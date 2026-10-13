import { zhUpdates, enUpdates } from "./updates";
import { zhPose, enPose } from "./pose";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { zhFeatures, enFeatures } from "./features";
import { zhPreview, enPreview } from "./preview";
import { zhLibrary, enLibrary } from "./library";
import { zhPerformance, enPerformance } from "./performance";
const zh = {
  common: {
    languageZh: "繁體中文",
    languageEn: "English",
    title: "VRM Explorer",
    phase: "v1.5",
    navigation: "導覽",
    files: "檔案瀏覽器",
    preview: "預覽工作區",
    empty: "尚未開啟素材",
    scope: "檔案瀏覽、模型與動畫功能將於後續階段提供。",
    language: "語言",
    theme: "佈景",
    settingsPage: "設定",
    closeSettings: "關閉",
    fileSizeUnit: "檔案大小顯示單位",
    sizeAuto: "自動（1024 進位）",
    light: "淺色",
    dark: "深色",
    system: "跟隨系統",
    splitter: "調整面板寬度",
    ready: "設定已儲存",
    loading: "正在讀取 Portable 設定",
    browser: "瀏覽器介面檢視：不會保存設定",
    appVersion: "應用程式版本",
    runtimeFixed: "隨附離線執行環境",
    runtimeSystem: "系統安裝的執行環境",
    animation: "動畫區",
    systemInfo: "系統資訊",
    runtime: "WebView2 模式",
    saveFailed: "設定儲存失敗",
    retry: "重試",
  },
  errors: {
    desktopRequired: "需要 Tauri 桌面環境才能存取 Portable 資料。",
    invalidSettings: "設定格式無效，請保留原檔並檢查設定。",
    native: "無法存取 Portable 資料；請確認執行檔旁的 data 目錄可寫入。",
  },
};
const en = {
  common: {
    languageZh: "繁體中文",
    languageEn: "English",
    title: "VRM Explorer",
    phase: "v1.5",
    navigation: "Navigation",
    files: "File explorer",
    preview: "Preview workspace",
    empty: "No asset opened",
    scope:
      "File browsing, model and animation features arrive in later phases.",
    language: "Language",
    theme: "Theme",
    settingsPage: "Settings",
    closeSettings: "Close",
    fileSizeUnit: "File size unit",
    sizeAuto: "Automatic (base 1024)",
    light: "Light",
    dark: "Dark",
    system: "Follow system",
    splitter: "Resize panel",
    ready: "Settings saved",
    loading: "Loading Portable settings",
    browser: "Browser UI review: settings are not saved",
    appVersion: "Application version",
    runtimeFixed: "Bundled offline runtime",
    runtimeSystem: "System-installed runtime",
    animation: "Animation panel",
    systemInfo: "System information",
    runtime: "WebView2 mode",
    saveFailed: "Could not save settings",
    retry: "Retry",
  },
  errors: {
    desktopRequired: "Portable storage requires the Tauri desktop application.",
    invalidSettings:
      "Invalid settings. Preserve the original file and check its contents.",
    native:
      "Cannot access Portable storage. Check that data beside the executable is writable.",
  },
};
void i18n.use(initReactI18next).init({
  resources: {
    "zh-TW": {
      ...zh,
      ...zhFeatures,
      preview: { ...zhFeatures.preview, ...zhPreview.preview },
      animation: zhPreview.animation,
      pose: zhPose,
      updates: zhUpdates,
      library: zhLibrary.library,
      settings: zhPerformance.settings,
      errors: {
        ...zh.errors,
        poseExport: "無法匯出姿勢；請確認模型有有效的髖部骨骼。",
        poseExists: "檔案已存在，請使用新的檔名。",
        ...zhFeatures.errors,
        ...zhPreview.errors,
        ...zhLibrary.errors,
        ...zhPerformance.errors,
      },
    },
    en: {
      ...en,
      ...enFeatures,
      preview: { ...enFeatures.preview, ...enPreview.preview },
      animation: enPreview.animation,
      pose: enPose,
      updates: enUpdates,
      library: enLibrary.library,
      settings: enPerformance.settings,
      errors: {
        ...en.errors,
        poseExport:
          "Could not export pose; check that the model has a valid hips bone.",
        poseExists: "File already exists. Choose a new filename.",
        ...enFeatures.errors,
        ...enPreview.errors,
        ...enLibrary.errors,
        ...enPerformance.errors,
      },
    },
  },
  lng: "zh-TW",
  fallbackLng: "en",
  ns: [
    "common",
    "explorer",
    "preview",
    "animation",
    "pose",
    "updates",
    "library",
    "settings",
    "errors",
  ],
  defaultNS: "common",
  interpolation: { escapeValue: false },
});
export default i18n;
