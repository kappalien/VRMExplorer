# Official dependency review — 2026-10-08

實作前以 npm registry `npm view` 核對：Tauri API/CLI 2.12.1（MIT OR Apache-2.0），Three.js 0.186.1（MIT），@pixiv/three-vrm 與 three-vrm-animation 3.5.5（MIT；peer three >=0.137），dialog 2.8.1 與 store 2.5.0（MIT OR Apache-2.0）。Phase 0 只使用 Tauri API/CLI；Three/pixiv/plugins 在使用階段重新核對並做實際相容測試。

Rust Tauri 官方 docs.rs 當日 stable 為 2.12.1。使用者補齊工具鏈後已保存 Cargo.lock，以 cargo metadata --locked --offline --filter-platform x86_64-pc-windows-msvc 核對：tauri 2.12.1、tauri-build 2.7.1、serde 1.0.229、serde_json 1.0.151、tempfile 3.27.0、wry 0.57.0 均為 MIT OR Apache-2.0；webview2-com 0.39.1 為 MIT。這是實際解析版本，不宣稱每項都為最新。Windows Rust build/test/Clippy 已通過。

npm 完整版本請見 package-lock.json；首次 npm install 的 audit 為 0 vulnerabilities。Fixed Runtime 尚未加入，另需核對 Microsoft 再散布條款。

API 來源：

- [Tauri 2.12.1](https://docs.rs/tauri/2.12.1/tauri/)
- [Tauri WebviewWindowBuilder](https://docs.rs/tauri/2.12.1/tauri/webview/struct.WebviewWindowBuilder.html)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Three.js 官方 repository / MIT](https://github.com/mrdoob/three.js)
- [pixiv 官方 repository / loader 與 animation examples](https://github.com/pixiv/three-vrm)
- [pixiv animation 官方 API](https://pixiv.github.io/three-vrm/docs/modules/three-vrm-animation.html)
- [Tauri Store](https://v2.tauri.app/plugin/store/)
- [Tauri Dialog](https://v2.tauri.app/plugin/dialog/)
- [Microsoft Fixed Version distribution / ACL requirements](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)

three-vrm-animation 的 VRMAnimationLoaderPlugin / createVRMAnimationClip 需在 Phase 3 與所鎖版本的型別、官方範例核對；本階段沒有臆造 loader 實作。
