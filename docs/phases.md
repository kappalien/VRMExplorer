# Subsequent phases — development and QA

使用者已授權剩餘階段。以下 Phase 1–5 為歷史記錄，最新 Phase 6 見文末；這份記錄不等同正式發行驗收。

## Phase 1

已實作原生 picker 授權、Rust 唯讀 broker、磁碟列示、路徑 history、清單/詳細/縮圖、搜尋/排序/篩選、圖片 preview、收藏/最近、clipboard/reveal 與 revoke。

Rust 6 tests、Vitest 7 tests、build/lint/Clippy 通過。桌面 EXE 與原生 Folder Picker 已啟動；computer-use 對 disabled parent/owned dialog 的 element caching/activation 失敗，無法完成自動選取測試資料夾，因此真正圖片 desktop E2E 仍未驗證。已建立自有中文圖片 fixture；不把單元測試當桌面測試。

目前 grants 僅 session 存活；收藏與最近資料保存，重啟需經 picker 再授權。細項 tree、multi-select、原尺寸圖片檢視尚未實作。原本 200 items 分頁已在 Phase 5 替換為虛擬列表及 thumbnail queue。

## Phase 2–3

已加入 single PreviewEngine、VRM/VRMA 官方 loader、模型/動畫獨立 Zustand identity、mixer/time/speed/loop/stop-rest-pose、camera/grid/light、模型 metadata 與資源 cleanup。

Frontend build、Vitest 與 lint 通過；沒有使用者提供或已核對授權的 VRM 0.x/1.0 與 VRMA fixture，真實格式相容性為 Not Tested。僅接受 self-contained GLB，拒絕網路或外部 glTF URI。Loader parsing 尚無硬取消，透過 epoch 防止 stale result commit 並 dispose；大型模型仍需實測。

## Phase 4 — 開發實作，驗收未完成

Rust SQLite 素材庫保存多個來源、相對 Portable 路徑、遞迴/啟用設定、收藏與最近使用。掃描由背景 worker 分批寫入，提供進度、取消、Missing 標記及整個來源重連。Schema version 1；migration 前使用 SQLite backup API 建立備份，採 DELETE journal。

修改模組：src-tauri/src/library.rs、filesystem.rs、portable.rs、main.rs；src/features/animation-library/AnimationLibrary.tsx、locales/library.ts、i18n.ts；Cargo 與 npm dependencies/lockfiles。

已執行：cargo test --manifest-path src-tauri/Cargo.toml --locked（9 passed）；cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings（passed）；cargo build --manifest-path src-tauri/Cargo.toml --locked（passed）；npm test（9 passed）、npm run build、npm run lint（passed）。資料庫測試確認中文路徑、重掃保留收藏、Missing、取消不誤標遺失、重新開啟持久化、個別重連保留 ID/收藏/最近記錄、重複檔案保護、時長與播放時間更新、無效時長拒絕及變更後時長失效。前端測試遞迴核對所有實際使用 namespaces 的 zh-TW/en keys。測試的 VRMA 副檔名檔案僅為索引 fixture，不能證明動畫格式相容性。

本輪補齊：個別 Missing 檔案經原生 picker 重連；跨來源替代檔案建立可見來源，僅授權所選檔案，來源掃描仍需另行授權資料夾。名稱/最近播放/時長/大小排序；成功建立 Clip 後保存實際 duration，開始播放才更新最近使用。切換動畫先清除舊 action 與 clipPath，避免失敗後仍播放舊動畫並寫錯記錄。Schema 已有 duration 欄位，無須升版。

Not Tested：原生 picker 完整桌面操作、真實 VRM/VRMA 播放及時長事件的桌面整合、多磁碟/USB 搬移、大型掃描壓力、migration 備份還原。目前最多回傳 10,000 筆並分頁顯示；時長採成功預覽後按需取得，未解析過的動畫顯示「時長尚未取得」。Vite 約 1.12 MB bundle 的大小警告尚待 Phase 5 處理。未修改或重新封裝使用者原始素材。

Phase 5 下一步：縮圖快取、lazy loading/併發限制、列表虛擬化、bundle 分割及 Plugin contribution 驗證；持續追蹤上述 Not Tested 項目。依階段規則本輪停在 Phase 4。Phase 6 的 Standard/Offline ZIP 與乾淨機驗收尚未進行。

## Phase 5 — 開發交付

本階段計畫：Rust 受控快取與 decode 限制；前端可取消工作佇列、固定列高虛擬列表、延遲載入 3D；Plugin 能力與相容性檢查、命令範例、生命週期回收。沒有新增外部執行權限或依賴。

完成：圖片與 VRM 0.x/1.0 內嵌封面縮圖快取、metadata key 失效、壞檔重建、容量設定/清除、工作取消與併發限制；檔案與動畫素材庫使用虛擬列表；3D chunk 按需載入；受信任 system-info/cache-tools Plugin、SemVer/能力檢查、失敗回收與命令錯誤隔離。修正 managed_file 對 dangling symlink 的檢查，防止快取目的地繞過 Portable containment。

主要修改：src-tauri/src/cache.rs、filesystem.rs、portable.rs、main.rs；src/core/work-queue.ts、plugins.ts、assets.ts；components/VirtualList.tsx；Explorer/AnimationLibrary/PreviewWorkspace/CacheSettings；i18n、App、CSS；tests/unit/performance.test.tsx、tests/performance/*、Playwright config；docs/performance.md、plugin-api.md。

驗證：Rust 13 tests、Vitest 16 tests；cargo fmt/clippy、npm build/lint；Tauri debug no-bundle 內嵌資產建置。Edge Playwright 1 test：50,000 合成項目、DOM 數量限制、清單/網格、搜尋及 End 鍵焦點，零頁面錯誤；兩次跳轉約 16.4/18.8 ms。Preview queue 整合測試確認 rapid switching 跳過中間模型及過期讀取，採 mock renderer/loader，不是 GPU 測試。桌面獨立 Portable 副本啟動，快取上限 32 MiB 寫到該副本 data/settings/cache.json；內建空快取命令完成且無錯誤。實際有內容快取的清除由 Rust 測試確認，不將空快取桌面操作當作刪除驗證。

限制／Not Tested：VRM 提供內嵌封面，批次 3D 模型快照依 §5.2 留待後續；真實 VRM/VRMA、GPU、USB、大量原生圖片及長時間記憶體壓測尚未執行。3D chunk 約 804 kB 仍有大小警告，初始約 324 kB。取消採工作邊界檢查，沒有同步 decode 的硬中斷。動畫 DB 仍最多回傳 10,000 筆；大量磁碟索引與 SQL paging 的完整壓測需 QA。

下一階段 Phase 6：QA、真實資產相容性、Standard/Offline Portable 發行、WebView2 Fixed Runtime 合法再散布與乾淨機驗證。依 AGENTS.md，本輪停在 Phase 5。

## Phase 6 — Portable QA 候選包；正式驗收未完成

交付 Windows 11 x64 Standard / Offline ZIP、SHA-256、逐檔 manifest、版本一致性建置腳本、官方 Fixed Runtime 下載/雜湊/簽章驗證、第三方授權文件，以及白名單升級保留 data 流程。Offline Runtime 缺失時明確報錯，Standard 忽略升級留下的 Fixed Runtime；啟動不使用 AppData fallback。固定版 Runtime 完整保留 257 個官方檔案，附官方條款及 SmartScreen 隱私告知，沒有重封裝使用者素材。

驗證：Rust 14 tests、Vitest 17 tests、Edge Playwright 2 tests、ESLint、TypeScript/Vite、fmt/Clippy、optimized Tauri build。使用者 src/Vivian.vrm 為 VRM0，真實 loader/WebGL 及 Standard/Offline Windows 原生 picker/preview 均成功；中文空格 Portable 路徑、英文即時切換、Fixed 子程序路徑、ZIP CRC/manifest/hash/data 排除、QA 副本升級 data 雜湊保留、關閉後 SQLite 副本 integrity_check=ok 均有實測。

完整矩陣與限制見 [Phase 6 QA](qa-phase6.md)，操作與升級見 [Portable 發行說明](portable-release.md)。乾淨無網路/無管理員/無 Node 機器、VRM1/VRMA、多磁碟、USB/DPI/長期 GPU soak 尚為 Not Tested。UI tree、multi-select、原尺寸圖片模式及 10k+ SQL paging 仍有既有缺口。不能宣稱所有規格或正式離線驗收已完成；目前停止於最後 Phase 6 的候選發行邊界，等待上述測試環境與樣本後完成驗收。

