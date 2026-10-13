# VRM Explorer

[繁體中文](README.md) | **English**

A portable Windows desktop browser and viewer for VRM avatars, VRMA animations and images. Offline use and read-only original assets come first. The app defaults to Traditional Chinese and also provides a complete English interface.

## Download

- [v1.4.1 full Offline Portable package (Windows x64, approximately 302 MiB)](https://github.com/kappalien/VRMExplorer/releases/download/v1.4.1/VRM-Explorer-1.4.1-Offline-win-x64.zip)
- [SHA-256 checksum](https://github.com/kappalien/VRMExplorer/releases/download/v1.4.1/VRM-Explorer-1.4.1-Offline-win-x64.zip.sha256)
- [All releases](https://github.com/kappalien/VRMExplorer/releases)

For normal use, download the Offline ZIP above. GitHub's **Code → Download ZIP** contains source code and cannot be launched directly.

First-time users should download the **v1.4.1 full Portable package**, then use **Settings → Online updates → Update now** to get the latest version. Current releases, version history and change descriptions are available on the [Release pages](https://github.com/kappalien/VRMExplorer/releases).

The release target is **Windows 11 x64**. The extracted full package is approximately 688 MiB, mostly the bundled Microsoft Fixed WebView2 Runtime 154.0.4258.62. Users do not need Node.js, Rust or MSVC.

## Example

![VRM Explorer v1.3 screenshot: file browsing, model preview and custom pose editing](docs/images/vrm-explorer-v1.3-example.png)

Browse files on the left and preview the avatar in the center. The right panel contains Animation, Bones and Custom pose tabs. This screenshot shows the left shoulder being adjusted with rotation rings and XYZ angles; the pose can be exported as a static VRMA.

The screenshot was supplied by the user. Its model, "神秘人B", is not included in the app, source code or releases; model rights remain with the original creator. See [Asset and third-party licensing](docs/licensing.md).

## Quick start

1. Extract the full ZIP into a writable local folder.
2. Launch `vrm-explorer.exe`.
3. Choose a drive or enter a folder path on the left. Double-click a folder to open it, then click a `.vrm` to preview it.
4. Use **Select source** in the animation panel to choose a folder containing `.vrma` files. After scanning, select a filename and press **Play**. Single-frame VRMA files use **Apply pose** to hold the pose; **Stop** resets it.

The last browsing folder, VRMA source and view mode are restored on startup. Read the bundled Microsoft Runtime terms before use. See the [Portable guide](docs/portable-release.md) for operation and upgrades.

## All features

| Feature                   | Description                                                                                                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supported assets          | VRM 0.x / 1.0, VRMA, and PNG, JPG / JPEG, WebP and BMP images.                                                                                                                                                                          |
| File browsing             | Drive selection, folder path entry, folder navigation, back / forward / parent and refresh; cycle through Details, Thumbnails and Compact views. Details includes type, size and modification time. The last folder and view are saved. |
| Large lists               | Virtualized rendering mounts only nearby items; keyboard navigation and selection are supported.                                                                                                                                        |
| Model preview             | Mouse orbit, pan and cursor-centered zoom; front / back / left / right views and reframing.                                                                                                                                             |
| Scene options             | Grid, bone overlay, coordinate axes, lights and background color.                                                                                                                                                                       |
| Multiple models           | Ctrl / Shift selection in Explorer loads up to eight VRMs into one scene. Arrange side by side, select the active model, change XYZ positions and headings, or remove models. Each retains independent pose and playback state.         |
| PNG export                | Capture the current scene, camera, poses and expressions. Transparency is enabled by default. Choose a 1024 / 2048 / 4096 px longest edge and whether to include grid, axes and bone controls.                                          |
| Loading summaries         | Per-model file reading, validation / parsing, first render submission and total timings; texture counts, maximum dimensions and estimated memory. Original model information remains separate.                                          |
| Model information         | Model-provided names, authors and licenses, plus mesh, material, texture and bone information.                                                                                                                                          |
| Image preview             | View supported image assets directly.                                                                                                                                                                                                   |
| Bone inspection           | Humanoid mappings, model nodes, parent nodes, required / optional status and missing required mappings.                                                                                                                                 |
| Animation sources         | VRMA files can be on different folders or drives from models. Choosing a source scans it, provides a filename list and saves the source preference.                                                                                     |
| Playback                  | Play, pause, stop, replay, looping, 0.25×–2× speeds and a timeline; single-frame VRMA can be applied and held.                                                                                                                          |
| Expressions               | Follow animation, Neutral, Happy, Angry, Sad, Relaxed and Surprised; unsupported model expressions are disabled.                                                                                                                        |
| Custom poses              | Grouped torso, limb and finger selection; local XYZ angle sliders / numbers, on-screen bone handles and rotation rings, plus hips translation.                                                                                          |
| Pose operations           | Capture the current animation pose, reset one bone or the T pose, undo / redo. Drafts survive tab changes and can be resumed after animation playback.                                                                                  |
| Pose export               | Save a single-frame static `.vrma` and reload it later. Exports contain bone poses without models or textures and never overwrite existing files.                                                                                       |
| Thumbnails and cache      | Image thumbnails, embedded VRM covers and background head portraits; configure cache capacity, inspect usage and clear the cache.                                                                                                       |
| Language and appearance   | Traditional Chinese by default and complete English; light / dark / system themes and adjustable panel widths.                                                                                                                          |
| System settings           | File size units (automatic, B, KB / MB / GB, KiB / MiB / GiB), app version and WebView2 mode; remembers normal window size and maximized state.                                                                                         |
| Portable data             | Bundled offline WebView2. Settings, indexes, cache and WebView data live in `data/` beside the executable, with no AppData fallback.                                                                                                    |
| Online updates            | One-click checking, downloading, signature verification and restart. Separate app and Runtime packages, download cancellation, and attempted rollback if startup fails.                                                                 |
| Upgrades and asset safety | Includes a local `upgrade.ps1` and preserves personal data. Original assets are read-only. External JavaScript and DLL plugins are not loaded; app updates require signed release packages.                                             |

### Limits

- VRM thumbnails prefer embedded covers. Missing covers trigger sequential background head snapshots and caching. Initial generation takes time; invalid or overly complex models keep a file icon. See [Thumbnail caching](docs/thumbnail-cache.md).
- Each scene model retains its pose draft when the active model changes. Removing it or closing the app clears its draft. Static VRMA export excludes expressions, gaze and physics results.
- Scenes are not restored after restarting. More models and larger textures consume more CPU, GPU and memory. PNG maintains the preview aspect ratio and preserves existing files. See [Scenes and PNG](docs/scene-export.md).
- Different body proportions can cause crossed hands or intersections. IK, collisions, FBX / BVH / GLB conversion and animation recording are not included.
- `upgrade.ps1` applies an already downloaded and extracted package; it does not perform online updates.

## Data and upgrades

The `data/` folder beside the app contains personal settings, SQLite indexes and caches. Keep the entire folder when moving the Portable app.

For a manual upgrade, close the app and back up `data/`. The new package's `upgrade.ps1` verifies release files, updates executables and Runtime, and preserves user data. See the [Portable guide](docs/portable-release.md) for details and Microsoft licensing / privacy notices.

Neither the public repository nor release packages include user models, animations, databases or personal settings. Model and animation rights are determined by their original asset licenses.

## Development and build

Development requires Windows, Git, Node.js / npm, the Rust MSVC toolchain, Visual Studio C++ Build Tools and the Windows SDK. Use PowerShell:

```powershell
git clone https://github.com/kappalien/VRMExplorer.git
cd VRMExplorer
npm ci
npm run tauri dev
```

Common checks:

```powershell
npm test
npm run lint
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings
```

Build and package:

```powershell
powershell -File scripts/fetch-runtime.ps1
powershell -File scripts/build.ps1
```

`fetch-runtime.ps1` obtains the locked Fixed Runtime from Microsoft, verifies the CAB hash and signatures, and retrieves official terms. `build.ps1` runs checks, builds and packages into the local `releases/` folder. Packaging refuses to overwrite an existing same-version ZIP.

For UI inspection only, run `npm run dev`. Browser mode does not provide Portable filesystem access or settings persistence.

## Project structure

| Path             | Purpose                                                                          |
| ---------------- | -------------------------------------------------------------------------------- |
| `src/`           | React / TypeScript UI, preview engine and i18n                                   |
| `src-tauri/src/` | Rust filesystem access, Portable settings, animation indexes and thumbnail cache |
| `scripts/`       | Runtime acquisition, builds, packaging and upgrades                              |
| `tests/`         | Unit and Edge regression checks                                                  |
| `docs/`          | Architecture, usage, validation and development records                          |

`node_modules/`, `src-tauri/target/`, `build/`, `releases/`, `data/` and user VRM / VRMA assets are excluded from Git. Source, documents, screenshots, third-party notices and the MPL source archive total approximately 5.1 MiB; Portable ZIP downloads are hosted separately on GitHub Releases.

## Licensing and attribution

Original code, scripts and original documentation are licensed under the [MIT License](LICENSE). Use, modification, redistribution and commercial use, including selling copies or modified versions, are permitted. Preserve copyright and full license notices. The software is provided as is, without warranty. The grant also covers original content in previously published versions.

Third-party components, Microsoft Runtime, screenshot models and user assets retain their own terms. Their licenses do not change because this project uses MIT. See [Licensing and asset scope](docs/licensing.md). Third-party notices are in `licenses/third-party/`; MPL component source is in `licenses/mpl-sources.zip`.

The current product and technical requirements are defined by the root [Development specification](VRM_Explorer_Development_Spec.md) (Traditional Chinese).
