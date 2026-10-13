import { test, expect } from "@playwright/test";

test("real loader supports a single-frame VRMA and switches back to a moving VRMA", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    let scanned = false;
    const source = {
      id: 1,
      displayName: "Pose test",
      path: "C:\\Motions",
      enabled: true,
    };
    const motions = ["單幀姿勢.vrma", "動態.vrma", "匯出姿勢.vrma"].map(
      (fileName, index) => ({
        id: index + 1,
        sourceId: 1,
        path: `C:\\Motions\\${fileName}`,
        fileName,
        fileSize: 100,
        modifiedTime: 0,
        missing: false,
      }),
    );
    const makePose = (buffer: ArrayBuffer) => {
      const view = new DataView(buffer);
      const jsonLength = view.getUint32(12, true);
      const json = JSON.parse(
        new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)),
      );
      const tail = new Uint8Array(buffer.slice(20 + jsonLength));
      const binary = new DataView(tail.buffer, 8);
      for (const animation of json.animations) {
        for (const sampler of animation.samplers) {
          for (const index of [sampler.input, sampler.output])
            json.accessors[index].count = 1;
          const input = json.accessors[sampler.input];
          binary.setFloat32(
            (json.bufferViews[input.bufferView].byteOffset ?? 0) +
              (input.byteOffset ?? 0),
            0,
            true,
          );
          input.min = [0];
          input.max = [0];
        }
        const armNode =
          json.extensions.VRMC_vrm_animation.humanoid.humanBones.leftUpperArm
            .node;
        const channel = animation.channels.find(
          (c: { target: { node: number; path: string } }) =>
            c.target.node === armNode && c.target.path === "rotation",
        );
        const output =
          json.accessors[animation.samplers[channel.sampler].output];
        const offset =
          (json.bufferViews[output.bufferView].byteOffset ?? 0) +
          (output.byteOffset ?? 0);
        [0, 0, Math.SQRT1_2, Math.SQRT1_2].forEach((v, i) =>
          binary.setFloat32(offset + i * 4, v, true),
        );
      }
      const raw = new TextEncoder().encode(JSON.stringify(json));
      const padded = new Uint8Array(Math.ceil(raw.length / 4) * 4);
      padded.fill(32);
      padded.set(raw);
      const result = new ArrayBuffer(20 + padded.length + tail.length);
      const header = new DataView(result);
      header.setUint32(0, 0x46546c67, true);
      header.setUint32(4, 2, true);
      header.setUint32(8, result.byteLength, true);
      header.setUint32(12, padded.length, true);
      header.setUint32(16, 0x4e4f534a, true);
      new Uint8Array(result, 20).set(padded);
      new Uint8Array(result, 20 + padded.length).set(tail);
      return result;
    };
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
                view: "list",
                lastPath: "C:\\",
              };
            case "browse_directory":
              return ["Vivian.vrm", "Other.vrm"].map((name) => ({
                path: "C:\\" + name,
                name,
                kind: "vrm",
                size: 1,
                modified: 0,
              }));
            case "list_drives":
              return ["C:\\"];
            case "list_grants":
              return [];
            case "cache_control":
              return { limitMib: 256, usedBytes: 0, entries: 0 };
            case "pick_asset":
              return { path: "C:\\Vivian.vrm", directory: false };
            case "choose_source":
              return 1;
            case "start_scan":
              scanned = true;
              return null;
            case "library_snapshot":
              return {
                sources: [source],
                motions: scanned ? motions : [],
                running: false,
                progress: 0,
                status: "idle",
              };
            case "export_pose":
              Object.assign(globalThis, { exportedPose: args.bytes });
              return true;
            case "read_asset": {
              if (String(args.path).includes("匯出姿勢"))
                return new Uint8Array(
                  (globalThis as unknown as { exportedPose: number[] })
                    .exportedPose,
                ).buffer;
              const model = String(args.path).endsWith(".vrm");
              const buffer = await (
                await fetch(model ? "/src/Vivian.vrm" : "/src/Test.vrma")
              ).arrayBuffer();
              return String(args.path).includes("單幀")
                ? makePose(buffer)
                : buffer;
            }
            case "record_motion":
              if (!Number.isFinite(args.duration) || Number(args.duration) < 0)
                throw new Error("invalid duration");
              return null;
            case "save_settings":
            case "save_explorer":
            case "cancel_thumbnails":
              return null;
            default:
              throw new Error(`Unexpected IPC: ${command}`);
          }
        },
      },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".badge")).toHaveText("v1.5");
  await page.locator(".file-row").filter({ hasText: "Vivian.vrm" }).click();
  await expect(
    page.getByRole("button", { name: "重新取景", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  await page.getByRole("checkbox", { name: "骨骼疊加", exact: true }).check();
  await page.getByRole("tab", { name: "骨骼", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "人形骨骼對應表" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tabpanel", { name: "骨骼", exact: true }),
  ).toContainText("必要骨骼映射完整");
  const initialBoneHeight = (await page
    .locator(".bone-table-scroll")
    .boundingBox())!.height;
  await page.setViewportSize({ width: 1200, height: 1300 });
  await expect
    .poll(
      async () =>
        (await page.locator(".bone-table-scroll").boundingBox())!.height,
    )
    .toBeGreaterThan(initialBoneHeight + 390);
  const paneBounds = (await page.locator(".animation-pane").boundingBox())!;
  const tableBounds = (await page.locator(".bone-table-scroll").boundingBox())!;
  expect(
    paneBounds.y + paneBounds.height - tableBounds.y - tableBounds.height,
  ).toBeLessThan(25);
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.getByRole("tab", { name: "動畫區", exact: true }).click();
  await page.getByRole("button", { name: "選擇來源", exact: true }).click();
  await page
    .getByRole("button", { name: "單幀姿勢.vrma", exact: true })
    .click();
  const apply = page.getByRole("button", { name: "套用姿勢", exact: true });
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(page.getByRole("slider", { name: "動畫時間軸" })).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "停止", exact: true }).click();
  await apply.click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "動態.vrma", exact: true }).click();
  const play = page.getByRole("button", { name: "播放", exact: true });
  await expect(play).toBeEnabled();
  await play.click();
  await expect(
    page.getByRole("button", { name: "暫停", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.getByRole("slider", { name: "動畫時間軸" }).inputValue())
    .not.toBe("0");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("tab", { name: "自定義姿勢", exact: true }).click();
  await page.getByRole("button", { name: "擷取目前姿勢", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "編輯中", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "選擇骨骼", exact: true })
    .selectOption("leftUpperArm");
  const angle = page.getByRole("spinbutton", {
    name: "X 角度數值",
    exact: true,
  });
  await angle.fill("35");
  await angle.blur();
  await expect(angle).toHaveValue("35");
  await page.getByRole("button", { name: "復原", exact: true }).click();
  await expect(angle).not.toHaveValue("35");
  await page.getByRole("button", { name: "重做", exact: true }).click();
  await expect(angle).toHaveValue("35");
  await page.getByRole("tab", { name: "骨骼", exact: true }).click();
  await page.getByRole("tab", { name: "自定義姿勢", exact: true }).click();
  await expect(angle).toHaveValue("35");
  await page
    .getByRole("button", { name: "匯出靜態 VRMA", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "姿勢已另存" }),
  ).toBeVisible();
  const binary = await page.evaluate(
    () => (globalThis as unknown as { exportedPose: number[] }).exportedPose,
  );
  expect(binary.length).toBeLessThan(30000);
  expect(binary.slice(0, 4)).toEqual([103, 108, 84, 70]);
  await page.screenshot({ path: ".tmp-tests/custom-pose.png" });
  await page.getByRole("tab", { name: "動畫區", exact: true }).click();
  await page
    .getByRole("button", { name: "匯出姿勢.vrma", exact: true })
    .click();
  await expect(apply).toBeEnabled();
  await apply.click();
  await page.getByRole("tab", { name: "自定義姿勢", exact: true }).click();
  await page.getByRole("button", { name: "擷取目前姿勢", exact: true }).click();
  await expect(angle).toHaveValue("35");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.locator(".file-row").filter({ hasText: "Other.vrm" }).click();
  await expect(
    page.getByRole("button", { name: "繼續編輯", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "復原", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await page
    .getByRole("combobox", { name: "語言", exact: true })
    .selectOption("en");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Custom pose", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resume editing", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Resume editing", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Select bone", exact: true })
    .selectOption("leftUpperArm");
  const englishAngle = page.getByRole("spinbutton", {
    name: "X angle value",
    exact: true,
  });
  await englishAngle.fill("-12.5");
  await englishAngle.blur();
  await expect(englishAngle).toHaveValue("-12.5");
  await page.screenshot({ path: ".tmp-tests/custom-pose-en.png" });
  expect(errors).toEqual([]);
});
