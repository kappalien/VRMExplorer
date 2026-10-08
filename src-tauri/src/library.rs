use crate::{
    filesystem::{display, io_error, pick_asset, safe_path, FsResult, FsState},
    portable::PortablePathService,
};
use rusqlite::{params, Connection};
use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{Manager, State};
pub type LibraryState = Arc<Mutex<Library>>;
pub struct Library {
    pub connection: Connection,
    pub root: PathBuf,
    pub cancellation: Arc<AtomicBool>,
    pub running: bool,
    pub progress: u64,
    pub status: String,
}
fn db_error(_: rusqlite::Error) -> String {
    "errors:database".into()
}
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    pub id: i64,
    pub display_name: String,
    pub path: String,
    pub path_kind: String,
    pub recursive: bool,
    pub enabled: bool,
    pub last_scan_at: Option<i64>,
    pub scan_status: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Motion {
    pub id: i64,
    pub source_id: i64,
    pub path: String,
    pub file_name: String,
    pub file_size: i64,
    pub modified_time: i64,
    pub favorite: bool,
    pub last_used_at: Option<i64>,
    pub missing: bool,
    pub duration: Option<f64>,
}
#[derive(Serialize)]
pub struct Snapshot {
    pub sources: Vec<Source>,
    pub motions: Vec<Motion>,
    pub running: bool,
    pub progress: u64,
    pub status: String,
}
impl Library {
    pub fn open(paths: &PortablePathService) -> FsResult<Self> {
        let file = paths
            .managed_file("data/database", "vrm-explorer.db")
            .map_err(io_error)?;
        let mut connection = Connection::open(file).map_err(db_error)?;
        connection
            .busy_timeout(std::time::Duration::from_secs(5))
            .map_err(db_error)?;
        // DELETE journal: no live standalone .db backups; migration backups use SQLite online backup API.
        connection
            .execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE;")
            .map_err(db_error)?;
        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .map_err(db_error)?;
        if version > 1 {
            return Err("errors:databaseVersion".into());
        }
        if version == 0 {
            let backup = paths
                .managed("data/database")
                .map_err(io_error)?
                .join(format!("before-schema1-{}.db", now()));
            connection.backup("main", &backup, None).map_err(db_error)?;
            let tx = connection.transaction().map_err(db_error)?;
            tx.execute_batch("CREATE TABLE sources(id INTEGER PRIMARY KEY,display_name TEXT NOT NULL,path TEXT NOT NULL,path_kind TEXT NOT NULL,recursive INTEGER NOT NULL DEFAULT 1,enabled INTEGER NOT NULL DEFAULT 1,last_scan_at INTEGER,scan_status TEXT NOT NULL DEFAULT 'idle');
CREATE TABLE motions(id INTEGER PRIMARY KEY,source_id INTEGER NOT NULL REFERENCES sources(id),rel_path TEXT NOT NULL,file_name TEXT NOT NULL,file_size INTEGER NOT NULL,modified_time INTEGER NOT NULL,favorite INTEGER NOT NULL DEFAULT 0,last_used_at INTEGER,duration REAL,missing INTEGER NOT NULL DEFAULT 0,seen INTEGER NOT NULL DEFAULT 0,UNIQUE(source_id,rel_path));
CREATE INDEX motion_name ON motions(file_name); PRAGMA user_version=1;").map_err(db_error)?;
            tx.commit().map_err(db_error)?;
        }
        Ok(Self {
            connection,
            root: paths.root.clone(),
            cancellation: Arc::new(AtomicBool::new(false)),
            running: false,
            progress: 0,
            status: "idle".into(),
        })
    }
    fn source_path(&self, stored: &str, kind: &str) -> PathBuf {
        if kind == "portableRelative" {
            self.root.join(stored)
        } else {
            PathBuf::from(stored)
        }
    }
    pub fn set_source(&mut self, id: Option<i64>, path: &str) -> FsResult<i64> {
        let p = crate::filesystem::safe_path(Path::new(path))?;
        if !p.is_dir() {
            return Err("errors:filesystem".into());
        }
        let (stored, kind) = if let Ok(relative) = p.strip_prefix(&self.root) {
            (relative.to_string_lossy().to_string(), "portableRelative")
        } else {
            (display(&p), "externalAbsolute")
        };
        let name = p
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| display(&p));
        if let Some(id) = id {
            if self.connection.execute("UPDATE sources SET path=?1,path_kind=?2,display_name=?3,scan_status='idle' WHERE id=?4",params![stored,kind,name,id]).map_err(db_error)?!=1{return Err("errors:missing".into());}
            Ok(id)
        } else {
            self.connection
                .execute(
                    "INSERT INTO sources(display_name,path,path_kind) VALUES(?1,?2,?3)",
                    params![name, stored, kind],
                )
                .map_err(db_error)?;
            Ok(self.connection.last_insert_rowid())
        }
    }
    fn record(&self, canonical: &Path, duration: f64, played: bool) -> FsResult<()> {
        if !duration.is_finite() || duration < 0.0 {
            return Err("errors:animation".into());
        }
        for motion in self.snapshot("")?.motions {
            if motion.path.eq_ignore_ascii_case(&display(canonical)) {
                self.connection.execute("UPDATE motions SET duration=?1,last_used_at=CASE WHEN ?2 THEN ?3 ELSE last_used_at END WHERE id=?4", params![duration,played,now(),motion.id]).map_err(db_error)?;
            }
        }
        Ok(())
    }
    pub fn snapshot(&self, query: &str) -> FsResult<Snapshot> {
        let mut statement=self.connection.prepare("SELECT id,display_name,path,path_kind,recursive,enabled,last_scan_at,scan_status FROM sources ORDER BY display_name").map_err(db_error)?;
        let sources = statement
            .query_map([], |r| {
                Ok(Source {
                    id: r.get(0)?,
                    display_name: r.get(1)?,
                    path: display(
                        &self.source_path(&r.get::<_, String>(2)?, &r.get::<_, String>(3)?),
                    ),
                    path_kind: r.get(3)?,
                    recursive: r.get(4)?,
                    enabled: r.get(5)?,
                    last_scan_at: r.get(6)?,
                    scan_status: r.get(7)?,
                })
            })
            .map_err(db_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db_error)?;
        let mut statement=self.connection.prepare("SELECT m.id,m.source_id,s.path,s.path_kind,m.rel_path,m.file_name,m.file_size,m.modified_time,m.favorite,m.last_used_at,m.missing,m.duration FROM motions m JOIN sources s ON s.id=m.source_id WHERE instr(lower(m.file_name),lower(?1))>0 ORDER BY m.favorite DESC,m.last_used_at DESC,m.file_name LIMIT 10000").map_err(db_error)?;
        let motions = statement
            .query_map([query], |r| {
                Ok(Motion {
                    id: r.get(0)?,
                    source_id: r.get(1)?,
                    path: display(
                        &self
                            .source_path(&r.get::<_, String>(2)?, &r.get::<_, String>(3)?)
                            .join(r.get::<_, String>(4)?),
                    ),
                    file_name: r.get(5)?,
                    file_size: r.get(6)?,
                    modified_time: r.get(7)?,
                    favorite: r.get(8)?,
                    last_used_at: r.get(9)?,
                    missing: r.get(10)?,
                    duration: r.get(11)?,
                })
            })
            .map_err(db_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db_error)?;
        Ok(Snapshot {
            sources,
            motions,
            running: self.running,
            progress: self.progress,
            status: self.status.clone(),
        })
    }
    fn relink(&mut self, id: i64, path: &Path) -> FsResult<()> {
        let p = safe_path(path)?;
        if p.extension()
            .and_then(|v| v.to_str())
            .is_none_or(|v| !v.eq_ignore_ascii_case("vrma"))
        {
            return Err("errors:unsupported".into());
        }
        let metadata = p.metadata().map_err(io_error)?;
        let l = self;
        if l.running {
            return Err("errors:scanBusy".into());
        }
        let exists: bool = l
            .connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM motions WHERE id=?1)",
                [id],
                |r| r.get(0),
            )
            .map_err(db_error)?;
        if !exists {
            return Err("errors:missing".into());
        }
        let parent = p.parent().ok_or("errors:filesystem")?;
        // A replacement outside the existing source gets its own visible source.
        // The file grant never implicitly grants permission to read its siblings.
        let sources = l.snapshot("")?.sources;
        let source_id = if let Some(source) = sources
            .iter()
            .find(|s| Path::new(&s.path) == Path::new(&display(parent)))
        {
            source.id
        } else {
            l.set_source(None, &display(parent))?
        };
        let relative = p
            .file_name()
            .ok_or("errors:filesystem")?
            .to_string_lossy()
            .to_string();
        let duplicate: bool = l.connection.query_row("SELECT EXISTS(SELECT 1 FROM motions WHERE source_id=?1 AND rel_path=?2 AND id<>?3)", params![source_id,relative,id], |r|r.get(0)).map_err(db_error)?;
        if duplicate {
            return Err("errors:alreadyIndexed".into());
        }
        l.connection.execute("UPDATE motions SET source_id=?1,rel_path=?2,file_name=?2,file_size=?3,modified_time=?4,missing=0,duration=NULL WHERE id=?5", params![source_id,relative,metadata.len() as i64,metadata.modified().ok().and_then(|v|v.duration_since(UNIX_EPOCH).ok()).map(|v|v.as_millis() as i64).unwrap_or(0),id]).map_err(db_error)?;
        Ok(())
    }
}
#[tauri::command]
pub async fn relink_motion(app: tauri::AppHandle, id: i64, title: String) -> FsResult<bool> {
    let grant = pick_asset(
        app.clone(),
        app.state::<FsState>(),
        "vrma".into(),
        title,
        None,
    )
    .await?;
    let Some(grant) = grant else { return Ok(false) };
    let state = app.state::<LibraryState>();
    state
        .lock()
        .map_err(|_| "errors:storageBusy")?
        .relink(id, Path::new(&grant.path))?;
    Ok(true)
}

#[tauri::command]
pub async fn record_motion(
    path: String,
    duration: f64,
    played: bool,
    state: State<'_, LibraryState>,
    broker: State<'_, FsState>,
) -> FsResult<()> {
    let broker = broker.inner().clone();
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let canonical = broker
            .lock()
            .map_err(|_| "errors:storageBusy")?
            .resolve(&path)?;
        let l = state.lock().map_err(|_| "errors:storageBusy")?;
        l.record(&canonical, duration, played)
    })
    .await
    .map_err(|_| "errors:database")?
}
#[tauri::command]
pub async fn choose_source(
    app: tauri::AppHandle,
    id: Option<i64>,
    title: String,
) -> FsResult<Option<i64>> {
    let grant = pick_asset(
        app.clone(),
        app.state::<FsState>(),
        "folder".into(),
        title,
        None,
    )
    .await?;
    let Some(grant) = grant else { return Ok(None) };
    let state = app.state::<LibraryState>();
    let mut library = state.lock().map_err(|_| "errors:storageBusy")?;
    if library.running {
        return Err("errors:scanBusy".into());
    }
    Ok(Some(library.set_source(id, &grant.path)?))
}
#[tauri::command]
pub async fn library_snapshot(query: String, state: State<'_, LibraryState>) -> FsResult<Snapshot> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        state
            .lock()
            .map_err(|_| "errors:storageBusy")?
            .snapshot(&query)
    })
    .await
    .map_err(|_| "errors:database")?
}
#[tauri::command]
pub fn library_action(id: i64, action: String, state: State<'_, LibraryState>) -> FsResult<()> {
    let l = state.lock().map_err(|_| "errors:storageBusy")?;
    let sql = match action.as_str() {
        "favorite" => "UPDATE motions SET favorite=NOT favorite WHERE id=?1",
        "used" => "UPDATE motions SET last_used_at=?2 WHERE id=?1",
        "toggle" => "UPDATE sources SET enabled=NOT enabled WHERE id=?1",
        "recursive" => "UPDATE sources SET recursive=NOT recursive WHERE id=?1",
        _ => return Err("errors:unsupported".into()),
    };
    if action == "used" {
        l.connection
            .execute(sql, params![id, now()])
            .map_err(db_error)?;
    } else {
        l.connection.execute(sql, [id]).map_err(db_error)?;
    }
    Ok(())
}
#[tauri::command]
pub fn cancel_scan(state: State<'_, LibraryState>) -> FsResult<()> {
    state
        .lock()
        .map_err(|_| "errors:storageBusy")?
        .cancellation
        .store(true, Ordering::Relaxed);
    Ok(())
}
fn scan_source(
    id: i64,
    root: PathBuf,
    recursive: bool,
    broker: FsState,
    state: LibraryState,
    cancel: Arc<AtomicBool>,
) -> FsResult<()> {
    let root = PathBuf::from(display(&safe_path(&root)?));
    let stamp = now();
    let mut stack = vec![(root.clone(), 0usize)];
    let mut batch = Vec::new();
    let mut incomplete = false;
    let mut visited = 0u64;
    while let Some((directory, depth)) = stack.pop() {
        if cancel.load(Ordering::Relaxed) {
            return Err("errors:cancelled".into());
        }
        let entries = broker
            .lock()
            .map_err(|_| "errors:storageBusy")?
            .list(&display(&directory))?;
        for entry in entries {
            if cancel.load(Ordering::Relaxed) {
                return Err("errors:cancelled".into());
            }
            visited += 1;
            if visited > 200000 {
                return Err("errors:tooMany".into());
            }
            if entry.kind == "folder" && recursive {
                if depth < 64 {
                    stack.push((PathBuf::from(entry.path), depth + 1));
                } else {
                    incomplete = true;
                }
            } else if entry.kind == "vrma" {
                let p = PathBuf::from(&entry.path);
                let relative = p
                    .strip_prefix(&root)
                    .map_err(|_| "errors:unauthorized")?
                    .to_string_lossy()
                    .to_string();
                batch.push((
                    relative,
                    entry.name,
                    entry.size as i64,
                    entry.modified as i64,
                ));
            }
            if batch.len() >= 100 {
                write_batch(id, stamp, &mut batch, &state, visited)?;
            }
        }
        state.lock().map_err(|_| "errors:storageBusy")?.progress = visited;
    }
    write_batch(id, stamp, &mut batch, &state, visited)?;
    let l = state.lock().map_err(|_| "errors:storageBusy")?;
    if !incomplete {
        l.connection
            .execute(
                "UPDATE motions SET missing=(seen<>?1) WHERE source_id=?2",
                params![stamp, id],
            )
            .map_err(db_error)?;
    }
    l.connection
        .execute(
            "UPDATE sources SET last_scan_at=?1,scan_status=?2 WHERE id=?3",
            params![stamp, if incomplete { "partial" } else { "complete" }, id],
        )
        .map_err(db_error)?;
    Ok(())
}
fn write_batch(
    id: i64,
    stamp: i64,
    batch: &mut Vec<(String, String, i64, i64)>,
    state: &LibraryState,
    visited: u64,
) -> FsResult<()> {
    let mut l = state.lock().map_err(|_| "errors:storageBusy")?;
    let tx = l.connection.transaction().map_err(db_error)?;
    for (path, name, size, modified) in batch.drain(..) {
        tx.execute("INSERT INTO motions(source_id,rel_path,file_name,file_size,modified_time,seen) VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(source_id,rel_path) DO UPDATE SET duration=CASE WHEN motions.file_size<>excluded.file_size OR motions.modified_time<>excluded.modified_time THEN NULL ELSE motions.duration END,file_name=excluded.file_name,file_size=excluded.file_size,modified_time=excluded.modified_time,seen=excluded.seen,missing=0",params![id,path,name,size,modified,stamp]).map_err(db_error)?;
    }
    tx.commit().map_err(db_error)?;
    l.progress = visited;
    Ok(())
}
#[tauri::command]
pub fn start_scan(
    id: i64,
    state: State<'_, LibraryState>,
    broker: State<'_, FsState>,
) -> FsResult<()> {
    let s = state.inner().clone();
    let b = broker.inner().clone();
    let (path, recursive, cancel) = {
        let mut l = s.lock().map_err(|_| "errors:storageBusy")?;
        if l.running {
            return Err("errors:scanBusy".into());
        }
        let (stored, kind, recursive, enabled): (String, String, bool, bool) = l
            .connection
            .query_row(
                "SELECT path,path_kind,recursive,enabled FROM sources WHERE id=?1",
                [id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .map_err(db_error)?;
        if !enabled {
            return Err("errors:sourceDisabled".into());
        }
        let p = l.source_path(&stored, &kind);
        b.lock()
            .map_err(|_| "errors:storageBusy")?
            .resolve(&display(&p))?;
        l.cancellation.store(false, Ordering::Relaxed);
        l.running = true;
        l.progress = 0;
        l.status = "scanning".into();
        l.connection
            .execute(
                "UPDATE sources SET scan_status='scanning' WHERE id=?1",
                [id],
            )
            .map_err(db_error)?;
        (p, recursive, l.cancellation.clone())
    };
    tauri::async_runtime::spawn_blocking(move || {
        let result = scan_source(id, path, recursive, b, s.clone(), cancel);
        if let Ok(mut l) = s.lock() {
            l.running = false;
            l.status = match result {
                Ok(()) => "complete".into(),
                Err(e) => e,
            };
            let _ = l.connection.execute(
                "UPDATE sources SET scan_status=?1 WHERE id=?2 AND scan_status='scanning'",
                params![l.status, id],
            );
        }
    });
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn individual_relink_preserves_identity_and_rejects_duplicates() {
        let t = tempfile::tempdir().unwrap();
        let paths = PortablePathService::for_test(t.path()).unwrap();
        let source = t.path().join("original");
        let replacement = t.path().join("replacement");
        std::fs::create_dir(&source).unwrap();
        std::fs::create_dir(&replacement).unwrap();
        let chosen = replacement.join("替代.vrma");
        std::fs::write(&chosen, b"index fixture").unwrap();
        let mut l = Library::open(&paths).unwrap();
        let source_id = l.set_source(None, &display(&source)).unwrap();
        l.connection.execute("INSERT INTO motions(source_id,rel_path,file_name,file_size,modified_time,favorite,last_used_at,missing,duration) VALUES(?1,'old.vrma','old.vrma',1,0,1,123,1,5)", [source_id]).unwrap();
        let id = l.connection.last_insert_rowid();
        l.relink(id, &chosen).unwrap();
        let snapshot = l.snapshot("").unwrap();
        let motion = &snapshot.motions[0];
        assert_eq!(motion.id, id);
        assert!(motion.favorite);
        assert_eq!(motion.last_used_at, Some(123));
        assert!(!motion.missing);
        assert_eq!(motion.duration, None);
        assert_eq!(motion.file_name, "替代.vrma");
        assert_eq!(snapshot.sources.len(), 2);
        l.record(&safe_path(&chosen).unwrap(), 2.5, false).unwrap();
        assert_eq!(l.snapshot("").unwrap().motions[0].duration, Some(2.5));
        assert_eq!(l.snapshot("").unwrap().motions[0].last_used_at, Some(123));
        l.record(&safe_path(&chosen).unwrap(), 2.5, true).unwrap();
        assert!(l.snapshot("").unwrap().motions[0].last_used_at.unwrap() > 123);
        assert_eq!(
            l.record(&chosen, f64::NAN, true).unwrap_err(),
            "errors:animation"
        );
        l.record(&safe_path(&chosen).unwrap(), 0.0, false).unwrap();
        assert_eq!(l.snapshot("").unwrap().motions[0].duration, Some(0.0));
        assert!(l.record(&chosen, -1.0, false).is_err());
        l.connection.execute("INSERT INTO motions(source_id,rel_path,file_name,file_size,modified_time,favorite,missing) VALUES(?1,'another.vrma','another.vrma',1,0,1,1)", [source_id]).unwrap();
        let other = l.connection.last_insert_rowid();
        assert_eq!(
            l.relink(other, &chosen).unwrap_err(),
            "errors:alreadyIndexed"
        );
        assert_eq!(l.snapshot("").unwrap().motions.len(), 2);
        assert!(
            l.snapshot("")
                .unwrap()
                .motions
                .iter()
                .find(|m| m.id == other)
                .unwrap()
                .missing
        );
    }
    #[test]
    fn rescan_preserves_favorites_and_missing() {
        let t = tempfile::tempdir().unwrap();
        let paths = PortablePathService::for_test(t.path()).unwrap();
        let source = t.path().join("motions");
        std::fs::create_dir(&source).unwrap();
        let file = source.join("中文.vrma");
        std::fs::write(&file, b"fixture").unwrap();
        let mut l = Library::open(&paths).unwrap();
        let id = l.set_source(None, &display(&source)).unwrap();
        let state = Arc::new(Mutex::new(l));
        let mut b = crate::filesystem::Broker::default();
        b.grant(&source).unwrap();
        let b = Arc::new(Mutex::new(b));
        let cancel = Arc::new(AtomicBool::new(false));
        scan_source(
            id,
            source.clone(),
            true,
            b.clone(),
            state.clone(),
            cancel.clone(),
        )
        .unwrap();
        state
            .lock()
            .unwrap()
            .connection
            .execute("UPDATE motions SET favorite=1,duration=3.5", [])
            .unwrap();
        std::fs::write(&file, b"modified index fixture").unwrap();
        scan_source(
            id,
            source.clone(),
            true,
            b.clone(),
            state.clone(),
            cancel.clone(),
        )
        .unwrap();
        assert_eq!(
            state.lock().unwrap().snapshot("").unwrap().motions[0].duration,
            None
        );
        std::fs::remove_file(&file).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(2));
        scan_source(id, source, true, b, state.clone(), cancel).unwrap();
        let s = state.lock().unwrap().snapshot("").unwrap();
        assert_eq!(s.motions.len(), 1);
        assert!(s.motions[0].favorite);
        assert!(s.motions[0].missing);
        assert_eq!(s.sources[0].path_kind, "portableRelative");
    }

    #[test]
    fn cancelled_scan_preserves_index_and_reopen_preserves_favorites() {
        let t = tempfile::tempdir().unwrap();
        let paths = PortablePathService::for_test(t.path()).unwrap();
        let source = t.path().join("motions");
        std::fs::create_dir(&source).unwrap();
        let file = source.join("motion.vrma");
        std::fs::write(&file, b"index fixture").unwrap();
        let mut library = Library::open(&paths).unwrap();
        let id = library.set_source(None, &display(&source)).unwrap();
        let state = Arc::new(Mutex::new(library));
        let mut broker = crate::filesystem::Broker::default();
        broker.grant(&source).unwrap();
        let broker = Arc::new(Mutex::new(broker));
        let cancel = Arc::new(AtomicBool::new(false));
        scan_source(
            id,
            source.clone(),
            true,
            broker.clone(),
            state.clone(),
            cancel.clone(),
        )
        .unwrap();
        state
            .lock()
            .unwrap()
            .connection
            .execute("UPDATE motions SET favorite=1,last_used_at=123", [])
            .unwrap();
        std::fs::remove_file(file).unwrap();
        cancel.store(true, Ordering::Relaxed);
        assert_eq!(
            scan_source(id, source, true, broker, state.clone(), cancel).unwrap_err(),
            "errors:cancelled"
        );
        assert!(!state.lock().unwrap().snapshot("").unwrap().motions[0].missing);
        drop(state);
        let reopened = Library::open(&paths).unwrap().snapshot("").unwrap();
        assert!(reopened.motions[0].favorite);
        assert_eq!(reopened.motions[0].last_used_at, Some(123));
        assert_eq!(reopened.sources.len(), 1);
    }
}
