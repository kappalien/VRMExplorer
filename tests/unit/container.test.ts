import { describe, it, expect } from "vitest";
import { inspectContainer } from "../../src/features/vrm-preview/container";
function glb(value: unknown) {
  const text = JSON.stringify(value);
  const bytes = new TextEncoder().encode(
    text.padEnd(Math.ceil(text.length / 4) * 4, " "),
  );
  const buffer = new ArrayBuffer(20 + bytes.length);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, buffer.byteLength, true);
  view.setUint32(12, bytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20).set(bytes);
  return buffer;
}
describe("local GLB validation", () => {
  it("requires the correct VRM or VRMA extension", () => {
    expect(() =>
      inspectContainer(glb({ extensions: { VRMC_vrm: {} } }), "vrm"),
    ).not.toThrow();
    expect(() =>
      inspectContainer(glb({ extensions: { VRMC_vrm: {} } }), "vrma"),
    ).toThrow();
  });
  it("rejects external resources and corrupt headers", () => {
    expect(() =>
      inspectContainer(
        glb({
          extensions: { VRM: {} },
          images: [{ uri: "https://example.com/a.png" }],
        }),
        "vrm",
      ),
    ).toThrow("errors:externalResource");
    expect(() => inspectContainer(new ArrayBuffer(32), "vrm")).toThrow(
      "errors:container",
    );
  });
});
