import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { inspectContainer } from "../../src/features/vrm-preview/container";
import { ExpressionControl } from "../../src/features/vrm-preview/expressions";
const status = document.getElementById("status")!;
try {
  const buffer = await (await fetch("/src/Vivian.vrm")).arrayBuffer();
  inspectContainer(buffer, "vrm");
  const loader = new GLTFLoader().register(
    (parser) => new VRMLoaderPlugin(parser),
  );
  const gltf = await loader.parseAsync(buffer, "");
  const vrm = gltf.userData.vrm;
  if (!vrm?.humanoid?.getNormalizedBoneNode("hips")) throw Error("No hips");
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(640, 480);
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(vrm.scene, new THREE.HemisphereLight(0xffffff, 0x666666, 3));
  const camera = new THREE.PerspectiveCamera(35, 640 / 480, 0.01, 100);
  camera.position.set(0, 1, 3);
  camera.lookAt(0, 1, 0);
  const expressions = new ExpressionControl();
  expressions.attach(vrm.expressionManager);
  const expressionChecks = expressions.available.map((name) => {
    expressions.select(name);
    vrm.update(1 / 60);
    renderer.render(scene, camera);
    return { name, weight: vrm.expressionManager?.getValue(name) ?? 0 };
  });
  expressions.select("animation");
  vrm.update(1 / 60);
  renderer.render(scene, camera);
  status.textContent = JSON.stringify({
    loaded: true,
    expressionChecks,
    version: vrm.meta.metaVersion,
    title: vrm.meta.name ?? vrm.meta.title,
    geometries: renderer.info.memory.geometries,
    drawCalls: renderer.info.render.calls,
  });
} catch (error) {
  status.textContent = `FAILED: ${String(error)}`;
}
