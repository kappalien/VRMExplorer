# VRM Explorer — 最終版開發需求與 Codex 執行規格

> 文件版本：1.0  
> 文件日期：2026-10-08  
> 專案定位：Windows 10/11 x64、離線優先、可攜式（Portable First）的 VRM / VRMA / 圖片素材瀏覽與預覽工具  
> 用途：將本檔放置於 Git Repository 根目錄，交給 Codex 作為專案規格；先實作 Phase 0，依階段驗收後再繼續。

## 0. 給 Codex 的最高優先級指令

你是此專案的資深 Windows 桌面軟體工程師、技術架構師及 QA 工程師。請依本文件設計並實作**真正可以在 Windows 執行**的應用程式，不要只做網頁 Prototype 或靜態 Mockup。

1. **Portable First**：首要交付物是 `VRMExplorer-Portable-Offline-win-x64.zip`，解壓後可啟動，不需執行安裝程式、不需 Node.js、不依賴網路、不要求管理員權限。允許 Windows 本身必要的系統元件；WebView2 若需隨附，必須按官方可用方式打包與驗證。
2. **真實功能優先**：檔案總管、VRM 模型載入、跨資料夾 VRMA 動畫播放要能實際運作。嚴禁將假資料或未完成按鈕冒充實作成果。
3. **原始素材安全**：第一版唯讀瀏覽與預覽，不修改、覆蓋、刪除 VRM、VRMA 與圖片。
4. **階段式開發**：先做 Phase 0，完成後提交檔案、測試結果、缺口與下一階段計畫；不得無條件一次實作全部階段。
5. **驗證誠實**：沒有執行的 Windows、模型格式、環境與效能測試必須標記「未驗證」，不得聲稱通過。
6. **官方來源核對**：實作前確認 Tauri 2、WebView2 Fixed Version Runtime、Three.js、pixiv three-vrm / three-vrm-animation、相關 Rust Plugin 的最新穩定版本、API、授權與相容性。不得依賴猜測的介面。
7. **繁體中文優先**：繁體中文（zh-TW）預設；所有應用 UI 字串使用 i18n，不可在元件內硬編碼。
8. **Plugin 擴充性**：第一版建立受信任內建擴充的介面與註冊機制，**不得**直接載入不可信任第三方 JavaScript、Rust DLL 或允許任意執行碼。

---

## 1. 產品目標與範圍

建立一套像 Windows 檔案總管的桌面應用程式，能瀏覽任意經使用者授權的本機資料夾，辨識 `.vrm`、`.vrma` 及圖片，並在右側預覽區顯示 3D 角色或圖片。VRMA 動畫可與 VRM 模型位於不同磁碟或資料夾；使用者可從獨立動畫素材庫或原生檔案選擇器挑選動作，立即套用到目前 VRM 播放。

### 1.1 第一版正式支援

- Windows 10/11 x64（具體最低系統組建須根據 Tauri/WebView2 官方相容性確認）。
- VRM 0.x 與 1.0（以相容測試樣本驗收，不宣稱任何檔案都可載入）。
- VRMA（以官方 three-vrm-animation 可解析的動畫格式與模型骨架綁定能力為準）。
- 圖片：PNG、JPG/JPEG、WebP、BMP。
- Windows 風格檔案瀏覽、排序、篩選、圖片預覽、VRM 模型視角操作、VRMA 播放控制。
- 複數動畫來源資料夾、索引、搜尋、收藏、最近使用。
- Portable 資料保存、搬移後相對路徑復原、遺失路徑重連結。
- 繁體中文與英文完整翻譯，另外保留日文、簡體中文擴充結構。
- Light/Dark/System 佈景、鍵盤操作與基本無障礙設計。
- 安全的內建 Plugin API 基礎。

### 1.2 暫不列入第一版

- 模型與動畫編輯器、修改骨骼並回存原檔。
- 大量模型同步展示、影片/GIF 動畫縮圖、動態預覽片段、直播錄影。
- 外部 Plugin Marketplace、不可信任 Plugin 的任意執行、線上雲端同步。
- 安裝型 MSI/NSIS、macOS/Linux 正式發行。
- FBX/BVH/GLB 作為直接兼容格式（可留擴充點，後續須實作格式解析與骨架轉換）。

---

## 2. 技術選型與約束

| 層級 | 技術 | 用途與原則 |
|---|---|---|
| 桌面外殼 | Tauri 2 | Windows 原生視窗、權限模型與發行 |
| Native Backend | Rust | 安全檔案存取、掃描、SQLite、Portable Path、索引 |
| 前端 | React + TypeScript Strict + Vite | 元件化 UI 與型別安全 |
| UI | Tailwind CSS + shadcn/ui + Lucide React | Windows 風格且可維護的介面 |
| 狀態 | Zustand | 瀏覽、模型、動畫、設定與播放狀態分離 |
| 3D | Three.js WebGL | VRM 模型渲染及攝影機操作 |
| VRM | @pixiv/three-vrm | 模型解析、VRM 元件操作 |
| VRMA | @pixiv/three-vrm-animation | 動作解析、轉換、綁定 |
| i18n | i18next + react-i18next | UI 語言即時切換與 fallback |
| 使用者設定 | 統一 PortablePathService + JSON/Tauri Store 適配層 | 僅寫 Portable data/；不得無意使用 AppData |
| 素材索引 | SQLite + Rust 資料存取層 | 搜尋、收藏、來源目錄、遷移 |
| 單元測試 | Vitest（前端）、Rust tests | 模型之外的邏輯、路徑與索引 |
| E2E | Playwright（Web UI）+ Windows 桌面啟動/互動測試 | 不得以瀏覽器測試冒充 Tauri 桌面測試 |
| 套件管理 | npm + package-lock.json | 鎖版、可重現安裝 |

**依賴原則：** Tauri Plugin、Rust crates 與 npm 套件版本必須由 Codex 當時核對；只寫明主要技術，不硬編未知版本。若 WebGL/WebView2 存在相容性問題，優先修正與建立驗證測試，不無聲更換架構。

### 2.1 必須保持模組分界

- React UI 不直接執行任意檔案系統存取。
- Rust Command / Repository 層負責受權範圍內的本機檔案讀取、檔案掃描及資料庫。
- 3D Preview Engine 封裝 Three.js renderer、scene、camera、controls、VRM 和 AnimationMixer 的生命週期。
- VRM（模型身分）與 VRMA（動作身分）在狀態及資料模型中分離；不能因動畫切換重新載入模型。
- 避免直接將 Windows 絕對檔案路徑嵌入 `file://` 供 WebView 載入；採 Tauri 2 官方安全的檔案資料傳輸方案（例如經授權的 Rust 二進位讀取、受控 asset 協定/範圍或檔案選擇流程）。實作必須驗證權限與大型檔案效能。

---

## 3. 介面與 UX 規格

### 3.1 主畫面分區

```text
┌──────────────────────────── VRM Explorer ──────────────────────────────────┐
│ ← → ↑  [目前磁碟/資料夾路徑                                    ] [搜尋][⚙]│
├────────────────┬──────────────────────┬────────────────────────────────────┤
│ 左側導覽       │ 中央檔案瀏覽器       │ 右側預覽工作區                     │
│ 磁碟機         │ 縮圖/清單/詳細模式   │ ┌────────────────────────────────┐ │
│ 資料夾樹       │ .vrm                 │ │      VRM 3D / 圖片預覽         │ │
│ 常用資料夾     │ .vrma                │ └────────────────────────────────┘ │
│ 收藏資料夾     │ 圖片                 │ 模型資訊、視角與縮放               │
│ 最近使用       │ 搜尋/排序/篩選       │ ────────────────────────────────── │
│                │                      │ [動畫素材庫] [單一檔案]           │
│                │                      │ 來源資料夾/動畫清單/搜尋          │
│                │                      │ ▶ 暫停 ■ 停止 ⟳ 時間軸 速度       │
├────────────────┴──────────────────────┴────────────────────────────────────┤
│ 檔案數量 ｜ 模型 ｜ 動畫 ｜ 掃描與載入狀態 ｜ 錯誤訊息                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

- 三欄分隔線可拖動、右側動畫區可收合、記住每區尺寸。
- 上方有路徑輸入、上一層/上一個/下一個路徑、全域或目前資料夾搜尋。
- 左欄磁碟機/資料夾樹、常用、收藏、最近使用。
- 中欄清單、詳細資訊、縮圖三種模式；顯示檔名、類型、大小、修改日期；篩選、副檔名、排序。
- 右欄預覽模型或圖片、顯示 Metadata；下方獨立 VRMA 選擇面板。
- 狀態列顯示總數、選取數、目前模型/動畫、進度/警示。
- 右鍵選單：預覽、複製路徑、於 Windows 檔案總管顯示、加入收藏；不得包含破壞性檔案操作。
- 所有互動可操作，無功能控制項在 MVP 階段應隱藏或標示未提供，不可設置假的按鈕。

### 3.2 VRMA 動畫選擇面板

**分頁 A — 動畫素材庫**：多個來源資料夾、可遞迴掃描、搜尋、排序、收藏、最近使用、來源路徑、檔案遺失狀態。  
**分頁 B — 單一檔案**：按「選擇 VRMA」打開 Windows 原生檔案對話框，允許任何已授權位置，並可選加入素材庫或最近使用。

- 模型位置例如 `D:\Models\A.vrm`，動畫位置例如 `E:\Motions\Dance\B.vrma`，必須能正常配對。
- 換動畫保留模型、3D 取景和場景；只更換 AnimationClip/Action。
- 換模型保留動畫選取紀錄，嘗試對新 VRM 重新綁定，失敗時顯示相容性狀態及修正提示。
- 若尚無模型，仍可選 VRMA，但播放控制應合理停用並顯示需選擇模型。
- 可支援拖曳 .vrm/.vrma 至各自的預覽目標；拖曳路徑須接受相同的權限與有效性驗證。

### 3.3 視覺與易用性

- 預設繁體中文、遵守 Windows 鍵盤慣例、良好焦點/選取狀態。
- Light、Dark、Follow System；設計 Token 化，方便 Plugin panel 沿用。
- 針對高 DPI、125%/150%/200% Windows 縮放與窄視窗實測。
- 初次開啟提供簡明空狀態與「開啟資料夾」、「開啟 VRM」、「選擇 VRMA」動作。
- 不把資料夾掃描或縮圖處理放在 React 主要執行緒阻塞 UI。

---

## 4. 檔案瀏覽與預覽規格

### 4.1 Explorer

- 列出磁碟與受授權資料夾，進入資料夾、返回/前進/上一層。
- 支援中文、空格、長路徑與 Unicode；處理權限拒絕、無效/消失路徑、USB 拔除。
- 檔案搜尋以當前資料夾為主，素材庫提供跨已索引資料夾搜尋。
- 遞迴掃描必須可取消、可報告進度，避免 symlink/junction 循環與越界；應限制深度/工作併發。
- 詳細清單可虛擬化；縮圖 Lazy Loading、並行數量限制；避免一次開啟大量模型。
- 預設唯讀；不得移動、刪除或更名使用者原始素材。

### 4.2 VRM 預覽

- 支援 VRM 0.x、VRM 1.0，使用 three-vrm loader；錯誤時友善提示，避免空白畫面。
- 提供旋轉、平移、縮放、重置、自動置中/取景、正背左右視角。
- 地面格線、座標軸、背景色、基本燈光可切換。
- Metadata：檔名、VRM 版本、模型名稱、作者、描述、授權/使用限制（原檔有提供時）、檔案大小、骨骼/mesh/材質/三角形數量（可計算時）；未提供需如實標示。
- VRM Meta 的授權描述應忠實呈現，不假設所有模型均允許商用/二次散布。
- renderer 單例生命週期管理；模型更換後清理 geometry、material、texture、mixer、event handlers 與 GPU 資源；處理快速切換的競態與取消。

### 4.3 VRMA 動畫

- 使用 pixiv 的 `VRMAnimationLoaderPlugin`、`createVRMAnimationClip` 與 `THREE.AnimationMixer`（以實際官方 API 為準）。
- 檢查內容格式與所需 VRMA 擴充，不以副檔名當作有效證明。
- 支援播放/暫停/停止/重播、循環開關、進度條拖曳、顯示目前時間與總時長、播放速度 0.25/0.5/1/1.5/2 倍。
- 切換模型時重新綁定動作；若無法建立有效 Clip 或骨架缺少必要映射，顯示相容性錯誤。
- 播放/暫停/停止狀態應與 Mixer 真實狀態同步；停止後姿勢重設策略明確記錄。
- 切換動作時清理舊 action，且不得額外建立多個 render loops。

### 4.4 圖片

- PNG、JPEG、WebP、BMP；適應視窗/原尺寸、縮放、平移、旋轉檢視（不改檔案），顯示解析度與大小。
- 大尺寸圖片採限制記憶體策略；失敗顯示提示。

---

## 5. 動畫素材庫、索引與快取

### 5.1 素材庫資料

來源目錄至少記錄 `id, displayName, path, pathKind, recursive, enabled, lastScanAt, scanStatus`。動畫紀錄至少記錄 `id, sourceId, relativeOrAbsolutePath, fileName, fileSize, modifiedTime, favorite, lastUsedAt, durationIfAvailable, missingStatus`。所有資料庫 schema 必須含版本與 Migration。

- 可添加多個來源、啟用/停用、重新掃描、取消掃描。
- 重啟仍保存資料夾、收藏、最近使用。
- 檔案不見標記 Missing，**不可自行清除收藏/標籤**；可重新連結檔案或整個來源目錄。
- 索引由 Rust 執行，SQLite 本地存放；不要把二進位模型完整存入 DB。
- 大型掃描分批寫入、批次更新狀態、顯示進度。

### 5.2 縮圖

- 圖片縮圖與 VRM 模型快照儲存在 `data/cache/thumbnails/`，不可寫入原始素材目錄。
- 以標準化路徑、大小、修改時間、快取格式版本產生鍵；評估變更後清除/更新。
- 背景產生、可取消與可限制併發；縮圖總大小可設定、可手動清除、毀損可重建。
- VRM 快照批次產生可於後續階段完成；第一版優先確保單一模型預覽正確。

---

## 6. Portable First：正式發行架構

### 6.1 發行形式

優先交付：

1. `VRMExplorer-Portable-Offline-win-x64.zip`：包含可執行主程式與經確認可合法再散布、可在無網路環境使用的必要 WebView2 Fixed Version runtime 或官方等效解決方案。**此為最高優先級驗收目標。**
2. `VRMExplorer-Portable-Standard-win-x64.zip`：較小，依賴目標電腦已安裝相容的 WebView2 Runtime；不可宣稱在沒有該 runtime 時仍可使用。

這兩個版本共用相同程式碼、資料格式與 Plugin API；並附版本、SHA-256 與操作說明。Installer（MSI/NSIS）不是第一版交付物。

**重要：**「Portable」指不需安裝本應用程式，不等於 Windows 沒有任何既有執行環境相依。不可把一般 Tauri build 直接單獨複製成 EXE 就宣稱完整 Portable。Fixed Version WebView2、User Data Folder、啟動順序與授權必須實際驗證。若指定 Tauri 版本無法滿足真正離線免安裝目標，需提出可行的官方支援方案並明確列出阻礙，**不可假完成**。

### 6.2 建議 ZIP 結構

```text
VRMExplorer-Portable/
├── VRMExplorer.exe
├── data/
│   ├── settings/config.json
│   ├── database/vrm-explorer.db
│   ├── cache/thumbnails/
│   ├── cache/metadata/
│   ├── logs/
│   ├── sessions/
│   └── plugins/
├── plugins/
│   ├── builtin/
│   └── external/          # 保留目錄；第一版不執行不可信任 Plugin
├── locales/               # 若編譯入應用資產，請記錄其實際儲存方式
└── runtime/webview2/      # Offline 版本使用；實際子目錄依官方打包方案
```

實際可包含 Tauri sidecars/DLL 等必要檔案。`data/`、`plugins/external/` 須被視為使用者資料，升級時不得覆寫。內建 Plugin 與語言資產可採編譯封裝或受控檔案，但應說明發行方式。

### 6.3 PortablePathService

- 從**執行檔實際位置**而非 Current Working Directory 定位 Portable Root。
- Rust 統一管理設定、DB、快取、log、plugin data 路徑；前端不得硬編 AppData 或 OS-specific path。
- 檔案可放於同資料夾、USB 磁碟或外部磁碟；路徑模型需有 `pathKind`（如 portableRelative/externalAbsolute）、`sourceId`、可重定位資訊。
- 當磁碟代號由 D: 改 E:，Portable 內資料用相對路徑自動復原；外部素材若無法定位則保留記錄、標記 Missing 並讓使用者重新連結。
- 實際防止符號連結、Junction、Path Traversal 超出授權範圍；相對路徑不代表可以繞過 ACL。
- 偵測 Portable Root 不可寫（USB 防寫、唯讀磁碟等），顯示明確錯誤；不得靜默改寫到 AppData。可提供明確的唯讀瀏覽模式，但該模式不得宣稱會保存設定。
- 不需管理員權限；完整產品不可默默寫資料到 Registry 或使用者 AppData。Windows/WebView2 暫存、Crash Dump 等若受 OS 管理，需列出已知例外並測試。

### 6.4 WebView2 策略

- **Standard**：啟動時判斷系統是否有可用 WebView2；缺失時呈現可理解的錯誤與使用說明，不得倚賴線上下載。
- **Offline**：核對 Tauri 2 + WebView2 官方對 Fixed Version Runtime 的啟動與設定方法；隨包交付必要 binaries，在應用啟動 WebView 前設定 runtime 來源和資料資料夾。
- 應評估 WebView2 user-data 目錄設在 `data/webview2/`，避免預設位置破壞可攜性；確認 API 支援與生命週期清理。
- 調查 GPU/WebGL、WebView2 版本與相容性、Windows 10/11 權限，以及合法再散布要求。
- 警告：不能僅依安裝器的 `webviewInstallMode` 推論解壓縮 Portable EXE 可獨立使用。

### 6.5 更新與 SQLite

- 第一版採手動 ZIP 升級，不需要自動更新。
- 發行部署必須能覆蓋程式檔而保留 `data/` 與外部 Plugins。
- SQLite schema migration 需有可回滾/備份策略；使用 WAL 時，關閉或備份資料庫前需正確處理 WAL/SHM，不可把執行中的單一 `.db` 檔當完整備份。
- 升級失敗不得破壞收藏、路徑索引或設定。

---

## 7. i18n 與主題設計

- 使用 `i18next` + `react-i18next`。
- **zh-TW 預設、en 完整支援**；`ja`、`zh-CN` 保留擴充設計，未翻譯文字明確 fallback `en`，不要假裝完整翻譯。
- UI 字串皆以 keys 管理，包含錯誤、Tooltip、對話框、Plugin、播放狀態。
- 支援執行時切換語言，無需重新啟動；設定保存在 `data/settings/`。
- 使用命名空間 `common`, `explorer`, `preview`, `animation`, `library`, `settings`, `plugins`, `errors`。
- 日期、檔案大小、數字以 locale 格式化，使用合宜的複數與變數插值。
- Theme：Light/Dark/System、設計 tokens、面板分隔尺寸持久保存。
- Plugin 翻譯需支援 namespace，避免覆寫核心翻譯鍵。

---

## 8. Plugin 擴充架構與安全

### 8.1 第一版目標

建立**內建且經編譯/信任**的 Plugin Registry、Manifest、介面、生命週期與至少一個測試用內建 Plugin。未來擴充新預覽器、Metadata Provider、右鍵命令與資訊面板時不需大量改動核心。

### 8.2 介面與類型

- `PluginManifest`: `id`, `name`, `version`, `apiVersion`, `minAppVersion`, `description`, `author`, `capabilities`, `supportedExtensions`, `localizationNamespaces`, `entry`（可選，依部署模式）。
- `PluginContext`：受控制的服務、logger、i18n、註冊 hook。
- `PluginLifecycle`: discover / validate / activate / deactivate / dispose。
- `PreviewProvider`, `MetadataProvider`, `AnimationProvider`, `CommandContribution`, `PanelContribution`, `ExportProvider`。
- 插件 API 做 SemVer/能力檢查，明確規範錯誤隔離。

### 8.3 安全邊界

- 不可信任 Plugin 不可直接載入主 WebView、Rust 同進程動態函式庫或任意 Node.js/runtime 程式碼。
- Manifest 的 capability 欄位**不是沙箱**，不等於真的授權隔離。
- 未來若支援外部 Plugin，必須先評估隔離 host/process、IPC、文件簽章或信任模式、使用者權限提示、檔案存取 broker、資源限制與更新相容策略。
- 第一版 `plugins/external/` 可存在但預設不載入/不執行；UI 明確標示此功能尚未開放。
- 不使用 `eval` 或動態執行未簽署的不可信任遠端程式碼。

---

## 9. 本機檔案安全與穩定性

- Tauri 2 Capability / Permission 以最小權限配置，不全域開放檔案系統。
- 原生 Folder/File Picker 授權與後續讀取必須設計明確的路徑許可及撤銷方式。
- 對所有 Rust Commands 驗證輸入；處理 Path Traversal、Junction、symlink、存取拒絕、磁碟拔除、壞檔與併發。
- VRM/VRMA 來自不可信任本機素材；解析過程需妥善捕捉錯誤，避免程式崩潰或耗盡記憶體。
- 錯誤訊息以繁中/英文提供可操作說明，詳細技術資訊記錄於 `data/logs/`；log 不應洩漏不必要的私人路徑資訊。
- Windows 無 WebGL 或 GPU Driver 不相容時，應有可理解的錯誤處理，而非無回應。
- 在程式關閉、頁面重建、快速切換模型時要測試 GPU/事件監聽與 SQLite 資源清理。

---

## 10. 建議目錄與文件結構

```text
vrm-explorer/
├── AGENTS.md
├── README.md
├── package.json
├── package-lock.json
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── explorer/
│   │   ├── vrm-preview/
│   │   ├── animation-player/
│   │   ├── animation-library/
│   │   ├── image-preview/
│   │   ├── settings/
│   │   └── plugins/
│   ├── core/{interfaces,services,types,events}/
│   ├── stores/
│   ├── hooks/
│   ├── locales/{zh-TW,en,ja,zh-CN}/
│   ├── styles/
│   └── utils/
├── src-tauri/
│   ├── src/
│   │   ├── commands/
│   │   ├── filesystem/
│   │   ├── indexing/
│   │   ├── portable/
│   │   ├── plugins/
│   │   └── security/
│   ├── capabilities/
│   └── tauri.conf.json
├── tests/{unit,integration,e2e,fixtures}/
├── scripts/
└── docs/
    ├── requirements.md
    ├── architecture.md
    ├── portable-design.md
    ├── plugin-api.md
    ├── development.md
    ├── testing.md
    ├── release.md
    └── decisions/
```

此樹為建議而非逐字強制；若調整，請將原因寫入 Architecture Decision Record（ADR）。`AGENTS.md` 應保存核心規則及本規格文件路徑，不要只把整份需求複製進 AGENTS.md。

---

## 11. 階段實作與驗收

### Phase 0 — 專案初始化、架構、Portable 根基

**交付**：
- 檢查 Windows 環境、Rust/Tauri/node 工具鏈；確認版本及官方 API。
- 初始化 Tauri + React + TypeScript 專案，配置 TypeScript strict、Lint/Format、Vitest。
- 建立三欄 Layout Skeleton、Splitter、Light/Dark/System、繁中/英文切換。
- 建立 `PortablePathService`、Portable Root 偵測、`data/` 可寫性檢測。
- 完成 WebView2 Standard/Offline 技術可行性評估與實作計畫；能做到的部分即刻驗證，不可在未測試時宣稱 Offline 完成。
- 建立內建 Plugin API Interface（不執行外部 Plugin）。
- 建立 `docs/` 文件與 `AGENTS.md`。

**驗收**：Windows 開發版可啟動、語言/佈景切換正常、設定寫入執行檔鄰近的 Portable 測試目錄；對於 WebView2 Offline 的阻礙與測試環境有明確報告。

### Phase 1 — 檔案總管 MVP

**交付**：磁碟與資料夾瀏覽、路徑導覽、清單/詳細資訊/縮圖模式、排序/篩選、圖片預覽、基本右鍵選單、錯誤處理、設定保存。  
**驗收**：中文檔名與不同磁碟可瀏覽、檔案選取與圖片預覽可用、存取被拒絕時不崩潰。

### Phase 2 — VRM 3D 預覽

**交付**：VRM Loader、3D Canvas、攝影機操作、Metadata、模型切換、資源清理。  
**驗收**：至少各一個經授權的 VRM 0.x、1.0 測試樣本能正常顯示（沒有樣本則標記未驗證），反覆切換不出現明顯資源洩漏。

### Phase 3 — VRMA 動畫播放

**交付**：獨立單一檔案選擇器、跨磁碟選取、VRMA 解析與 Clip 綁定、播放控制、時間軸/速度/Loop、切換模型與動畫狀態。  
**驗收**：VRM 與 VRMA 分屬不同資料夾仍可播放；換動畫不重載模型；換模型重新綁定或顯示不相容資訊。

### Phase 4 — 多來源動畫素材庫

**交付**：SQLite + migration、多來源資料夾、背景索引、收藏、最近使用、搜尋、失效路徑重連結。  
**驗收**：重啟/搬移 Portable 根目錄後設定與收藏保留；外部來源換磁碟代號可手動重新定位。

### Phase 5 — 效能、快取與 Plugin 基礎

**交付**：圖片/VRM 縮圖快取、虛擬化列表、背景工作併發限制、內建 Plugin Registry、Plugin API 文件、至少一個受信任範例 Plugin。  
**驗收**：大量檔案仍可互動、快取可清除、擴充功能經註冊能運作、外部不可信程式碼不會被執行。

### Phase 6 — QA 與 Portable 正式發行

**交付**：完善測試、Windows Standard 與 Offline ZIP、SHA-256、版本/建置腳本、使用說明、升級保留資料流程。  
**驗收**：在乾淨且符合最低 OS 要求的 Windows 虛擬機或實體機，完整 Offline 包解壓後無網路、無管理員權限、未另外安裝本應用程式仍能啟動並完成 VRM/VRMA 預覽；若做不到，公開阻礙與退路，不能宣稱通過。

---

## 12. 必須執行的測試矩陣

| ID | 場景 | 驗收結果 |
|---|---|---|
| T01 | 中文、空格、Unicode 路徑 | 能瀏覽與預覽 |
| T02 | 磁碟/資料夾切換，返回/前進 | 行為正確 |
| T03 | 權限不足、拔除 USB、路徑遺失 | 顯示錯誤且不崩潰 |
| T04 | VRM 0.x 與 1.0 測試模型 | 正確載入與資訊顯示 |
| T05 | VRM 與 VRMA 位於不同磁碟 | 仍可播放 |
| T06 | 播放、暫停、停止、循環、拖曳時間軸、變速 | 與 Mixer 同步 |
| T07 | 換動畫但模型不重載 | Scene/模型實例保留 |
| T08 | 換模型但保留動畫選擇 | 可綁定或清楚報錯 |
| T09 | 損壞/不相容 VRM、VRMA | 不崩潰且有提示 |
| T10 | 圖片預覽與縮放 | 功能正確 |
| T11 | zh-TW / en 切換與 fallback | 畫面即時更新 |
| T12 | 重新啟動後設定、收藏、索引保留 | 資料完整 |
| T13 | Portable 根目錄搬移或磁碟代號改變 | 相對路徑可用、外部路徑可重連 |
| T14 | 大量檔案、取消掃描 | UI 可操作、無明顯卡死 |
| T15 | 快速切換 VRM、反覆播放動畫 | 無重複 loop/顯著資源洩漏 |
| T16 | 外部 Plugin 目錄放置不可信檔案 | 第一版不執行 |
| T17 | Standard 沒有 WebView2 | 友善報錯或指引 |
| T18 | Offline ZIP：乾淨 Windows、沒網路 | 真正能直接啟動 |
| T19 | 不需要 Admin、不需要 Node.js | 實際驗證 |
| T20 | 升級檔案，不覆寫 data/ | 收藏/DB 保留且可遷移 |
| T21 | 應用程式關閉後安全複製 SQLite | DB 完整一致 |
| T22 | Windows 125%/150%/200% DPI | Layout、字體與互動正常 |

每項測試請輸出：測試日期、OS/WebView2/程式版本、測試方式、Pass/Fail/Blocked/Not Tested、相關日誌或截圖；不得把單純的 Web UI 測試視為完整的 Windows desktop E2E。

---

## 13. 非功能需求與品質標準

- 檔案及索引掃描不得阻塞主 UI；允許取消與逐步回報。
- 不強制訂定尚未量測的毫秒級效能承諾；完成第一版後建立效能基準，記錄大資料夾、模型載入與反覆切換測試數據。
- TypeScript strict、Rust Clippy/Format、適當的 Lint、單元與整合測試。
- 核心服務採可測試介面，避免 `App.tsx` 巨型元件。
- Plugin API、資料庫 Migration 與 Portable 路徑行為有文件及測試。
- 不上傳模型或個人路徑至雲端；本機離線模式不需帳號與外部 API。
- 對使用者可能具有商業版權的 VRM/VRMA 資產，程式僅作本機唯讀操作，尊重其檔案授權條款。

---

## 14. 未來擴充方向（非第一版承諾）

- 模型透明背景 PNG 快照與批次截圖。
- VRMA 動畫影片預覽、動態縮圖、循環短片。
- 複數 VRM 模型比較、表情/姿勢面板。
- 額外格式（GLB、FBX、BVH）的解析、骨架轉換與預覽 Plugin。
- 標籤/分類、智慧搜尋與大量素材整理。
- 匯出模型/動畫預覽影片、批次轉換。
- 安全隔離的第三方 Plugin Host、授權/簽章/版本相容與 Marketplace。
- 檔案監控、索引增量更新、可選跨平台發行。

新增功能須先更新需求與 ADR，不得破壞現有 Portable Storage、VRM/VRMA 解耦與安全界線。

---

## 15. Codex 工作流程與交付格式

每個 Phase 必須遵循：

1. **Inspect**：檢查 Repository 與開發環境，確認現有程式，不覆蓋使用者未提交工作。
2. **Plan**：列出當階段檔案/模組、相依性、風險、測試方式。
3. **Implement**：分成小型可驗證變更，保持明確型別與模組邊界。
4. **Verify**：執行該環境能執行的 build、lint、測試；需要 Windows 才能驗證的項目不得假裝測過。
5. **Document**：更新 requirements、architecture、development、testing、decision records。
6. **Report**：列出「完成內容、修改檔案、測試命令與結果、風險/限制、未完成事項、下一 Phase 工作」。
7. **Stop at phase boundary**：完成並總結目前 Phase 後，等待下一個開發指令；除非使用者明確要求繼續。

禁止擅自刪除使用者資料、執行破壞性清理，或在未徵得同意情況下大幅重寫不相關模組。

### 15.1 第一次交給 Codex 的執行指令

> 請閱讀 Repository 根目錄的 `VRM_Explorer_Codex_Development_Spec_Final.md`，將其視為本專案的正式產品與技術規格。先檢查目前 Repository 與 Windows 開發環境，再完成 **Phase 0**：文件、Tauri + React + TypeScript 初始化、三欄可調整 Layout、zh-TW/en i18n、Theme、PortablePathService、Plugin Interfaces 與 Windows 開發啟動。務必核實 Tauri 2 + WebView2 Fixed Version Offline Portable 的官方可行作法，誠實標註未驗證項目。先不要實作 Phase 1–6。完成後提交檔案異動、測試結果、風險及 Phase 1 計畫。

---

## 16. 最終產品成功定義

使用者下載 `VRMExplorer-Portable-Offline-win-x64.zip`、解壓縮到可寫入的磁碟/USB、執行 `VRMExplorer.exe`，能在無網路及不需安裝此程式的情況下：

1. 以繁體中文瀏覽本機資料夾與圖片。
2. 載入 `.vrm`、旋轉/縮放/查看模型資訊。
3. 從另一個資料夾或磁碟選取 `.vrma`，直接預覽動畫。
4. 管理多個 VRMA 來源，搜尋、收藏及重複使用。
5. 關閉、重新啟動甚至搬移 Portable 資料夾後保留設定、索引與收藏。
6. 安全地預覽原始素材，不造成原始檔案異動。
7. 保留可靠的 i18n 與 Plugin 擴充接口，後續可迭代升級。

**以上須以真實 Windows 執行與測試證據確認，而不是僅靠編譯成功判定。**
