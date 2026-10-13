# 多模型場景、PNG 匯出與載入摘要

## 場景

在檔案瀏覽以 Ctrl 點選增減選取，Shift 點選選取範圍，再按「載入選取模型」。只載入選取項目中的 VRM，最多八個；模型依序載入，自動並排，共用一個 renderer 與渲染循環。單擊新模型會切換為單模型場景；單擊已在場景的模型會選為操作模型。

預覽下方「場景模型」可切換目前操作模型、調整 XYZ 位置（公尺）與朝向、重新並排或移出模型。動畫、表情、骨骼資訊及自定義姿勢作用於操作模型。其他模型維持自己的姿勢及播放狀態；暫停某個模型不會暫停其他模型。新操作模型若尚未綁定動畫，會嘗試綁定最近載入的 VRMA，預設暫停。場景位置不包含在靜態 VRMA 匯出內。

場景內切換模型不清除草稿；移出模型、以新單模型取代場景或關閉程式會清除對應草稿。場景及選取不會在下次啟動時自動還原。模型載入失敗會保留同場景中成功的模型並顯示錯誤。模型數量、幾何及貼圖會增加資源需求；這不是碰撞或 IK 系統。

## PNG

預覽工具列按「匯出 PNG」，選擇最長邊 1024／2048／4096 px，維持預覽區比例。預設透明背景、排除格線／座標軸／骨骼控制點；可另行勾選。取消透明背景時採目前背景色。包含目前場景內所有模型，保留當下視角、姿勢與表情，不會更改預覽的背景或輔助物件選項。

擷取一次畫面後，GPU 非同步讀回像素，修正上下方向及透明像素，再生成 PNG。Rust 驗證 PNG 格式、尺寸及大小，透過原生另存對話框保存。使用新檔名；既有 PNG 或素材不會被覆蓋。最高邊長亦受裝置紋理上限限制，PNG 不得超過 32 MiB。PNG 匯出與 VRMA 姿勢匯出是不同用途。

## 載入摘要

「模型載入效能摘要」隨操作模型切換，顯示檔案讀取、格式檢查／模型解析、首次渲染提交及總耗時，不含佇列等待。首次渲染是 CPU 發出渲染指令的時間，不是 GPU 完成時間。

貼圖數量涵蓋一般材質與 MToon shader uniforms，依 Texture 物件去重。最大寬／高是各貼圖寬與高的最大值，可能來自不同貼圖。記憶體估算採 RGBA8，加上適用的 mipmap；不涵蓋幾何、解码暫存、瀏覽器、驅動程式或渲染目標，亦不等於實際 GPU 使用量。模型資訊與原始授權仍保留於獨立區塊。

## 開發核對

核對 [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)、[WebGLRenderTarget](https://threejs.org/docs/pages/WebGLRenderTarget.html) 與 [VRM](https://pixiv.github.io/three-vrm/docs/classes/three-vrm.VRM.html)，並以鎖定版本 renderer、SRGB8 framebuffer、async readback 與 MToon 原始碼確認 API。PNG 另存 API 使用鎖定的 Tauri dialog 原始碼。

真實 VRM1 多模型、八個大型模型同場景及不同 GPU／高 DPI 匯出：Not Tested。

## English

Ctrl-click toggles selection; Shift-click selects a range. Load selected VRMs into one scene (up to eight). Choose the active model to edit its transform, pose, expressions and animation. Other models keep their own state. Scenes are temporary; removing a model clears its draft.

Export PNG captures all scene models using the current camera and poses. Transparency is enabled and helper objects are excluded by default. Choose a 1024, 2048 or 4096 px longest edge. Native saving preserves existing files. Loading summaries report CPU timings and approximate texture memory, not actual GPU completion time or memory consumption.
