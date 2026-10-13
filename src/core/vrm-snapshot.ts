import { invoke } from "@tauri-apps/api/core";
import { WorkQueue } from "./work-queue";
import { usePreview } from "../stores/preview";
const queue = new WorkQueue(1, 64);
const failures = new Map<string, number>();
interface Ticket {
  key: string;
  epoch: number;
}
function delay(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const stop = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve();
    }, 300);
    signal.addEventListener("abort", stop, { once: true });
    if (signal.aborted) stop();
  });
}
function render(data: ArrayBuffer, signal: AbortSignal) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const worker = new Worker(
      new URL("./vrm-snapshot.worker.ts", import.meta.url),
      { type: "module", name: "vrm-head-thumbnail" },
    );
    const finish = (error?: unknown, png?: ArrayBuffer) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      unsubscribe();
      worker.terminate();
      if (error) reject(error);
      else resolve(png!);
    };
    const abort = () => finish(new DOMException("Cancelled", "AbortError"));
    const unsubscribe = usePreview.subscribe((state) => {
      if (state.playback.loading) finish(new Error("previewBusy"));
    });
    const timer = setTimeout(() => finish(new Error("errors:image")), 20_000);
    worker.onmessage = (
      e: MessageEvent<{ png?: ArrayBuffer; error?: string }>,
    ) =>
      e.data.png
        ? finish(undefined, e.data.png)
        : finish(new Error(e.data.error ?? "errors:image"));
    worker.onerror = () => finish(new Error("errors:image"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    worker.postMessage(data, [data]);
  });
}
export async function snapshotBytes(path: string, signal: AbortSignal) {
  return queue.run(async () => {
    for (;;) {
      await delay(signal);
      while (
        usePreview.getState().playback.loading ||
        document.visibilityState === "hidden"
      )
        await delay(signal);
      const ticket = await invoke<Ticket>("snapshot_ticket", { path });
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      const failed = failures.get(ticket.key);
      if (failed && Date.now() - failed < 60_000)
        throw new Error("errors:image");
      try {
        const raw = await invoke<ArrayBuffer | number[]>(
          "read_snapshot_model",
          { path, ticket },
        );
        const data =
          raw instanceof ArrayBuffer ? raw : new Uint8Array(raw).buffer;
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        if (usePreview.getState().playback.loading) continue;
        const png = await render(data, signal);
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        const result = await invoke<ArrayBuffer | number[]>("save_snapshot", {
          path,
          ticket,
          png: Array.from(new Uint8Array(png)),
        });
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        failures.delete(ticket.key);
        return result;
      } catch (e) {
        if (String(e) === "Error: previewBusy") continue;
        if (!signal.aborted && String(e) !== "errors:cancelled") {
          if (failures.size >= 256)
            failures.delete(failures.keys().next().value!);
          failures.set(ticket.key, Date.now());
        }
        throw e;
      }
    }
  }, signal);
}
