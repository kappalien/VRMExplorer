use crate::filesystem::{io_error, safe_path};
use std::{
    io::{Cursor, Write},
    path::Path,
};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

fn validate(bytes: &[u8]) -> Result<(), String> {
    if bytes.is_empty()
        || bytes.len() > 32 * 1024 * 1024
        || !bytes.starts_with(b"\x89PNG\r\n\x1a\n")
    {
        return Err("errors:pngExport".into());
    }
    let mut reader = image::ImageReader::with_format(Cursor::new(bytes), image::ImageFormat::Png);
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(4096);
    limits.max_image_height = Some(4096);
    limits.max_alloc = Some(128 * 1024 * 1024);
    reader.limits(limits);
    reader
        .decode()
        .map_err(|_| "errors:pngExport".to_string())?;
    Ok(())
}
fn save_new(path: &Path, bytes: &[u8]) -> Result<(), String> {
    validate(bytes)?;
    if !path
        .extension()
        .and_then(|s| s.to_str())
        .is_some_and(|s| s.eq_ignore_ascii_case("png"))
    {
        return Err("errors:unsupported".into());
    }
    let parent = safe_path(path.parent().ok_or("errors:unauthorized")?)?;
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or("errors:unauthorized")?;
    if name.contains([':', '/', '\\']) || name.ends_with([' ', '.']) {
        return Err("errors:unauthorized".into());
    }
    let target = parent.join(name);
    if std::fs::symlink_metadata(&target).is_ok() {
        return Err("errors:pngExists".into());
    }
    let mut temp = tempfile::NamedTempFile::new_in(&parent).map_err(io_error)?;
    temp.write_all(bytes).map_err(io_error)?;
    temp.as_file().sync_all().map_err(io_error)?;
    temp.persist_noclobber(&target).map_err(|e| {
        if e.error.kind() == std::io::ErrorKind::AlreadyExists {
            "errors:pngExists".into()
        } else {
            io_error(e.error)
        }
    })?;
    Ok(())
}
#[tauri::command]
pub async fn export_png(
    app: tauri::AppHandle,
    bytes: Vec<u8>,
    title: String,
) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        validate(&bytes)?;
        let mut dialog = app
            .dialog()
            .file()
            .set_title(title.chars().take(160).collect::<String>())
            .add_filter("PNG", &["png"])
            .set_file_name("scene.png");
        if let Some(window) = app.get_webview_window("main") {
            dialog = dialog.set_parent(&window);
        }
        let Some(file) = dialog.blocking_save_file() else {
            return Ok(false);
        };
        save_new(&file.into_path().map_err(|_| "errors:filesystem")?, &bytes)?;
        Ok(true)
    })
    .await
    .map_err(|_| "errors:filesystem".to_string())?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn transparent_png_is_preserved_and_existing_assets_cannot_be_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let mut bytes = Cursor::new(Vec::new());
        image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
            2,
            2,
            image::Rgba([20, 40, 60, 0]),
        ))
        .write_to(&mut bytes, image::ImageFormat::Png)
        .unwrap();
        let bytes = bytes.into_inner();
        let target = dir.path().join("scene.png");
        save_new(&target, &bytes).unwrap();
        assert_eq!(std::fs::read(&target).unwrap(), bytes);
        assert_eq!(save_new(&target, &bytes).unwrap_err(), "errors:pngExists");
        assert!(save_new(&dir.path().join("avatar.vrm"), &bytes).is_err());
        assert!(validate(b"invalid").is_err());
        let mut huge = bytes.clone();
        huge[16..20].copy_from_slice(&5000u32.to_be_bytes());
        assert!(validate(&huge).is_err());
    }
}
