import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { VirtualList, visibleRange } from "../../src/components/VirtualList";
import { WorkQueue } from "../../src/core/work-queue";
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
