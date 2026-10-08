use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{self, Write},
    path::{Component, Path, PathBuf},
};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Settings {
    pub schema_version: u32,
    pub language: String,
    pub theme: String,
    #[serde(default = "default_size_unit")]
    pub file_size_unit: String,
    pub navigation_width: u32,
    pub preview_width: u32,
}
fn default_size_unit() -> String {
    "auto".into()
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            language: "zh-TW".into(),
            theme: "system".into(),
            file_size_unit: default_size_unit(),
            navigation_width: 220,
            preview_width: 380,
        }
    }
}
impl Settings {
    fn valid(&self) -> bool {
        self.schema_version == 1
            && ["zh-TW", "en"].contains(&self.language.as_str())
            && ["light", "dark", "system"].contains(&self.theme.as_str())
            && ["auto", "B", "KB", "MB", "GB", "KiB", "MiB", "GiB"]
                .contains(&self.file_size_unit.as_str())
            && (160..=420).contains(&self.navigation_width)
            && (260..=600).contains(&self.preview_width)
    }
}
pub struct PortablePathService {
    pub root: PathBuf,
}
impl PortablePathService {
    #[cfg(test)]
    pub fn for_test(root: &Path) -> io::Result<Self> {
        Self::new(root)
    }
    pub fn from_executable() -> io::Result<Self> {
        let exe = std::env::current_exe()?;
        Self::new(
            exe.parent()
                .ok_or_else(|| io::Error::other("Missing executable parent"))?,
        )
    }
    fn new(root: &Path) -> io::Result<Self> {
        let service = Self {
            root: root.canonicalize()?,
        };
        for folder in [
            "data/settings",
            "data/database",
            "data/cache/thumbnails",
            "data/cache/metadata",
            "data/logs",
            "data/sessions",
            "data/plugins",
            "data/webview2",
            "plugins/builtin",
            "plugins/external",
        ] {
            service.managed(folder)?;
        }
        let dir = service.managed("data/settings")?;
        let mut probe = tempfile::NamedTempFile::new_in(dir)?;
        probe.write_all(b"portable-write-probe")?;
        probe.as_file().sync_all()?;
        Ok(service)
    }
    pub fn managed(&self, relative: &str) -> io::Result<PathBuf> {
        let mut result = self.root.clone();
        for component in Path::new(relative).components() {
            let Component::Normal(name) = component else {
                return Err(io::Error::other("Unsafe relative path"));
            };
            result.push(name);
            if let Ok(meta) = fs::symlink_metadata(&result) {
                #[cfg(windows)]
                {
                    use std::os::windows::fs::MetadataExt;
                    if meta.file_attributes() & 0x400 != 0 {
                        return Err(io::Error::other("Reparse points forbidden"));
                    }
                }
                if meta.file_type().is_symlink() {
                    return Err(io::Error::other("Symlinks forbidden"));
                }
            } else {
                fs::create_dir(&result)?;
            }
            if !result.canonicalize()?.starts_with(&self.root) {
                return Err(io::Error::other("Path escaped portable root"));
            }
        }
        Ok(result)
    }
    pub fn managed_file(&self, directory: &str, name: &str) -> io::Result<PathBuf> {
        if Path::new(name).components().count() != 1
            || !matches!(
                Path::new(name).components().next(),
                Some(Component::Normal(_))
            )
        {
            return Err(io::Error::other("Unsafe file name"));
        }
        let file = self.managed(directory)?.join(name);
        let metadata = match fs::symlink_metadata(&file) {
            Ok(meta) => Some(meta),
            Err(error) if error.kind() == io::ErrorKind::NotFound => None,
            Err(error) => return Err(error),
        };
        if let Some(meta) = metadata {
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if meta.file_attributes() & 0x400 != 0 {
                    return Err(io::Error::other("Reparse config forbidden"));
                }
            }
            if !meta.is_file()
                || meta.file_type().is_symlink()
                || !file.canonicalize()?.starts_with(&self.root)
            {
                return Err(io::Error::other("Unsafe config path"));
            }
            if directory == "data/settings" && meta.len() > 65536 {
                return Err(io::Error::other("Config too large"));
            }
        }
        Ok(file)
    }
    fn config(&self) -> io::Result<PathBuf> {
        self.managed_file("data/settings", "config.json")
    }
    pub fn write_json<T: Serialize>(&self, name: &str, value: &T) -> io::Result<()> {
        let path = self.managed_file("data/settings", name)?;
        let mut temp = tempfile::NamedTempFile::new_in(self.managed("data/settings")?)?;
        temp.write_all(&serde_json::to_vec_pretty(value)?)?;
        temp.as_file().sync_all()?;
        temp.persist(path).map_err(|e| e.error)?;
        Ok(())
    }
    pub fn load(&self) -> io::Result<Settings> {
        let path = self.config()?;
        if !path.exists() {
            return Ok(Settings::default());
        }
        let settings: Settings = serde_json::from_slice(&fs::read(path)?)?;
        if !settings.valid() {
            return Err(io::Error::other("Invalid settings"));
        }
        Ok(settings)
    }
    pub fn save(&self, settings: &Settings) -> io::Result<()> {
        if !settings.valid() {
            return Err(io::Error::other("Invalid settings"));
        }
        let path = self.config()?;
        let mut temp = tempfile::NamedTempFile::new_in(self.managed("data/settings")?)?;
        temp.write_all(&serde_json::to_vec_pretty(settings)?)?;
        temp.as_file().sync_all()?;
        temp.persist(path).map_err(|e| e.error)?;
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn portable_round_trip_and_traversal() {
        let temp = tempfile::tempdir().unwrap();
        let paths = PortablePathService::new(temp.path()).unwrap();
        assert!(paths.managed("../escape").is_err());
        assert!(paths.managed("/absolute").is_err());
        paths.save(&Settings::default()).unwrap();
        assert_eq!(paths.load().unwrap().language, "zh-TW");
    }
    #[test]
    fn corrupt_config_is_preserved() {
        let temp = tempfile::tempdir().unwrap();
        let paths = PortablePathService::new(temp.path()).unwrap();
        let config = paths.config().unwrap();
        fs::write(&config, b"bad json").unwrap();
        assert!(paths.load().is_err());
        assert_eq!(fs::read(config).unwrap(), b"bad json");
    }
    #[test]
    fn replacement_and_relocation_preserve_settings() {
        let temp = tempfile::tempdir().unwrap();
        let original = temp.path().join("中文 Portable Root");
        fs::create_dir(&original).unwrap();
        let paths = PortablePathService::new(&original).unwrap();
        paths.save(&Settings::default()).unwrap();
        let settings = Settings {
            language: "en".into(),
            theme: "dark".into(),
            navigation_width: 280,
            ..Settings::default()
        };
        paths.save(&settings).unwrap();
        assert_eq!(paths.load().unwrap().navigation_width, 280);
        drop(paths);
        let relocated = temp.path().join("搬移後 Portable Root");
        fs::rename(&original, &relocated).unwrap();
        let moved = PortablePathService::new(&relocated).unwrap();
        assert_eq!(moved.load().unwrap().language, "en");
        assert_eq!(moved.load().unwrap().theme, "dark");
    }
    #[test]
    fn invalid_settings_cannot_replace_existing_config() {
        let temp = tempfile::tempdir().unwrap();
        let paths = PortablePathService::new(temp.path()).unwrap();
        paths.save(&Settings::default()).unwrap();
        let invalid = Settings {
            preview_width: 9999,
            ..Settings::default()
        };
        assert!(paths.save(&invalid).is_err());
        assert_eq!(paths.load().unwrap().preview_width, 380);
    }
    #[test]
    fn legacy_settings_default_size_unit_and_new_unit_round_trip() {
        let legacy = br#"{"schemaVersion":1,"language":"zh-TW","theme":"system","navigationWidth":220,"previewWidth":380}"#;
        let mut settings: Settings = serde_json::from_slice(legacy).unwrap();
        assert_eq!(settings.file_size_unit, "auto");
        let temp = tempfile::tempdir().unwrap();
        let paths = PortablePathService::new(temp.path()).unwrap();
        settings.file_size_unit = "MiB".into();
        paths.save(&settings).unwrap();
        assert_eq!(paths.load().unwrap().file_size_unit, "MiB");
        settings.file_size_unit = "invalid".into();
        assert!(paths.save(&settings).is_err());
        assert_eq!(paths.load().unwrap().file_size_unit, "MiB");
    }
}
