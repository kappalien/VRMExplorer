use crate::portable::PortablePathService;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::Read,
    path::{Component, Path, PathBuf},
    sync::{Arc, Mutex},
    time::UNIX_EPOCH,
};
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;
pub type FsState = Arc<Mutex<Broker>>;
pub type FsResult<T> = Result<T, String>;
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub path: String,
    pub name: String,
    pub kind: String,
    pub size: u64,
    pub modified: u64,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Grant {
    pub path: String,
    pub directory: bool,
}
#[derive(Default)]
pub struct Broker {
    grants: HashMap<PathBuf, bool>,
}
pub fn display(path: &Path) -> String {
    let p = path.to_string_lossy();
    if let Some(s) = p.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{}", s)
    } else {
        p.strip_prefix(r"\\?\").unwrap_or(&p).into()
    }
}
pub fn safe_path(path: &Path) -> FsResult<PathBuf> {
    if !path.is_absolute() || path.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err("errors:unauthorized".into());
    }
    let mut current = PathBuf::new();
    for c in path.components() {
        current.push(c);
        if matches!(c, Component::Prefix(_)) {
            continue;
        }
        let meta = fs::symlink_metadata(&current).map_err(io_error)?;
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if meta.file_attributes() & 0x400 != 0 {
                return Err("errors:link".into());
            }
        }
        if meta.file_type().is_symlink() {
            return Err("errors:link".into());
        }
    }
    path.canonicalize().map_err(io_error)
}
pub fn io_error(e: std::io::Error) -> String {
    match e.kind() {
        std::io::ErrorKind::NotFound => "errors:missing",
        std::io::ErrorKind::PermissionDenied => "errors:denied",
        _ => "errors:filesystem",
    }
    .into()
}
impl Broker {
    pub fn grant(&mut self, path: &Path) -> FsResult<Grant> {
        let p = safe_path(path)?;
        let directory = p.is_dir();
        self.grants.insert(p.clone(), directory);
        Ok(Grant {
            path: display(&p),
            directory,
        })
    }
    pub fn resolve(&self, path: &str) -> FsResult<PathBuf> {
        let p = safe_path(Path::new(path))?;
        if self
            .grants
            .iter()
            .any(|(root, dir)| (&p == root) || (*dir && p.starts_with(root)))
        {
            Ok(p)
        } else {
            Err("errors:unauthorized".into())
        }
    }
    pub fn grants(&self) -> Vec<Grant> {
        let mut v: Vec<_> = self
            .grants
            .iter()
            .map(|(p, d)| Grant {
                path: display(p),
                directory: *d,
            })
            .collect();
        v.sort_by(|a, b| a.path.cmp(&b.path));
        v
    }
    pub fn browse(&mut self, path: &str) -> FsResult<Vec<Entry>> {
        let p = safe_path(Path::new(path))?;
        #[cfg(windows)]
        if !matches!(
            p.components().next(),
            Some(Component::Prefix(prefix))
                if matches!(prefix.kind(), std::path::Prefix::Disk(_) | std::path::Prefix::VerbatimDisk(_))
        ) {
            return Err("errors:unauthorized".into());
        }
        if !p.is_dir() {
            return Err("errors:filesystem".into());
        }
        let previous = self.grants.insert(p.clone(), true);
        let result = self.list(&display(&p));
        if result.is_err() {
            if let Some(value) = previous {
                self.grants.insert(p, value);
            } else {
                self.grants.remove(&p);
            }
        }
        result
    }
    pub fn list(&self, path: &str) -> FsResult<Vec<Entry>> {
        let p = self.resolve(path)?;
        let mut entries = Vec::new();
        for item in fs::read_dir(p).map_err(io_error)? {
            let item = item.map_err(io_error)?;
            let path = item.path();
            if safe_path(&path).is_err() {
                continue;
            }
            let meta = match item.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            entries.push(Entry {
                path: display(&path),
                name: item.file_name().to_string_lossy().into(),
                kind: if meta.is_dir() {
                    "folder".into()
                } else {
                    path.extension()
                        .map(|s| s.to_string_lossy().to_ascii_lowercase())
                        .unwrap_or_default()
                },
                size: meta.len(),
                modified: meta
                    .modified()
                    .ok()
                    .and_then(|v| v.duration_since(UNIX_EPOCH).ok())
                    .map(|v| v.as_millis() as u64)
                    .unwrap_or(0),
            });
            if entries.len() > 100_000 {
                return Err("errors:tooMany".into());
            }
        }
        Ok(entries)
    }
    pub fn read(&self, path: &str, limit: u64) -> FsResult<Vec<u8>> {
        let p = self.resolve(path)?;
        let mut file = fs::File::open(p).map_err(io_error)?;
        if file.metadata().map_err(io_error)?.len() > limit {
            return Err("errors:tooLarge".into());
        }
        let mut data = Vec::new();
        file.by_ref()
            .take(limit + 1)
            .read_to_end(&mut data)
            .map_err(io_error)?;
        if data.len() as u64 > limit {
            return Err("errors:tooLarge".into());
        }
        Ok(data)
    }
}
#[tauri::command]
pub async fn pick_asset(
    app: tauri::AppHandle,
    state: State<'_, FsState>,
    kind: String,
    title: String,
    start: Option<String>,
) -> FsResult<Option<Grant>> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut picker = app
            .dialog()
            .file()
            .set_title(title.chars().take(160).collect::<String>());
        if let Some(window) = app.get_webview_window("main") {
            picker = picker.set_parent(&window);
        }
        if let Some(start) = start {
            if Path::new(&start).is_absolute() {
                picker = picker.set_directory(start);
            }
        }
        let selected = match kind.as_str() {
            "folder" => picker.blocking_pick_folder(),
            "vrm" => picker.add_filter("VRM", &["vrm"]).blocking_pick_file(),
            "vrma" => picker.add_filter("VRMA", &["vrma"]).blocking_pick_file(),
            _ => return Err("errors:unsupported".into()),
        };
        selected
            .map(|p| {
                let path = p.into_path().map_err(|_| "errors:filesystem")?;
                state.lock().map_err(|_| "errors:storageBusy")?.grant(&path)
            })
            .transpose()
    })
    .await
    .map_err(|_| "errors:filesystem")?
}
#[tauri::command]
pub fn list_grants(state: State<'_, FsState>) -> FsResult<Vec<Grant>> {
    Ok(state.lock().map_err(|_| "errors:storageBusy")?.grants())
}
#[tauri::command]
pub fn revoke_grant(path: String, state: State<'_, FsState>) -> FsResult<()> {
    let mut s = state.lock().map_err(|_| "errors:storageBusy")?;
    s.grants.retain(|p, _| display(p) != path);
    Ok(())
}
#[tauri::command]
pub async fn list_directory(path: String, state: State<'_, FsState>) -> FsResult<Vec<Entry>> {
    let s = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        s.lock().map_err(|_| "errors:storageBusy")?.list(&path)
    })
    .await
    .map_err(|_| "errors:filesystem")?
}
#[tauri::command]
pub async fn browse_directory(path: String, state: State<'_, FsState>) -> FsResult<Vec<Entry>> {
    let s = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        s.lock().map_err(|_| "errors:storageBusy")?.browse(&path)
    })
    .await
    .map_err(|_| "errors:filesystem")?
}
#[tauri::command]
pub async fn read_asset(path: String, state: State<'_, FsState>) -> FsResult<tauri::ipc::Response> {
    let s = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let p = s.lock().map_err(|_| "errors:storageBusy")?;
        let resolved = p.resolve(&path)?;
        let ext = resolved
            .extension()
            .map(|v| v.to_string_lossy().to_ascii_lowercase())
            .unwrap_or_default();
        if !["vrm", "vrma", "png", "jpg", "jpeg", "webp", "bmp"].contains(&ext.as_str()) {
            return Err("errors:unsupported".into());
        }
        Ok(tauri::ipc::Response::new(p.read(&path, 256 * 1024 * 1024)?))
    })
    .await
    .map_err(|_| "errors:filesystem")?
}
#[tauri::command]
pub fn list_drives() -> Vec<String> {
    ('A'..='Z')
        .map(|c| format!("{c}:\\"))
        .filter(|p| Path::new(p).is_dir())
        .collect()
}
#[tauri::command]
pub async fn read_image(
    path: String,
    thumbnail: bool,
    state: State<'_, FsState>,
    cache: State<'_, crate::cache::CacheState>,
) -> FsResult<tauri::ipc::Response> {
    if thumbnail {
        return crate::cache::read_thumbnail(path, state, cache).await;
    }
    let s = state.inner().clone();
    let cache = cache.inner().clone();
    let permit = crate::cache::reserve(&cache)?;
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        let _decode = cache.decode.lock().map_err(|_| "errors:storageBusy")?;
        let bytes = {
            let broker = s.lock().map_err(|_| "errors:storageBusy")?;
            let p = broker.resolve(&path)?;
            let ext = p
                .extension()
                .map(|v| v.to_string_lossy().to_ascii_lowercase())
                .unwrap_or_default();
            if !["png", "jpg", "jpeg", "bmp", "webp"].contains(&ext.as_str()) {
                return Err("errors:unsupported".into());
            }
            broker.read(&path, 32 * 1024 * 1024)?
        };
        Ok(tauri::ipc::Response::new(crate::cache::encode_preview(
            &bytes, 4096,
        )?))
    })
    .await
    .map_err(|_| "errors:image")?
}
#[tauri::command]
pub async fn file_action(path: String, action: String, state: State<'_, FsState>) -> FsResult<()> {
    let s = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let p = s.lock().map_err(|_| "errors:storageBusy")?.resolve(&path)?;
        match action.as_str() {
            "copy" => arboard::Clipboard::new()
                .and_then(|mut c| c.set_text(display(&p)))
                .map_err(|_| "errors:clipboard".into()),
            "reveal" => {
                #[cfg(windows)]
                {
                    let exe = PathBuf::from(std::env::var_os("WINDIR").ok_or("errors:filesystem")?)
                        .join("explorer.exe");
                    std::process::Command::new(exe)
                        .arg(format!("/select,{}", display(&p)))
                        .spawn()
                        .map_err(io_error)?;
                    Ok(())
                }
                #[cfg(not(windows))]
                {
                    Err("errors:unsupported".into())
                }
            }
            _ => Err("errors:unsupported".into()),
        }
    })
    .await
    .map_err(|_| "errors:filesystem")?
}
#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExplorerPrefs {
    pub schema_version: u32,
    pub favorites: Vec<String>,
    pub recent: Vec<String>,
    pub view: String,
    #[serde(default)]
    pub last_path: String,
    #[serde(default)]
    pub last_source_id: Option<i64>,
}
#[tauri::command]
pub fn load_explorer(paths: State<'_, Mutex<PortablePathService>>) -> FsResult<ExplorerPrefs> {
    let p = paths.lock().map_err(|_| "errors:storageBusy")?;
    let path = p
        .managed_file("data/settings", "explorer.json")
        .map_err(io_error)?;
    if !path.exists() {
        return Ok(ExplorerPrefs {
            schema_version: 1,
            view: "details".into(),
            ..Default::default()
        });
    }
    serde_json::from_slice(&fs::read(path).map_err(io_error)?)
        .map_err(|_| "errors:invalidSettings".into())
}
#[tauri::command]
pub fn save_explorer(
    prefs: ExplorerPrefs,
    paths: State<'_, Mutex<PortablePathService>>,
) -> FsResult<()> {
    if prefs.schema_version != 1
        || prefs.last_path.len() > 32768
        || prefs.last_source_id.is_some_and(|id| id <= 0)
        || prefs.favorites.len() > 200
        || prefs.recent.len() > 30
        || !['l', 'd', 't'].contains(&prefs.view.chars().next().unwrap_or(' '))
        || prefs
            .favorites
            .iter()
            .chain(&prefs.recent)
            .any(|p| p.len() > 32768)
    {
        return Err("errors:invalidSettings".into());
    }
    let p = paths.lock().map_err(|_| "errors:storageBusy")?;
    p.write_json("explorer.json", &prefs).map_err(io_error)
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn explorer_location_preferences_are_backward_compatible_and_persist() {
        let legacy = br#"{"schemaVersion":1,"favorites":[],"recent":[],"view":"details"}"#;
        let mut prefs: ExplorerPrefs = serde_json::from_slice(legacy).unwrap();
        assert!(prefs.last_path.is_empty());
        assert_eq!(prefs.last_source_id, None);
        prefs.last_path = "C:\\Models".into();
        prefs.last_source_id = Some(3);
        let temp = tempfile::tempdir().unwrap();
        let paths = PortablePathService::for_test(temp.path()).unwrap();
        paths.write_json("explorer.json", &prefs).unwrap();
        let restored: ExplorerPrefs = serde_json::from_slice(
            &fs::read(
                paths
                    .managed_file("data/settings", "explorer.json")
                    .unwrap(),
            )
            .unwrap(),
        )
        .unwrap();
        assert_eq!(restored.last_path, prefs.last_path);
        assert_eq!(restored.last_source_id, Some(3));
    }
    #[test]
    fn direct_browsing_grants_only_valid_local_directories_and_preserves_assets() {
        let temp = tempfile::tempdir().unwrap();
        let folder = temp.path().join("中文 folder");
        fs::create_dir(&folder).unwrap();
        let file = folder.join("model.vrm");
        fs::write(&file, b"original").unwrap();
        let mut broker = Broker::default();
        assert!(broker.resolve(&display(&file)).is_err());
        assert_eq!(broker.browse(&display(&folder)).unwrap().len(), 1);
        assert_eq!(broker.read(&display(&file), 100).unwrap(), b"original");
        assert!(broker.browse(&display(&file)).is_err());
        assert!(broker
            .browse(&display(&temp.path().join("missing")))
            .is_err());
        assert!(broker.browse(&display(&folder.join("../"))).is_err());
        assert_eq!(broker.grants().len(), 1);
        assert_eq!(fs::read(file).unwrap(), b"original");
    }
    #[test]
    fn authorization_unicode_and_revocation() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().join("中文 folder");
        fs::create_dir(&root).unwrap();
        fs::write(root.join("照片.png"), b"read-only").unwrap();
        let outside = tmp.path().join("private.txt");
        fs::write(&outside, b"private").unwrap();
        let mut b = Broker::default();
        b.grant(&root).unwrap();
        assert_eq!(b.list(&display(&root)).unwrap().len(), 1);
        assert!(b.read(&display(&outside), 100).is_err());
        assert!(b.resolve(&display(&root.join("../private.txt"))).is_err());
        assert_eq!(
            b.read(&display(&root.join("照片.png")), 100).unwrap(),
            b"read-only"
        );
        b.grants.clear();
        assert!(b.resolve(&display(&root)).is_err());
    }
    #[test]
    fn missing_and_size_limits() {
        let t = tempfile::tempdir().unwrap();
        let f = t.path().join("a.png");
        fs::write(&f, b"123456").unwrap();
        let mut b = Broker::default();
        b.grant(&f).unwrap();
        assert!(b.read(&display(&f), 4).is_err());
        assert!(b.resolve(&display(&t.path().join("gone"))).is_err());
    }
}
