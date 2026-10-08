import { test, expect } from "@playwright/test";

test("direct browse supports folder selection, address input and history without picker", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let scanned = false;
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        invoke: async (command: string, args: Record<string, unknown> = {}) => {
          switch (command) {
            case "load_settings":
              return {
                info: { root: "C:\\qa", writable: true, runtime: "system" },
                settings: JSON.parse(
                  localStorage.getItem("qa-settings") ?? "null",
                ) ?? {
                  schemaVersion: 1,
                  language: "zh-TW",
                  theme: "light",
                  navigationWidth: 280,
                  previewWidth: 380,
                },
              };
            case "load_explorer":
              return (
                JSON.parse(localStorage.getItem("qa-explorer") ?? "null") ?? {
                  schemaVersion: 1,
                  favorites: [],
                  recent: [],
                  view: "details",
                }
              );
            case "list_drives":
              return ["C:\\"];
            case "list_grants":
              return [];
            case "cache_control":
              return { limitMib: 256, usedBytes: 0, entries: 0 };
            case "choose_source":
              return 1;
            case "start_scan":
              scanned = true;
              localStorage.setItem("qa-scanned", "true");
              return null;
            case "read_thumbnail":
              throw new Error("errors:missing");
            case "read_asset":
              throw new Error("errors:missing");
            case "library_snapshot":
              return {
                sources:
                  scanned || localStorage.getItem("qa-scanned")
                    ? [
                        {
                          id: 1,
                          displayName: "動作",
                          path: "C:\\Motions",
                          enabled: true,
                        },
                      ]
                    : [],
                motions:
                  scanned || localStorage.getItem("qa-scanned")
                    ? [
                        {
                          id: 1,
                          sourceId: 1,
                          path: "C:\\Motions\\招手.vrma",
                          fileName: "招手.vrma",
                          fileSize: 2048,
                          modifiedTime: 0,
                          duration: 2.5,
                          favorite: false,
                          missing: false,
                        },
                      ]
                    : [],
                running: false,
                progress: 0,
                status: "idle",
              };
            case "browse_directory":
              return args.path === "C:\\"
                ? [
                    {
                      path: "C:\\Samples",
                      name: "Samples",
                      kind: "folder",
                      size: 0,
                      modified: 0,
                    },
                  ]
                : args.path === "C:\\中文 資料夾"
                  ? [
                      {
                        path: "C:\\中文 資料夾\\sample.vrm",
                        name: "sample.vrm",
                        kind: "vrm",
                        size: 2097152,
                        modified: 0,
                      },
                    ]
                  : [];
            case "save_settings":
              localStorage.setItem(
                "qa-settings",
                JSON.stringify(args.settings),
              );
              return null;
            case "save_explorer":
              localStorage.setItem("qa-explorer", JSON.stringify(args.prefs));
              return null;
            case "cancel_thumbnails":
              return null;
            default:
              throw new Error(`Unexpected IPC / picker: ${command}`);
          }
        },
      },
    });
  });
  await page.goto("/");
  const address = page.getByRole("textbox", { name: "資料夾路徑" });
  await page.getByRole("button", { name: "C:\\", exact: true }).click();
  await expect(address).toHaveValue("C:\\");
  const folder = page.getByRole("button", { name: /^Samples/ });
  await folder.click();
  await expect(address).toHaveValue("C:\\");
  await folder.dblclick();
  await expect(address).toHaveValue("C:\\Samples");
  await page.getByRole("button", { name: "上一個", exact: true }).click();
  await expect(address).toHaveValue("C:\\");
  await page.getByRole("button", { name: "下一個", exact: true }).click();
  await expect(address).toHaveValue("C:\\Samples");
  await address.fill("C:\\中文 資料夾");
  await address.press("Enter");
  await expect(page.locator(".files .file-list")).toBeVisible();
  await page.getByRole("button", { name: "上一個", exact: true }).click();
  await expect(address).toHaveValue("C:\\Samples");
  await page
    .getByRole("combobox", { name: "磁碟機", exact: true })
    .selectOption("");
  await expect(
    page.getByRole("button", { name: "C:\\", exact: true }),
  ).toBeVisible();
  await expect(address).toHaveValue("");
  await expect(page.locator(".files h2, .files .file-controls")).toHaveCount(0);
  await address.fill("C:\\中文 資料夾");
  await address.press("Enter");
  await expect(page.locator(".files .file-list")).toContainText("2 MiB");
  await page.getByRole("button", { name: "選擇來源", exact: true }).click();
  const motion = page.getByRole("button", { name: "招手.vrma", exact: true });
  await expect(motion).toBeVisible();
  await expect(page.locator(".motion-list small")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "切換收藏" })).toHaveCount(0);
  await motion.click();
  await expect(motion).toHaveAttribute("aria-pressed", "true");
  expect(
    (await page.locator(".three-surface").boundingBox())!.height,
  ).toBeGreaterThan(400);
  const toolbarHeight = (await page.locator(".files .toolbar").boundingBox())!
    .height;
  await page.getByRole("button", { name: "顯示縮圖", exact: true }).click();
  await expect(page.locator(".file-list.thumbnails")).toBeVisible();
  expect((await page.locator(".files .toolbar").boundingBox())!.height).toBe(
    toolbarHeight,
  );
  await page.getByRole("button", { name: "精簡顯示", exact: true }).click();
  await expect(page.locator(".file-list.list")).toBeVisible();
  expect((await page.locator(".files .toolbar").boundingBox())!.height).toBe(
    toolbarHeight,
  );
  await page.getByRole("button", { name: "顯示縮圖", exact: true }).click();
  await page.reload();
  await expect(page.locator(".file-list.thumbnails")).toBeVisible();
  // Restore details only in the test fixture to exercise file size preferences too.
  await page.evaluate(() => {
    const prefs = JSON.parse(localStorage.getItem("qa-explorer")!);
    prefs.view = "details";
    localStorage.setItem("qa-explorer", JSON.stringify(prefs));
  });
  await page.reload();
  await expect(page.locator(".file-list.details")).toBeVisible();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "設定", exact: true });
  await settings.getByLabel("檔案大小顯示單位").selectOption("MB");
  await settings.getByRole("combobox", { name: /^佈景/ }).selectOption("dark");
  await settings.getByRole("combobox", { name: /^語言/ }).selectOption("en");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".files .file-list")).toContainText("2.1 MB");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("qa-settings") ?? "{}").fileSizeUnit,
      ),
    )
    .toBe("MB");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Folder path" })).toHaveValue(
    "C:\\中文 資料夾",
  );
  await expect(
    page.getByRole("combobox", {
      name: "Choose or reauthorize a VRMA source folder",
    }),
  ).toHaveValue("1");
  await expect(
    page.getByRole("button", { name: "招手.vrma", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".files .file-list")).toContainText("2.1 MB");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "File size unit" }),
  ).toHaveValue("MB");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
