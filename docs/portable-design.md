# Portable / WebView2 feasibility

Standard 使用系統 Runtime；Offline 預計將官方 x64 Fixed Runtime 完整展開到 EXE 旁 runtime/webview2/，其中直接包含 msedgewebview2.exe。啟動前設定 WEBVIEW2_BROWSER_EXECUTABLE_FOLDER，WebviewWindowBuilder.data_directory 指向 data/webview2。程式清除繼承的 Runtime/UDF overrides 再設定受控值，不使用 installer webviewInstallMode 冒充可攜打包。

[Microsoft distribution](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution) 說明 Fixed Version 可以隨應用發布，但 Windows 10 的 unpackaged Win32 + v120 以上需要 ALL APPLICATION PACKAGES 與 ALL RESTRICTED APPLICATION PACKAGES 的讀取/執行 ACL；搬移 ZIP/USB、NTFS/exFAT 與非管理員帳戶必須驗證。UNC/network location 不支援。不可為避開 ACL 而發布有漏洞的舊版 Runtime。

[Tauri API](https://docs.rs/tauri/2.12.1/tauri/webview/struct.WebviewWindowBuilder.html#method.data_directory) 支援 data_directory。[WebView2 environment API](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2environment) 說明環境變數 runtime override。已完成編譯及系統 Runtime 啟動，確認 data/webview2/EBWebView 產生於 exe 旁。Fixed Runtime 選擇分支尚未實測，不宣稱 Offline 完成。

本階段不下載或再散布 Runtime。需在 Phase 6 保存所選 Microsoft Runtime 版本、官方下載 URL、SHA256、授權/EULA 並確認再散布條款、WebView2Loader 連結或 DLL。最低 Windows build 仍待所選 Runtime 的官方 support policy 與實測確認；不把「1803 多數預裝」當最低支援證明。

startup 失敗提供 native zh-TW/en MessageBox（WebView 啟動前無 i18next）；不下載、不自動安裝 Runtime。後續應加入精確的 Runtime detection 原因分類，目前只有一般啟動失敗提示。

所有應用資料位於 data/；WebView cache 在 data/webview2/。OS crash dump、GPU driver cache、Runtime 自身系統行為未觀測，不能宣稱完全無其他寫入。使用 Process Monitor 檢查 clean VM，包含不可寫 root、不同 CWD、搬移 root 與 no-admin/no-network 場景。
