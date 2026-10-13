use crate::filesystem::{io_error, safe_path};
use std::{io::Write, path::Path};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
fn validate(bytes: &[u8]) -> Result<(), String> {
    let invalid = || "errors:poseExport".to_string();
    if bytes.len() < 28 || bytes.len() > 1024 * 1024 {
        return Err(invalid());
    }
    let word = |offset| u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap()) as usize;
    if &bytes[..4] != b"glTF" || word(4) != 2 || word(8) != bytes.len() || &bytes[16..20] != b"JSON"
    {
        return Err(invalid());
    }
    let length = word(12);
    if length % 4 != 0 || length > bytes.len() - 28 {
        return Err(invalid());
    }
    let bin = 20 + length;
    if &bytes[bin + 4..bin + 8] != b"BIN\0" || word(bin) != bytes.len() - bin - 8 {
        return Err(invalid());
    }
    let json: serde_json::Value = serde_json::from_slice(&bytes[20..bin]).map_err(|_| invalid())?;
    if json
        .pointer("/extensions/VRMC_vrm_animation/specVersion")
        .and_then(|v| v.as_str())
        != Some("1.0")
        || json
            .pointer("/extensions/VRMC_vrm_animation/humanoid/humanBones/hips/node")
            .and_then(|v| v.as_u64())
            .is_none()
        || json
            .get("animations")
            .and_then(|v| v.as_array())
            .is_none_or(|v| v.len() != 1)
        || ["meshes", "images", "textures"]
            .iter()
            .any(|k| json.get(k).is_some())
    {
        return Err(invalid());
    }
    Ok(())
}
fn save_new(path: &Path, bytes: &[u8]) -> Result<(), String> {
    validate(bytes)?;
    if path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.eq_ignore_ascii_case("vrma"))
        != Some(true)
    {
        return Err("errors:unsupported".into());
    }
    let parent = safe_path(path.parent().ok_or("errors:unauthorized")?)?;
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("errors:unauthorized")?;
    if name.contains([':', '/', '\\']) || name.ends_with([' ', '.']) {
        return Err("errors:unauthorized".into());
    }
    let target = parent.join(name);
    if std::fs::symlink_metadata(&target).is_ok() {
        return Err("errors:poseExists".into());
    }
    let mut temp = tempfile::NamedTempFile::new_in(&parent).map_err(io_error)?;
    temp.write_all(bytes).map_err(io_error)?;
    temp.as_file().sync_all().map_err(io_error)?;
    temp.persist_noclobber(&target).map_err(|e| {
        if e.error.kind() == std::io::ErrorKind::AlreadyExists {
            "errors:poseExists".into()
        } else {
            io_error(e.error)
        }
    })?;
    Ok(())
}
#[tauri::command]
pub async fn export_pose(
    app: tauri::AppHandle,
    bytes: Vec<u8>,
    title: String,
) -> Result<bool, String> {
    validate(&bytes)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = app
            .dialog()
            .file()
            .set_title(title.chars().take(160).collect::<String>())
            .add_filter("VRMA", &["vrma"])
            .set_file_name("pose.vrma");
        if let Some(window) = app.get_webview_window("main") {
            dialog = dialog.set_parent(&window);
        }
        let Some(file) = dialog.blocking_save_file() else {
            return Ok(false);
        };
        let path = file.into_path().map_err(|_| "errors:filesystem")?;
        save_new(&path, &bytes)?;
        Ok(true)
    })
    .await
    .map_err(|_| "errors:filesystem".to_string())?
}
#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> Vec<u8> {
        let mut json=br#"{"extensions":{"VRMC_vrm_animation":{"specVersion":"1.0","humanoid":{"humanBones":{"hips":{"node":0}}}}},"animations":[{}]}"#.to_vec();
        while !json.len().is_multiple_of(4) {
            json.push(b' ');
        }
        let mut bytes = b"glTF".to_vec();
        bytes.extend(2u32.to_le_bytes());
        bytes.extend(((28 + json.len()) as u32).to_le_bytes());
        bytes.extend((json.len() as u32).to_le_bytes());
        bytes.extend(b"JSON");
        bytes.extend(json);
        bytes.extend(0u32.to_le_bytes());
        bytes.extend(b"BIN\0");
        bytes
    }
    #[test]
    fn preserves_existing_and_rejects_invalid_targets() {
        let directory = tempfile::tempdir().unwrap();
        let target = directory.path().join("pose.vrma");
        let bytes = fixture();
        save_new(&target, &bytes).unwrap();
        assert_eq!(std::fs::read(&target).unwrap(), bytes);
        assert_eq!(save_new(&target, &bytes).unwrap_err(), "errors:poseExists");
        assert!(save_new(&directory.path().join("original.vrm"), &bytes).is_err());
        assert!(save_new(&directory.path().join("bad.vrma"), b"invalid").is_err());
        assert!(save_new(&directory.path().join("../escape.vrma"), &bytes).is_err());
    }
    #[test]
    fn malformed_lengths_never_panic() {
        for size in 0..100 {
            let bytes = vec![255; size];
            assert!(validate(&bytes).is_err());
        }
        let mut bytes = fixture();
        bytes[12..16].copy_from_slice(&u32::MAX.to_le_bytes());
        assert!(validate(&bytes).is_err());
    }
}
