import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { VirtualList, visibleRange } from "../../src/components/VirtualList";
import { WorkQueue } from "../../src/core/work-queue";
import {
  PluginRegistry,
  systemInfoPlugin,
  cacheToolsPlugin,
  type PluginContext,
  type CommandContribution,
} from "../../src/core/plugins";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("bounded UI work", () => {
  it("renders a bounded window of 50,000 items and navigates to the end", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const items = Array.from({ length: 50000 }, (_, id) => ({
      id,
      name: `file-${id}`,
    }));
    const view = render(
      <VirtualList
        items={items}
        itemKey={(v) => v.id}
        label="files"
        rowHeight={40}
        render={(v) => <button>{v.name}</button>}
      />,
    );
    expect(view.getAllByRole("listitem").length).toBeLessThan(25);
    fireEvent.keyDown(view.getByRole("list"), { key: "End" });
    expect(view.getByText("file-49999")).toBeTruthy();
    expect(view.getAllByRole("listitem").length).toBeLessThan(25);
    const range = visibleRange(50000, 5, 148, 148000, 400);
    expect(range.end - range.start).toBeLessThan(55);
  });
  it("retains the slot for an aborted running task and skips cancelled queued work", async () => {
    const queue = new WorkQueue(1);
    let finish!: (v: number) => void;
    const a = new AbortController(),
      b = new AbortController(),
      c = new AbortController();
    const first = queue
      .run(
        () =>
          new Promise<number>((r) => {
            finish = r;
          }),
        a.signal,
      )
      .catch((e: Error) => e.name);
    const skipped = vi.fn(async () => 2);
    const second = queue.run(skipped, b.signal).catch((e: Error) => e.name);
    const thirdTask = vi.fn(async () => 3);
    const third = queue.run(thirdTask, c.signal);
    a.abort();
    b.abort();
    expect(await first).toBe("AbortError");
    expect(await second).toBe("AbortError");
    expect(thirdTask).not.toHaveBeenCalled();
    finish(1);
    expect(await third).toBe(3);
    expect(skipped).not.toHaveBeenCalled();
  });
});
describe("trusted plugin contributions", () => {
  it("isolates command errors and continues disposing other plugins", async () => {
    const registry = new PluginRegistry();
    let command!: CommandContribution;
    const c: PluginContext = {
      log: vi.fn(),
      translate: (k) => k,
      registerPanel: () => () => {},
      clearThumbnailCache: async () => {
        throw new Error("private detail");
      },
      registerCommand: (v) => {
        command = v;
        return () => {};
      },
    };
    registry.activate(cacheToolsPlugin(), c);
    const panel = systemInfoPlugin();
    registry.activate(panel, c);
    panel.lifecycle.deactivate = () => {
      throw new Error("failure");
    };
    await expect(command.run()).rejects.toThrow("plugins:commandFailed");
    expect(registry.dispose()).toContain("builtin.system-info");
    expect(registry.dispose()).toEqual([]);
  });
  const context = (): PluginContext => ({
    log: vi.fn(),
    translate: (k) => k,
    registerPanel: () => vi.fn(),
  });
  it("checks SemVer and declared capabilities before registration", () => {
    const registry = new PluginRegistry(),
      plugin = systemInfoPlugin();
    plugin.manifest.minAppVersion = "0.0.9";
    plugin.manifest.apiVersion = "1.0.2";
    registry.validate(plugin.manifest);
    plugin.manifest.minAppVersion = "0.2.0";
    expect(() => registry.validate(plugin.manifest)).toThrow();
    plugin.manifest.minAppVersion = "0.1.0";
    plugin.manifest.capabilities = [];
    const c = context();
    c.registerPanel = vi.fn(() => vi.fn());
    expect(() => registry.activate(plugin, c)).toThrow();
    expect(c.registerPanel).not.toHaveBeenCalled();
  });
  it("rolls back leaked contributions when activation and disposal throw", () => {
    const registry = new PluginRegistry(),
      plugin = systemInfoPlugin(),
      remove = vi.fn(),
      c = context();
    c.registerPanel = () => remove;
    plugin.lifecycle.activate = (ctx) => {
      ctx.registerPanel({ id: plugin.manifest.id, titleKey: "x" });
      throw new Error("activation");
    };
    plugin.lifecycle.dispose = () => {
      throw new Error("disposal");
    };
    expect(() => registry.activate(plugin, c)).toThrow();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(registry.dispose()).toEqual([]);
  });
  it("executes the registered cache command and unregisters it on deactivation", async () => {
    const registry = new PluginRegistry(),
      c = context(),
      clear = vi.fn(async () => {}),
      remove = vi.fn();
    let command!: CommandContribution;
    c.clearThumbnailCache = clear;
    c.registerCommand = (value) => {
      command = value;
      return remove;
    };
    registry.activate(cacheToolsPlugin(), c);
    await command.run();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(registry.deactivate("builtin.cache-tools")).toEqual([]);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(registry.dispose()).toEqual([]);
  });
});
