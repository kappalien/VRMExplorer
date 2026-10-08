# Development

2026-10-08 最新檢查：Windows NT 10.0.26300.0 x64、Node 24.21.0、npm 11.19.0、WebView2 154.0.4258.62、Rust/Cargo 1.99.0、stable-x86_64-pc-windows-msvc、MSVC Visual Studio Build Tools 2026。使用者已準備工具鏈，首次開發時的缺少 Rust 阻礙已解除。本次沒有安裝或修改系統工具鏈。

依 [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) 準備 Rust stable x86_64-pc-windows-msvc 與 Microsoft C++ Build Tools (Desktop development with C++)；重新啟動 terminal 後執行 npm ci、npm run tauri dev。不要把 browser npm run dev 當桌面驗收。

驗證命令：npm run build、npm run lint、npm test、npm run format:check；Rust 準備好後 cargo test --manifest-path src-tauri/Cargo.toml、cargo fmt --manifest-path src-tauri/Cargo.toml --check、cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings。

npm 依賴使用 exact 與 package-lock.json。Cargo.lock 已產生並保存；驗證使用 --locked，實際解析版本與授權見 docs/dependencies.md。

已執行 npm run tauri build -- --debug --no-bundle，產生 src-tauri/target/debug/vrm-explorer.exe，內含前端資產，啟動不需要 Vite server。首次編譯發現 Windows resource 必須有 icon.ico，已加入原創 SVG 與 Tauri CLI 產生的圖示。重建圖示：npm run tauri icon -- src-tauri/icons/app-icon.svg。

本環境 sandbox 的 Rust 工具鏈存取需要 elevated execution；一般使用者環境可在普通 shell 開發。desktop smoke test 只写 target 下的 Portable data，不修改原始素材。
