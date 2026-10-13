import { test, expect } from "@playwright/test";
test("multiple real VRMs preserve per-model poses and export an actual transparent scene PNG", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        invoke: async (command: string, args: Record<string, unknown> = {}) => {
          switch (command) {
            case "update_snapshot":
              return {
                phase: "idle",
                supported: false,
                automatic: false,
                error: "",
                result: "",
              };
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
                view: "details",
                lastPath: "C:\\Models",
              };
            case "list_drives":
              return ["C:\\"];
            case "list_grants":
              return [];
            case "browse_directory":
              return ["Vivian.vrm", "Crimson Weave.vrm", "photo.png"].map(
                (name) => ({
                  path: "C:\\Models\\" + name,
                  name,
                  kind: name.endsWith(".vrm") ? "vrm" : "png",
                  size: 1,
                  modified: 0,
                }),
              );
            case "library_snapshot":
              return {
                sources: [],
                motions: [],
                running: false,
                progress: 0,
                status: "idle",
              };
            case "cache_control":
              return { limitMib: 256, usedBytes: 0, entries: 0 };
            case "read_image":
              return Uint8Array.from(
                atob(
                  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVn8AAAAASUVORK5CYII=",
                ),
                (c) => c.charCodeAt(0),
              ).buffer;
            case "read_asset":
              return (
                await fetch("/src/" + String(args.path).split("\\").pop())
              ).arrayBuffer();
            case "export_png":
              Object.assign(globalThis, { scenePng: args.bytes });
              return true;
            case "save_explorer":
            case "save_settings":
            case "cancel_thumbnails":
              return;
            default:
              throw new Error("unexpected " + command);
          }
        },
      },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator(".file-row").filter({ hasText: "Vivian.vrm" }).click();
  await expect(
    page.getByRole("button", { name: "重新取景", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
  await page.locator(".file-row").filter({ hasText: "photo.png" }).click();
  await expect(page.locator(".image-surface img")).toBeVisible();
  await page
    .locator(".file-row")
    .filter({ hasText: "Vivian.vrm" })
    .click({ modifiers: ["Control"] });
  await page
    .locator(".file-row")
    .filter({ hasText: "Crimson Weave.vrm" })
    .click({ modifiers: ["Control"] });
  await page
    .getByRole("button", { name: "載入選取模型（2）", exact: true })
    .click();
  const active = page.getByRole("combobox", {
    name: "目前操作模型",
    exact: true,
  });
  await expect(active.locator("option")).toHaveCount(2, { timeout: 60000 });
  await expect(active).toBeEnabled();
  await page.locator(".load-summary summary").click();
  await expect(page.locator(".load-summary")).toContainText("貼圖記憶體估算");
  await expect(page.locator(".load-summary")).not.toContainText("NaN");
  await expect(
    page
      .locator(".load-summary .metadata > div")
      .filter({ has: page.getByText("貼圖數量", { exact: true }) })
      .locator("dd"),
  ).not.toHaveText("0");
  await page.getByRole("tab", { name: "自定義姿勢", exact: true }).click();
  await page.getByRole("button", { name: "繼續編輯", exact: true }).click();
  await page
    .getByRole("combobox", { name: "選擇骨骼", exact: true })
    .selectOption("leftUpperArm");
  const angle = page.getByRole("spinbutton", {
    name: "X 角度數值",
    exact: true,
  });
  await angle.fill("35");
  await angle.press("Tab");
  await active.selectOption("C:\\Models\\Crimson Weave.vrm");
  await page.getByRole("button", { name: "繼續編輯", exact: true }).click();
  await page
    .getByRole("combobox", { name: "選擇骨骼", exact: true })
    .selectOption("leftUpperArm");
  await expect(angle).toHaveValue("0");
  await active.selectOption("C:\\Models\\Vivian.vrm");
  await expect(angle).toHaveValue("35");
  await page.getByRole("checkbox", { name: "骨骼疊加", exact: true }).check();
  await page.getByRole("button", { name: "匯出 PNG", exact: true }).click();
  await page.getByLabel("最長邊解析度").selectOption("1024");
  await page.getByRole("button", { name: "另存 PNG", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "PNG 已儲存",
    {
      timeout: 30000,
    },
  );
  const pixels = await page.evaluate(async () => {
    const bytes = (globalThis as unknown as { scenePng: number[] }).scenePng;
    const bitmap = await createImageBitmap(
      new Blob([new Uint8Array(bytes)], { type: "image/png" }),
    );
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0,
      opaque = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) transparent++;
      if (data[i] === 255) opaque++;
    }
    return {
      width: canvas.width,
      height: canvas.height,
      transparent,
      opaque,
      corner: data[3],
      size: bytes.length,
    };
  });
  expect(Math.max(pixels.width, pixels.height)).toBe(1024);
  expect(pixels.transparent).toBeGreaterThan(10000);
  expect(pixels.opaque).toBeGreaterThan(10000);
  expect(pixels.corner).toBe(0);
  await page.getByRole("button", { name: "關閉", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "格線", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "骨骼疊加", exact: true }),
  ).toBeChecked();
  await expect(angle).toHaveValue("35");
  await page.getByRole("button", { name: "移出場景", exact: true }).click();
  await expect(page.locator(".scene-management select option")).toHaveCount(1);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({ sceneModels: 2, png: pixels, retainedPose: true }),
  );
});
