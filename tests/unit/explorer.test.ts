import { describe, it, expect } from "vitest";
import {
  filterEntries,
  parentPath,
  type AssetEntry,
} from "../../src/core/assets";
const entries: AssetEntry[] = [
  { path: "a", name: "動作10.vrma", kind: "vrma", size: 10, modified: 1 },
  { path: "b", name: "動作2.vrma", kind: "vrma", size: 20, modified: 2 },
  { path: "c", name: "照片.png", kind: "png", size: 5, modified: 3 },
  { path: "d", name: "資料夾", kind: "folder", size: 0, modified: 0 },
];
describe("explorer navigation and ordering", () => {
  it("keeps folders first and sorts filenames naturally", () => {
    expect(
      filterEntries(entries, "", "all", "name", false, "zh-TW").map(
        (e) => e.path,
      ),
    ).toEqual(["d", "b", "a", "c"]);
  });
  it("filters image files while preserving navigable folders", () => {
    expect(
      filterEntries(entries, "", "image", "name", false, "en").map(
        (e) => e.path,
      ),
    ).toEqual(["d", "c"]);
    expect(
      filterEntries(entries, "動作", "vrma", "size", true, "zh-TW").map(
        (e) => e.path,
      ),
    ).toEqual(["b", "a"]);
  });
  it("does not navigate past a drive root", () => {
    expect(parentPath("D:\\Models\\子資料夾")).toBe("D:\\Models\\");
    expect(parentPath("D:\\")).toBe("D:\\");
  });
});
