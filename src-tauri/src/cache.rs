use crate::{
    filesystem::{display, io_error, FsResult, FsState},
    portable::PortablePathService,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Cursor, Write},
    path::Path,
    sync::{
        atomic::{AtomicU64, AtomicUsize, Ordering},
        Arc, Mutex,
    },
    time::UNIX_EPOCH,
};
use tauri::State;

const DIRECTORY: &str = "data/cache/thumbnails";
const MAX_ENTRY: u64 = 1024 * 1024;
pub type CacheState = Arc<ThumbnailService>;
pub struct ThumbnailService {
    store: Mutex<CacheStore>,
    pub decode: Mutex<()>,
    epoch: AtomicU64,
    jobs: AtomicUsize,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CacheConfig {
    schema_version: u32,
    limit_mib: u32,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheInfo {
    limit_mib: u32,
    used_bytes: u64,
    entries: usize,
}
struct CacheStore {
    paths: PortablePathService,
    limit_mib: u32,
}
impl ThumbnailService {
    pub fn new(paths: &PortablePathService) -> FsResult<Self> {
        let file = paths
            .managed_file("data/settings", "cache.json")
            .map_err(io_error)?;
        let config = if file.exists() {
            let value: CacheConfig = serde_json::from_slice(&fs::read(file).map_err(io_error)?)
                .map_err(|_| "errors:cacheConfig")?;
            if value.schema_version != 1 || !(16..=2048).contains(&value.limit_mib) {
                return Err("errors:cacheConfig".into());
            }
            value
        } else {
            CacheConfig {
                schema_version: 1,
                limit_mib: 256,
            }
        };
        let mut store = CacheStore {
            paths: PortablePathService {
                root: paths.root.clone(),
            },
            limit_mib: config.limit_mib,
        };
        store.trim(u64::from(store.limit_mib) * 1024 * 1024)?;
        Ok(Self {
            store: Mutex::new(store),
            decode: Mutex::new(()),
            epoch: AtomicU64::new(0),
            jobs: AtomicUsize::new(0),
        })
    }
    fn check(&self, epoch: u64) -> FsResult<()> {
        if self.epoch.load(Ordering::SeqCst) != epoch {
            Err("errors:cancelled".into())
        } else {
            Ok(())
        }
    }
    fn thumbnail(&self, path: &str, broker: &FsState, epoch: u64) -> FsResult<Vec<u8>> {
        self.check(epoch)?;
        let _decode = self.decode.lock().map_err(|_| "errors:storageBusy")?;
        self.check(epoch)?;
        // A warm cache still requires a live filesystem grant and a present original.
        let (canonical, metadata, vrm) = {
            let b = broker.lock().map_err(|_| "errors:storageBusy")?;
            let p = b.resolve(path)?;
            let ext = p
                .extension()
                .map(|v| v.to_string_lossy().to_ascii_lowercase())
                .unwrap_or_default();
            if !["png", "jpg", "jpeg", "webp", "bmp", "vrm"].contains(&ext.as_str()) {
                return Err("errors:unsupported".into());
            }
            let metadata = p.metadata().map_err(io_error)?;
            if !metadata.is_file() {
                return Err("errors:unsupported".into());
            }
            (p, metadata, ext == "vrm")
        };
        let key = cache_key(&canonical, &metadata);
        if let Some(bytes) = self
            .store
            .lock()
            .map_err(|_| "errors:storageBusy")?
            .get(&key)?
        {
            self.check(epoch)?;
            return Ok(bytes);
        }
        let raw = broker.lock().map_err(|_| "errors:storageBusy")?.read(
            path,
            if vrm {
                256 * 1024 * 1024
            } else {
                32 * 1024 * 1024
            },
        )?;
        self.check(epoch)?;
        let encoded = if vrm {
            encode_preview(embedded_vrm_image(&raw)?, 192)?
        } else {
            encode_preview(&raw, 192)?
        };
        self.check(epoch)?;
        let mut store = self.store.lock().map_err(|_| "errors:storageBusy")?;
        self.check(epoch)?;
        // Don't cache a source that changed during decoding.
        let latest = broker
            .lock()
            .map_err(|_| "errors:storageBusy")?
            .resolve(path)?
            .metadata()
            .map_err(io_error)?;
        if cache_key(&canonical, &latest) != key {
            return Err("errors:cancelled".into());
        }
        store.put(&key, &encoded)?;
        Ok(encoded)
    }
}
pub struct JobPermit(CacheState);
impl Drop for JobPermit {
    fn drop(&mut self) {
        self.0.jobs.fetch_sub(1, Ordering::SeqCst);
    }
}
pub fn reserve(state: &CacheState) -> FsResult<JobPermit> {
    state
        .jobs
        .try_update(Ordering::SeqCst, Ordering::SeqCst, |value| {
            if value < 3 {
                Some(value + 1)
            } else {
                None
            }
        })
        .map_err(|_| "errors:thumbnailBusy")?;
    Ok(JobPermit(state.clone()))
}
fn cache_key(path: &Path, meta: &fs::Metadata) -> String {
    let modified = meta
        .modified()
        .ok()
        .and_then(|v| v.duration_since(UNIX_EPOCH).ok())
        .map(|v| v.as_nanos())
        .unwrap_or(0);
    let mut hash = Sha256::new();
    hash.update(b"vrm-explorer-thumbnail-v1\0");
    hash.update(display(path).as_bytes());
    hash.update(meta.len().to_le_bytes());
    hash.update(modified.to_le_bytes());
    format!("v1-{:x}.png", hash.finalize())
}
fn owned_name(name: &str) -> bool {
    name.len() == 71
        && name.starts_with("v1-")
        && name.ends_with(".png")
        && name.as_bytes()[3..67]
            .iter()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(b))
}
impl CacheStore {
    fn files(&self) -> FsResult<Vec<(String, u64, std::time::SystemTime)>> {
        let dir = self.paths.managed(DIRECTORY).map_err(io_error)?;
        let mut files = Vec::new();
        for item in fs::read_dir(dir).map_err(io_error)? {
            let item = item.map_err(io_error)?;
            let name = item.file_name().to_string_lossy().to_string();
            if !owned_name(&name) {
                continue;
            }
            if !item.file_type().map_err(io_error)?.is_file() {
                continue;
            }
            let p = self
                .paths
                .managed_file(DIRECTORY, &name)
                .map_err(io_error)?;
            let meta = p.metadata().map_err(io_error)?;
            if meta.is_file() {
                files.push((name, meta.len(), meta.modified().unwrap_or(UNIX_EPOCH)));
            }
            if files.len() > 100000 {
                return Err("errors:tooMany".into());
            }
        }
        Ok(files)
    }
    fn info(&self) -> FsResult<CacheInfo> {
        let files = self.files()?;
        Ok(CacheInfo {
            limit_mib: self.limit_mib,
            used_bytes: files.iter().map(|v| v.1).sum(),
            entries: files.len(),
        })
    }
    fn trim(&mut self, target: u64) -> FsResult<()> {
        let mut files = self.files()?;
        files.sort_by_key(|v| v.2);
        let mut total: u64 = files.iter().map(|v| v.1).sum();
        for (name, size, _) in files {
            if target > 0 && total <= target {
                break;
            }
            fs::remove_file(
                self.paths
                    .managed_file(DIRECTORY, &name)
                    .map_err(io_error)?,
            )
            .map_err(io_error)?;
            total = total.saturating_sub(size);
        }
        Ok(())
    }
    fn get(&self, key: &str) -> FsResult<Option<Vec<u8>>> {
        let path = self.paths.managed_file(DIRECTORY, key).map_err(io_error)?;
        if !path.exists() {
            return Ok(None);
        }
        if path.metadata().map_err(io_error)?.len() <= MAX_ENTRY {
            let bytes = fs::read(&path).map_err(io_error)?;
            let mut reader =
                image::ImageReader::with_format(Cursor::new(&bytes), image::ImageFormat::Png);
            let mut limits = image::Limits::default();
            limits.max_image_width = Some(192);
            limits.max_image_height = Some(192);
            limits.max_alloc = Some(2 * 1024 * 1024);
            reader.limits(limits);
            if reader.decode().is_ok() {
                return Ok(Some(bytes));
            }
        }
        // Only our strict cache namespace is removed; corruption is rebuilt from the original.
        fs::remove_file(path).map_err(io_error)?;
        Ok(None)
    }
    fn put(&mut self, key: &str, bytes: &[u8]) -> FsResult<()> {
        if !owned_name(key) || bytes.len() as u64 > MAX_ENTRY {
            return Err("errors:cacheConfig".into());
        }
        let budget = u64::from(self.limit_mib) * 1024 * 1024;
        self.trim(budget.saturating_sub(bytes.len() as u64))?;
        let destination = self.paths.managed_file(DIRECTORY, key).map_err(io_error)?;
        let mut temp =
            tempfile::NamedTempFile::new_in(self.paths.managed(DIRECTORY).map_err(io_error)?)
                .map_err(io_error)?;
        temp.write_all(bytes).map_err(io_error)?;
        temp.as_file().sync_all().map_err(io_error)?;
        temp.persist(destination).map_err(|v| io_error(v.error))?;
        Ok(())
    }
}
pub fn encode_preview(bytes: &[u8], size: u32) -> FsResult<Vec<u8>> {
    let mut reader = image::ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(io_error)?;
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(20000);
    limits.max_image_height = Some(20000);
    limits.max_alloc = Some(128 * 1024 * 1024);
    reader.limits(limits);
    let decoded = reader.decode().map_err(|_| "errors:image")?;
    let mut out = Cursor::new(Vec::new());
    decoded
        .thumbnail(size, size)
        .write_to(&mut out, image::ImageFormat::Png)
        .map_err(|_| "errors:image")?;
    Ok(out.into_inner())
}
fn u32_at(bytes: &[u8], offset: usize) -> FsResult<usize> {
    let data = bytes.get(offset..offset + 4).ok_or("errors:container")?;
    Ok(u32::from_le_bytes(data.try_into().map_err(|_| "errors:container")?) as usize)
}
// VRM 0.x: meta.texture -> textures[].source. VRM 1.0: meta.thumbnailImage -> images[].
// Only a bounded GLB BIN bufferView is accepted. No external URI is read.
fn embedded_vrm_image(bytes: &[u8]) -> FsResult<&[u8]> {
    if bytes.get(..4) != Some(b"glTF")
        || u32_at(bytes, 4)? != 2
        || u32_at(bytes, 8)? != bytes.len()
        || u32_at(bytes, 16)? != 0x4e4f534a
    {
        return Err("errors:container".into());
    }
    let json_len = u32_at(bytes, 12)?;
    if json_len > 16 * 1024 * 1024 || json_len % 4 != 0 {
        return Err("errors:container".into());
    }
    let json: serde_json::Value =
        serde_json::from_slice(bytes.get(20..20 + json_len).ok_or("errors:container")?)
            .map_err(|_| "errors:container")?;
    let bin_offset = 20 + json_len;
    if u32_at(bytes, bin_offset + 4)? != 0x004e4942 {
        return Err("errors:container".into());
    }
    let bin_len = u32_at(bytes, bin_offset)?;
    let bin = bytes
        .get(bin_offset + 8..bin_offset + 8 + bin_len)
        .ok_or("errors:container")?;
    let image_index = if let Some(index) = json
        .pointer("/extensions/VRMC_vrm/meta/thumbnailImage")
        .and_then(|v| v.as_u64())
    {
        index
    } else {
        let texture = json
            .pointer("/extensions/VRM/meta/texture")
            .and_then(|v| v.as_u64())
            .ok_or("errors:noThumbnail")?;
        json.get("textures")
            .and_then(|v| v.get(usize::try_from(texture).ok()?))
            .and_then(|v| v.get("source"))
            .and_then(|v| v.as_u64())
            .ok_or("errors:noThumbnail")?
    };
    let image = json
        .get("images")
        .and_then(|v| v.get(usize::try_from(image_index).ok()?))
        .ok_or("errors:noThumbnail")?;
    if image.get("uri").is_some() {
        return Err("errors:noThumbnail".into());
    }
    let view_index = image
        .get("bufferView")
        .and_then(|v| v.as_u64())
        .ok_or("errors:noThumbnail")?;
    let view = json
        .get("bufferViews")
        .and_then(|v| v.get(usize::try_from(view_index).ok()?))
        .ok_or("errors:container")?;
    if view.get("buffer").and_then(|v| v.as_u64()) != Some(0)
        || json.pointer("/buffers/0/uri").is_some()
    {
        return Err("errors:container".into());
    }
    let offset = view.get("byteOffset").and_then(|v| v.as_u64()).unwrap_or(0);
    let length = view
        .get("byteLength")
        .and_then(|v| v.as_u64())
        .ok_or("errors:container")?;
    if length > 32 * 1024 * 1024 {
        return Err("errors:tooLarge".into());
    }
    let end = offset.checked_add(length).ok_or("errors:container")?;
    let declared = json
        .pointer("/buffers/0/byteLength")
        .and_then(|v| v.as_u64())
        .ok_or("errors:container")?;
    if end > declared || declared > bin.len() as u64 {
        return Err("errors:container".into());
    }
    bin.get(
        usize::try_from(offset).map_err(|_| "errors:container")?
            ..usize::try_from(end).map_err(|_| "errors:container")?,
    )
    .ok_or_else(|| "errors:container".into())
}
#[tauri::command]
pub async fn read_thumbnail(
    path: String,
    state: State<'_, FsState>,
    cache: State<'_, CacheState>,
) -> FsResult<tauri::ipc::Response> {
    let broker = state.inner().clone();
    let cache = cache.inner().clone();
    let epoch = cache.epoch.load(Ordering::SeqCst);
    let permit = reserve(&cache)?;
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        cache
            .thumbnail(&path, &broker, epoch)
            .map(tauri::ipc::Response::new)
    })
    .await
    .map_err(|_| "errors:image")?
}
#[tauri::command]
pub fn cancel_thumbnails(cache: State<'_, CacheState>) {
    cache.epoch.fetch_add(1, Ordering::SeqCst);
}
#[tauri::command]
pub async fn cache_control(
    action: String,
    limit_mib: Option<u32>,
    cache: State<'_, CacheState>,
) -> FsResult<CacheInfo> {
    let cache = cache.inner().clone();
    if action == "clear" {
        cache.epoch.fetch_add(1, Ordering::SeqCst);
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut store = cache.store.lock().map_err(|_| "errors:storageBusy")?;
        match action.as_str() {
            "info" => {}
            "clear" => store.trim(0)?,
            "limit" => {
                let limit = limit_mib
                    .filter(|v| (16..=2048).contains(v))
                    .ok_or("errors:cacheConfig")?;
                store
                    .paths
                    .write_json(
                        "cache.json",
                        &CacheConfig {
                            schema_version: 1,
                            limit_mib: limit,
                        },
                    )
                    .map_err(io_error)?;
                store.limit_mib = limit;
                store.trim(u64::from(limit) * 1024 * 1024)?;
            }
            _ => return Err("errors:unsupported".into()),
        }
        store.info()
    })
    .await
    .map_err(|_| "errors:image")?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::filesystem::Broker;
    fn png(width: u32, color: u8) -> Vec<u8> {
        let image = image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
            width,
            24,
            image::Rgba([color, 50, 100, 255]),
        ));
        let mut out = Cursor::new(Vec::new());
        image.write_to(&mut out, image::ImageFormat::Png).unwrap();
        out.into_inner()
    }
    #[test]
    fn warm_cache_corruption_change_and_revocation() {
        let temp = tempfile::tempdir().unwrap();
        let paths = PortablePathService::for_test(temp.path()).unwrap();
        let source = temp.path().join("中文 圖片.png");
        let original = png(320, 10);
        fs::write(&source, &original).unwrap();
        let mut broker = Broker::default();
        broker.grant(&source).unwrap();
        let broker = Arc::new(Mutex::new(broker));
        let service = ThumbnailService::new(&paths).unwrap();
        let first = service.thumbnail(&display(&source), &broker, 0).unwrap();
        assert_eq!(
            service.thumbnail(&display(&source), &broker, 0).unwrap(),
            first
        );
        assert_eq!(service.store.lock().unwrap().info().unwrap().entries, 1);
        let key = service.store.lock().unwrap().files().unwrap()[0].0.clone();
        fs::write(paths.managed_file(DIRECTORY, &key).unwrap(), b"corrupt").unwrap();
        assert_eq!(
            service.thumbnail(&display(&source), &broker, 0).unwrap(),
            first
        );
        assert_eq!(fs::read(&source).unwrap(), original);
        fs::write(&source, png(321, 200)).unwrap();
        assert_ne!(
            service.thumbnail(&display(&source), &broker, 0).unwrap(),
            first
        );
        assert_eq!(service.store.lock().unwrap().info().unwrap().entries, 2);
        *broker.lock().unwrap() = Broker::default();
        assert_eq!(
            service
                .thumbnail(&display(&source), &broker, 0)
                .unwrap_err(),
            "errors:unauthorized"
        );
        service.epoch.fetch_add(1, Ordering::SeqCst);
        assert_eq!(
            service
                .thumbnail(&display(&source), &broker, 0)
                .unwrap_err(),
            "errors:cancelled"
        );
    }
    #[test]
    fn quota_clear_preserves_unmanaged_files_and_job_limit() {
        let temp = tempfile::tempdir().unwrap();
        let paths = PortablePathService::for_test(temp.path()).unwrap();
        let service = Arc::new(ThumbnailService::new(&paths).unwrap());
        let unmanaged = paths.managed(DIRECTORY).unwrap().join("user-note.txt");
        fs::write(&unmanaged, b"preserve").unwrap();
        let mut store = service.store.lock().unwrap();
        for i in 0..3 {
            store.put(&format!("v1-{i:064x}.png"), &png(10, i)).unwrap();
        }
        let budget = png(10, 0).len() as u64;
        store.trim(budget).unwrap();
        assert!(store.info().unwrap().used_bytes <= budget);
        let empty = format!("v1-{:064x}.png", 10);
        fs::write(paths.managed_file(DIRECTORY, &empty).unwrap(), []).unwrap();
        store.trim(0).unwrap();
        assert_eq!(store.info().unwrap().entries, 0);
        assert_eq!(fs::read(unmanaged).unwrap(), b"preserve");
        drop(store);
        let a = reserve(&service).unwrap();
        let b = reserve(&service).unwrap();
        let c = reserve(&service).unwrap();
        assert!(reserve(&service).is_err());
        drop(a);
        assert!(reserve(&service).is_ok());
        drop((b, c));
    }
    fn glb(json: serde_json::Value, image: &[u8]) -> Vec<u8> {
        let mut json = serde_json::to_vec(&json).unwrap();
        while !json.len().is_multiple_of(4) {
            json.push(b' ');
        }
        let mut bin = image.to_vec();
        while !bin.len().is_multiple_of(4) {
            bin.push(0);
        }
        let mut data = b"glTF".to_vec();
        data.extend_from_slice(&2u32.to_le_bytes());
        data.extend_from_slice(&((28 + json.len() + bin.len()) as u32).to_le_bytes());
        data.extend_from_slice(&(json.len() as u32).to_le_bytes());
        data.extend_from_slice(&0x4e4f534au32.to_le_bytes());
        data.extend(json);
        data.extend_from_slice(&(bin.len() as u32).to_le_bytes());
        data.extend_from_slice(&0x004e4942u32.to_le_bytes());
        data.extend(bin);
        data
    }
    #[test]
    fn vrm_zero_and_one_embedded_covers_reject_external_and_bad_ranges() {
        let image = png(24, 100);
        let mut json = serde_json::json!({"asset":{"version":"2.0"},"extensions":{"VRMC_vrm":{"meta":{"thumbnailImage":0}}},"buffers":[{"byteLength":image.len()}],"bufferViews":[{"buffer":0,"byteLength":image.len()}],"images":[{"bufferView":0}]});
        assert_eq!(
            embedded_vrm_image(&glb(json.clone(), &image)).unwrap(),
            image
        );
        json["extensions"] = serde_json::json!({"VRM":{"meta":{"texture":0}}});
        json["textures"] = serde_json::json!([{"source":0}]);
        assert_eq!(
            embedded_vrm_image(&glb(json.clone(), &image)).unwrap(),
            image
        );
        json["images"][0]["uri"] = serde_json::json!("https://example.invalid/private.png");
        assert!(embedded_vrm_image(&glb(json.clone(), &image)).is_err());
        json["images"][0].as_object_mut().unwrap().remove("uri");
        json["bufferViews"][0]["byteOffset"] = serde_json::json!(u64::MAX);
        assert!(embedded_vrm_image(&glb(json, &image)).is_err());
        assert!(embedded_vrm_image(&[0; 20]).is_err());
    }
    #[test]
    fn quota_persists_and_invalid_config_is_preserved() {
        let temp = tempfile::tempdir().unwrap();
        let paths = PortablePathService::for_test(temp.path()).unwrap();
        paths
            .write_json(
                "cache.json",
                &CacheConfig {
                    schema_version: 1,
                    limit_mib: 32,
                },
            )
            .unwrap();
        assert_eq!(
            ThumbnailService::new(&paths)
                .unwrap()
                .store
                .lock()
                .unwrap()
                .limit_mib,
            32
        );
        let file = paths.managed_file("data/settings", "cache.json").unwrap();
        fs::write(&file, b"broken").unwrap();
        assert!(ThumbnailService::new(&paths).is_err());
        assert_eq!(fs::read(file).unwrap(), b"broken");
    }
}
