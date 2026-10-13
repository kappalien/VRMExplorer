use crate::{portable::PortablePathService, update_core as core};
use serde::Serialize;
use std::{
    fs::{self, File},
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::State;
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    phase: String,
    version: String,
    notes_zh: String,
    notes_en: String,
    downloaded: u64,
    total: u64,
    runtime_extra: bool,
    error: String,
    result: String,
    supported: bool,
    automatic: bool,
}
struct Inner {
    snapshot: Snapshot,
    signed: Option<Vec<u8>>,
    manifest: Option<core::Manifest>,
    job: Option<String>,
    checked: Option<Instant>,
}
#[derive(Clone)]
pub struct UpdateService {
    root: PathBuf,
    inner: Arc<Mutex<Inner>>,
    cancel: Arc<AtomicBool>,
}
impl UpdateService {
    pub fn new(root: PathBuf) -> Self {
        let supported = installed(&root).is_ok();
        let automatic = core::safe(&root, "data/settings/update-preferences.json")
            .ok()
            .and_then(|p| core::read_limited(&p, 4096).ok())
            .and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok())
            .and_then(|v| v.get("automatic").and_then(|v| v.as_bool()))
            .unwrap_or(false);
        let result = core::safe(&root, "data/updates/result.json")
            .ok()
            .and_then(|p| core::read_limited(&p, 4096).ok())
            .and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok())
            .and_then(|v| v.get("state").and_then(|v| v.as_str()).map(String::from))
            .unwrap_or_default();
        Self {
            root,
            inner: Arc::new(Mutex::new(Inner {
                snapshot: Snapshot {
                    phase: "idle".into(),
                    version: String::new(),
                    notes_zh: String::new(),
                    notes_en: String::new(),
                    downloaded: 0,
                    total: 0,
                    runtime_extra: false,
                    error: String::new(),
                    result,
                    supported,
                    automatic,
                },
                signed: None,
                manifest: None,
                job: None,
                checked: None,
            })),
            cancel: Arc::new(AtomicBool::new(false)),
        }
    }
    pub fn start_automatic_check(&self) {
        if self.snapshot().is_ok_and(|s| s.supported && s.automatic) {
            let service = self.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(1500));
                let _ = service.check();
            });
        }
    }
    fn mutate(&self, f: impl FnOnce(&mut Inner)) -> core::Result<()> {
        let mut guard = self.inner.lock().map_err(|_| "updates:busy")?;
        f(&mut guard);
        Ok(())
    }
    fn snapshot(&self) -> core::Result<Snapshot> {
        let mut snapshot = self
            .inner
            .lock()
            .map_err(|_| "updates:busy")?
            .snapshot
            .clone();
        if let Some(result) = core::safe(&self.root, "data/updates/result.json")
            .ok()
            .and_then(|p| core::read_limited(&p, 4096).ok())
            .and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok())
            .and_then(|v| v.get("state").and_then(|v| v.as_str()).map(String::from))
        {
            snapshot.result = result;
        }
        Ok(snapshot)
    }
    fn enter(&self, phase: &str) -> core::Result<()> {
        let mut state = self.inner.lock().map_err(|_| "updates:busy")?;
        if ["checking", "downloading", "handoff"].contains(&state.snapshot.phase.as_str()) {
            return Err("updates:busy".into());
        }
        if !state.snapshot.supported {
            return Err("updates:notPortable".into());
        }
        state.snapshot.phase = phase.into();
        state.snapshot.error.clear();
        self.cancel.store(false, Ordering::SeqCst);
        Ok(())
    }
    fn error(&self, error: &str) {
        let _ = self.mutate(|s| {
            s.snapshot.phase = "error".into();
            s.snapshot.error = error.into();
        });
    }
    fn check(&self) -> core::Result<Snapshot> {
        {
            let s = self.inner.lock().map_err(|_| "updates:busy")?;
            if s.checked
                .is_some_and(|t| t.elapsed() < Duration::from_secs(60))
                && s.manifest.is_some()
                && ["current", "available"].contains(&s.snapshot.phase.as_str())
            {
                return Ok(s.snapshot.clone());
            }
        }
        self.enter("checking")?;
        let result = (|| {
            let current = installed(&self.root)?;
            let bytes = fetch_small(core::FEED)?;
            let m = core::verify(&bytes)?;
            if self.cancel.load(Ordering::SeqCst) {
                return Err("updates:cancelled".into());
            }
            let newer = core::version(&m.version)? > core::version(env!("CARGO_PKG_VERSION"))?;
            let runtime =
                current.get("runtimeVersion").and_then(|v| v.as_str()) != Some(&m.runtime_version);
            if newer && runtime && m.runtime.is_none() {
                return Err("updates:runtime".into());
            }
            self.mutate(|s| {
                s.snapshot.phase = if newer { "available" } else { "current" }.into();
                s.snapshot.version = m.version.clone();
                s.snapshot.notes_zh = m.notes_zh.clone();
                s.snapshot.notes_en = m.notes_en.clone();
                s.snapshot.runtime_extra = runtime;
                s.snapshot.total = m.app.size
                    + if runtime {
                        m.runtime.as_ref().map_or(0, |p| p.size)
                    } else {
                        0
                    };
                s.signed = Some(bytes);
                s.manifest = Some(m);
                s.checked = Some(Instant::now());
                s.job = None;
            })?;
            self.snapshot()
        })();
        if let Err(e) = &result {
            self.error(e);
        }
        result
    }
    fn prepare(&self) -> core::Result<Snapshot> {
        let (signed, m) = {
            let s = self.inner.lock().map_err(|_| "updates:busy")?;
            if s.snapshot.phase != "available" {
                return Err("updates:invalid".into());
            }
            (
                s.signed.clone().ok_or("updates:invalid")?,
                s.manifest.clone().ok_or("updates:invalid")?,
            )
        };
        self.enter("downloading")?;
        let result = (|| {
            let current = installed(&self.root)?;
            let runtime =
                current.get("runtimeVersion").and_then(|v| v.as_str()) != Some(&m.runtime_version);
            let jobs = core::safe(&self.root, "data/updates/jobs")?;
            fs::create_dir_all(&jobs).map_err(|_| "updates:storage")?;
            let dir = tempfile::Builder::new()
                .prefix("job-")
                .tempdir_in(jobs)
                .map_err(|_| "updates:storage")?;
            let job = dir.path();
            let id = job
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or("updates:invalid")?
                .to_string();
            fs::write(core::safe(job, "signed.json")?, signed).map_err(|_| "updates:storage")?;
            self.mutate(|s| {
                s.snapshot.downloaded = 0;
                s.snapshot.total = m.app.size
                    + if runtime {
                        m.runtime.as_ref().map_or(0, |p| p.size)
                    } else {
                        0
                    };
            })?;
            self.download(&m.app, &core::safe(job, "app.zip")?)?;
            let stage = core::safe(job, "stage")?;
            fs::create_dir(&stage).map_err(|_| "updates:storage")?;
            core::extract(&core::safe(job, "app.zip")?, &m.app, &stage, false)?;
            if runtime {
                let p = m.runtime.as_ref().ok_or("updates:runtime")?;
                self.download(p, &core::safe(job, "runtime.zip")?)?;
                core::extract(&core::safe(job, "runtime.zip")?, p, &stage, true)?;
            }
            if self.cancel.load(Ordering::SeqCst) {
                return Err("updates:cancelled".into());
            }
            let next: serde_json::Value = serde_json::from_slice(&core::read_limited(
                &core::safe(&stage, "release.json")?,
                2 * 1024 * 1024,
            )?)
            .map_err(|_| "updates:invalid")?;
            if next.get("version").and_then(|v| v.as_str()) != Some(&m.version) {
                return Err("updates:invalid".into());
            }
            let _path = dir.keep();
            self.mutate(|s| {
                s.job = Some(id);
                s.snapshot.phase = "ready".into();
            })?;
            self.snapshot()
        })();
        if let Err(e) = &result {
            self.error(e);
        }
        result
    }
    fn download(&self, p: &core::Package, destination: &Path) -> core::Result<()> {
        let mut response = client()?
            .get(&p.url)
            .send()
            .map_err(|_| "updates:network")?
            .error_for_status()
            .map_err(|_| "updates:network")?;
        if response.content_length().is_some_and(|n| n != p.size) {
            return Err("updates:checksum".into());
        }
        let mut out = File::options()
            .write(true)
            .create_new(true)
            .open(destination)
            .map_err(|_| "updates:storage")?;
        let mut count = 0u64;
        let mut buffer = [0u8; 65536];
        loop {
            if self.cancel.load(Ordering::SeqCst) {
                return Err("updates:cancelled".into());
            }
            let n = response.read(&mut buffer).map_err(|_| "updates:network")?;
            if n == 0 {
                break;
            }
            count += n as u64;
            if count > p.size {
                return Err("updates:checksum".into());
            }
            out.write_all(&buffer[..n]).map_err(|_| "updates:storage")?;
            self.mutate(|s| s.snapshot.downloaded += n as u64)?;
        }
        out.sync_all().map_err(|_| "updates:storage")?;
        if count != p.size || core::hash(destination)? != p.sha256 {
            return Err("updates:checksum".into());
        }
        Ok(())
    }
}
fn installed(root: &Path) -> core::Result<serde_json::Value> {
    let path = core::safe(root, "release.json")?;
    let value: serde_json::Value =
        serde_json::from_slice(&core::read_limited(&path, 2 * 1024 * 1024)?)
            .map_err(|_| "updates:notPortable")?;
    if value.get("version").and_then(|v| v.as_str()) != Some(env!("CARGO_PKG_VERSION"))
        || value.get("runtimeMode").and_then(|v| v.as_str()) != Some("fixed")
        || !core::safe(root, "runtime/webview2/msedgewebview2.exe")?.is_file()
    {
        return Err("updates:notPortable".into());
    }
    Ok(value)
}
fn client() -> core::Result<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .https_only(true)
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(180))
        .user_agent("VRMExplorer-updater/1")
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            let host = attempt.url().host_str().unwrap_or("");
            if attempt.previous().len() >= 5
                || attempt.url().scheme() != "https"
                || ![
                    "github.com",
                    "release-assets.githubusercontent.com",
                    "objects.githubusercontent.com",
                ]
                .contains(&host)
            {
                attempt.error("Untrusted redirect")
            } else {
                attempt.follow()
            }
        }))
        .build()
        .map_err(|_| "updates:network".into())
}
fn fetch_small(url: &str) -> core::Result<Vec<u8>> {
    let response = client()?.get(url).send().map_err(|_| "updates:network")?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Err("updates:feedMissing".into());
    }
    let mut bytes = vec![];
    response
        .error_for_status()
        .map_err(|_| "updates:network")?
        .take(512 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "updates:network")?;
    if bytes.len() > 512 * 1024 {
        return Err("updates:invalid".into());
    }
    Ok(bytes)
}
pub fn spawn_helper(root: &Path, id: &str, recovery: bool) -> core::Result<()> {
    let (job, m, _) = core::load_job(root, id)?;
    let file = m
        .app
        .files
        .iter()
        .find(|e| e.path == "vrm-updater.exe")
        .ok_or("updates:invalid")?;
    let source = core::safe(&job, "stage/vrm-updater.exe")?;
    core::check_file(&source, file)?;
    let helper = core::safe(&job, "handoff.exe")?;
    fs::copy(source, &helper).map_err(|_| "updates:storage")?;
    let mut command = Command::new(helper);
    command
        .arg("--job")
        .arg(id)
        .arg("--pid")
        .arg(std::process::id().to_string())
        .current_dir(root)
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    if recovery {
        command.arg("--recover");
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().map_err(|_| "updates:helper")?;
    let stdout = child.stdout.take().ok_or("updates:helper")?;
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut line = String::new();
        let _ = BufReader::new(stdout).read_line(&mut line);
        let _ = tx.send(line);
    });
    if rx.recv_timeout(Duration::from_secs(10)).ok().as_deref() != Some("READY\n") {
        let _ = child.kill();
        return Err("updates:helper".into());
    }
    Ok(())
}
#[tauri::command]
pub fn update_snapshot(state: State<'_, UpdateService>) -> core::Result<Snapshot> {
    state.snapshot()
}
#[tauri::command]
pub async fn check_update(state: State<'_, UpdateService>) -> core::Result<Snapshot> {
    let service = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.check())
        .await
        .map_err(|_| "updates:network")?
}
#[tauri::command]
pub async fn prepare_update(state: State<'_, UpdateService>) -> core::Result<Snapshot> {
    let service = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.prepare())
        .await
        .map_err(|_| "updates:storage")?
}
#[tauri::command]
pub fn cancel_update(state: State<'_, UpdateService>) {
    state.cancel.store(true, Ordering::SeqCst);
}
#[tauri::command]
pub async fn install_update(
    app: tauri::AppHandle,
    state: State<'_, UpdateService>,
) -> core::Result<()> {
    let service = state.inner().clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let id = {
            let s = service.inner.lock().map_err(|_| "updates:busy")?;
            if s.snapshot.phase != "ready" {
                return Err("updates:invalid".into());
            }
            s.job.clone().ok_or("updates:invalid")?
        };
        service.enter("handoff")?;
        let result = spawn_helper(&service.root, &id, false);
        if let Err(e) = &result {
            service.error(e);
        }
        result
    })
    .await
    .map_err(|_| "updates:helper")?;
    result?;
    app.exit(0);
    Ok(())
}
#[tauri::command]
pub fn update_acknowledge(state: State<'_, Mutex<PortablePathService>>) -> core::Result<()> {
    let paths = state.lock().map_err(|_| "updates:busy")?;
    let args: Vec<_> = std::env::args().collect();
    let id = args
        .windows(2)
        .find(|a| a[0] == "--updated-job")
        .map(|a| a[1].as_str())
        .ok_or("updates:invalid")?;
    let journal = core::pending(&paths.root)?.ok_or("updates:invalid")?;
    if journal.job != id || journal.version != env!("CARGO_PKG_VERSION") {
        return Err("updates:invalid".into());
    }
    core::json_write(
        &core::safe(&paths.root, "data/updates/health.json")?,
        &serde_json::json!({"job":id,"version":journal.version,"pid":std::process::id()}),
    )
}

#[tauri::command]
pub fn update_preferences(
    automatic: bool,
    state: State<'_, UpdateService>,
) -> core::Result<Snapshot> {
    let path = core::safe(&state.root, "data/settings/update-preferences.json")?;
    core::json_write(&path, &serde_json::json!({"automatic":automatic}))?;
    state.mutate(|s| s.snapshot.automatic = automatic)?;
    state.snapshot()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn result_written_after_application_start_is_visible() {
        let root = tempfile::tempdir().unwrap();
        let service = UpdateService::new(root.path().to_path_buf());
        assert!(service.snapshot().unwrap().result.is_empty());
        fs::create_dir_all(root.path().join("data/updates")).unwrap();
        core::json_write(
            &core::safe(root.path(), "data/updates/result.json").unwrap(),
            &serde_json::json!({"state":"updated","version":"1.4.0"}),
        )
        .unwrap();
        assert_eq!(service.snapshot().unwrap().result, "updated");
    }
}
