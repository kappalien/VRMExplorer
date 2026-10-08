export type Capability =
  "metadata" | "preview" | "animation" | "command" | "panel" | "export";
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  apiVersion: string;
  minAppVersion: string;
  description: string;
  author: string;
  capabilities: Capability[];
  supportedExtensions: string[];
  localizationNamespaces: string[];
  entry?: string;
}
export interface PluginContext {
  log: (message: string) => void;
  translate: (key: string) => string;
  registerPanel: (panel: PanelContribution) => () => void;
  registerCommand?: (command: CommandContribution) => () => void;
  clearThumbnailCache?: () => Promise<void>;
}
export interface PluginLifecycle {
  activate: (context: PluginContext) => void;
  deactivate: () => void;
  dispose: () => void;
}
export interface PreviewProvider {
  extensions: string[];
  dispose: () => void;
}
export interface MetadataProvider {
  read: (assetId: string) => Promise<Record<string, unknown>>;
}
export interface AnimationProvider {
  bind: (modelId: string, animationId: string) => Promise<void>;
}
export interface CommandContribution {
  id: string;
  labelKey: string;
  run: () => Promise<void>;
}
export interface PanelContribution {
  id: string;
  titleKey: string;
}
export interface ExportProvider {
  id: string;
  export: () => Promise<Uint8Array>;
}
export interface BuiltinPlugin {
  manifest: PluginManifest;
  lifecycle: PluginLifecycle;
}
export class PluginRegistry {
  private active = new Map<
    string,
    { plugin: BuiltinPlugin; cleanup: (() => void)[] }
  >();
  discover(): BuiltinPlugin[] {
    return [systemInfoPlugin(), cacheToolsPlugin()];
  }
  validate(m: PluginManifest) {
    const api = version(m.apiVersion),
      app = version(m.minAppVersion);
    const capabilities: Capability[] = [
      "metadata",
      "preview",
      "animation",
      "command",
      "panel",
      "export",
    ];
    if (
      !api ||
      api[0] !== 1 ||
      api[1] !== 0 ||
      !app ||
      compare(app, [0, 1, 0]) > 0 ||
      !version(m.version) ||
      !/^builtin\.[a-z-]+$/.test(m.id) ||
      m.entry !== undefined ||
      new Set(m.capabilities).size !== m.capabilities.length ||
      m.capabilities.some((c) => !capabilities.includes(c)) ||
      m.supportedExtensions.some((e) => !/^[a-z0-9]+$/.test(e)) ||
      m.localizationNamespaces.some((n) => !/^[a-z][a-z0-9.-]*$/.test(n))
    )
      throw new Error("Invalid built-in manifest");
  }
  activate(plugin: BuiltinPlugin, context: PluginContext) {
    const m = plugin.manifest;
    this.validate(m);
    if (this.active.has(m.id)) throw new Error("Plugin already active");
    const cleanup: (() => void)[] = [];
    const ids = new Set<string>();
    const register = (
      capability: Capability,
      id: string,
      host: () => () => void,
    ) => {
      if (
        !m.capabilities.includes(capability) ||
        !(id === m.id || id.startsWith(m.id + ".")) ||
        ids.has(id)
      )
        throw new Error("Invalid contribution");
      const remove = host();
      ids.add(id);
      let active = true;
      const unregister = () => {
        if (active) {
          active = false;
          ids.delete(id);
          remove();
        }
      };
      cleanup.push(unregister);
      return unregister;
    };
    const controlled: PluginContext = {
      log: context.log,
      translate: context.translate,
      clearThumbnailCache: m.capabilities.includes("command")
        ? context.clearThumbnailCache
        : undefined,
      registerPanel: (p) =>
        register("panel", p.id, () => context.registerPanel(p)),
      registerCommand: (c) =>
        register("command", c.id, () => {
          if (!context.registerCommand) throw new Error("Commands unavailable");
          return context.registerCommand({
            ...c,
            run: async () => {
              try {
                await c.run();
              } catch {
                context.log("plugins:commandFailed");
                throw new Error("plugins:commandFailed");
              }
            },
          });
        }),
    };
    try {
      plugin.lifecycle.activate(controlled);
      this.active.set(m.id, { plugin, cleanup });
    } catch (error) {
      try {
        plugin.lifecycle.dispose();
      } catch {
        context.log("plugins:disposeFailed");
      }
      for (const remove of cleanup.reverse()) {
        try {
          remove();
        } catch {
          context.log("plugins:disposeFailed");
        }
      }
      throw error;
    }
  }
  deactivate(id: string) {
    const failures: string[] = [];
    const record = this.active.get(id);
    if (!record) return failures;
    this.active.delete(id);
    const p = record.plugin;
    try {
      p.lifecycle.deactivate();
    } catch {
      failures.push(p.manifest.id);
    }
    try {
      p.lifecycle.dispose();
    } catch {
      failures.push(p.manifest.id);
    }
    for (const remove of record.cleanup.reverse()) {
      try {
        remove();
      } catch {
        failures.push(id);
      }
    }
    return failures;
  }
  dispose() {
    return [...this.active.keys()].flatMap((id) => this.deactivate(id));
  }
}
function version(value: string): number[] | null {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) return null;
  const parts = value.split(".").map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}
function compare(a: number[], b: number[]) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}
export function cacheToolsPlugin(): BuiltinPlugin {
  let unregister: (() => void) | undefined;
  return {
    manifest: {
      id: "builtin.cache-tools",
      name: "plugins:cacheTools",
      version: "0.1.0",
      apiVersion: "1.0.0",
      minAppVersion: "0.1.0",
      description: "plugins:cacheToolsDescription",
      author: "VRM Explorer",
      capabilities: ["command"],
      supportedExtensions: [],
      localizationNamespaces: ["plugins"],
    },
    lifecycle: {
      activate: (context) => {
        if (!context.registerCommand || !context.clearThumbnailCache)
          throw new Error("Cache service unavailable");
        const clear = context.clearThumbnailCache;
        unregister = context.registerCommand({
          id: "builtin.cache-tools.clear",
          labelKey: "plugins:clearCache",
          run: clear,
        });
      },
      deactivate: () => {
        unregister?.();
        unregister = undefined;
      },
      dispose: () => {
        unregister?.();
        unregister = undefined;
      },
    },
  };
}
export function systemInfoPlugin(): BuiltinPlugin {
  let unregister: undefined | (() => void);
  return {
    manifest: {
      id: "builtin.system-info",
      name: "plugins:systemInfo",
      version: "0.1.0",
      apiVersion: "1.0.0",
      minAppVersion: "0.1.0",
      description: "plugins:systemInfoDescription",
      author: "VRM Explorer",
      capabilities: ["panel"],
      supportedExtensions: [],
      localizationNamespaces: ["plugins"],
    },
    lifecycle: {
      activate: (c) => {
        unregister = c.registerPanel({
          id: "builtin.system-info",
          titleKey: "common:builtin",
        });
      },
      deactivate: () => {
        unregister?.();
        unregister = undefined;
      },
      dispose: () => {
        unregister?.();
        unregister = undefined;
      },
    },
  };
}
