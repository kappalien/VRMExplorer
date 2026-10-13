import * as THREE from "three";
import { VRMUtils } from "@pixiv/three-vrm";
export { MAX_SCENE_MODELS } from "../../core/scene-limits";
export interface LoadSummary {
  bytes: number;
  readMs: number;
  parseMs: number;
  firstRenderMs: number;
  totalMs: number;
  textures: number;
  maxTextureWidth: number;
  maxTextureHeight: number;
  estimatedTextureBytes: number;
}
export interface SceneModel {
  path: string;
  name: string;
  position: [number, number, number];
  yaw: number;
}
function materialTextures(material: THREE.Material) {
  const textures = new Set<THREE.Texture>();
  const collect = (value: unknown) => {
    if (value instanceof THREE.Texture) textures.add(value);
    else if (Array.isArray(value))
      for (const item of value)
        if (item instanceof THREE.Texture) textures.add(item);
  };
  for (const value of Object.values(material)) collect(value);
  // MToon stores maps in shader uniforms rather than enumerable material map fields.
  if (material instanceof THREE.ShaderMaterial)
    for (const uniform of Object.values(material.uniforms))
      collect(uniform.value);
  return textures;
}
export function textureSummary(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(node.material)
      ? node.material
      : [node.material])
      for (const texture of materialTextures(material)) textures.add(texture);
  });
  let maxTextureWidth = 0,
    maxTextureHeight = 0,
    estimatedTextureBytes = 0;
  for (const texture of textures) {
    const image = texture.image as
      { width?: number; height?: number } | undefined;
    const width = image?.width ?? 0,
      height = image?.height ?? 0;
    maxTextureWidth = Math.max(maxTextureWidth, width);
    maxTextureHeight = Math.max(maxTextureHeight, height);
    estimatedTextureBytes +=
      width * height * 4 * (texture.generateMipmaps ? 4 / 3 : 1);
  }
  return {
    textures: textures.size,
    maxTextureWidth,
    maxTextureHeight,
    estimatedTextureBytes,
  };
}
/** Readback is bottom-up and blended pixels have premultiplied RGB. PNG needs straight alpha. */
export function pngPixels(raw: Uint8Array, width: number, height: number) {
  const output = new Uint8ClampedArray(raw.length);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const from = ((height - 1 - y) * width + x) * 4,
        to = (y * width + x) * 4;
      const alpha = raw[from + 3];
      for (let c = 0; c < 3; c++) {
        if (alpha === 255) output[to + c] = raw[from + c];
        else if (alpha) {
          // SRGB8 framebuffer blending is linear. Unpremultiply before converting back to sRGB.
          const encoded = raw[from + c] / 255;
          const linear =
            ((encoded <= 0.04045
              ? encoded / 12.92
              : ((encoded + 0.055) / 1.055) ** 2.4) *
              255) /
            alpha;
          output[to + c] = Math.round(
            255 *
              (linear <= 0.0031308
                ? linear * 12.92
                : 1.055 * linear ** (1 / 2.4) - 0.055),
          );
        }
      }
      output[to + 3] = alpha;
    }
  return output;
}

export function disposeModel(root: THREE.Object3D) {
  const bitmaps = new Set<ImageBitmap>();
  if (typeof ImageBitmap !== "undefined")
    root.traverse((node) => {
      if (node instanceof THREE.Mesh)
        for (const material of Array.isArray(node.material)
          ? node.material
          : [node.material])
          for (const texture of materialTextures(material))
            if (texture.image instanceof ImageBitmap)
              bitmaps.add(texture.image);
    });
  VRMUtils.deepDispose(root);
  for (const bitmap of bitmaps) bitmap.close();
}
