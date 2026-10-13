import { it, expect } from "vitest";
import * as THREE from "three";
import {
  pngPixels,
  textureSummary,
} from "../../src/features/vrm-preview/scene";
import { useExplorer } from "../../src/stores/explorer";
import { usePreview } from "../../src/stores/preview";
const assets = Array.from({ length: 9 }, (_, i) => ({
  path: `${i}.vrm`,
  name: `${i}.vrm`,
  kind: "vrm",
  size: 1,
  modified: 1,
}));
it("PNG readback flips rows and removes premultiplication in linear color space", () => {
  const result = pngPixels(
    new Uint8Array([
      136, 136, 136, 128, 200, 30, 10, 0, 12, 34, 56, 255, 0, 0, 0, 255,
    ]),
    2,
    2,
  );
  expect(Array.from(result.slice(0, 8))).toEqual([
    12, 34, 56, 255, 0, 0, 0, 255,
  ]);
  expect(result[8]).toBe(186);
  expect(Array.from(result.slice(12))).toEqual([0, 0, 0, 0]);
});
it("texture estimates deduplicate shared textures without duplicating material metadata", () => {
  const texture = new THREE.Texture({
    width: 1024,
    height: 512,
  } as unknown as HTMLImageElement);
  const root = new THREE.Group();
  root.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshBasicMaterial({ map: texture }),
    ),
    new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.ShaderMaterial({ uniforms: { map: { value: texture } } }),
    ),
  );
  expect(textureSummary(root)).toEqual({
    textures: 1,
    maxTextureWidth: 1024,
    maxTextureHeight: 512,
    estimatedTextureBytes: (1024 * 512 * 4 * 4) / 3,
  });
});
it("Ctrl selection and sorted Shift ranges retain the current preview until explicitly loaded", () => {
  const store = useExplorer.getState();
  store.select(assets[0]);
  store.select(assets[2], "toggle");
  expect(useExplorer.getState().selected).toEqual(assets[0]);
  expect(useExplorer.getState().selection).toEqual([assets[0], assets[2]]);
  store.select(assets[0], "range", assets.slice(0, 3).reverse());
  expect(useExplorer.getState().selection).toEqual(
    assets.slice(0, 3).reverse(),
  );
  store.select(null);
});
it("scene selection deduplicates, enforces the model cap and updates the active model on removal", () => {
  const store = usePreview.getState();
  store.setModels([assets[0], assets[1], assets[0]]);
  expect(usePreview.getState().models).toEqual(assets.slice(0, 2));
  store.activateModel(assets[1].path);
  store.removeModel(assets[1].path);
  expect(usePreview.getState().model).toEqual(assets[0]);
  store.setModels(assets);
  expect(usePreview.getState().models).toEqual([assets[0]]);
  expect(usePreview.getState().playback.error).toBe("errors:sceneLimit");
  store.setModels([]);
});
