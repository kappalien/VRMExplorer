import { describe, it, expect } from "vitest";
import { defaults, validateSettings } from "../../src/core/settings";
import i18n from "../../src/locales/i18n";
describe("Portable settings boundary", () => {
  it("rejects unknown versions and unreasonable panel widths", () => {
    expect(() => validateSettings({ ...defaults, schemaVersion: 2 })).toThrow();
    expect(() =>
      validateSettings({ ...defaults, previewWidth: 9000 }),
    ).toThrow();
    expect(validateSettings(defaults)).toEqual(defaults);
  });
});
describe("locale completeness", () => {
  it("has identical zh-TW and English keys and falls back for Japanese", async () => {
    const keys = (value: Record<string, unknown>, prefix = ""): string[] =>
      Object.entries(value)
        .flatMap(([key, child]) =>
          child && typeof child === "object"
            ? keys(child as Record<string, unknown>, prefix + key + ".")
            : [prefix + key],
        )
        .sort();
    for (const ns of [
      "common",
      "errors",
      "explorer",
      "preview",
      "animation",
      "library",
      "settings",
    ])
      expect(keys(i18n.getResourceBundle("zh-TW", ns))).toEqual(
        keys(i18n.getResourceBundle("en", ns)),
      );
    await i18n.changeLanguage("ja");
    expect(i18n.t("navigation")).toBe("Navigation");
    await i18n.changeLanguage("zh-TW");
    expect(i18n.t("navigation")).toBe("導覽");
  });
});
