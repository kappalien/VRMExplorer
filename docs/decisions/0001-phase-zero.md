# ADR 0001 — Phase 0 boundary

保留原規格檔名，AGENTS.md 指向實際存在的文件。使用精簡 core/components/stores/locales/app 目錄，依功能加入 features，避免空模組與假按鈕。

Tailwind Vite pipeline 已建立，當前版面使用 design tokens。shadcn/ui 的元件採按需要加入，Phase 0 原生 select/details 足夠；沒有為未使用元件加入整套 UI 依賴。Rust plugins 在 Phase 0 不必引入；Portable JSON 透過自訂 command，避免 Store 預設 AppData。

使用者補齊工具鏈後已完成 Phase 0 基本桌面驗收，結果見 docs/testing.md。維持 Phase 0 邊界；Phase 1 另需繼續開發指令。Offline 與完整 QA 仍在後續階段驗收。
