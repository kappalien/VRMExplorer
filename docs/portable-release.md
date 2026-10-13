# VRM Explorer v1.4 Portable Offline

下載並完整解壓 `VRM-Explorer-1.4.1-Offline-win-x64.zip`，開啟其中的 `vrm-explorer.exe`。最低發行目標 Windows 11 x64，請使用本機可寫入的資料夾。不要從壓縮檔、唯讀媒體或 UNC 路徑執行。隨附 Fixed WebView2 Runtime 154.0.4258.62；無需安裝 Node.js、Rust 或 MSVC。

Extract the complete ZIP into a writable local folder, then run `vrm-explorer.exe`. Target: Windows 11 x64. Fixed WebView2 Runtime 154.0.4258.62 is included; Node.js, Rust and MSVC are development tools only. Clean offline VM, non-admin and Windows 10 qualification: Not Tested.

Offline 使用前請閱讀並同意 licenses/Microsoft-WebView2-Fixed.html 的 Microsoft 條款；不同意時請勿執行 Offline 版或散布 Runtime。Offline 包含 Microsoft Defender SmartScreen，會蒐集並傳送使用者資訊至 Microsoft，依 Microsoft 隱私聲明 https://aka.ms/privacy 及 Edge 隱私白皮書 https://learn.microsoft.com/en-us/microsoft-edge/privacy-whitepaper#smartscreen 說明處理。

Before using Offline, read and agree to the Microsoft terms in licenses/Microsoft-WebView2-Fixed.html. Do not run or redistribute its Runtime if you disagree. This software includes Microsoft Defender SmartScreen, which collects and sends end-user information to Microsoft as described in the Microsoft Privacy Statement and Edge Privacy Whitepaper linked above. Redistribution requires passing these protections and notices to end users and distributors.

Fixed Runtime 本身不會自動更新；本程式線上更新在發行者提供新版 Runtime 更新包時一併更新。也可取得新版完整發行包。官方發行說明：https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution 。

## v1.4 功能更新

設定頁新增一鍵線上更新、下載進度、取消及可選的啟動後檢查。採用 GitHub Release、Ed25519 簽章資訊與獨立 Rust 更新器；一般更新不重複下載 WebView2。個人 data 保留，更新前提醒姿勢草稿；啟動失敗會嘗試回復舊版。詳見 v1.4-updates.md。

## v1.3 功能更新

新增自定義姿勢分頁、骨骼分組與 XYZ 角度、畫面控制點／旋轉環、髖部位移、動畫影格擷取、重設與復原／重做。匯出靜態 VRMA 另存新檔，不覆蓋原始素材。繁中／英文介面完整；草稿於換模型或結束程式時清除。[姿勢說明](v1.3-pose.md)

## v1.2 功能更新

預覽區新增骨骼疊加勾選，動畫區增加骨骼分頁，顯示人形骨骼映射、父節點與必要骨骼狀態。設定頁改顯示版本與 WebView2 模式，不顯示資料路徑。自訂 Plugin 功能移除，快取管理保留。[完整更新說明](v1.2-release-notes.md)

## 操作 / Usage

左側可選擇磁碟、輸入路徑，雙擊資料夾進入，點選 VRM 預覽。工具列右側小圖示可切換精簡清單／縮圖。中央滑鼠拖曳旋轉，滾輪以游標位置縮放。右側選擇 VRMA 來源後自動掃描，點選檔名再按播放；單幀 VRMA 會顯示「套用姿勢」，按下後保持靜態姿勢，停止可回復。動畫區提供自然、開心、生氣、悲傷、放鬆、驚訝與跟隨動畫；實際可用表情由模型提供，未提供的項目停用。

上次資料夾與 VRMA 來源會自動還原。右上角「設定」可調整語言、布景、檔案大小單位及快取；變更自動保存。

Browse folders on the left, preview VRM in the center, and choose a VRMA source on the right. Select a motion filename, then Play. Zero-duration single-frame VRMA uses Apply pose and holds the pose; Stop resets it. The small toolbar icon switches compact list / thumbnails without adding a toolbar row. Expression controls offer Neutral, Happy, Angry, Sad, Relaxed, Surprised and Follow animation; unavailable model expressions are disabled. Wheel zoom centers on the cursor. Last folder and motion source are restored on startup. Settings contains language, theme, file size units and cache options.

所有設定、SQLite、快取與 WebView 資料只寫在執行檔旁 `data/`；不可寫入時報錯，沒有 AppData fallback。原始素材唯讀，包內不含使用者素材或資料。自訂 Plugin 功能已移除；既有 Plugin 資料不刪除，外部執行碼不執行。

Data stays in `data/` beside the executable. Original assets are read-only. User assets/data are excluded from the release. Custom plugin support has been removed. Existing plugin folders are preserved as user data.

## 升級 / Upgrade

先關閉程式，備份整個 `data/`，尤其 `data/database`。將新 ZIP 解壓到另一個資料夾，可執行新包中的 `upgrade.ps1 -PackageDirectory 新包路徑 -TargetDirectory 舊程式路徑`。腳本驗證 manifest 的 SHA-256，備份舊 EXE，更新程式及 Runtime，不覆寫 `data/`。失敗時重新解壓完整包，再還原已備份資料。

Close the app and back up `data/` before upgrading. Extract the package separately; its `upgrade.ps1` verifies release files, backs up the executable and preserves data. On failure restore a complete package and your data backup.

## 建置 / Build

執行 `scripts/fetch-runtime.ps1` 驗證 Microsoft CAB 與簽章，再執行 `scripts/build.ps1`。發行腳本預設只產出小型 Update ZIP、SHA-256 與簽章資訊。已建置主程式與更新器 release EXE，且備妥對應私鑰時可執行 `node scripts/package.mjs`；相同版本輸出拒絕覆寫。Runtime 變動時加上 `--with-runtime`。只有明確需要新的完整可攜包時才使用 `--full`；GitHub 完整可攜版下載入口保留 v1.4.1，後續版本只上傳更新資產。詳見 `v1.4-updates.md`。

包內只有 EXE、文件、升級腳本、授權與 Fixed Runtime，不包含 `src`、`data`、VRM／VRMA 或測試資料。`licenses/dependencies.json` 保守列出鎖定依賴，包含跨平台／build dependencies，不代表每個 crate 都連入 Windows EXE。使用者模型的再散布權不由本程式授權。

See `v1.1-tests.md` for executed tests and remaining Not Tested items. Licenses and notices are in `licenses/`.

## 專案授權 / Project license

VRM Explorer 原創內容採用 MIT License，允許使用、修改、再散布與商用；須保留著作權及完整授權文字。後續封裝附於 `licenses/VRM-Explorer-LICENSE.txt`；舊包中的原創內容亦適用目前 [MIT 授權](https://github.com/kappalien/VRMExplorer/blob/main/LICENSE)。第三方套件、Microsoft Runtime 及模型素材保留獨立條款。詳見 [授權範圍](licensing.md)。

Original project content is MIT licensed, including previously published versions. Preserve copyright and license notices. Future packages include `licenses/VRM-Explorer-LICENSE.txt`; older packages are covered by the current MIT grant linked above. Third-party and asset terms remain separate.
