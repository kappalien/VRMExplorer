# Built-in Plugin API 1.0

`src/core/plugins.ts` 定義 Manifest、Context、Lifecycle、Preview/Metadata/Animation/Command/Panel/Export interfaces。`discover()` 回傳靜態工廠 `systemInfoPlugin()`、`cacheToolsPlugin()`；不讀取或執行 `plugins/external/`。加入新 Plugin 須修改專案再編譯。Capability 是受信任程式碼的契約檢查，不是外部程式碼沙箱。

Manifest 含規格要求的欄位。`entry` 一律拒絕（含空字串），id 必須為 `builtin.[a-z-]+`。capability 不可重複或未知，副檔名只接受小寫英數。正常版本遵循 [SemVer X.Y.Z 格式與數值順序](https://semver.org/)；API 接受 `1.0.x`，最低 app 版本不得大於 `0.1.0`。目前拒絕 prerelease、build metadata、range，不假設已有完整 range resolver。

生命週期 discover → validate → activate → deactivate → dispose。`activate()` 拒絕重複 id。Context 的 `registerPanel()`/`registerCommand()` 要求對應能力，contribution id 必須等於 Plugin id 或以 `id.` 開頭，且不可重複。Registry 追蹤 Host 回傳的取消函式並使其冪等；activation 或 lifecycle 失敗仍嘗試取消註冊。`deactivate(id)`/`dispose()` 回傳失敗 id；一個清理錯誤不阻止其他 Plugin 清理。

Context 提供 logger、i18n 翻譯、面板/命令 hooks、受控 `clearThumbnailCache()`，沒有任意檔案、Shell、Node 或網路服務。命令錯誤隔離成 `plugins:commandFailed`，UI 顯示本地化訊息，不暴露底層私有路徑。

- `builtin.system-info` 宣告 panel，註冊 Portable/runtime 資訊面板。
- `builtin.cache-tools` 宣告 command，註冊「清除縮圖（內建擴充）」並呼叫受控 Rust 快取命令。`cacheToolsPlugin()` 是受信任的最小範例；停用時移除註冊。

Preview/Metadata/Animation/Export providers 尚無 Host dispatch hook，不能只寫外部 manifest 就新增預覽器。增加 hook 時需同步能力檢查、錯誤隔離與相容性測試。

已測試：SemVer、能力檢查、external entry 拒絕、重複 activation、activation rollback、registered command 執行、命令錯誤隔離與清理失敗隔離。桌面測試副本確認資訊面板與空快取命令；實際有內容快取的移除由 Rust 測試驗證。
