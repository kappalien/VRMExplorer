# v1.1 授權文件更新驗證（2026-10-08）

程式版本維持 1.1.0，未更動 EXE 或 Runtime。原有測試紀錄仍描述原程式；此次只更新文件、封裝授權檔案及未修改的第三方原始碼封存。

- 補上 README 模型 elegant_flower／power_plant 署名、個人展示用途與模型限制。
- 公開保留 744 個既有第三方授權、NOTICE、依賴與 Runtime 來源檔案。
- 5 個 MPL 元件 `.crate` 封存 SHA-256 全部符合 Cargo.lock；原始碼未修改，來源與雜湊記載於 licenses/sources.json。
- 更新包 1,009 個 manifest 檔案逐一驗證 SHA-256，ZIP 檔案集合與 manifest 一致；沒有使用者 VRM、VRMA 或 data/。
- 更新 ZIP：324,798,541 bytes；SHA-256 `22de48f8dd0b8c9fc59f5cf59fa19607a0201e76b54db2eba955157cf2fa0558`。
- 封裝腳本通過 Node syntax check；Git diff whitespace check 通過。
- 未重新執行應用程式功能測試：Not Tested（EXE 未變更）。

此紀錄取代舊發行驗證文件中的 ZIP 大小與雜湊；舊文件保留作為原包的歷史紀錄。此檢查不等於對所有第三方權利的法律保證；模型條款依使用者提供的 Metadata／網址核對，來源頁若另有附加條款仍須遵守。
