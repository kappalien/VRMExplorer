# VRM Explorer v1.1

Windows 桌面 VRM／VRMA／圖片瀏覽工具。僅提供 [Offline 可攜版](releases/VRM-Explorer-1.1.0-Offline-win-x64.zip)，完整解壓後雙擊 `vrm-explorer.exe`，隨附 Fixed WebView2 Runtime。

- 左側像檔案總管直接瀏覽資料夾，中間預覽，右側動畫。
- VRMA 來源自動掃描、簡單檔名清單與播放控制；支援長度為 0 的單幀靜態姿勢。
- 左側工具列的小圖示切換精簡清單／縮圖，會記住上次檢視方式。
- 自然、開心、生氣、悲傷、放鬆、驚訝及跟隨動畫；模型未提供的表情停用。
- 滑鼠游標位置縮放；記住上次資料夾及 VRMA 來源。
- 設定頁面集中語言（繁中／英文）、布景、檔案大小單位、快取與工具。
- 素材唯讀，所有程式資料寫入執行檔旁 `data/`，沒有 AppData fallback。

使用、升級與 Runtime 條款見 [Portable 說明](docs/portable-release.md)，驗證與限制見 [v1.1 測試記錄](docs/v1.1-tests.md)。最低發行目標 Windows 11 x64；乾淨離線 VM 等未執行的測試以 Not Tested 標示。舊階段歷史記錄見 [phases](docs/phases.md) 與 [UI 調整](docs/ui-revision.md)。

```powershell
npm ci
npm run tauri dev
npm test
npm run lint
npm run test:performance
powershell -File scripts/build.ps1
```

依根目錄 `VRM_Explorer_Codex_Development_Spec.md` 開發。發行包不含使用者素材、Portable 資料或測試模型。
