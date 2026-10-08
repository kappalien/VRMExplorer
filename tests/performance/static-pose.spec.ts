import { test, expect } from "@playwright/test";

test("real loader supports a single-frame VRMA and switches back to a moving VRMA", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let scanned = false;
    const source = {
      id: 1,
      displayName: "Pose test",
      path: "C:\\Motions",
      enabled: true,
    };
    const motions = ["單幀姿勢.vrma", "動態.vrma"].map((fileName, index) => ({
      id: index + 1,
      sourceId: 1,
      path: `C:\\Motions\\${fileName}`,
      fileName,
      fileSize: 100,
      modifiedTime: 0,
      missing: false,
    }));
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
              };
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
            case "read_asset": {
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
  await expect(page.locator(".badge")).toHaveText("v1.1");
  await page.getByRole("button", { name: "開啟 VRM", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "重新取景", exact: true }),
  ).toBeEnabled();
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
  expect(errors).toEqual([]);
});
