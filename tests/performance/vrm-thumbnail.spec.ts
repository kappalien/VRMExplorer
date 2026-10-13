import { test, expect } from "@playwright/test";
test("VRM covers take priority; missing covers render a head in a worker and reuse the snapshot", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    const cover = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVn8AAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    const noCover = async () => {
      const raw = await (await fetch("/src/Vivian.vrm")).arrayBuffer(),
        v = new DataView(raw),
        length = v.getUint32(12, true);
      const json = JSON.parse(
        new TextDecoder().decode(new Uint8Array(raw, 20, length)),
      );
      if (json.extensions.VRM) delete json.extensions.VRM.meta.texture;
      if (json.extensions.VRMC_vrm)
        delete json.extensions.VRMC_vrm.meta.thumbnailImage;
      const encoded = new TextEncoder().encode(JSON.stringify(json)),
        padded = (encoded.length + 3) & ~3,
        tail = new Uint8Array(raw, 20 + length);
      const out = new Uint8Array(20 + padded + tail.length);
      out.set(new Uint8Array(raw, 0, 20));
      out.fill(32, 20, 20 + padded);
      out.set(encoded, 20);
      out.set(tail, 20 + padded);
      const view = new DataView(out.buffer);
      view.setUint32(8, out.length, true);
      view.setUint32(12, padded, true);
      return out.buffer;
    };
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        invoke: async (command: string, args: Record<string, unknown> = {}) => {
          const head = args.path === "C:\\Models\\head.vrm";
          switch (command) {
            case "load_settings":
              return {
                info: { root: "C:\\qa", writable: true, runtime: "fixed" },
                settings: {
                  schemaVersion: 1,
                  language: "zh-TW",
                  theme: "light",
                  navigationWidth: 280,
                  previewWidth: 380,
                },
              };
            case "load_explorer":
              return {
                schemaVersion: 1,
                favorites: [],
                recent: [],
                view: "thumbnails",
                lastPath: "C:\\Models",
              };
            case "list_drives":
              return ["C:\\"];
            case "list_grants":
              return [];
            case "save_explorer":
            case "cancel_thumbnails":
              return;
            case "browse_directory":
              return ["embedded.vrm", "head.vrm"].map((name) => ({
                path: "C:\\Models\\" + name,
                name,
                kind: "vrm",
                size: 1,
                modified: 1,
              }));
            case "library_snapshot":
              return {
                sources: [],
                motions: [],
                running: false,
                progress: 0,
                status: "idle",
              };
            case "read_thumbnail": {
              if (!head) return cover.buffer;
              const cache = localStorage.getItem("head-snapshot");
              if (cache) return new Uint8Array(JSON.parse(cache)).buffer;
              throw "errors:noThumbnail";
            }
            case "snapshot_ticket":
              if (!head) throw "should not snapshot a cover";
              return { key: "head", epoch: 0 };
            case "read_snapshot_model":
              if (!head) throw "should not read a covered VRM";
              localStorage.setItem(
                "model-reads",
                String(Number(localStorage.getItem("model-reads") ?? 0) + 1),
              );
              return noCover();
            case "save_snapshot":
              localStorage.setItem("head-snapshot", JSON.stringify(args.png));
              return new Uint8Array(args.png as number[]).buffer;
            default:
              throw "unexpected " + command;
          }
        },
      },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const embedded = page
    .locator(".file-row")
    .filter({ hasText: "embedded.vrm" })
    .locator("img");
  await expect(embedded).toBeVisible();
  await expect
    .poll(() => embedded.evaluate((e) => (e as HTMLImageElement).naturalWidth))
    .toBe(1);
  const head = page
    .locator(".file-row")
    .filter({ hasText: "head.vrm" })
    .locator("img");
  await expect(head).toBeVisible({ timeout: 45000 });
  await expect
    .poll(() => head.evaluate((e) => (e as HTMLImageElement).naturalWidth))
    .toBe(192);
  const colored = await head.evaluate((e) => {
    const canvas = document.createElement("canvas");
    canvas.width = 192;
    canvas.height = 192;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(e as HTMLImageElement, 0, 0);
    const data = ctx.getImageData(0, 0, 192, 192).data;
    let colored = 0;
    for (let i = 0; i < data.length; i += 4)
      if (
        Math.abs(data[i] - 229) +
          Math.abs(data[i + 1] - 234) +
          Math.abs(data[i + 2] - 242) >
        30
      )
        colored++;
    return colored;
  });
  expect(colored).toBeGreaterThan(1000);
  await head.screenshot({ path: ".tmp-tests/head-thumbnail.png" });
  expect(
    await page.evaluate(() => Number(localStorage.getItem("model-reads"))),
  ).toBe(1);
  await page.reload();
  await expect(
    page.locator(".file-row").filter({ hasText: "head.vrm" }).locator("img"),
  ).toBeVisible();
  expect(
    await page.evaluate(() => Number(localStorage.getItem("model-reads"))),
  ).toBe(1);
  expect(errors).toEqual([]);
});
