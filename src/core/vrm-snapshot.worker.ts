/// <reference lib="webworker" />
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import { inspectContainer } from "../features/vrm-preview/container";
import { headBounds } from "../features/vrm-preview/head-bounds";
const worker = globalThis as unknown as DedicatedWorkerGlobalScope;
// Resize during decoding, before textures are uploaded to the GPU. This worker
// only produces 192px portraits and does not need full-resolution texture maps.
const bitmapFactory = worker.createImageBitmap.bind(worker);
worker.createImageBitmap = (async (
  source: ImageBitmapSource,
  options: ImageBitmapOptions = {},
) => {
  if (!(source instanceof Blob)) return bitmapFactory(source, options);
  const bytes = new Uint8Array(await source.slice(0, 24).arrayBuffer());
  let width = 512,
    height = 512;
  if (
    bytes.length === 24 &&
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71
  ) {
    const view = new DataView(bytes.buffer);
    const w = view.getUint32(16),
      h = view.getUint32(20);
    if (w > 0 && h > 0) {
      const scale = Math.min(1, 512 / Math.max(w, h));
      width = Math.max(1, Math.round(w * scale));
      height = Math.max(1, Math.round(h * scale));
    }
  }
  return bitmapFactory(source, {
    ...options,
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: "low",
  });
}) as typeof worker.createImageBitmap;
worker.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  let renderer: THREE.WebGLRenderer | undefined, vrm: VRM | undefined;
  try {
    const json = inspectContainer(event.data, "vrm");
    if (
      (json.accessors ?? []).reduce((sum, a) => sum + a.count, 0) > 5_000_000 ||
      (json.images?.length ?? 0) > 128
    )
      throw new Error("errors:tooLarge");
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      if (!url.startsWith("blob:") && !url.startsWith("data:"))
        throw new Error("errors:externalResource");
      return url;
    });
    const loader = new GLTFLoader(manager);
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await loader.parseAsync(event.data, "");
    vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) {
      VRMUtils.deepDispose(gltf.scene);
      throw new Error("errors:model");
    }
    VRMUtils.rotateVRM0(vrm);
    vrm.update(0);
    const bounds = headBounds(vrm),
      center = bounds.getCenter(new THREE.Vector3()),
      size = bounds.getSize(new THREE.Vector3());
    const half = Math.max(size.x, size.y, 0.06) * 0.58,
      distance = Math.max(size.z, half * 4, 0.3);
    const camera = new THREE.OrthographicCamera(
      -half,
      half,
      half,
      -half,
      0.001,
      distance + size.z + half * 4 + 1,
    );
    camera.position.copy(center).add(new THREE.Vector3(0, 0, distance));
    camera.lookAt(center);
    const canvas = new OffscreenCanvas(192, 192);
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(192, 192, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor("#e5eaf2");
    const scene = new THREE.Scene();
    scene.add(vrm.scene, new THREE.HemisphereLight(0xffffff, 0x667788, 2));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.copy(center).add(new THREE.Vector3(1, 2, 3));
    key.target.position.copy(center);
    scene.add(key, key.target);
    renderer.render(scene, camera);
    const blob = await canvas.convertToBlob({ type: "image/png" }),
      png = await blob.arrayBuffer();
    worker.postMessage({ png }, [png]);
  } catch (error) {
    worker.postMessage({ error: String(error).replace(/^Error: /, "") });
  } finally {
    if (vrm) {
      const images = new Set<ImageBitmap>();
      vrm.scene.traverse((node) => {
        if (node instanceof THREE.Mesh)
          for (const m of Array.isArray(node.material)
            ? node.material
            : [node.material])
            for (const value of Object.values(m))
              if (
                value instanceof THREE.Texture &&
                value.image instanceof ImageBitmap
              )
                images.add(value.image);
      });
      VRMUtils.deepDispose(vrm.scene);
      images.forEach((image) => image.close());
    }
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
};
