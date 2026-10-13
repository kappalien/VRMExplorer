use base64::{engine::general_purpose::STANDARD, Engine};
use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs::{self, File},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    time::Duration,
};
pub type Result<T> = std::result::Result<T, String>;
pub const PUBLIC_KEY: &str = include_str!("../update-public-key.txt");
pub const RUNTIME: &str = "154.0.4258.62";
pub const FEED: &str =
    "https://github.com/kappalien/VRMExplorer/releases/latest/download/update.json";
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Signed {
    pub payload: String,
    pub signature: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Entry {
    pub path: String,
    pub size: u64,
    pub sha256: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Package {
    pub url: String,
    pub size: u64,
    pub sha256: String,
    pub files: Vec<Entry>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Manifest {
    pub schema_version: u32,
    pub version: String,
    pub target: String,
    pub min_updater: u32,
    pub runtime_version: String,
    pub notes_zh: String,
    pub notes_en: String,
    pub app: Package,
    pub runtime: Option<Package>,
}
fn fail() -> String {
    "updates:invalid".into()
}
pub fn verify(bytes: &[u8]) -> Result<Manifest> {
    verify_key(bytes, PUBLIC_KEY)
}
fn verify_key(bytes: &[u8], public: &str) -> Result<Manifest> {
    if bytes.len() > 512 * 1024 {
        return Err(fail());
    }
    let signed: Signed = serde_json::from_slice(bytes).map_err(|_| fail())?;
    let payload = STANDARD.decode(signed.payload).map_err(|_| fail())?;
    let signature = Signature::from_slice(&STANDARD.decode(signed.signature).map_err(|_| fail())?)
        .map_err(|_| fail())?;
    let key: [u8; 32] = STANDARD
        .decode(public.trim())
        .map_err(|_| fail())?
        .try_into()
        .map_err(|_| fail())?;
    VerifyingKey::from_bytes(&key)
        .map_err(|_| fail())?
        .verify_strict(&payload, &signature)
        .map_err(|_| "updates:signature".to_string())?;
    let m: Manifest = serde_json::from_slice(&payload).map_err(|_| fail())?;
    validate(&m)?;
    Ok(m)
}
pub fn version(value: &str) -> Result<semver::Version> {
    let v = semver::Version::parse(value).map_err(|_| fail())?;
    if !v.pre.is_empty() || !v.build.is_empty() {
        return Err(fail());
    }
    Ok(v)
}
pub fn validate(m: &Manifest) -> Result<()> {
    version(&m.version)?;
    if m.schema_version != 1
        || m.target != "windows-x64"
        || m.min_updater > 1
        || m.notes_zh.len() > 12000
        || m.notes_en.len() > 12000
        || m.runtime_version.is_empty()
    {
        return Err(fail());
    }
    validate_package(&m.app, &m.version, false)?;
    if let Some(p) = &m.runtime {
        validate_package(p, &m.version, true)?;
    }
    let paths: HashSet<_> = m.app.files.iter().map(|e| e.path.as_str()).collect();
    if !["vrm-explorer.exe", "vrm-updater.exe", "release.json"]
        .iter()
        .all(|p| paths.contains(p))
    {
        return Err(fail());
    }
    Ok(())
}
fn hash_valid(s: &str) -> bool {
    s.len() == 64
        && s.bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}
pub fn allowed(path: &str, runtime: bool) -> bool {
    if path.is_empty()
        || path.len() > 230
        || path.split('/').any(|c| {
            c.is_empty()
                || c == "."
                || c == ".."
                || c.ends_with('.')
                || c.ends_with(' ')
                || matches!(
                    c.split('.')
                        .next()
                        .unwrap_or("")
                        .to_ascii_uppercase()
                        .as_str(),
                    "CON"
                        | "PRN"
                        | "AUX"
                        | "NUL"
                        | "COM1"
                        | "COM2"
                        | "COM3"
                        | "COM4"
                        | "COM5"
                        | "COM6"
                        | "COM7"
                        | "COM8"
                        | "COM9"
                        | "LPT1"
                        | "LPT2"
                        | "LPT3"
                        | "LPT4"
                        | "LPT5"
                        | "LPT6"
                        | "LPT7"
                        | "LPT8"
                        | "LPT9"
                )
                || !c
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"-_.@ +".contains(&b))
        })
    {
        return false;
    }
    let extension = path.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    if ["vrm", "vrma", "pem", "key", "db", "sqlite"].contains(&extension.as_str()) {
        return false;
    }
    if runtime {
        path.starts_with("runtime/webview2/")
    } else {
        matches!(
            path,
            "vrm-explorer.exe" | "vrm-updater.exe" | "release.json" | "upgrade.ps1"
        ) || path.starts_with("docs/")
            || path.starts_with("licenses/")
    }
}
fn validate_package(p: &Package, v: &str, runtime: bool) -> Result<()> {
    let name = if runtime {
        format!("VRM-Explorer-{v}-Runtime-win-x64.zip")
    } else {
        format!("VRM-Explorer-{v}-Update-win-x64.zip")
    };
    let url = format!("https://github.com/kappalien/VRMExplorer/releases/download/v{v}/{name}");
    let limit = if runtime {
        512 * 1024 * 1024
    } else {
        128 * 1024 * 1024
    };
    if p.url != url
        || p.size == 0
        || p.size > limit
        || !hash_valid(&p.sha256)
        || p.files.is_empty()
        || p.files.len() > 5000
    {
        return Err(fail());
    }
    let mut paths = HashSet::new();
    let mut total = 0u64;
    for f in &p.files {
        if !allowed(&f.path, runtime)
            || !hash_valid(&f.sha256)
            || !paths.insert(f.path.to_ascii_lowercase())
        {
            return Err(fail());
        }
        total = total.checked_add(f.size).ok_or_else(fail)?;
        if total > limit * 3 || f.size > limit * 2 {
            return Err(fail());
        }
    }
    Ok(())
}
pub fn safe(root: &Path, relative: &str) -> Result<PathBuf> {
    let mut path = root.to_path_buf();
    for component in root.components() {
        if matches!(component, Component::ParentDir) {
            return Err(fail());
        }
    }
    check_existing(root)?;
    for c in relative.split('/') {
        if c.is_empty() || c == "." || c == ".." || c.contains(['\\', ':']) {
            return Err(fail());
        }
        path.push(c);
        check_existing(&path)?;
    }
    Ok(path)
}
fn check_existing(p: &Path) -> Result<()> {
    match fs::symlink_metadata(p) {
        Ok(meta) => {
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if meta.file_attributes() & 0x400 != 0 {
                    return Err(fail());
                }
            }
            if meta.file_type().is_symlink() {
                return Err(fail());
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
        Err(_) => return Err("updates:storage".into()),
    }
    Ok(())
}
pub fn json_write<T: Serialize>(p: &Path, value: &T) -> Result<()> {
    let parent = p.parent().ok_or_else(fail)?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|_| "updates:storage")?;
    temp.write_all(&serde_json::to_vec(value).map_err(|_| fail())?)
        .map_err(|_| "updates:storage")?;
    temp.as_file().sync_all().map_err(|_| "updates:storage")?;
    temp.persist(p).map_err(|_| "updates:storage")?;
    Ok(())
}
pub fn hash(p: &Path) -> Result<String> {
    let mut f = File::open(p).map_err(|_| "updates:storage")?;
    let mut h = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = f.read(&mut buf).map_err(|_| "updates:storage")?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(format!("{:x}", h.finalize()))
}
pub fn check_file(p: &Path, e: &Entry) -> Result<()> {
    if fs::metadata(p).map_err(|_| fail())?.len() != e.size || hash(p)? != e.sha256 {
        return Err("updates:checksum".into());
    }
    Ok(())
}
pub fn extract(zip: &Path, p: &Package, stage: &Path, runtime: bool) -> Result<()> {
    if fs::metadata(zip).map_err(|_| fail())?.len() != p.size || hash(zip)? != p.sha256 {
        return Err("updates:checksum".into());
    }
    let mut archive =
        zip::ZipArchive::new(File::open(zip).map_err(|_| fail())?).map_err(|_| fail())?;
    if archive.len() != p.files.len() {
        return Err(fail());
    }
    let mut seen = HashSet::new();
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|_| fail())?;
        let name = file.name().to_string();
        if !allowed(&name, runtime)
            || file.is_dir()
            || file.enclosed_name().is_none()
            || file.unix_mode().is_some_and(|m| m & 0o170000 == 0o120000)
            || !seen.insert(name.to_ascii_lowercase())
        {
            return Err(fail());
        }
        let expected = p.files.iter().find(|e| e.path == name).ok_or_else(fail)?;
        if file.size() != expected.size {
            return Err(fail());
        }
        let dest = safe(stage, &name)?;
        fs::create_dir_all(dest.parent().ok_or_else(fail)?).map_err(|_| "updates:storage")?;
        let mut out = File::options()
            .write(true)
            .create_new(true)
            .open(&dest)
            .map_err(|_| "updates:storage")?;
        let count = std::io::copy(&mut (&mut file).take(expected.size + 1), &mut out)
            .map_err(|_| "updates:storage")?;
        out.sync_all().map_err(|_| "updates:storage")?;
        if count != expected.size {
            return Err(fail());
        }
        check_file(&dest, expected)?;
    }
    Ok(())
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Journal {
    pub job: String,
    pub version: String,
    pub entries: Vec<Record>,
    pub committed: bool,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Record {
    pub path: String,
    pub existed: bool,
}
pub fn job_path(root: &Path, id: &str) -> Result<PathBuf> {
    if id.is_empty() || id.len() > 80 || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
    {
        return Err(fail());
    }
    safe(root, &format!("data/updates/jobs/{id}"))
}
pub fn load_job(root: &Path, id: &str) -> Result<(PathBuf, Manifest, bool)> {
    load_job_key(root, id, PUBLIC_KEY)
}
fn load_job_key(root: &Path, id: &str, key: &str) -> Result<(PathBuf, Manifest, bool)> {
    let job = job_path(root, id)?;
    let bytes = read_limited(&safe(&job, "signed.json")?, 512 * 1024)?;
    let m = verify_key(&bytes, key)?;
    let runtime = safe(&job, "runtime.zip")?.is_file();
    if runtime && m.runtime.is_none() {
        return Err(fail());
    }
    Ok((job, m, runtime))
}
pub fn read_limited(p: &Path, max: u64) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    File::open(p)
        .map_err(|_| "updates:storage")?
        .take(max + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "updates:storage")?;
    if bytes.len() as u64 > max {
        return Err(fail());
    }
    Ok(bytes)
}
pub fn recover(root: &Path) -> Result<bool> {
    recover_key(root, PUBLIC_KEY)
}
fn recover_key(root: &Path, key: &str) -> Result<bool> {
    let path = safe(root, "data/updates/transaction.json")?;
    if !path.exists() {
        return Ok(false);
    }
    let journal: Journal =
        serde_json::from_slice(&read_limited(&path, 512 * 1024)?).map_err(|_| fail())?;
    let (job, m, runtime) = load_job_key(root, &journal.job, key)?;
    let files = selected_files(&m, runtime);
    if journal.version != m.version || journal.entries.len() > files.len() {
        return Err(fail());
    }
    let mut seen = HashSet::new();
    for e in &journal.entries {
        if !files.iter().any(|f| f.path == e.path) || !seen.insert(&e.path) {
            return Err(fail());
        }
    }
    if !journal.committed {
        for e in journal.entries.iter().rev() {
            let target = safe(root, &e.path)?;
            let backup = safe(&job, &format!("backup/{}", e.path))?;
            if e.existed && backup.exists() {
                if target.exists() {
                    fs::remove_file(&target).map_err(|_| "updates:rollback")?;
                }
                fs::rename(&backup, &target).map_err(|_| "updates:rollback")?;
            } else if !e.existed && target.exists() {
                fs::remove_file(&target).map_err(|_| "updates:rollback")?;
            }
        }
        json_write(
            &safe(root, "data/updates/result.json")?,
            &serde_json::json!({"state":"rolledBack","version":journal.version}),
        )?;
    }
    fs::remove_file(path).map_err(|_| "updates:storage")?;
    Ok(!journal.committed)
}
pub fn selected_files(m: &Manifest, runtime: bool) -> Vec<Entry> {
    let mut files = m.app.files.clone();
    if runtime {
        if let Some(p) = &m.runtime {
            files.extend(p.files.clone());
        }
    }
    files
}
fn replace(stage: &Path, target: &Path) -> Result<()> {
    let mut temp = tempfile::NamedTempFile::new_in(target.parent().ok_or_else(fail)?)
        .map_err(|_| "updates:storage")?;
    std::io::copy(
        &mut File::open(stage).map_err(|_| "updates:storage")?,
        &mut temp,
    )
    .map_err(|_| "updates:storage")?;
    temp.as_file().sync_all().map_err(|_| "updates:storage")?;
    temp.persist(target).map_err(|_| "updates:storage")?;
    Ok(())
}
pub fn install(root: &Path, id: &str) -> Result<()> {
    install_key(root, id, PUBLIC_KEY)
}
fn install_key(root: &Path, id: &str, key: &str) -> Result<()> {
    recover_key(root, key)?;
    let (job, m, runtime) = load_job_key(root, id, key)?;
    let files = selected_files(&m, runtime);
    let release: serde_json::Value = serde_json::from_slice(&read_limited(
        &safe(root, "release.json")?,
        2 * 1024 * 1024,
    )?)
    .map_err(|_| fail())?;
    let current = release
        .get("version")
        .and_then(|v| v.as_str())
        .ok_or_else(fail)?;
    if version(&m.version)? <= version(current)? {
        return Err("updates:current".into());
    }
    if release.get("runtimeVersion").and_then(|v| v.as_str()) != Some(&m.runtime_version)
        && !runtime
    {
        return Err("updates:runtime".into());
    }
    let owned: HashSet<String> = release
        .get("files")
        .and_then(|v| v.as_array())
        .ok_or_else(fail)?
        .iter()
        .filter_map(|v| v.get("path")?.as_str().map(String::from))
        .chain(["release.json".into()])
        .collect();
    for e in &files {
        let target = safe(root, &e.path)?;
        check_file(&safe(&job, &format!("stage/{}", e.path))?, e)?;
        if target.exists() && (!target.is_file() || !owned.contains(&e.path)) {
            return Err("updates:conflict".into());
        }
    }
    let next: serde_json::Value = serde_json::from_slice(&read_limited(
        &safe(&job, "stage/release.json")?,
        2 * 1024 * 1024,
    )?)
    .map_err(|_| fail())?;
    if next.get("version").and_then(|v| v.as_str()) != Some(&m.version)
        || next.get("runtimeVersion").and_then(|v| v.as_str()) != Some(&m.runtime_version)
        || next.get("runtimeMode").and_then(|v| v.as_str()) != Some("fixed")
    {
        return Err(fail());
    }
    let journal_path = safe(root, "data/updates/transaction.json")?;
    let mut journal = Journal {
        job: id.into(),
        version: m.version.clone(),
        entries: vec![],
        committed: false,
    };
    let result = (|| {
        for e in &files {
            let target = safe(root, &e.path)?;
            fs::create_dir_all(target.parent().ok_or_else(fail)?).map_err(|_| "updates:storage")?;
            let existed = target.exists();
            journal.entries.push(Record {
                path: e.path.clone(),
                existed,
            });
            json_write(&journal_path, &journal)?;
            if existed {
                let backup = safe(&job, &format!("backup/{}", e.path))?;
                fs::create_dir_all(backup.parent().ok_or_else(fail)?)
                    .map_err(|_| "updates:storage")?;
                let mut moved = false;
                for _ in 0..100 {
                    if fs::rename(&target, &backup).is_ok() {
                        moved = true;
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(100));
                }
                if !moved {
                    return Err("updates:locked".into());
                }
            }
            replace(&safe(&job, &format!("stage/{}", e.path))?, &target)?;
        }
        Ok(())
    })();
    if result.is_err() {
        recover_key(root, key)?;
    }
    result
}
pub fn application_lock(root: &Path) -> Result<File> {
    let p = safe(root, "data/updates/application.lock")?;
    fs::create_dir_all(p.parent().ok_or_else(fail)?).map_err(|_| "updates:storage")?;
    let file = File::options()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(p)
        .map_err(|_| "updates:storage")?;
    file.try_lock().map_err(|_| "updates:busy")?;
    Ok(file)
}

pub fn finish(root: &Path, id: &str) -> Result<()> {
    let path = safe(root, "data/updates/transaction.json")?;
    let mut journal: Journal =
        serde_json::from_slice(&read_limited(&path, 512 * 1024)?).map_err(|_| fail())?;
    if journal.job != id {
        return Err(fail());
    }
    journal.committed = true;
    json_write(&path, &journal)?;
    json_write(
        &safe(root, "data/updates/result.json")?,
        &serde_json::json!({"state":"updated","version":journal.version}),
    )?;
    fs::remove_file(path).map_err(|_| "updates:storage")?;
    Ok(())
}
pub fn pending(root: &Path) -> Result<Option<Journal>> {
    let path = safe(root, "data/updates/transaction.json")?;
    if !path.exists() {
        return Ok(None);
    }
    let j: Journal =
        serde_json::from_slice(&read_limited(&path, 512 * 1024)?).map_err(|_| fail())?;
    let (_, m, _) = load_job(root, &j.job)?;
    if j.version != m.version {
        return Err(fail());
    }
    Ok(Some(j))
}
#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    fn fixture() -> (tempfile::TempDir, Manifest, String) {
        let root = tempfile::tempdir().unwrap();
        let key = SigningKey::from_bytes(&[7; 32]);
        let public = STANDARD.encode(key.verifying_key().as_bytes());
        let job = job_path(root.path(), "job-test").unwrap();
        fs::create_dir_all(job.join("stage")).unwrap();
        let contents = [
            ("vrm-explorer.exe", b"new program".to_vec()),
            ("vrm-updater.exe", b"new updater".to_vec()),
            ("release.json", serde_json::to_vec(&serde_json::json!({"version":"1.5.0","runtimeVersion":RUNTIME,"runtimeMode":"fixed","files":[]})).unwrap()),
        ];
        let files = contents
            .iter()
            .map(|(path, bytes)| {
                fs::write(job.join("stage").join(path), bytes).unwrap();
                Entry {
                    path: path.to_string(),
                    size: bytes.len() as u64,
                    sha256: format!("{:x}", Sha256::digest(bytes)),
                }
            })
            .collect();
        let m = Manifest {schema_version:1,version:"1.5.0".into(),target:"windows-x64".into(),min_updater:1,runtime_version:RUNTIME.into(),notes_zh:"更新".into(),notes_en:"Update".into(),app:Package {url:"https://github.com/kappalien/VRMExplorer/releases/download/v1.5.0/VRM-Explorer-1.5.0-Update-win-x64.zip".into(),size:1,sha256:"0".repeat(64),files},runtime:None};
        let payload = serde_json::to_vec(&m).unwrap();
        let signed = Signed {
            payload: STANDARD.encode(&payload),
            signature: STANDARD.encode(key.sign(&payload).to_bytes()),
        };
        json_write(&job.join("signed.json"), &signed).unwrap();
        fs::write(root.path().join("vrm-explorer.exe"), b"old program").unwrap();
        json_write(&root.path().join("release.json"), &serde_json::json!({"version":"1.4.0","runtimeVersion":RUNTIME,"runtimeMode":"fixed","files":[{"path":"vrm-explorer.exe"}]})).unwrap();
        fs::create_dir_all(root.path().join("data/user")).unwrap();
        fs::write(root.path().join("data/user/model.vrm"), b"user asset").unwrap();
        (root, m, public)
    }
    #[test]
    fn signature_tampering_and_wrong_key_are_rejected() {
        let (r, _, public) = fixture();
        let path = job_path(r.path(), "job-test").unwrap().join("signed.json");
        let bytes = fs::read(path).unwrap();
        assert!(verify_key(&bytes, &public).is_ok());
        assert!(verify(&bytes).is_err());
        let mut signed: Signed = serde_json::from_slice(&bytes).unwrap();
        signed.payload = STANDARD.encode(b"tampered");
        assert_eq!(
            verify_key(&serde_json::to_vec(&signed).unwrap(), &public)
                .err()
                .unwrap(),
            "updates:signature"
        );
    }
    #[test]
    fn rejects_paths_user_assets_duplicates_and_foreign_urls() {
        let (_, mut m, _) = fixture();
        for path in [
            "data/settings.json",
            "docs/../vrm-explorer.exe",
            "docs/user.vrm",
            "docs/key.pem",
            "C:/file",
            "docs/name.",
            "docs/CON.txt",
        ] {
            assert!(!allowed(path, false), "{path}");
        }
        m.app.files.push(m.app.files[0].clone());
        assert!(validate(&m).is_err());
        m.app.files.pop();
        m.app.url = "https://example.org/update.zip".into();
        assert!(validate(&m).is_err());
    }
    #[test]
    fn rollback_restores_files_and_preserves_user_data() {
        let (r, _, key) = fixture();
        install_key(r.path(), "job-test", &key).unwrap();
        assert_eq!(
            fs::read(r.path().join("vrm-explorer.exe")).unwrap(),
            b"new program"
        );
        assert!(recover_key(r.path(), &key).unwrap());
        assert_eq!(
            fs::read(r.path().join("vrm-explorer.exe")).unwrap(),
            b"old program"
        );
        assert!(!r.path().join("vrm-updater.exe").exists());
        assert_eq!(
            fs::read(r.path().join("data/user/model.vrm")).unwrap(),
            b"user asset"
        );
        assert!(!recover_key(r.path(), &key).unwrap());
    }
    #[test]
    fn acknowledgement_commits_and_does_not_rollback() {
        let (r, _, key) = fixture();
        install_key(r.path(), "job-test", &key).unwrap();
        finish(r.path(), "job-test").unwrap();
        assert!(!recover_key(r.path(), &key).unwrap());
        assert_eq!(
            fs::read(r.path().join("vrm-explorer.exe")).unwrap(),
            b"new program"
        );
    }
    #[test]
    fn corrupted_stage_and_unmanaged_file_do_not_replace_original() {
        let (r, _, key) = fixture();
        let job = job_path(r.path(), "job-test").unwrap();
        fs::write(job.join("stage/vrm-explorer.exe"), b"corrupt").unwrap();
        assert!(install_key(r.path(), "job-test", &key).is_err());
        assert_eq!(
            fs::read(r.path().join("vrm-explorer.exe")).unwrap(),
            b"old program"
        );
        let (r, _, key) = fixture();
        fs::write(r.path().join("vrm-updater.exe"), b"user file").unwrap();
        assert_eq!(
            install_key(r.path(), "job-test", &key).unwrap_err(),
            "updates:conflict"
        );
        assert_eq!(
            fs::read(r.path().join("vrm-updater.exe")).unwrap(),
            b"user file"
        );
    }
    #[test]
    fn extraction_rejects_extra_zip_entries_and_wrong_package_hash() {
        let (r, mut m, _) = fixture();
        let job = job_path(r.path(), "job-test").unwrap();
        let zip_path = job.join("app.zip");
        let mut archive = zip::ZipWriter::new(File::create(&zip_path).unwrap());
        for entry in &m.app.files {
            archive
                .start_file(&entry.path, zip::write::SimpleFileOptions::default())
                .unwrap();
            archive
                .write_all(&fs::read(job.join("stage").join(&entry.path)).unwrap())
                .unwrap();
        }
        archive
            .start_file("docs/extra.txt", zip::write::SimpleFileOptions::default())
            .unwrap();
        archive.write_all(b"extra").unwrap();
        archive.finish().unwrap();
        m.app.size = fs::metadata(&zip_path).unwrap().len();
        m.app.sha256 = hash(&zip_path).unwrap();
        let stage = job.join("extract");
        fs::create_dir(&stage).unwrap();
        assert!(extract(&zip_path, &m.app, &stage, false).is_err());
        m.app.sha256 = "0".repeat(64);
        assert_eq!(
            extract(&zip_path, &m.app, &stage, false).unwrap_err(),
            "updates:checksum"
        );
    }
    #[test]
    fn packaged_update_verifies_with_embedded_key_when_requested() {
        let Ok(feed) = std::env::var("VRM_VERIFY_UPDATE_FEED") else {
            return;
        };
        let manifest = verify(&fs::read(feed).unwrap()).unwrap();
        let archive = std::env::var("VRM_VERIFY_UPDATE_ZIP").unwrap();
        let stage = tempfile::tempdir().unwrap();
        extract(Path::new(&archive), &manifest.app, stage.path(), false).unwrap();
        assert!(stage.path().join("vrm-explorer.exe").is_file());
        assert!(!stage.path().join("data").exists());
        assert!(!stage.path().join("runtime").exists());
    }
    #[test]
    fn concurrent_application_lock_is_rejected() {
        let (r, _, _) = fixture();
        let lock = application_lock(r.path()).unwrap();
        assert!(application_lock(r.path()).is_err());
        drop(lock);
        assert!(application_lock(r.path()).is_ok());
    }
}
