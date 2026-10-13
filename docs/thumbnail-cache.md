# 縮圖與背景頭部快照

在檔案瀏覽切換至縮圖檢視，圖片直接顯示縮圖；VRM 優先使用內嵌封面。沒有可用封面的 VRM 會逐一生成正面頭部快照，完成後自動顯示。沒有可用頭部映射時使用模型上半部取景。快照不取用目前預覽中的動畫、表情或姿勢草稿，也不修改原始檔案。

只為目前虛擬清單中的可見項目及少量預載項目排程，不掃描整個資料夾。背景只執行一個模型快照；捲離項目或切換檢視／資料夾會取消，主預覽載入模型時會中斷背景渲染並稍後重試。模型解析與 WebGL 在獨立 Worker 中執行，材質貼圖降至最高 512px，再輸出 192×192 PNG；不另開動畫循環。首次建立仍使用 CPU、GPU 與磁碟資源，並非完全沒有負擔。渲染超時或失敗會保留圖示，短時間內避免反覆重試同一個檔案。

快照由 Rust 保存於程式旁 `data/cache/thumbnails/`，與圖片及內嵌封面共用容量上限與清除快取功能。快取鍵包含原始路徑、大小與修改時間；再次瀏覽會直接讀取 PNG，來源變更則重建。背景讀取不持有檔案授權鎖，寫入前會再次核對授權、來源版本與取消狀態。清除快取後，舊工作不會重新寫入快取。原始 VRM／VRMA 與個人其他檔案保持唯讀。

模型仍受 256 MiB 檔案上限與渲染資源限制；損壞的模型、外部資源 URI、過於複雜的幾何或無法建立 WebGL 的環境不生成快照。英文介面也提供等待及失敗提示。

## 開發核對

API 核對：[Three.js WebGLRenderer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer)、[VRMHumanoid](https://pixiv.github.io/three-vrm/docs/classes/three-vrm.VRMHumanoid.html)，並核對鎖定版本的 GLTFLoader、ImageBitmapLoader、SkinnedMesh 與 VRMUtils 原始碼。WebView2 使用隨附的 Fixed Runtime。

Rust 測試涵蓋來源變更、權限撤銷、快取清除的取消世代、PNG 上限、內嵌封面優先及原始檔保留。Edge 與可攜桌面版使用真實 VRM0、獨立 Worker 與 WebGL 檢查頭部影像；桌面重啟後持久快取也可使用。真實 VRM1 頭部取景及不同 GPU／低記憶體環境：Not Tested。
