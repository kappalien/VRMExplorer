# Architecture

React UI → typed Portable service → Tauri IPC → Rust PortablePathService。前端不接收任意寫入路徑；只傳入經驗證的設定。Zustand 保存 UI 設定；Rust Mutex 序列化 JSON 存取。

Rust 在 WebView 建立前以 current_exe 定位根目錄，檢查受控子目錄、拒絕 symlink/Windows reparse point，測試寫入；設定以同目錄暫存檔 sync + persist 替換。讀取失敗不覆蓋設定。沒有 AppData fallback。路徑檢查不能防禦另一個本機程序在檢查後惡意替換目錄的 TOCTOU；後續安全強化需以 Windows handle-based 存取評估。

WebView 由 Rust 建立，明確指定 data_directory。Capability 不授予 fs/shell/plugin 指令；應用 commands 僅 load_settings/save_settings。CSP 不允許外部網路資產。Phase 1 的 picker 授權 broker 尚未建立。

3D engine、Explorer、動畫 state、SQLite repository 將分開實作；Phase 0 不安裝尚未使用的 Three/VRM 套件。
