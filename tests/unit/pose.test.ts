import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  VRMHumanoid,
  type VRM,
  type VRMHumanBones,
  type VRMPose,
} from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
} from "@pixiv/three-vrm-animation";
import {
  exportPose,
  PoseHistory,
  poseAngles,
} from "../../src/features/vrm-preview/pose";
function fixture(version: "0" | "1") {
  const scene = new THREE.Scene(),
    hips = new THREE.Object3D(),
    spine = new THREE.Object3D(),
    arm = new THREE.Object3D();
  hips.name = "Hips";
  spine.name = "Spine";
  arm.name = "Arm";
  scene.add(hips);
  hips.position.y = 1;
  hips.add(spine);
  spine.position.y = 0.2;
  spine.add(arm);
  arm.position.set(version === "0" ? 0.3 : -0.3, 0.2, 0);
  const humanoid = new VRMHumanoid({
    hips: { node: hips },
    spine: { node: spine },
    leftUpperArm: { node: arm },
  } as VRMHumanBones);
  scene.add(humanoid.normalizedHumanBonesRoot);
  return { scene, humanoid, meta: { metaVersion: version } } as unknown as VRM;
}
describe("static VRMA export", () => {
  for (const version of ["0", "1"] as const)
    it(`round trips rotations and hips through official loader for VRM ${version}`, async () => {
      const vrm = fixture(version);
      const rotation = new THREE.Quaternion()
        .setFromEuler(new THREE.Euler(0.3, -0.4, 0.6))
        .toArray();
      const pose: VRMPose = {
        leftUpperArm: { rotation },
        hips: { position: [0.1, 0.2, -0.3], rotation: [0, 0, 0, 1] },
      };
      vrm.humanoid.setNormalizedPose(pose);
      const bytes = exportPose(vrm, vrm.humanoid.getNormalizedPose());
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
      const gltf = await loader.parseAsync(bytes.buffer as ArrayBuffer, "");
      const clip = createVRMAnimationClip(gltf.userData.vrmAnimations[0], vrm);
      expect(clip.duration).toBe(0);
      const mixer = new THREE.AnimationMixer(vrm.scene);
      vrm.humanoid.resetNormalizedPose();
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      action.paused = true;
      mixer.update(0);
      const actual = vrm.humanoid.getNormalizedPose();
      expect(
        new THREE.Quaternion()
          .fromArray(actual.leftUpperArm!.rotation!)
          .angleTo(new THREE.Quaternion().fromArray(rotation)),
      ).toBeLessThan(0.001);
      actual.hips!.position!.forEach((v, i) =>
        expect(v).toBeCloseTo(pose.hips!.position![i], 5),
      );
      const json = JSON.parse(
        new TextDecoder().decode(
          bytes.subarray(
            20,
            20 + new DataView(bytes.buffer).getUint32(12, true),
          ),
        ),
      );
      expect(json.meshes).toBeUndefined();
      expect(json.images).toBeUndefined();
      expect(
        json.animations[0].channels.filter(
          (c: { target: { path: string } }) => c.target.path === "translation",
        ),
      ).toHaveLength(1);
    });
  it("rejects nonfinite poses", () =>
    expect(() =>
      exportPose(fixture("1"), { hips: { position: [NaN, 0, 0] } }),
    ).toThrow());
});
it("pose history branches and copies snapshots without mutating inputs", () => {
  const history = new PoseHistory(),
    pose: VRMPose = { hips: { rotation: [0, 0, 0, 1] } };
  history.push(pose);
  pose.hips!.rotation = [1, 0, 0, 0];
  history.push(pose);
  expect(history.canUndo).toBe(true);
  const old = history.move(-1)!;
  expect(old.hips!.rotation).toEqual([0, 0, 0, 1]);
  old.hips!.rotation = [0, 1, 0, 0];
  history.push(old);
  expect(history.canRedo).toBe(false);
  expect(history.move(-1)!.hips!.rotation).toEqual([0, 0, 0, 1]);
});
it("angles use consistent XYZ degrees", () =>
  expect(
    poseAngles(
      {
        head: {
          rotation: new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))
            .toArray(),
        },
      },
      "head",
    )[0],
  ).toBeCloseTo(90));

it("editor pauses, preserves drafts after animation, resets, and cleans up its controls", async () => {
  const { PoseEditor } =
    await import("../../src/features/vrm-preview/PoseEditor");
  const { OrbitControls } =
    await import("three/examples/jsm/controls/OrbitControls.js");
  const vrm = fixture("1"),
    canvas = document.createElement("canvas"),
    camera = new THREE.PerspectiveCamera();
  const orbit = new OrbitControls(camera, canvas);
  let paused = 0;
  const states: import("../../src/features/vrm-preview/pose").PoseState[] = [];
  const editor = new PoseEditor(
    vrm,
    vrm.scene,
    camera,
    canvas,
    orbit,
    () => paused++,
    (state) => states.push(state),
  );
  editor.show(true);
  editor.start();
  expect(paused).toBe(1);
  editor.select("leftUpperArm");
  editor.setAxis(0, -35);
  editor.commit();
  expect(states.at(-1)?.angles[0]).toBeCloseTo(-35);
  editor.suspend();
  vrm.humanoid.resetNormalizedPose();
  editor.start();
  expect(states.at(-1)?.angles[0]).toBeCloseTo(-35);
  editor.reset(false);
  expect(states.at(-1)?.angles[0]).toBeCloseTo(0);
  editor.undo(-1);
  expect(states.at(-1)?.angles[0]).toBeCloseTo(-35);
  editor.select("hips");
  editor.setAxis(1, 0.25, true);
  editor.commit();
  expect(states.at(-1)?.offset[1]).toBeCloseTo(0.25);
  editor.reset(true);
  expect(states.at(-1)?.offset[1]).toBeCloseTo(0);
  const count = vrm.scene.children.length;
  editor.dispose();
  expect(vrm.scene.children.length).toBe(count - 2);
  expect(orbit.enabled).toBe(true);
  orbit.dispose();
});
