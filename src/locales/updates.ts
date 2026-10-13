export const zhUpdates = {
  title: "線上更新",
  hint: "一鍵檢查、下載、驗證與更新，完成後自動重新啟動。設定、索引及快取會保留；一般更新不下載 WebView2。",
  automatic: "啟動後檢查新版（不自動安裝）",
  check: "檢查更新",
  oneClick: "一鍵更新",
  cancel: "取消",
  progress: "更新下載進度",
  mib: "MiB",
  draftTitle: "姿勢草稿尚在記憶體",
  draftWarning:
    "更新會關閉程式並清除目前姿勢草稿。需要保留時，請先取消並匯出 VRMA。",
  keepDraft: "返回並保留草稿",
  discardDraft: "捨棄草稿並更新",
  runtimeExtra: "此版本需要更新 WebView2，將額外下載獨立 Runtime 包。",
  notes: "新版功能說明",
  phases: {
    idle: "尚未檢查",
    checking: "正在檢查新版…",
    current: "目前沒有較新的版本",
    available: "可更新版本：",
    downloading: "正在下載並驗證…",
    ready: "更新包已驗證，準備重新啟動…",
    handoff: "正在交由更新器重新啟動…",
    error: "更新未完成",
  },
  results: {
    updated: "上次線上更新已完成。",
    rolledBack: "上次更新未完成，已回復舊版。",
  },
  failed: "更新失敗，程式與個人資料仍保留。",
  notPortable:
    "線上更新適用於含 release.json 與離線 Runtime 的正式可攜版；開發模式不提供更新。",
  network: "無法連線或下載中斷，請檢查網路後重試。",
  feedMissing: "目前 GitHub 最新正式版尚未提供簽章更新資訊。",
  signature: "更新資訊的簽章無效，已拒絕更新。",
  checksum: "更新包大小或雜湊不符，已拒絕更新。",
  invalid: "更新格式、版本、平台或檔案路徑無效，已拒絕更新。",
  storage: "無法寫入程式資料夾，請確認可寫入且磁碟空間足夠。",
  busy: "另一個程式或更新程序正在使用此可攜版，請稍後重試。",
  cancelled: "已取消，原程式不受影響。",
  runtime: "所需 Runtime 更新包未提供，請等待發行者補齊更新資產。",
  conflict: "更新檔案與非程式管理的檔案衝突，已保留原檔。",
  helper: "更新器無法啟動，原程式仍保持開啟。",
  locked: "檔案仍被其他程序占用，更新未完成。",
  rollback: "無法完整回復舊版，請保留 data/updates 備份並重新下載完整可攜包。",
  restart: "新版未成功啟動，更新器會嘗試回復舊版。",
};
export const enUpdates = {
  title: "Online updates",
  hint: "Check, download, verify and update with one click, then restart automatically. Settings, index and cache are preserved. Routine updates exclude WebView2.",
  automatic: "Check at startup (installation stays manual)",
  check: "Check for updates",
  oneClick: "Update with one click",
  cancel: "Cancel",
  progress: "Update download progress",
  mib: "MiB",
  draftTitle: "Pose draft is in memory",
  draftWarning:
    "Updating closes the app and clears your pose draft. Cancel and export a VRMA first if you want to keep it.",
  keepDraft: "Return and keep draft",
  discardDraft: "Discard draft and update",
  runtimeExtra:
    "This version needs a WebView2 update. A separate Runtime package will also be downloaded.",
  notes: "What is new",
  phases: {
    idle: "Not checked",
    checking: "Checking for updates…",
    current: "No newer version available",
    available: "Available version:",
    downloading: "Downloading and verifying…",
    ready: "Verified; preparing to restart…",
    handoff: "Restarting through the updater…",
    error: "Update did not complete",
  },
  results: {
    updated: "The previous online update completed.",
    rolledBack: "The previous update failed and was rolled back.",
  },
  failed: "Update failed; application and personal data are preserved.",
  notPortable:
    "Online updates require a release Portable package with release.json and an offline Runtime. Development mode does not update.",
  network:
    "Connection failed or download interrupted. Check your network and retry.",
  feedMissing:
    "The latest GitHub release does not yet provide signed update metadata.",
  signature: "Invalid update signature. Update rejected.",
  checksum: "Update size or hash mismatch. Update rejected.",
  invalid:
    "Invalid update format, version, target or file path. Update rejected.",
  storage:
    "Cannot write to the application folder. Check permissions and free disk space.",
  busy: "Another application or updater is using this Portable folder. Try again later.",
  cancelled: "Cancelled; the original application is unchanged.",
  runtime:
    "The required Runtime package is missing. Wait for the publisher to provide it.",
  conflict:
    "An update file conflicts with an unmanaged file. The original is preserved.",
  helper: "Updater could not start. The original application remains open.",
  locked: "Files are still in use. Update did not complete.",
  rollback:
    "Rollback could not complete. Preserve data/updates backups and restore a full Portable package.",
  restart:
    "The new version did not start. The updater will attempt to restore the previous version.",
};
