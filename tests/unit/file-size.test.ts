import { expect, it } from "vitest";
import {
  defaults,
  formatFileSize,
  validateSettings,
} from "../../src/core/settings";
it("supports automatic binary units and explicit decimal or binary units", () => {
  expect(formatFileSize(0, "auto", "en")).toBe("0 B");
  expect(formatFileSize(1024, "auto", "en")).toBe("1 KiB");
  expect(formatFileSize(1048576, "MiB", "en")).toBe("1 MiB");
  expect(formatFileSize(1000000, "MB", "en")).toBe("1 MB");
  expect(formatFileSize(1024, "B", "en")).toBe("1,024 B");
  expect(formatFileSize(1024, "GB", "en")).toBe("0 GB");
});
it("old settings gain the default unit and unsupported units are rejected", () => {
  const legacy = { ...defaults } as Partial<typeof defaults>;
  delete legacy.fileSizeUnit;
  expect(validateSettings(legacy).fileSizeUnit).toBe("auto");
  expect(() =>
    validateSettings({ ...defaults, fileSizeUnit: "invalid" }),
  ).toThrow();
});
