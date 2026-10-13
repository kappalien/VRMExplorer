# 授權與素材說明 / Licensing and attribution

## 專案與第三方程式碼

VRM Explorer 的原創程式碼、腳本及原創文件採用 [MIT License](https://github.com/kappalien/VRMExplorer/blob/main/LICENSE)，著作權聲明為 `Copyright (c) 2026 kappalien`。任何人均可使用、複製、修改、合併、發布、再散布、再授權及商用，包括出售原創程式的副本或修改版；須在軟體副本或實質部分保留完整著作權與 MIT 授權文字。修改版不必公開原始碼，軟體按現況提供，不提供保證。完整條款以根目錄 `LICENSE` 為準；後續發行包亦附於 `licenses/VRM-Explorer-LICENSE.txt`。

MIT 授權亦適用本倉庫已發布版本中的原創專案內容。舊發行包若仍記載「尚未指定開源授權」或需另行取得原創內容許可，該部分以本聲明及根目錄 MIT License 為準；第三方條款不因此改變。

本授權不涵蓋第三方套件、Microsoft WebView2 Runtime、展示截圖中的第三方模型或使用者自行載入的素材。這些內容保留各自授權，不因本專案採用 MIT 而變為 MIT；本專案不主張第三方內容的所有權。

主要元件包含 React、Three.js、pixiv three-vrm、Tauri、i18next、Zustand、Lucide／Feather、SQLite 及 Rust 相依元件。實際版本與授權見 [依賴清單](../licenses/third-party/dependencies.json)，完整授權及著作權聲明保存在 [licenses/third-party](../licenses/third-party)。清單保守包含建置及跨平台依賴，不代表每項都連入 Windows 執行檔。再散布時須保留相應授權、NOTICE 及著作權文字；多重授權的選擇與 AND 組合以元件原文為準。

Original VRM Explorer code, scripts and original documentation are licensed under MIT, copyright (c) 2026 kappalien. Use, modification, redistribution, sublicensing and commercial use (including selling copies) are permitted, provided the copyright and full license notice are preserved. Modified versions need not publish their source. The software is provided as is, without warranty. See the root LICENSE; future distribution packages also include licenses/VRM-Explorer-LICENSE.txt.

This grant also applies to original project content in previously published versions. It supersedes older statements that no open-source license was selected or that separate permission was required for original content. Third-party components, Microsoft Runtime, third-party screenshot models and user assets retain their own terms. Preserve applicable copyright, license and NOTICE texts. Nothing here restricts rights granted by third-party licenses.

## MPL-2.0 原始碼 / Source availability

cssparser 0.37.0、cssparser-macros 0.7.1、dtoa-short 0.3.5、option-ext 0.2.0、selectors 0.38.0 的未修改原始碼，包含原授權與聲明，可從 [mpl-sources.zip](../licenses/mpl-sources.zip) 免費取得；可攜包亦附相同封存。各元件仍依 MPL-2.0 授權。版本、上游來源與原始封存 SHA-256 見 [sources.json](../licenses/sources.json)。

The unmodified source of these MPL-2.0 components is available at no charge in `licenses/mpl-sources.zip`, both in this repository and in the portable package. Original notices and license files are included. Their source remains licensed under MPL-2.0; no project terms restrict these rights. See [Mozilla's official FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).

## Microsoft Fixed WebView2 Runtime

Offline 包隨附 Microsoft Fixed WebView2 Runtime 154.0.4258.62，由 Microsoft 官方取得。它是第三方專有軟體，並非本專案的原創或開源程式碼。使用與散布須遵守 [Microsoft 條款](../licenses/third-party/Microsoft-WebView2-Fixed.html)，包括散布者與終端使用者的義務；不同意請勿使用或散布 Offline 包。

Microsoft Defender SmartScreen 可能蒐集並傳送資訊至 Microsoft，見 [Microsoft 隱私聲明](https://aka.ms/privacy) 與 [Edge 隱私白皮書](https://learn.microsoft.com/en-us/microsoft-edge/privacy-whitepaper#smartscreen)。Runtime 內的第三方聲明及檔案須保留；Microsoft 所提供的第三方原始碼取得途徑見條款與 <https://thirdpartysource.microsoft.com>。本專案並非 Microsoft 或 pixiv 官方產品，亦未聲稱獲其背書。

Fixed WebView2 is licensed separately by Microsoft. Read and agree to the included terms before use or redistribution. Preserve Microsoft and runtime third-party notices, pass applicable terms and privacy notices to users and distributors, and do not describe this runtime as licensed under this project's terms.

## 目前 README 展示圖片

繁體中文 README 使用使用者提供的 v1.3 姿勢編輯截圖，英文 README 使用使用者提供的 v1.5 英文介面截圖；兩張圖的模型檔名皆為「神秘人B」。未提供作者或來源資訊，因此不另行推定授權。截圖展示應用操作，不提供模型檔案，模型權利仍屬原作者。

## 歷史 README 展示模型

模型名稱：**elegant_flower**。作者：**power_plant**；[作者聯絡頁](https://bsky.app/profile/m0toi.bsky.social)。這是使用者提供的操作截圖，模型並非本專案製作，也不隨程式、原始碼或 Release 提供。

依使用者提供的模型資訊，其 [VRoid Hub 條款](https://hub.vroid.com/en/license?allowed_to_use_user=everyone&characterization_allowed_user=everyone&corporate_commercial_use=disallow&credit=unnecessary&modification=allow&personal_commercial_use=profit&redistribution=disallow&sexual_expression=allow&version=1&violent_expression=allow) 為：允許第三方及個人營利使用、允許修改、不強制署名、禁止法人使用與模型再散布。截圖僅供個人專案操作展示，不表示模型可自由取得或隨程式再利用。法人產品宣傳或不同用途應另向作者取得許可。嵌入的 VRM 0.x 商業欄位與外部條款有所不同，應核對完整來源條款，不以單一欄位取代。

Screenshot model: **elegant_flower**, by **power_plant**. The screenshot illustrates personal project use; the model is not included or offered for download. The supplied conditions allow individual use (including profit), prohibit corporate use and redistribution of model data, allow alterations and do not require attribution. This acknowledgement grants no additional model or screenshot reuse rights. Consult the original creator for other uses.

## 使用者自行載入的素材

載入模型、動畫、圖片不會使本程式取得其授權，也不會替使用者授予公開展示、商用、修改或再散布的權利。請遵守每個素材的來源條款；可攜包不包含使用者模型、動畫、資料庫、設定或快取。

User assets retain their own terms. Loading an asset does not grant additional rights to display, modify, sell or redistribute it.
