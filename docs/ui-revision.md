# UI 調整 — 2026-10-08

依使用者新需求，本輪修改開發版，不重新封裝 Portable ZIP。releases/ 既有候選包保持原樣，不包含本輪 UI。

版面為左側檔案瀏覽器、中間模型／圖片預覽、右側獨立動畫素材庫與播放控制。刪除原本導覽區塊；快取設定、內建命令及 Portable 資訊移至上方「設定與工具」。兩個 Splitter 可調整左側與右側寬度，保留原設定 schema 相容性。

瀏覽入口為本機磁碟清單與地址欄，不需要先按「開啟資料夾」。資料夾單擊選取、雙擊或 Enter 進入；支援返回、前進、上一層、重新整理及返回本機畫面。檔案單擊選取供預覽，右鍵開啟／複製路徑／在 Explorer 顯示／收藏維持可用。

使用者已授權改為 Explorer 式直接瀏覽，因此新增 Rust browse_directory 命令：依使用者指定的本機絕對資料夾路徑，驗證安全路徑、讀取清單並授予本次 session 的唯讀範圍。成功瀏覽磁碟根目錄會涵蓋其子目錄。read_asset、縮圖及索引仍使用同一 Rust broker；沒有前端 filesystem API、任意寫入原始素材或 OS 權限提升。拒絕 ParentDir、reparse/symlink 及 UNC/device namespace；不存在／不可讀資料夾顯示錯誤，失敗不新增授權。手動開啟 VRM/VRMA 和新增索引來源仍可使用原生選擇器。

## 已驗證

- Rust 15 tests、Vitest 17 tests、ESLint、TypeScript/Vite build、cargo fmt/clippy 及 Tauri debug no-bundle 編譯通過。
- 新 Rust 測試覆蓋直接瀏覽中文空格資料夾、僅授權有效目錄、路徑錯誤及原檔唯讀。
- Windows 桌面獨立副本 build/ui-revision-smoke：三欄位置、直接 C:\ 瀏覽無 picker、單擊 Kappa 不換路徑、雙擊進入 C:\Kappa、返回 C:\ 實測成功。
- Edge Playwright explorer-navigation.spec.ts：以 IPC mock 掛載完整 App，驗證磁碟入口、單擊／雙擊、地址欄 Enter、返回／前進及本機畫面。1 test passed，這是瀏覽器整合測試，不代表 Rust／Windows 完整 E2E。

桌面測試期間偵測到使用者輸入，停止自動輸入以供使用者檢視。使用者自行操作後的截圖 build/ui-revision-smoke/ui-layout.jpg 可見左側已選取 VRM、中央顯示模型、右側 VRMA Clip 時長 1.57 秒與播放時間 0.72 秒；這是觀察性證據，不列作代理完成完整播放測試。新版地址欄／前進的完整原生自動化及 VRMA 各播放控制矩陣仍為 Not Tested。本輪不更新 Phase 6 ZIP，也不宣稱補完既有離線驗收矩陣。

API 已核對官方文件：[React createPortal](https://react.dev/reference/react-dom/createPortal)、[Rust Prefix](https://doc.rust-lang.org/std/path/enum.Prefix.html)。動畫控制仍由同一 PreviewEngine 處理，透過 portal 顯示於右側，不新增 renderer 或 animation loop。

## 2026-10-08 簡化介面

- 左側移除「檔案瀏覽器」標題與搜尋／篩選／排序／檢視控制區；保留資料夾瀏覽及原有已保存的檢視偏好。
- 移除左右兩側收藏星號與收藏操作，保存資料不刪除。
- VRMA 來源選擇後立即掃描；已保存來源可由下拉選單選取並重新掃描。只顯示所選來源中仍存在的檔案。
- 動作改為每列一個檔名，不顯示大小或個別長度；點選即載入，可使用播放控制。播放進度控制仍保留。
- 中央預覽高度由 360 px 改為依視窗調整的 420–900 px；滑鼠滾輪以游標位置縮放。API 已核對 Three.js 官方 OrbitControls 文件：https://threejs.org/docs/pages/OrbitControls.html#zoomToCursor 。

驗證：18 項 Vitest 通過，其中使用實際 PreviewEngine／OrbitControls、模擬 WebGL renderer，驗證偏中心點於滾輪縮放後維持相同螢幕座標。Edge UI 回歸 1 項通過，使用 IPC mock 驗證來源選擇自動掃描、簡單清單選取及左側移除控制。前端 build、lint 與 Windows debug --no-bundle 編譯通過。此輪原生 Windows 素材載入、VRMA 實際播放及滑鼠操作：Not Tested。未封裝或更新 Portable 發行包。

## 2026-10-08 位置記憶與設定頁面

最後成功瀏覽的資料夾與最後成功掃描的 VRMA 來源 ID 保存在執行檔旁 `data/settings/explorer.json`。重新啟動透過 Rust broker 還原本機唯讀存取並自動掃描該來源；資料夾遺失或存取失敗時顯示錯誤，保留保存的位置，仍可選擇其他資料夾。回到「本機」不清除最後瀏覽資料夾。VRMA 來源路徑仍由既有 Portable 資料庫保存。

右上角「設定」開啟集中設定頁面，包含語言、布景、檔案大小單位及既有快取／工具設定。原生 HTML dialog 提供模態焦點與 Escape 關閉，API 核對 WHATWG HTML Standard：https://html.spec.whatwg.org/multipage/interactive-elements.html#dom-dialog-showmodal 。設定變更自動保存。大小顯示選項：自動（1024 進位）、B、KB、MB、GB、KiB、MiB、GiB；KB／MB／GB 採 1000 進位。大小單位適用於左側檔案詳細資訊，VRMA 清單維持只顯示檔名。

舊設定缺少新欄位時使用預設值，不刪除或重建使用者資料。

驗證：Rust 17 項、Vitest 20 項通過；Edge IPC mock 回歸通過，涵蓋重新載入後還原資料夾與來源、大小格式、語言與布景保存，以及 Escape 關閉設定。lint、Rust clippy、前端 build 與 Windows debug --no-bundle 編譯通過。Windows 原生完整關閉／重啟與實際素材播放：Not Tested。未封裝 Portable。
