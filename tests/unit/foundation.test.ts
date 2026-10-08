import { describe, it, expect } from "vitest";
import { defaults, validateSettings } from "../../src/core/settings";
import { PluginRegistry, systemInfoPlugin } from "../../src/core/plugins";
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
describe("compiled plugin registry", () => {
  it("registers and removes the built-in panel", () => {
    const registry = new PluginRegistry();
    const ids = new Set<string>();
    registry.activate(systemInfoPlugin(), {
      log: () => {},
      translate: (k) => k,
      registerPanel: (p) => {
        ids.add(p.id);
        return () => {
          ids.delete(p.id);
        };
      },
    });
    expect(ids.size).toBe(1);
    expect(() =>
      registry.activate(systemInfoPlugin(), {
        log: () => {},
        translate: (k) => k,
        registerPanel: () => () => {},
      }),
    ).toThrow();
    registry.dispose();
    expect(ids.size).toBe(0);
  });
  it("rejects external entry points", () => {
    const plugin = systemInfoPlugin();
    plugin.manifest.entry = "untrusted.js";
    expect(() =>
      new PluginRegistry().activate(plugin, {
        log: () => {},
        translate: (k) => k,
        registerPanel: () => () => {},
      }),
    ).toThrow();
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
      "plugins",
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
