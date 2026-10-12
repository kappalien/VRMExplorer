# 自訂 Plugin 架構已移除

依使用者要求，已移除 Registry、Manifest、生命週期、內建範例及 Plugin 介面入口。此文件保留為舊連結的移除說明，不再描述可使用的 API。

系統資訊直接顯示於設定頁；縮圖容量與清除功能繼續由 CacheSettings 呼叫受控 Rust 命令。新啟動不再建立 Plugin 目錄；既有 plugins/ 與 data/plugins/ 內容保留，不讀取、不執行、不刪除，也不納入發行包。

Tauri 官方套件及 pixiv 模型/動畫 loader 的 Plugin 是相依函式庫的機制，仍為既有功能所需，不屬於本次移除的自訂擴充功能。
