# Release

Phase 0 沒有正式 ZIP。npm run tauri build -- --no-bundle 在工具鏈完整時建立 exe；單一 EXE 不是 Offline Portable 驗收。

Phase 6 才建立 Standard/Offline staging、版本、SHA256 與合法 Runtime 配套。乾淨機驗收需 Windows 10/11、無 Node/no-admin/no-network、無系統 WebView2（Offline）、GPU/WebGL 與 DPI。

升級不得覆寫 data 或 plugins/external。SQLite 尚未建立，後續設計 migration backup、WAL checkpoint 與安全關閉，不能在執行中複製單一 db 當備份。
