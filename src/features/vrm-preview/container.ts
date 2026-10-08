export interface GltfDocument {
  extensions?: Record<string, unknown>;
  buffers?: { uri?: string }[];
  images?: { uri?: string }[];
  accessors?: { count: number }[];
  extensionsUsed?: string[];
}
export function inspectContainer(
  buffer: ArrayBuffer,
  kind: "vrm" | "vrma",
): GltfDocument {
  if (buffer.byteLength < 20 || buffer.byteLength > 256 * 1024 * 1024)
    throw new Error("errors:container");
  const view = new DataView(buffer);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== buffer.byteLength ||
    view.getUint32(16, true) !== 0x4e4f534a
  )
    throw new Error("errors:container");
  const length = view.getUint32(12, true);
  if (length > 16 * 1024 * 1024 || 20 + length > buffer.byteLength)
    throw new Error("errors:container");
  const json = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 20, length)),
  ) as GltfDocument;
  if (
    !json ||
    typeof json !== "object" ||
    !json.extensions ||
    (kind === "vrm"
      ? !(json.extensions.VRM || json.extensions.VRMC_vrm)
      : !json.extensions.VRMC_vrm_animation)
  )
    throw new Error("errors:container");
  for (const resource of [...(json.buffers ?? []), ...(json.images ?? [])])
    if (resource.uri && !resource.uri.startsWith("data:"))
      throw new Error("errors:externalResource");
  if (
    json.accessors?.some(
      (a) =>
        !Number.isSafeInteger(a.count) || a.count < 0 || a.count > 10_000_000,
    )
  )
    throw new Error("errors:tooLarge");
  return json;
}
