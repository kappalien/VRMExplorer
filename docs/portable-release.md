# VRM Explorer v1.1 Portable Offline

下載並完整解壓 `VRM-Explorer-1.1.0-Offline-win-x64.zip`，開啟其中的 `vrm-explorer.exe`。最低發行目標 Windows 11 x64，請使用本機可寫入的資料夾。不要從壓縮檔、唯讀媒體或 UNC 路徑執行。隨附 Fixed WebView2 Runtime 154.0.4258.62；無需安裝 Node.js、Rust 或 MSVC。

Extract the complete ZIP into a writable local folder, then run `vrm-explorer.exe`. Target: Windows 11 x64. Fixed WebView2 Runtime 154.0.4258.62 is included; Node.js, Rust and MSVC are development tools only. Clean offline VM, non-admin and Windows 10 qualification: Not Tested.

Offline 使用前請閱讀並同意 licenses/Microsoft-WebView2-Fixed.html 的 Microsoft 條款；不同意時請勿執行 Offline 版或散布 Runtime。Offline 包含 Microsoft Defender SmartScreen，會蒐集並傳送使用者資訊至 Microsoft，依 Microsoft 隱私聲明 https://aka.ms/privacy 及 Edge 隱私白皮書 https://learn.microsoft.com/en-us/microsoft-edge/privacy-whitepaper#smartscreen 說明處理。

Before using Offline, read and agree to the Microsoft terms in licenses/Microsoft-WebView2-Fixed.html. Do not run or redistribute its Runtime if you disagree. This software includes Microsoft Defender SmartScreen, which collects and sends end-user information to Microsoft as described in the Microsoft Privacy Statement and Edge Privacy Whitepaper linked above. Redistribution requires passing these protections and notices to end users and distributors.

Fixed Runtime 不會自動更新；請定期取得新版完整發行包。官方發行說明：https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution 。

## 操作 / Usage

左側可選擇磁碟、輸入路徑，雙擊資料夾進入，點選 VRM 預覽。工具列右側小圖示可切換精簡清單／縮圖。中央滑鼠拖曳旋轉，滾輪以游標位置縮放。右側選擇 VRMA 來源後自動掃描，點選檔名再按播放；單幀 VRMA 會顯示「套用姿勢」，按下後保持靜態姿勢，停止可回復。動畫區提供自然、開心、生氣、悲傷、放鬆、驚訝與跟隨動畫；實際可用表情由模型提供，未提供的項目停用。

上次資料夾與 VRMA 來源會自動還原。右上角「設定」可調整語言、布景、檔案大小單位及快取；變更自動保存。

Browse folders on the left, preview VRM in the center, and choose a VRMA source on the right. Select a motion filename, then Play. Zero-duration single-frame VRMA uses Apply pose and holds the pose; Stop resets it. The small toolbar icon switches compact list / thumbnails without adding a toolbar row. Expression controls offer Neutral, Happy, Angry, Sad, Relaxed, Surprised and Follow animation; unavailable model expressions are disabled. Wheel zoom centers on the cursor. Last folder and motion source are restored on startup. Settings contains language, theme, file size units and cache options.

所有設定、SQLite、快取與 WebView 資料只寫在執行檔旁 `data/`；不可寫入時報錯，沒有 AppData fallback。原始素材唯讀，包內不含使用者素材或資料。內建 Plugin 靜態編譯，外部執行碼不開放。

Data stays in `data/` beside the executable. Original assets are read-only. User assets/data are excluded from the release. External executable plugins are disabled.

## 升級 / Upgrade

先關閉程式，備份整個 `data/`，尤其 `data/database`。將新 ZIP 解壓到另一個資料夾，可執行新包中的 `upgrade.ps1 -PackageDirectory 新包路徑 -TargetDirectory 舊程式路徑`。腳本驗證 manifest 的 SHA-256，備份舊 EXE，更新程式及 Runtime，不覆寫 `data/`。失敗時重新解壓完整包，再還原已備份資料。

Close the app and back up `data/` before upgrading. Extract the package separately; its `upgrade.ps1` verifies release files, backs up the executable and preserves data. On failure restore a complete package and your data backup.

## 建置 / Build

執行 `scripts/fetch-runtime.ps1` 驗證 Microsoft CAB 與簽章，再執行 `scripts/build.ps1`。發行腳本只產出 Offline ZIP 與 SHA-256，不產出 Standard。已建置 release EXE 時可執行 `node scripts/package.mjs`；相同版本輸出拒絕覆寫。

包內只有 EXE、文件、升級腳本、授權與 Fixed Runtime，不包含 `src`、`data`、VRM／VRMA 或測試資料。`licenses/dependencies.json` 保守列出鎖定依賴，包含跨平台／build dependencies，不代表每個 crate 都連入 Windows EXE。使用者模型的再散布權不由本程式授權。

See `v1.1-tests.md` for executed tests and remaining Not Tested items. Licenses and notices are in `licenses/`.
