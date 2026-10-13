use crate::portable::PortablePathService;
use serde::{Deserialize, Serialize};
use std::{fs, sync::Mutex};
use tauri::Manager;
#[derive(Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Geometry {
    schema_version: u32,
    width: f64,
    height: f64,
    maximized: bool,
}
impl Default for Geometry {
    fn default() -> Self {
        Self {
            schema_version: 1,
            width: 1200.0,
            height: 760.0,
            maximized: false,
        }
    }
}
impl Geometry {
    fn valid(&self) -> bool {
        self.schema_version == 1
            && self.width.is_finite()
            && self.height.is_finite()
            && (760.0..=16000.0).contains(&self.width)
            && (480.0..=16000.0).contains(&self.height)
    }
    fn observe(&mut self, width: f64, height: f64, maximized: bool, minimized: bool) {
        if minimized {
            return;
        }
        self.maximized = maximized;
        if !maximized && (760.0..=16000.0).contains(&width) && (480.0..=16000.0).contains(&height) {
            self.width = width;
            self.height = height;
        }
    }
}
pub struct WindowMemory {
    value: Mutex<Geometry>,
    save_allowed: bool,
}
impl WindowMemory {
    pub fn load(paths: &PortablePathService) -> std::io::Result<Self> {
        let file = paths.managed_file("data/settings", "window.json")?;
        let parsed = if file.exists() {
            fs::read(file)
                .ok()
                .and_then(|b| serde_json::from_slice::<Geometry>(&b).ok())
                .filter(Geometry::valid)
        } else {
            Some(Geometry::default())
        };
        Ok(Self {
            save_allowed: parsed.is_some(),
            value: Mutex::new(parsed.unwrap_or_default()),
        })
    }
    pub fn initial(&self) -> (f64, f64, bool) {
        let g = *self.value.lock().expect("window geometry");
        (g.width, g.height, g.maximized)
    }
    pub fn observe(&self, window: &tauri::Window) {
        if let (Ok(size), Ok(scale), Ok(maximized), Ok(minimized)) = (
            window.inner_size(),
            window.scale_factor(),
            window.is_maximized(),
            window.is_minimized(),
        ) {
            let logical = size.to_logical::<f64>(scale);
            if let Ok(mut g) = self.value.lock() {
                g.observe(logical.width, logical.height, maximized, minimized);
            }
        }
    }
    pub fn save(&self, paths: &PortablePathService) -> std::io::Result<()> {
        if self.save_allowed {
            let g = *self
                .value
                .lock()
                .map_err(|_| std::io::Error::other("Window state busy"))?;
            paths.write_json("window.json", &g)?;
        }
        Ok(())
    }
}
pub fn save_on_exit(app: &tauri::AppHandle) {
    let memory = app.state::<WindowMemory>();
    if let Ok(paths) = app.state::<Mutex<PortablePathService>>().lock() {
        if let Err(e) = memory.save(&paths) {
            eprintln!("Window state save failed: {e}");
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn normal_size_survives_maximize_and_minimize() {
        let mut g = Geometry::default();
        g.observe(1380.0, 940.0, false, false);
        g.observe(1920.0, 1080.0, true, false);
        g.observe(0.0, 0.0, false, true);
        assert_eq!((g.width, g.height, g.maximized), (1380.0, 940.0, true));
    }
    #[test]
    fn portable_roundtrip_and_corrupt_file_preserved() {
        let temp = tempfile::tempdir().unwrap();
        let paths = PortablePathService::for_test(temp.path()).unwrap();
        let memory = WindowMemory::load(&paths).unwrap();
        memory
            .value
            .lock()
            .unwrap()
            .observe(1400.0, 900.0, false, false);
        memory.save(&paths).unwrap();
        assert_eq!(
            WindowMemory::load(&paths).unwrap().initial(),
            (1400.0, 900.0, false)
        );
        let file = paths.managed_file("data/settings", "window.json").unwrap();
        fs::write(&file, b"invalid").unwrap();
        WindowMemory::load(&paths).unwrap().save(&paths).unwrap();
        assert_eq!(fs::read(file).unwrap(), b"invalid");
    }
}
