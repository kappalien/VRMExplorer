# VRM Explorer v1.3 (codex開發)

Windows 桌面 VRM／VRMA／圖片素材瀏覽與預覽工具。以離線使用及可攜式為優先，原始素材唯讀；繁體中文預設，支援英文介面。

## 下載

- [v1.3 Offline 可攜版（Windows x64，約 310 MiB）](https://github.com/kappalien/VRMExplorer/releases/download/v1.3.0/VRM-Explorer-1.3.0-Offline-win-x64.zip)
- [SHA-256 校驗碼](https://github.com/kappalien/VRMExplorer/releases/download/v1.3.0/VRM-Explorer-1.3.0-Offline-win-x64.zip.sha256)
- [所有發行版本](https://github.com/kappalien/VRMExplorer/releases)

一般使用者請下載上面的 Offline ZIP。GitHub 的 **Code → Download ZIP** 是原始碼，不能直接啟動。

目前發行目標為 **Windows 11 x64**。完整解壓後約 685 MiB，主要是隨附 Microsoft Fixed WebView2 Runtime 154.0.4258.62；使用程式不需安裝 Node.js、Rust 或 MSVC。

## 使用範例

![VRM Explorer v1.3 使用範例：檔案瀏覽、模型預覽與自定義姿勢編輯](docs/images/vrm-explorer-v1.3-example.png)

左側瀏覽模型檔案，中央預覽角色；右側可切換動畫、骨骼及自定義姿勢分頁。圖中示範選擇左肩骨骼，以旋轉環與 XYZ 角度調整姿勢，並可匯出靜態 VRMA。

截圖由使用者提供，展示模型「神秘人B」不隨程式、原始碼或 Release 提供；模型權利仍屬原作者。[素材與第三方授權說明](docs/licensing.md)

## 快速開始

1. 將完整 ZIP 解壓至本機可寫入的資料夾。
2. 開啟其中的 `vrm-explorer.exe`。
3. 左側選擇磁碟或輸入資料夾路徑，雙擊資料夾進入，點選 `.vrm` 預覽。
4. 右側「選擇來源」選擇含 `.vrma` 的資料夾，掃描後點選檔名，再按「播放」。單幀靜態 VRMA 使用「套用姿勢」，可保持姿勢；「停止」會回復。

上次瀏覽資料夾、VRMA 來源與檢視方式會自動還原。請先閱讀包內 Microsoft Runtime 條款；使用與升級說明見 [Portable 發行文件](docs/portable-release.md)。

## 全部功能

| 功能           | 說明                                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 支援素材       | VRM 0.x／1.0、VRMA，以及 PNG、JPG／JPEG、WebP、BMP 圖片。                                                                          |
| 檔案瀏覽       | 磁碟選擇、路徑輸入、資料夾導覽、上一個／下一個／上一層、重新整理、清單／縮圖切換、檔案類型與大小。上次瀏覽位置及檢視方式自動保存。 |
| 大型清單       | 虛擬化呈現，僅繪製可見項目；支援鍵盤移動與選取。                                                                                   |
| 模型預覽       | 滑鼠旋轉、平移、以游標為中心縮放；正面／背面／左右視角與重新取景。                                                                 |
| 場景選項       | 格線、骨骼疊加、座標軸、燈光與背景色。                                                                                             |
| 模型資訊       | 顯示模型提供的名稱、作者、授權及網格／材質／貼圖／骨骼等資訊。                                                                     |
| 圖片預覽       | 直接檢視支援的圖片素材。                                                                                                           |
| 骨骼檢視       | 人形骨骼對應、模型節點、父節點、必要／選用狀態及缺少必要映射提示。                                                                 |
| 動畫來源       | VRMA 可與模型位於不同資料夾或磁碟；選擇來源後自動掃描，以檔名清單選取動作，保存來源偏好。                                          |
| 動畫播放       | 播放、暫停、停止、重播、循環、0.25×～2×速度與時間軸；單幀 VRMA 可套用並保持靜態姿勢。                                              |
| 表情           | 跟隨動畫、自然、開心、生氣、悲傷、放鬆及驚訝；模型未提供的選項自動停用。                                                           |
| 自定義姿勢     | 分組選擇軀幹、四肢與手指；局部 XYZ 角度滑桿／數值、畫面骨骼控制點與旋轉環，以及髖部位移。                                          |
| 姿勢操作       | 擷取目前動畫姿勢、重設單骨骼或 T 姿勢、復原／重做；分頁切換保留草稿，播放動畫後可恢復編輯。                                        |
| 姿勢匯出       | 另存單幀靜態 `.vrma`，可重新載入套用；只包含骨骼姿勢，不夾帶模型或貼圖，不覆蓋既有檔案。                                           |
| 縮圖與快取     | 圖片縮圖及模型內嵌封面；設定快取容量、查看使用量與清除快取。                                                                       |
| 語言與外觀     | 繁體中文預設、完整英文；淺色／深色／跟隨系統，可調整面板寬度。                                                                     |
| 系統設定       | 檔案大小單位（自動、B、KB／MB／GB、KiB／MiB／GiB）、應用版本與 WebView2 模式。                                                     |
| 可攜使用       | 隨附離線 WebView2；設定、索引、快取及 WebView 資料寫於執行檔旁 `data/`，沒有 AppData fallback。                                    |
| 升級與素材保護 | 包含本機 `upgrade.ps1`，驗證發行檔案並保留個人資料；原始素材唯讀，不載入外部 JavaScript、DLL Plugin 或遠端執行碼。                 |

### 使用限制

- 模型沒有內嵌封面時，縮圖可能無法顯示；目前未提供模型快照縮圖。
- 姿勢草稿於換模型或關閉程式時清除。匯出不包含表情、視線或物理模擬結果。
- 不同身形可能產生手掌交叉或穿模；目前不含 IK、碰撞、FBX／BVH／GLB 格式轉換或動畫錄製。
- `upgrade.ps1` 使用已下載且解壓的新版封裝，不會線上自動更新。

## v1.3 更新

- 新增「自定義姿勢」分頁，與動畫／骨骼區共用位置；介面支援繁中與英文。
- 分組選擇軀幹、四肢及手指骨骼，使用 XYZ 角度滑桿、數值輸入或 3D 控制點與旋轉環調整。
- 擷取目前動畫影格、髖部位移、單骨骼／T 姿勢重設、復原／重做；動畫播放後可恢復編輯草稿。
- 匯出單幀靜態 `.vrma`，可重新載入套用。匯出另存新檔，不覆蓋既有素材；不包含表情、模型或貼圖。

草稿在換模型或關閉程式時清除；不同身形仍可能穿模，此階段不包含碰撞或 IK。[姿勢操作說明](docs/v1.3-pose.md)

## v1.2 更新

- **骨骼疊加**：中央預覽的勾選項可顯示模型骨架，預設關閉，沿用既有渲染畫面。
- **骨骼分頁**：動畫區加入「動畫／骨骼」分頁，不改三欄配置；顯示標準人形骨骼、模型節點、父節點與必要／選用狀態，提示缺少必要映射。切換分頁保留動畫狀態。
- **簡化擴充架構**：移除自訂 Plugin 與外部擴充入口；系統資訊與快取操作仍在設定頁，既有資料保留。
- **精簡系統資訊**：移除 Portable 路徑顯示，改顯示應用版本與 WebView2 執行環境模式。
- **開發啟動修正**：統一本機前端連線位址；新增文字完整支援繁中與英文。

骨骼檢視為唯讀映射資訊，不代表蒙皮、階層或姿勢已完整驗證。此次未新增模型快照縮圖或其他模型格式轉換。[完整 v1.2 更新說明](docs/v1.2-release-notes.md)

## v1.1 修正

- 單幀 VRMA 不再因動畫長度為 0 而被拒絕；以靜態姿勢套用，避免零長度循環計算。
- 模型缺少動畫中的可選骨骼時，交由官方綁定函式略過；完全沒有可用軌道的素材仍會拒絕。
- 加回小圖示切換精簡清單／縮圖，並保存檢視偏好。

## 資料與升級

程式旁的 `data/` 包含個人設定、SQLite 索引與快取。移動可攜版時，保留整個資料夾即可保留資料。

升級前關閉程式並備份 `data/`；新包中的 `upgrade.ps1` 會驗證發行檔案、更新 EXE 與 Runtime，保留使用者資料。詳細步驟與 Microsoft 授權／隱私聲明見 [Portable 說明](docs/portable-release.md)。

公開倉庫與可攜包皆不包含使用者模型、動畫、資料庫或個人設定。模型與動畫的使用權由素材原始授權決定。

## 開發與建置

需要 Windows、Git、Node.js／npm、Rust MSVC 工具鏈，以及 Visual Studio C++ Build Tools／Windows SDK。以下為 PowerShell 指令：

```powershell
git clone https://github.com/kappalien/VRMExplorer.git
cd VRMExplorer
npm ci
npm run tauri dev
```

常用檢查：

```powershell
npm test
npm run lint
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings
```

正式 Offline 封裝：

```powershell
powershell -File scripts/fetch-runtime.ps1
powershell -File scripts/build.ps1
```

`fetch-runtime.ps1` 從 Microsoft 取得鎖定的 Fixed Runtime、核對 CAB 雜湊與簽章，並取得官方條款。`build.ps1` 執行測試、建置與封裝，輸出至本機 `releases/`。同版本 ZIP 已存在時，封裝會拒絕覆寫。

若只需 UI 檢視，可以使用 `npm run dev`；瀏覽器模式不提供 Portable 檔案存取或設定保存。

## 專案結構

| 路徑             | 用途                                             |
| ---------------- | ------------------------------------------------ |
| `src/`           | React／TypeScript 介面、預覽引擎與 i18n          |
| `src-tauri/src/` | Rust 檔案存取、Portable 設定、動畫索引與縮圖快取 |
| `scripts/`       | Runtime 取得、建置、封裝與升級                   |
| `tests/`         | 單元與 Edge 回歸測試                             |
| `docs/`          | 架構、使用、測試與開發記錄                       |

`node_modules/`、`src-tauri/target/`、`build/`、`releases/`、`data/` 與使用者 VRM／VRMA 不會進入 Git。原始碼、文件、截圖、第三方授權與 MPL 原始碼封存合計約 5.1 MiB；可攜 ZIP 另放 GitHub Release。

## 授權與署名 / Licensing

使用或再散布前請閱讀 [授權與素材說明](docs/licensing.md)。第三方授權及著作權聲明見 `licenses/third-party/`，MPL 元件原始碼見 `licenses/mpl-sources.zip`。Microsoft Runtime 與展示模型各有獨立條款。原創專案內容尚未指定開源授權；Public 不代表任意商用或再散布許可。

Third-party licenses, source availability and screenshot attribution are documented in [Licensing](docs/licensing.md). No general open-source license has been selected for original project content.

## English

v1.3 adds a bilingual Custom pose tab, bone groups, XYZ controls, viewport rotation gizmos, hips offsets, frame capture, reset, undo/redo and static VRMA export. Exports create a new file and contain no avatar meshes or textures. Drafts are cleared on model change or exit. See [Pose guide](docs/v1.3-pose.md).

v1.2 adds a skeleton overlay and an Animation/Bones tab with raw humanoid mappings and required-bone status. Custom plugin support is removed; settings shows the application version and WebView2 mode. Existing preview, motion and Portable features remain. See [v1.2 release notes](docs/v1.2-release-notes.md).

VRM Explorer is a portable Windows desktop viewer for VRM avatars, VRMA animations and images. Download the **Offline release**, extract it into a writable local folder and run `vrm-explorer.exe`. Fixed WebView2 is included. Original assets are read-only; settings and cache stay in `data/` beside the executable.

v1.1 supports single-frame poses, compact/thumbnail view switching, cursor-centered zoom, animation playback and model-provided facial expressions. Traditional Chinese is the default language; English is available in Settings. See the linked test records for verified behavior and remaining **Not Tested** cases.

依根目錄 [開發規格](VRM_Explorer_Codex_Development_Spec.md) 開發。
