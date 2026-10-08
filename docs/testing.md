# Verification report — 2026-10-08

## Phase 6 current verification

最新實測、Standard/Offline 候選包及未驗收項目見 [Phase 6 QA matrix](qa-phase6.md)。以下 Phase 5 及更早內容為歷史記錄。

## Phase 5 historical verification

Rust 13 tests、Vitest 16 tests、ESLint、TypeScript/Vite build、Rust fmt/Clippy、Tauri debug no-bundle build 均已執行。新增快取/取消/限制/Plugin/虛擬列表/Preview queue 測試詳見 [Phase 5 記錄](phases.md) 與 [效能文件](performance.md)。

`npm run test:performance`：本機已安裝 Edge，50,000 合成項目清單/網格/搜尋/End 焦點 1 test passed，零 page errors，一次跳轉約 16.4 ms。這是 UI component 的真實瀏覽器測試，不是原生磁碟或 WebView2 GPU 壓測。

computer-use 桌面副本位於 target/phase5-smoke，未複製使用者 data：成功啟動、展開縮圖快取、設定 32 MiB 並核對 cache.json；空快取的 builtin.cache-tools 命令正常完成。快取有內容清除、原檔不變、毀損重建、授權拒絕由 Rust 測試驗證。真實 VRM/VRMA、縮圖 picker 整合、乾淨機、USB/長期記憶體為 Not Tested。

## Phase 0 historical verification

App 0.1.0 / Phase 0；Windows NT 10.0.26300 x64，WebView2 154.0.4258.62，Rust/Cargo 1.99.0，MSVC Build Tools 2026，Node 24.21.0 / npm 11.19.0。

| Check                                                                                   | Result | Evidence / scope                                                                      |
| --------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| npm run build                                                                           | Pass   | TypeScript strict + Vite production assets                                            |
| npm run lint                                                                            | Pass   | ESLint + React hooks                                                                  |
| npm test                                                                                | Pass   | 4 Vitest tests，設定邊界、Plugin lifecycle、external entry 拒絕、i18n parity/fallback |
| npm run format:check                                                                    | Pass   | Prettier source/docs；文件更新後重新檢查                                              |
| npm run tauri info                                                                      | Pass   | Rust/MSVC/SDK/WebView2 已可用                                                         |
| cargo test --manifest-path src-tauri/Cargo.toml --locked                                | Pass   | 4 tests：JSON round-trip/traversal、壞檔保留、中文根目錄搬移、無效設定不得覆蓋        |
| cargo fmt --manifest-path src-tauri/Cargo.toml --check                                  | Pass   | sandbox 需 elevated execution，正常執行後 exit 0                                      |
| cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings | Pass   | exit 0，無 warning                                                                    |
| npm run tauri build -- --debug --no-bundle                                              | Pass   | src-tauri/target/debug/vrm-explorer.exe，embedded assets，不使用 Vite server          |
| Windows desktop startup                                                                 | Pass   | 實際 Tauri 視窗、內建資訊面板與 Settings saved，使用 computer-use @oai/sky            |

首次 Windows 建置因缺少 icons/icon.ico 失敗；加入原創 SVG、以 Tauri CLI 產生 ICO/PNG 後成功，並在 config 指定圖示。Cargo.lock 已產生。

## Desktop smoke evidence

實測的是上述 EXE，SHA-256：`C2BB25DE4F699889FF3A92164318D79801C0B9F83715FD2C6B19D1971BF6B047`。

1. 從 TEMP 工作目錄啟動 EXE，畫面顯示 Portable Root 為 src-tauri/target/debug，非 CWD。確認 data/settings/config.json 與 data/webview2/EBWebView 在 exe 旁。
2. 首次啟動繁中、system Theme；桌面截圖確認三欄、內建資訊面板、狀態列。
3. 語言選單滑鼠展開可用；工具點擊 option 時遇到 msedgewebview2 Chrome Legacy Window 對象不符。改用關閉選單後方向鍵，成功即時切換英文，完整畫面文字更新。
4. Tab 移動至 Theme，再以 Up 選 Dark；實際畫面變深色。Light 與 System 畫面僅以首次跟隨系統的淺色結果觀察，未切換 OS Theme。
5. 左分隔線滑鼠拖曳 220 → 277px；click focus + Right 277 → 287px。config 實際保存 en/dark/navigationWidth=287/previewWidth=380。
6. 用桌面關閉鈕結束，再從 TEMP 工作目錄啟動。畫面與 accessibility tree 確認 English、Dark、287px、Settings saved 保留。
7. 在 target 下全新 phase0-smoke-* 測試目錄複製 EXE 與設定，搬移目錄至含「搬移後」中文名稱，再啟動。確認根目錄指向新位置、English/Dark/287px 保留、新 data/webview2 產生。僅覆蓋測試副本，未修改原素材；未測磁碟代號改變。
8. 關閉搬移副本，恢復這次產生的開發版設定為 zh-TW/system/220，再啟動主 EXE 供檢視。

截图由 desktop tool inline 顯示於開發對話；嘗試保存圖像至 docs/evidence 被 node tool filesystem 拒絕，沒有交付獨立 screenshot 檔案。以上文字是實測摘要，不是虛構的 UI automation log。實際設定可在 target/debug/data/settings/config.json 檢查，搬移測試路徑保存於 target/phase0-smoke-path.txt。

## Specification matrix

| IDs     | Status                             | Method / remaining work                                                                |
| ------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| T01–T10 | Not Tested                         | Phase 1–3 素材功能未實作；中文 Portable Root 已測，不冒充素材瀏覽                      |
| T11     | Pass (Phase 0 scope)               | desktop zh-TW→en、Theme dark、i18n unit fallback；Japanese UI 和 OS Theme 動態切換未測 |
| T12     | Pass (settings only)               | 實際 desktop restart；收藏/SQLite 未實作                                               |
| T13     | Pass (Portable settings only)      | 實際 root 搬移與中文目錄；跨磁碟/外部來源重連未實作                                    |
| T14–T15 | Not Tested                         | 後續掃描/3D 資源測試                                                                   |
| T16     | Not Tested (desktop file scenario) | Registry 拒絕 external entry 單元測試 Pass；未在外部目錄置惡意檔案測試                 |
| T17     | Not Tested                         | 缺 Runtime 的 native error 场景未測                                                    |
| T18–T19 | Not Tested                         | 無網路、無 Node、no-admin、clean VM、Offline Runtime 包未測；目前使用系統 Runtime      |
| T20–T21 | Not Tested                         | 後續發行/SQLite 功能                                                                   |
| T22     | Not Tested                         | 不改動使用者 OS 縮放；125/150/200% 矩陣未测                                            |

未執行 Playwright、VRM/VRMA 樣本、效能測試、完整桌面 E2E 或 Process Monitor 全寫入追蹤。不能從 desktop smoke 推論正式 QA 通過。

Phase 0 基本驗收完成，依規格停在階段邊界。Phase 1 計畫：原生 Folder/File Picker 與可撤銷授權 broker、唯讀 listing、磁碟/路徑 history、排序/篩選/檢視、圖片預覽、右鍵命令；加入 traversal/junction、中文素材路徑、消失目錄與權限拒絕測試。
