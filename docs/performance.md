# Phase 5 — 效能與快取

檔案清單與動畫素材庫使用固定列高 `VirtualList`，僅掛載 viewport 加前後各 3 列；縮圖模式依面板寬度計算欄數。Arrow/Home/End 可跨未掛載項目移動並將焦點放到實際按鈕。縮圖移出窗口時釋放 Object URL；錯誤回退圖示，完整預覽仍有錯誤提示。

Rust `cache.rs` 僅寫入執行檔旁 `data/cache/thumbnails/`。鍵為格式版本、canonical path、大小、nanosecond 修改時間的 SHA-256，核對 [RustCrypto sha2](https://docs.rs/sha2/0.10.9/sha2/)。cache hit 仍需有效 broker 授權及存在的原檔。PNG 最大 192×192、entry 1 MiB；毀損從原檔重建。解碼核對 [image 0.25.10 ImageReader/limits](https://docs.rs/image/latest/image/struct.ImageReader.html)：原始圖片 32 MiB、尺寸 20,000、decode allocation 128 MiB，不改原檔。

VRM 0.x 使用 meta.texture → textures[].source；VRM 1.0 使用 [官方 meta.thumbnailImage](https://raw.githubusercontent.com/vrm-c/vrm-specification/master/specification/VRMC_vrm-1.0/meta.md)。只接受 GLB BIN bufferView 封面，檢查 container/JSON 長度、索引、offset/length/declared buffer size，拒絕外部 URI。單元測試的合成封面容器不能當作可播放模型；沒有封面時保留圖示。批次 3D 渲染快照依規格 §5.2 留待後續。

前端 WorkQueue 上限 2 個 thumbnail IPC、128 個排隊工作。AbortSignal 可移除未開始工作；執行中的取消仍占 slot 直到原工作完成，避免併發超標。Rust 接受最多 3 個 image/thumbnail workers（2 縮圖與 1 預覽的容量），超出回報 busy；共用 decode mutex，最多 1 張解碼。導航/清除提升 epoch，於 I/O、decode、commit 邊界檢查。同步解碼本身沒有硬中斷。

設定上限 16–2048 MiB，預設 256 MiB，存於 `data/settings/cache.json`。啟動、減少上限與新增快取時套用容量限制，依建立時間移除最舊 entry（不是 LRU）。清除只處理 `v1-` + 64 lowercase hex + `.png` 專用 namespace，不遞迴刪除資料夾，其他檔案/目錄保留。損毀設定報錯並保留，不自行覆寫，不新增 AppData fallback。

選取 VRM/VRMA 後才 import 本地編譯的 3D chunk；這是專案內程式碼，沒有外部 Plugin/遠端執行入口。初始 JS 約 324 kB、3D chunk 約 804 kB；後者仍有 Vite >500 kB warning，未隱藏。模型/動畫共用 1 個載入 slot，最多保留最新模型與動畫的 2 個待執行工作。切換時取消同類排隊工作，已執行工作完成讀取後檢查 epoch，舊結果不進入 parser；已開始解析的 stale 結果仍會 dispose。Preview queue 測試使用 mock renderer/loader，不能當作真實 GPU/格式測試。大型模型 parsing 仍在 WebView 主執行緒。

已執行 Rust 快取測試、前端虛擬 DOM/取消/Plugin/Preview queue 測試，以及已安裝 Edge 的 Playwright harness：50,000 合成項目可切換清單/網格、搜尋、End 跳轉及焦點，零頁面錯誤。本機兩次 End 導航約 16.4/18.8 ms，非效能 SLA。Harness 沒有被 production entry 引用，不封裝測試資料；它不是 50,000 個磁碟檔案或圖片解碼壓力測試。

Rust 併發計數使用 AtomicUsize::try_update；核對 [Rust 官方 atomic 原始碼](https://raw.githubusercontent.com/rust-lang/rust/master/library/core/src/sync/atomic.rs) 與本機 Rust 1.99 compiler。舊 fetch_update 在 1.99 deprecated，未抑制警告。

Not Tested：大量真實圖片、真實 VRM 封面與動畫、GPU/USB 壓力、長期記憶體趨勢、撤銷/清除與實際解碼並行的長期競態。TOCTOU 路徑風險仍待 handle-based 開檔強化；目前重驗 reparse/path containment，寫入前重驗原檔 metadata。
