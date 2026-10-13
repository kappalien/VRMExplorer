#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{fs, io::Write, path::Path, process::Command, time::Duration};
use vrm_explorer::update_core as core;
#[cfg(windows)]
fn wait_parent(pid: u32) -> core::Result<()> {
    unsafe {
        #[link(name = "kernel32")]
        extern "system" {
            fn OpenProcess(access: u32, inherit: i32, pid: u32) -> *mut std::ffi::c_void;
            fn WaitForSingleObject(handle: *mut std::ffi::c_void, millis: u32) -> u32;
            fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
            fn GetLastError() -> u32;
        }
        let handle = OpenProcess(0x00100000, 0, pid);
        if handle.is_null() {
            return if GetLastError() == 87 {
                Ok(())
            } else {
                Err("updates:locked".into())
            };
        }
        let result = WaitForSingleObject(handle, 30000);
        CloseHandle(handle);
        if result == 0 {
            Ok(())
        } else {
            Err("updates:locked".into())
        }
    }
}
#[cfg(not(windows))]
fn wait_parent(_: u32) -> core::Result<()> {
    Err("updates:notPortable".into())
}
fn restart(root: &Path, id: Option<&str>) -> core::Result<std::process::Child> {
    let mut c = Command::new(core::safe(root, "vrm-explorer.exe")?);
    c.current_dir(root);
    if let Some(id) = id {
        c.arg("--updated-job").arg(id);
    }
    c.spawn().map_err(|_| "updates:restart".into())
}
fn run() -> core::Result<()> {
    let args: Vec<_> = std::env::args().collect();
    let id = args
        .windows(2)
        .find(|a| a[0] == "--job")
        .map(|a| a[1].as_str())
        .ok_or("updates:invalid")?;
    let pid: u32 = args
        .windows(2)
        .find(|a| a[0] == "--pid")
        .and_then(|a| a[1].parse().ok())
        .ok_or("updates:invalid")?;
    let exe = std::env::current_exe().map_err(|_| "updates:helper")?;
    let job = exe.parent().ok_or("updates:invalid")?;
    let root = job
        .ancestors()
        .nth(4)
        .ok_or("updates:invalid")?
        .canonicalize()
        .map_err(|_| "updates:storage")?;
    let (expected, manifest, _) = core::load_job(&root, id)?;
    if job.canonicalize().map_err(|_| "updates:storage")?
        != expected.canonicalize().map_err(|_| "updates:storage")?
    {
        return Err("updates:invalid".into());
    }
    let helper = manifest
        .app
        .files
        .iter()
        .find(|e| e.path == "vrm-updater.exe")
        .ok_or("updates:invalid")?;
    core::check_file(&exe, helper)?;
    println!("READY");
    let _ = std::io::stdout().flush();
    wait_parent(pid)?;
    let lock = core::application_lock(&root)?;
    if args.iter().any(|a| a == "--recover") {
        core::recover(&root)?;
        drop(lock);
        restart(&root, None)?;
        return Ok(());
    }
    if let Err(error) = core::install(&root, id) {
        drop(lock);
        let _ = restart(&root, None);
        return Err(error);
    }
    let health = core::safe(&root, "data/updates/health.json")?;
    if health.exists() && fs::remove_file(&health).is_err() {
        core::recover(&root)?;
        drop(lock);
        let _ = restart(&root, None);
        return Err("updates:storage".into());
    }
    drop(lock);
    let mut child = match restart(&root, Some(id)) {
        Ok(child) => child,
        Err(e) => {
            let _lock = core::application_lock(&root)?;
            core::recover(&root)?;
            drop(_lock);
            let _ = restart(&root, None);
            return Err(e);
        }
    };
    let mut healthy = false;
    for _ in 0..240 {
        if let Ok(bytes) = core::read_limited(&health, 4096) {
            if let Ok(value) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                if value.get("job").and_then(|v| v.as_str()) == Some(id)
                    && value.get("version").and_then(|v| v.as_str()) == Some(&manifest.version)
                {
                    healthy = true;
                    break;
                }
            }
        }
        if !matches!(child.try_wait(), Ok(None)) {
            break;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    if healthy {
        core::finish(&root, id)?;
        Ok(())
    } else {
        let _ = child.kill();
        let _ = child.wait();
        let lock = core::application_lock(&root)?;
        core::recover(&root)?;
        drop(lock);
        let _ = restart(&root, None);
        Err("updates:restart".into())
    }
}
fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        #[cfg(windows)]
        unsafe {
            #[link(name = "user32")]
            extern "system" {
                fn MessageBoxW(
                    window: *mut std::ffi::c_void,
                    text: *const u16,
                    title: *const u16,
                    flags: u32,
                ) -> i32;
            }
            let root = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent()?.ancestors().nth(4).map(Path::to_path_buf));
            let english = root
                .and_then(|p| core::safe(&p, "data/settings/config.json").ok())
                .and_then(|p| core::read_limited(&p, 4096).ok())
                .and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok())
                .is_some_and(|v| v.get("language").and_then(|v| v.as_str()) == Some("en"));
            let messages: serde_json::Value =
                serde_json::from_str(include_str!("../../update-messages.json"))
                    .expect("embedded locales");
            let locale = &messages[if english { "en" } else { "zh-TW" }];
            let text: Vec<_> = format!(
                "{}\n\n{error}\0",
                locale["failure"].as_str().expect("embedded message")
            )
            .encode_utf16()
            .collect();
            let title: Vec<_> = format!("{}\0", locale["title"].as_str().expect("embedded title"))
                .encode_utf16()
                .collect();
            MessageBoxW(std::ptr::null_mut(), text.as_ptr(), title.as_ptr(), 0x10);
        }
        std::process::exit(1);
    }
}
