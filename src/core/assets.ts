import { invoke } from "@tauri-apps/api/core";
import { WorkQueue } from "./work-queue";
const thumbnailQueue = new WorkQueue(2);
export async function thumbnailUrl(path: string, signal: AbortSignal) {
  const result = await thumbnailQueue.run(
    () => invoke<ArrayBuffer | number[]>("read_thumbnail", { path }),
    signal,
  );
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  return URL.createObjectURL(
    new Blob(
      [result instanceof ArrayBuffer ? result : new Uint8Array(result).buffer],
      { type: "image/png" },
    ),
  );
}
export interface AssetEntry {
  path: string;
  name: string;
  kind: string;
  size: number;
  modified: number;
}
export interface Grant {
  path: string;
  directory: boolean;
}
export interface ExplorerPrefs {
  schemaVersion: 1;
  favorites: string[];
  recent: string[];
  view: "list" | "details" | "thumbnails";
  lastPath?: string;
  lastSourceId?: number | null;
}
export const images = ["png", "jpg", "jpeg", "webp", "bmp"];
export async function pickAsset(
  kind: "folder" | "vrm" | "vrma",
  title: string,
  start?: string,
) {
  return invoke<Grant | null>("pick_asset", {
    kind,
    title,
    start: start ?? null,
  });
}
export async function readAsset(path: string) {
  const result = await invoke<ArrayBuffer | number[]>("read_asset", { path });
  return result instanceof ArrayBuffer ? result : new Uint8Array(result).buffer;
}
export async function imageUrl(path: string, thumbnail = false) {
  const result = await invoke<ArrayBuffer | number[]>("read_image", {
    path,
    thumbnail,
  });
  return URL.createObjectURL(
    new Blob(
      [result instanceof ArrayBuffer ? result : new Uint8Array(result).buffer],
      { type: "image/png" },
    ),
  );
}
export function errorKey(e: unknown) {
  const key = String(e);
  return key.startsWith("errors:") ? key : "errors:filesystem";
}
export function parentPath(path: string) {
  const p = path.replace(/[\\/]+$/, "");
  const i = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
  return i >= 0 ? p.slice(0, i + 1) : path;
}
export function filterEntries(
  entries: AssetEntry[],
  query: string,
  filter: string,
  sort: string,
  descending: boolean,
  locale: string,
) {
  const collator = new Intl.Collator(locale, {
    numeric: true,
    sensitivity: "base",
  });
  return entries
    .filter(
      (e) =>
        e.name
          .toLocaleLowerCase(locale)
          .includes(query.toLocaleLowerCase(locale)) &&
        (e.kind === "folder" ||
          filter === "all" ||
          (filter === "image" ? images.includes(e.kind) : e.kind === filter)),
    )
    .sort((a, b) => {
      if ((a.kind === "folder") !== (b.kind === "folder"))
        return a.kind === "folder" ? -1 : 1;
      const n =
        sort === "size"
          ? a.size - b.size
          : sort === "modified"
            ? a.modified - b.modified
            : sort === "kind"
              ? collator.compare(a.kind, b.kind)
              : collator.compare(a.name, b.name);
      return (descending ? -1 : 1) * (n || collator.compare(a.name, b.name));
    });
}
