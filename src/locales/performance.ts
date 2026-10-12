export const zhPerformance = {
  settings: {
    cache: "縮圖快取",
    cacheUsage: "{{count}} 個縮圖 · {{size}} MiB",
    cacheLimit: "容量上限（16–2048 MiB）",
    apply: "套用",
    clearCache: "清除快取",
    cacheDescription:
      "儲存在程式旁 data/cache/thumbnails；超出上限先移除最早建立的快取。圖片及 VRM 內嵌封面可重建，原始素材不受影響。",
  },
  errors: {
    cacheConfig:
      "縮圖快取設定無效。請檢查程式旁 data/settings/cache.json，原檔已保留。",
    noThumbnail: "此 VRM 沒有支援的內嵌封面。",
    thumbnailBusy: "縮圖佇列已滿，請稍後重新整理。",
  },
};
export const enPerformance = {
  settings: {
    cache: "Thumbnail cache",
    cacheUsage: "{{count}} thumbnails · {{size}} MiB",
    cacheLimit: "Capacity limit (16–2048 MiB)",
    apply: "Apply",
    clearCache: "Clear cache",
    cacheDescription:
      "Stored beside the app in data/cache/thumbnails. Oldest generated entries are evicted first. Images and embedded VRM covers can be rebuilt; original assets are preserved.",
  },
  errors: {
    cacheConfig:
      "Invalid thumbnail cache settings. Check data/settings/cache.json beside the app; the original file is preserved.",
    noThumbnail: "This VRM has no supported embedded cover.",
    thumbnailBusy: "Thumbnail queue is full. Refresh later.",
  },
};
