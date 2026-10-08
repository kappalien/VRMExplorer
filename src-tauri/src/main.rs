#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod cache;
mod filesystem;
mod library;
mod portable;
use portable::{PortablePathService, Settings};
use std::sync::Mutex;
use tauri::Manager;

fn fixed_runtime(paths: &PortablePathService) -> Result<bool, Box<dyn std::error::Error>> {
    let manifest = paths.managed_file("", "release.json")?;
    let runtime = paths.managed_file("runtime/webview2", "msedgewebview2.exe")?;
    if !manifest.exists() {
        return Ok(runtime.is_file());
    }
    if std::fs::metadata(&manifest)?.len() > 2 * 1024 * 1024 {
        return Err("Release manifest too large".into());
    }
    let value: serde_json::Value = serde_json::from_slice(&std::fs::read(&manifest)?)?;
    match value.get("runtimeMode").and_then(|v| v.as_str()) {
        Some("system") => Ok(false),
        Some("fixed") if runtime.is_file() => Ok(true),
        Some("fixed") => Err(
            "Offline Runtime missing: restore runtime/webview2 from the complete Offline ZIP"
                .into(),
        ),
        _ => Err("Invalid release.json runtimeMode".into()),
    }
}

#[tauri::command]
fn load_settings(
    state: tauri::State<'_, Mutex<PortablePathService>>,
) -> Result<serde_json::Value, String> {
    let paths = state.lock().map_err(|_| "errors:storageBusy")?;
    let settings = paths.load().map_err(|_| "errors:invalidSettings")?;
    Ok(
        serde_json::json!({"info":{"root":paths.root.to_string_lossy(),"writable":true,"runtime":if fixed_runtime(&paths).map_err(|_| "errors:invalidSettings")?{"fixed"}else{"system"}},"settings":settings}),
    )
}
#[tauri::command]
fn save_settings(
    settings: Settings,
    state: tauri::State<'_, Mutex<PortablePathService>>,
) -> Result<(), String> {
    state
        .lock()
        .map_err(|_| "errors:storageBusy")?
        .save(&settings)
        .map_err(|_| "errors:saveFailed".into())
}
fn main() {
    let result = (|| -> Result<(), Box<dyn std::error::Error>> {
        let paths = PortablePathService::from_executable()?;
        let runtime = paths.root.join("runtime/webview2");
        let use_fixed = fixed_runtime(&paths)?;
        // Set once before Tauri creates threads or WebViews, never from IPC.
        std::env::remove_var("WEBVIEW2_USER_DATA_FOLDER");
        std::env::remove_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER");
        if use_fixed {
            std::env::set_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", &runtime);
        }
        let data_directory = paths.managed("data/webview2")?;
        let library = library::Library::open(&paths)?;
        let thumbnails = cache::ThumbnailService::new(&paths)?;
        tauri::Builder::default()
            .plugin(tauri_plugin_dialog::init())
            .manage(std::sync::Arc::new(Mutex::new(
                filesystem::Broker::default(),
            )))
            .manage(Mutex::new(paths))
            .manage(std::sync::Arc::new(Mutex::new(library)))
            .manage(std::sync::Arc::new(thumbnails))
            .invoke_handler(tauri::generate_handler![
                load_settings,
                save_settings,
                filesystem::pick_asset,
                filesystem::list_grants,
                filesystem::revoke_grant,
                filesystem::list_directory,
                filesystem::browse_directory,
                filesystem::list_drives,
                filesystem::read_asset,
                filesystem::read_image,
                cache::read_thumbnail,
                cache::cancel_thumbnails,
                cache::cache_control,
                filesystem::file_action,
                filesystem::load_explorer,
                filesystem::save_explorer,
                library::choose_source,
                library::library_snapshot,
                library::library_action,
                library::relink_motion,
                library::record_motion,
                library::cancel_scan,
                library::start_scan
            ])
            .setup(move |app| {
                tauri::WebviewWindowBuilder::new(
                    app,
                    "main",
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .title("VRM Explorer")
                .inner_size(1200.0, 760.0)
                .min_inner_size(760.0, 480.0)
                .data_directory(data_directory.clone())
                .build()?;
                let _ = app.get_webview_window("main");
                Ok(())
            })
            .run(tauri::generate_context!())?;
        Ok(())
    })();
    if let Err(error) = result {
        eprintln!("VRM Explorer startup failed: {error}");
        #[cfg(target_os = "windows")]
        unsafe {
            #[link(name = "user32")]
            extern "system" {
                fn MessageBoxW(
                    hwnd: *mut std::ffi::c_void,
                    text: *const u16,
                    caption: *const u16,
                    flags: u32,
                ) -> i32;
            }
            let text: Vec<u16> = format!("無法啟動。請確認程式旁 data 可寫入。Standard 版需安裝 Microsoft WebView2；Offline 版請完整解壓 runtime。\nStartup failed. Use a writable local folder. Standard requires Microsoft WebView2; restore the complete Offline runtime folder.\n\n{error}\0").encode_utf16().collect();
            let caption: Vec<u16> = "VRM Explorer\0".encode_utf16().collect();
            MessageBoxW(std::ptr::null_mut(), text.as_ptr(), caption.as_ptr(), 0x10);
        }
        std::process::exit(1);
    }
}

#[cfg(test)]
mod release_tests {
    use super::*;
    #[test]
    fn explicit_runtime_mode_prevents_offline_fallback_and_standard_stale_runtime() {
        let temp = tempfile::tempdir().unwrap();
        let paths = PortablePathService::for_test(temp.path()).unwrap();
        let manifest = paths.root.join("release.json");
        std::fs::write(&manifest, r#"{"runtimeMode":"fixed"}"#).unwrap();
        assert!(fixed_runtime(&paths).is_err());
        let runtime = paths
            .managed_file("runtime/webview2", "msedgewebview2.exe")
            .unwrap();
        std::fs::write(&runtime, b"fixture").unwrap();
        assert!(fixed_runtime(&paths).unwrap());
        std::fs::write(&manifest, r#"{"runtimeMode":"system"}"#).unwrap();
        assert!(!fixed_runtime(&paths).unwrap());
        std::fs::write(&manifest, r#"{"runtimeMode":"unknown"}"#).unwrap();
        assert!(fixed_runtime(&paths).is_err());
    }
}
