import { it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), parse: vi.fn() }));
vi.mock("../../src/core/assets", () => ({ readAsset: mocks.read }));
vi.mock("../../src/features/vrm-preview/container", () => ({
  inspectContainer: () => {},
}));
vi.mock("three", async (original) => {
  const three = await original<typeof import("three")>();
  return {
    ...three,
    WebGLRenderer: class {
      domElement = document.createElement("canvas");
      outputColorSpace = "";
      setPixelRatio() {}
      setClearColor() {}
      setSize() {}
      setAnimationLoop() {}
      dispose() {}
      forceContextLoss() {}
    },
  };
});
it("failed replacement clears the previous model and its resources", async () => {
  mocks.read.mockReset().mockResolvedValue(new ArrayBuffer(20));
  mocks.parse.mockReset();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("devicePixelRatio", 1);
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry();
  scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
  const disposed = vi.spyOn(geometry, "dispose");
  mocks.parse.mockResolvedValue({
    scene,
    userData: {
      vrm: {
        scene,
        meta: { metaVersion: "1", name: "old" },
        humanoid: { humanBones: {}, resetNormalizedPose: vi.fn() },
      },
    },
  });
  const state = vi.fn();
  const engine = new PreviewEngine(document.createElement("div"), state);
  try {
    await engine.loadModel("valid.vrm");
    expect(state).toHaveBeenCalledWith(
      expect.objectContaining({ hasModel: true }),
    );
    state.mockClear();
    mocks.read.mockRejectedValueOnce(new Error("errors:readFailed"));
    await engine.loadModel("broken.vrm");
    expect(state).toHaveBeenCalledWith(
      expect.objectContaining({
        hasModel: false,
        metadata: {},
        availableExpressions: [],
        expression: "animation",
      }),
    );
    expect(state).toHaveBeenLastCalledWith({
      loading: false,
      error: "errors:readFailed",
    });
    expect(disposed).toHaveBeenCalledTimes(1);
  } finally {
    engine.dispose();
    vi.unstubAllGlobals();
  }
});
vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    register() {}
    parseAsync = mocks.parse;
  },
}));
import * as THREE from "three";
import { PreviewEngine } from "../../src/features/vrm-preview/PreviewEngine";
it("rapid model switches skip queued and stale reads before parsing", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("devicePixelRatio", 1);
  let finish!: (value: ArrayBuffer) => void;
  mocks.read
    .mockImplementationOnce(
      () =>
        new Promise<ArrayBuffer>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(new ArrayBuffer(20));
  mocks.parse.mockResolvedValue({ scene: new THREE.Scene(), userData: {} });
  const engine = new PreviewEngine(document.createElement("div"), vi.fn());
  try {
    const first = engine.loadModel("first.vrm");
    const middle = engine.loadModel("middle.vrm");
    const latest = engine.loadModel("latest.vrm");
    expect(mocks.read.mock.calls.map((v) => v[0])).toEqual(["first.vrm"]);
    finish(new ArrayBuffer(20));
    await Promise.all([first, middle, latest]);
    expect(mocks.read.mock.calls.map((v) => v[0])).toEqual([
      "first.vrm",
      "latest.vrm",
    ]);
    expect(mocks.parse).toHaveBeenCalledTimes(1);
  } finally {
    engine.dispose();
    vi.unstubAllGlobals();
  }
});

it("wheel zoom keeps an off-center point anchored at the cursor", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("devicePixelRatio", 1);
  const host = document.createElement("div");
  const engine = new PreviewEngine(host, vi.fn());
  const canvas = host.querySelector("canvas")!;
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 800,
    height: 600,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON() {},
  });
  const internals = engine as unknown as {
    camera: THREE.PerspectiveCamera;
    controls: import("three/examples/jsm/controls/OrbitControls.js").OrbitControls;
  };
  const { camera, controls } = internals;
  camera.aspect = 800 / 600;
  camera.position.set(0, 1, 3);
  controls.target.set(0, 1, 0);
  camera.updateProjectionMatrix();
  controls.update();
  const cursor = new THREE.Vector2(0.5, 0.3);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(cursor, camera);
  const point = ray.ray.intersectPlane(
    new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    new THREE.Vector3(),
  )!;
  const before = camera.position.clone();
  try {
    canvas.dispatchEvent(
      new WheelEvent("wheel", {
        clientX: 600,
        clientY: 210,
        deltaY: -100,
        cancelable: true,
      }),
    );
    camera.updateMatrixWorld();
    const projected = point.clone().project(camera);
    expect(camera.position.distanceTo(before)).toBeGreaterThan(0.01);
    expect(projected.x).toBeCloseTo(cursor.x, 5);
    expect(projected.y).toBeCloseTo(cursor.y, 5);
  } finally {
    engine.dispose();
    vi.unstubAllGlobals();
  }
});

it("zero-duration VRMA applies a held pose, skips absent optional bones and still switches to moving animation", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("devicePixelRatio", 1);
  mocks.read.mockReset().mockResolvedValue(new ArrayBuffer(20));
  mocks.parse.mockReset();
  const scene = new THREE.Scene();
  const arm = new THREE.Object3D();
  arm.name = "normalizedLeftUpperArm";
  scene.add(arm);
  const vrm = {
    scene,
    meta: { metaVersion: "1" },
    update: vi.fn(),
    humanoid: {
      humanBones: { leftUpperArm: {} },
      getNormalizedBoneNode: (bone: string) =>
        bone === "leftUpperArm" ? arm : null,
      resetNormalizedPose: () => arm.quaternion.identity(),
    },
  };
  const { VRMAnimation } = await import("@pixiv/three-vrm-animation");
  const pose = new VRMAnimation();
  const rotation = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
  pose.humanoidTracks.rotation.set(
    "leftUpperArm",
    new THREE.QuaternionKeyframeTrack("arm", [0], rotation),
  );
  pose.humanoidTracks.rotation.set(
    "upperChest",
    new THREE.QuaternionKeyframeTrack("optional", [0], [0, 0, 0, 1]),
  );
  mocks.parse
    .mockResolvedValueOnce({ scene, userData: { vrm } })
    .mockResolvedValueOnce({
      scene: new THREE.Scene(),
      userData: { vrmAnimations: [pose] },
    });
  const state = vi.fn();
  const engine = new PreviewEngine(document.createElement("div"), state);
  try {
    await engine.loadModel("model.vrm");
    await engine.loadAnimation("pose.vrma");
    expect(state).toHaveBeenCalledWith(
      expect.objectContaining({
        hasClip: true,
        staticPose: true,
        duration: 0,
        error: "",
      }),
    );
    engine.play();
    expect(arm.quaternion.toArray()).toEqual(
      Array.from(new Float32Array(rotation)),
    );
    const internals = engine as unknown as {
      mixer: THREE.AnimationMixer;
      action: THREE.AnimationAction;
    };
    engine.setLoop(true);
    expect(internals.action.loop).toBe(THREE.LoopOnce);
    internals.mixer.update(1);
    expect(arm.quaternion.toArray()).toEqual(
      Array.from(new Float32Array(rotation)),
    );
    expect(arm.quaternion.toArray().every(Number.isFinite)).toBe(true);
    engine.stop();
    expect(arm.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    engine.play();
    expect(arm.quaternion.toArray()).toEqual(
      Array.from(new Float32Array(rotation)),
    );
    const moving = new VRMAnimation();
    moving.duration = 1;
    moving.humanoidTracks.rotation.set(
      "leftUpperArm",
      new THREE.QuaternionKeyframeTrack(
        "arm",
        [0, 1],
        [...rotation, 0, 0, 0, 1],
      ),
    );
    mocks.parse.mockResolvedValueOnce({
      scene: new THREE.Scene(),
      userData: { vrmAnimations: [moving] },
    });
    await engine.loadAnimation("moving.vrma");
    expect(state).toHaveBeenCalledWith(
      expect.objectContaining({
        hasClip: true,
        staticPose: false,
        duration: 1,
      }),
    );
    engine.play();
    internals.mixer.update(0.5);
    expect(internals.action.isRunning()).toBe(true);
    expect(arm.quaternion.z).toBeGreaterThan(0);
    expect(arm.quaternion.z).toBeLessThan(Math.SQRT1_2);
    mocks.parse.mockResolvedValueOnce({
      scene: new THREE.Scene(),
      userData: { vrmAnimations: [new VRMAnimation()] },
    });
    await engine.loadAnimation("empty.vrma");
    expect(state).toHaveBeenCalledWith({ error: "errors:binding" });
    expect(state).toHaveBeenCalledWith(
      expect.objectContaining({ hasClip: false, staticPose: false }),
    );
  } finally {
    engine.dispose();
    vi.unstubAllGlobals();
  }
});
