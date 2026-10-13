import {
  disposeModel,
  textureSummary,
  pngPixels,
  MAX_SCENE_MODELS,
  type LoadSummary,
} from "./scene";
import type { AssetEntry } from "../../core/assets";
import type { PoseState } from "./pose";
import { PoseEditor } from "./PoseEditor";
import { emptyPose } from "./pose";
import { inspectBones } from "./bones";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import {
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
  type VRMAnimation,
} from "@pixiv/three-vrm-animation";
import { readAsset } from "../../core/assets";
import { inspectContainer } from "./container";
import type { Playback } from "../../stores/preview";
import { WorkQueue } from "../../core/work-queue";
import { ExpressionControl, type ExpressionMode } from "./expressions";
interface ModelSlot {
  path: string;
  name: string;
  fingerprint: string;
  vrm: VRM;
  root: THREE.Group;
  width: number;
  expressions: ExpressionControl;
  poseEditor?: PoseEditor;
  poseState: PoseState;
  skeleton?: THREE.SkeletonHelper;
  mixer?: THREE.AnimationMixer;
  action?: THREE.AnimationAction;
  staticPose: boolean;
  clipPath: string;
  metadata: Record<string, unknown>;
  summary: LoadSummary;
}
export class PreviewEngine {
  private models = new Map<string, ModelSlot>();
  private activePath = "";
  private requestedActive = "";
  private fallbackExpressions = new ExpressionControl();
  private get active() {
    return this.models.get(this.activePath);
  }
  private get vrm() {
    return this.active?.vrm;
  }
  private get expressions() {
    return this.active?.expressions ?? this.fallbackExpressions;
  }
  private get poseEditor() {
    return this.active?.poseEditor;
  }
  private set poseEditor(value: PoseEditor | undefined) {
    if (this.active) this.active.poseEditor = value;
  }
  private get mixer() {
    return this.active?.mixer;
  }
  private set mixer(value: THREE.AnimationMixer | undefined) {
    if (this.active) this.active.mixer = value;
  }
  private get action() {
    return this.active?.action;
  }
  private set action(value: THREE.AnimationAction | undefined) {
    if (this.active) this.active.action = value;
  }
  private get staticPose() {
    return this.active?.staticPose ?? false;
  }
  private set staticPose(value: boolean) {
    if (this.active) this.active.staticPose = value;
  }
  private poseVisible = false;
  private showBones = false;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private animation?: VRMAnimation;
  private animationPath = "";
  private modelEpoch = 0;
  private animationEpoch = 0;
  private loads = new WorkQueue(1, 2);
  private modelRequest?: AbortController;
  private animationRequest?: AbortController;
  private disposed = false;
  private last = performance.now();
  private notified = 0;
  private speed = 1;
  private loop = true;
  private grid = new THREE.GridHelper(10, 20);
  private axes = new THREE.AxesHelper(0.5);
  private lights = new THREE.Group();
  constructor(
    private host: HTMLElement,
    private onState: (patch: Partial<Playback>) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor("#e5eaf2");
    host.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.zoomToCursor = true;
    this.controls.minDistance = 0.05;
    this.camera.position.set(0, 1.4, 3);
    this.controls.target.set(0, 1, 0);
    this.lights.add(new THREE.HemisphereLight(0xffffff, 0x667788, 2));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(1, 2, 3);
    this.lights.add(key);
    this.scene.add(this.grid, this.axes, this.lights);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.renderer.domElement.addEventListener(
      "webglcontextlost",
      this.contextLost,
    );
    this.renderer.setAnimationLoop(() => {
      if (this.disposed) return;
      const now = performance.now();
      const delta = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      for (const model of this.models.values()) {
        if (!model.poseEditor?.active) model.mixer?.update(delta);
        model.expressions.apply();
        model.vrm.update(delta);
      }
      this.poseEditor?.tick();
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      if (now - this.notified > 100) {
        this.notified = now;
        this.onState({
          time: this.action?.time ?? 0,
          playing: !!this.action?.isRunning(),
        });
      }
    });
  }
  showPose(visible: boolean) {
    this.poseVisible = visible;
    this.poseEditor?.show(visible);
  }
  editPose(capture = false) {
    if (!this.vrm || this.disposed) return;
    const slot = this.active!;
    if (!this.poseEditor)
      this.poseEditor = new PoseEditor(
        this.vrm,
        this.scene,
        this.camera,
        this.renderer.domElement,
        this.controls,
        () => this.pause(),
        (pose) => {
          slot.poseState = pose;
          if (this.active === slot) this.onState({ pose });
        },
      );
    this.poseEditor.show(this.poseVisible);
    this.poseEditor.start(capture);
  }
  selectPoseBone(bone: import("./pose").PoseBone) {
    this.poseEditor?.select(bone);
  }
  poseAxis(axis: number, value: number, translation = false) {
    this.poseEditor?.setAxis(axis, value, translation);
  }
  commitPose() {
    this.poseEditor?.commit();
  }
  resetPose(all: boolean) {
    this.poseEditor?.reset(all);
  }
  undoPose(direction: -1 | 1) {
    this.poseEditor?.undo(direction);
  }
  exportPose() {
    if (!this.poseEditor) throw new Error("errors:poseExport");
    return this.poseEditor.bytes();
  }
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.onState({ error: "errors:webgl", playing: false });
    this.renderer.setAnimationLoop(null);
  };
  private resize() {
    const width = Math.max(1, this.host.clientWidth),
      height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  async loadModel(path: string) {
    await this.loadModels(
      [
        {
          path,
          name: path.split(/[\\/]/).pop() ?? path,
          kind: "vrm",
          size: 0,
          modified: 0,
        },
      ],
      path,
    );
  }
  async loadModels(entries: AssetEntry[], activePath: string) {
    if (entries.length > MAX_SCENE_MODELS) {
      this.onState({ error: "errors:sceneLimit" });
      return;
    }
    const epoch = ++this.modelEpoch;
    this.modelRequest?.abort();
    this.animationRequest?.abort();
    this.animationEpoch++;
    const request = new AbortController();
    this.modelRequest = request;
    this.requestedActive = activePath;
    const sources = new Map(
      entries.map((e) => [e.path, `${e.size}:${e.modified}`]),
    );
    for (const slot of this.models.values())
      if (sources.get(slot.path) !== slot.fingerprint) this.removeSlot(slot);
    if (!this.models.has(this.activePath)) this.activePath = "";
    if (!entries.length) {
      this.publishActive();
      this.onState({ loading: false });
      return;
    }
    this.onState({ loading: true, error: "" });
    await this.loads
      .run(async () => {
        let error = "";
        for (const entry of entries) {
          if (
            this.disposed ||
            request.signal.aborted ||
            epoch !== this.modelEpoch
          )
            return;
          if (this.models.has(entry.path)) continue;
          try {
            await this.processModel(entry, epoch);
          } catch (e) {
            error =
              e instanceof Error && e.message.startsWith("errors:")
                ? e.message
                : "errors:model";
          }
        }
        if (
          this.disposed ||
          request.signal.aborted ||
          epoch !== this.modelEpoch
        )
          return;
        this.activateModel(
          this.models.has(this.requestedActive)
            ? this.requestedActive
            : (this.models.keys().next().value ?? ""),
        );
        this.arrange();
        this.onState({ loading: false, error });
      }, request.signal)
      .catch((e) => {
        if (!this.disposed && !request.signal.aborted)
          this.onState({
            loading: false,
            error: String(e).startsWith("errors:") ? String(e) : "errors:model",
          });
      });
  }
  private async processModel(entry: AssetEntry, epoch: number) {
    const start = performance.now();
    const data = await readAsset(entry.path),
      readEnd = performance.now();
    if (this.disposed || epoch !== this.modelEpoch) return;
    inspectContainer(data, "vrm");
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await loader.parseAsync(data, ""),
      parsed = performance.now();
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) {
      VRMUtils.deepDispose(gltf.scene);
      throw new Error("errors:model");
    }
    if (this.disposed || epoch !== this.modelEpoch) {
      disposeModel(vrm.scene);
      return;
    }
    let slot: ModelSlot | undefined;
    try {
      VRMUtils.rotateVRM0(vrm);
      vrm.update(0);
      const bounds = new THREE.Box3().setFromObject(vrm.scene),
        size = bounds.getSize(new THREE.Vector3());
      if (
        bounds.isEmpty() ||
        ![...bounds.min.toArray(), ...bounds.max.toArray()].every(
          Number.isFinite,
        )
      )
        throw new Error("errors:model");
      const root = new THREE.Group();
      root.add(vrm.scene);
      // Place avatars on the ground without altering humanoid local transforms.
      vrm.scene.position.y -= bounds.min.y;
      let meshes = 0,
        triangles = 0;
      const materials = new Set<THREE.Material>();
      vrm.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          meshes++;
          triangles +=
            (object.geometry.index?.count ??
              object.geometry.attributes.position?.count ??
              0) / 3;
          for (const m of Array.isArray(object.material)
            ? object.material
            : [object.material])
            materials.add(m);
        }
      });
      const meta = Object.fromEntries(
        Object.entries(vrm.meta).filter(
          ([k, v]) =>
            k !== "thumbnailImage" &&
            (typeof v === "string" ||
              typeof v === "boolean" ||
              Array.isArray(v)),
        ),
      );
      const expressions = new ExpressionControl();
      expressions.attach(vrm.expressionManager);
      slot = {
        path: entry.path,
        name: entry.name,
        fingerprint: `${entry.size}:${entry.modified}`,
        vrm,
        root,
        width: Math.max(size.x, 0.5),
        expressions,
        poseState: { ...emptyPose },
        staticPose: false,
        clipPath: "",
        metadata: {
          ...meta,
          version: vrm.meta.metaVersion,
          meshes,
          materials: materials.size,
          triangles: Math.floor(triangles),
          bones: Object.keys(vrm.humanoid.humanBones).length,
        },
        summary: {
          bytes: data.byteLength,
          readMs: readEnd - start,
          parseMs: parsed - readEnd,
          firstRenderMs: 0,
          totalMs: 0,
          ...textureSummary(vrm.scene),
        },
      };
      this.models.set(entry.path, slot);
      this.scene.add(root);
      this.arrange();
      const renderStart = performance.now();
      this.renderer.render(this.scene, this.camera);
      slot.summary.firstRenderMs = performance.now() - renderStart;
      slot.summary.totalMs = performance.now() - start;
      this.setBones(this.showBones);
    } catch (error) {
      if (slot) this.removeSlot(slot);
      else disposeModel(vrm.scene);
      throw error;
    }
  }
  activateModel(path: string) {
    this.requestedActive = path;
    if (!this.models.has(path)) {
      if (!this.models.size) {
        this.activePath = "";
        this.publishActive();
      }
      return;
    }
    if (this.activePath !== path) {
      this.poseEditor?.show(false);
      this.activePath = path;
      this.poseEditor?.show(this.poseVisible);
    }
    if (!this.action && this.animation && !this.poseEditor?.active) this.bind();
    this.publishActive();
  }
  private publishScene() {
    this.onState({
      sceneModels: [...this.models.values()].map((slot) => ({
        path: slot.path,
        name: slot.name,
        position: slot.root.position.toArray() as [number, number, number],
        yaw: THREE.MathUtils.radToDeg(slot.root.rotation.y),
      })),
    });
  }
  private publishActive() {
    const slot = this.active;
    this.onState({
      activeModelPath: slot?.path ?? "",
      hasModel: !!slot,
      metadata: slot?.metadata ?? {},
      loadSummary: slot?.summary ?? null,
      bones: slot
        ? inspectBones(slot.vrm.humanoid, slot.vrm.meta.metaVersion === "0")
        : [],
      pose: slot?.poseState ?? { ...emptyPose },
      expression: slot?.expressions.mode ?? "animation",
      availableExpressions: slot?.expressions.available ?? [],
      hasClip: !!slot?.action,
      staticPose: slot?.staticPose ?? false,
      clipPath: slot?.clipPath ?? "",
      time: slot?.action?.time ?? 0,
      duration: slot?.action?.getClip().duration ?? 0,
      playing: !!slot?.action?.isRunning(),
      speed: slot?.mixer?.timeScale ?? this.speed,
      loop: slot?.action ? slot.action.loop === THREE.LoopRepeat : this.loop,
    });
    this.publishScene();
  }
  arrange() {
    const slots = [...this.models.values()];
    const total =
      slots.reduce((sum, slot) => sum + slot.width, 0) +
      Math.max(0, slots.length - 1) * 0.35;
    let x = -total / 2;
    for (const slot of slots) {
      slot.root.position.set(x + slot.width / 2, 0, 0);
      slot.root.rotation.y = 0;
      x += slot.width + 0.35;
    }
    this.publishScene();
    this.fit();
  }
  transformModel(axis: number, value: number, yaw = false) {
    if (!this.active || !Number.isFinite(value)) return;
    if (yaw)
      this.active.root.rotation.y = THREE.MathUtils.degToRad(
        THREE.MathUtils.clamp(value, -180, 180),
      );
    else if (axis >= 0 && axis < 3)
      this.active.root.position.setComponent(
        axis,
        THREE.MathUtils.clamp(value, -100, 100),
      );
    this.publishScene();
  }
  private removeSlot(slot: ModelSlot) {
    slot.poseEditor?.dispose();
    slot.mixer?.stopAllAction();
    slot.mixer?.uncacheRoot(slot.vrm.scene);
    if (slot.skeleton) {
      this.scene.remove(slot.skeleton);
      slot.skeleton.dispose();
    }
    this.scene.remove(slot.root);
    disposeModel(slot.root);
    this.models.delete(slot.path);
  }
  async exportPng(edge: number, transparent: boolean, helpers: boolean) {
    if (
      !this.models.size ||
      this.disposed ||
      ![1024, 2048, 4096].includes(edge)
    )
      throw new Error("errors:pngExport");
    const aspect = this.camera.aspect;
    const width = aspect >= 1 ? edge : Math.max(1, Math.round(edge * aspect));
    const height = aspect >= 1 ? Math.max(1, Math.round(edge / aspect)) : edge;
    if (
      width > this.renderer.capabilities.maxTextureSize ||
      height > this.renderer.capabilities.maxTextureSize
    )
      throw new Error("errors:pngExport");
    const target = new THREE.WebGLRenderTarget(width, height, { samples: 4 });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const previousTarget = this.renderer.getRenderTarget(),
      color = this.renderer.getClearColor(new THREE.Color()),
      alpha = this.renderer.getClearAlpha();
    const background = this.scene.background;
    const hidden = [
      this.grid,
      this.axes,
      ...[...this.models.values()].flatMap((s) =>
        s.skeleton ? [s.skeleton] : [],
      ),
    ].map((object) => ({ object, visible: object.visible }));
    const pixels = new Uint8Array(width * height * 4);
    let reading: Promise<unknown>;
    try {
      if (!helpers) {
        hidden.forEach(({ object }) => (object.visible = false));
        this.poseEditor?.show(false);
      }
      if (transparent) {
        this.scene.background = null;
        this.renderer.setClearColor(color, 0);
      }
      this.renderer.setRenderTarget(target);
      this.renderer.render(this.scene, this.camera);
      reading = this.renderer.readRenderTargetPixelsAsync(
        target,
        0,
        0,
        width,
        height,
        pixels,
      );
    } catch (error) {
      target.dispose();
      throw error;
    } finally {
      this.renderer.setRenderTarget(previousTarget);
      this.renderer.setClearColor(color, alpha);
      this.scene.background = background;
      hidden.forEach(({ object, visible }) => (object.visible = visible));
      this.poseEditor?.show(this.poseVisible);
    }
    try {
      await reading;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("errors:pngExport");
      context.putImageData(
        new ImageData(pngPixels(pixels, width, height), width, height),
        0,
        0,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("errors:pngExport"))),
          "image/png",
        ),
      );
      if (blob.size > 32 * 1024 * 1024) throw new Error("errors:tooLarge");
      return new Uint8Array(await blob.arrayBuffer());
    } finally {
      target.dispose();
    }
  }
  async loadAnimation(path: string) {
    const epoch = ++this.animationEpoch;
    this.animationRequest?.abort();
    const request = new AbortController();
    this.animationRequest = request;
    this.clearAction();
    this.animation = undefined;
    this.animationPath = "";
    this.onState({ loading: true, error: "" });
    await this.loads
      .run(() => this.processAnimation(path, epoch), request.signal)
      .catch((e) => {
        if (!this.disposed && !request.signal.aborted)
          this.onState({
            loading: false,
            error:
              e instanceof Error && e.message.startsWith("errors:")
                ? e.message
                : "errors:animation",
          });
      });
  }
  private async processAnimation(path: string, epoch: number) {
    if (this.disposed || epoch !== this.animationEpoch) return;
    this.onState({ loading: true, error: "" });
    try {
      const data = await readAsset(path);
      if (this.disposed || epoch !== this.animationEpoch) return;
      inspectContainer(data, "vrma");
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
      const gltf = await loader.parseAsync(data, "");
      const animation = gltf.userData.vrmAnimations?.[0] as
        VRMAnimation | undefined;
      VRMUtils.deepDispose(gltf.scene);
      if (!animation) throw new Error("errors:animation");
      if (this.disposed || epoch !== this.animationEpoch) return;
      this.animation = animation;
      this.animationPath = path;
      this.bind();
      this.onState({ loading: false });
    } catch (e) {
      if (!this.disposed && epoch === this.animationEpoch)
        this.onState({
          loading: false,
          error:
            e instanceof Error && e.message.startsWith("errors:")
              ? e.message
              : "errors:animation",
        });
    }
  }
  private bind() {
    this.clearAction();
    if (!this.vrm || !this.animation) return;
    try {
      const clip = createVRMAnimationClip(this.animation, this.vrm);
      if (
        !clip.tracks.length ||
        !Number.isFinite(clip.duration) ||
        clip.duration < 0
      )
        throw new Error("errors:binding");
      this.staticPose = clip.duration === 0;
      this.mixer = new THREE.AnimationMixer(this.vrm.scene);
      this.mixer.timeScale = this.speed;
      this.action = this.mixer.clipAction(clip);
      this.action.setLoop(
        this.loop && !this.staticPose ? THREE.LoopRepeat : THREE.LoopOnce,
        this.loop && !this.staticPose ? Infinity : 1,
      );
      this.action.clampWhenFinished = true;
      this.action.play();
      this.action.paused = true;
      if (this.active) this.active.clipPath = this.animationPath;
      this.onState({
        hasClip: true,
        staticPose: this.staticPose,
        clipPath: this.animationPath,
        duration: clip.duration,
        time: 0,
        playing: false,
        error: "",
      });
    } catch {
      this.clearAction();
      this.onState({ error: "errors:binding" });
    }
  }
  play() {
    this.poseEditor?.suspend();
    if (!this.action) return;
    if (this.staticPose) {
      this.action.reset().play();
      this.action.paused = true;
      this.mixer?.update(0);
      this.expressions.apply();
      this.vrm?.update(0);
      this.onState({ playing: false, time: 0 });
      return;
    }
    if (!this.action.isScheduled()) this.action.reset().play();
    this.action.paused = false;
    this.onState({ playing: true });
  }
  pause() {
    if (this.action) this.action.paused = true;
    this.onState({ playing: false });
  }
  stop() {
    this.poseEditor?.suspend();
    this.action?.stop();
    this.vrm?.humanoid.resetNormalizedPose();
    this.vrm?.expressionManager?.resetValues();
    this.expressions.apply();
    this.vrm?.update(0);
    this.onState({ playing: false, time: 0 });
  }
  seek(time: number) {
    this.poseEditor?.suspend();
    if (!this.action || !this.mixer) return;
    const paused = this.action.paused;
    this.action.play();
    this.action.paused = true;
    this.action.time = THREE.MathUtils.clamp(
      time,
      0,
      this.action.getClip().duration,
    );
    this.mixer.update(0);
    this.action.paused = paused;
    this.onState({ time: this.action.time });
  }
  setExpression(mode: ExpressionMode) {
    if (!this.vrm || !this.expressions.select(mode)) return;
    this.vrm.expressionManager?.update();
    this.onState({ expression: mode });
  }
  setSpeed(speed: number) {
    this.speed = speed;
    if (this.mixer) this.mixer.timeScale = speed;
    this.onState({ speed });
  }
  setLoop(loop: boolean) {
    this.loop = loop;
    this.action?.setLoop(
      loop && !this.staticPose ? THREE.LoopRepeat : THREE.LoopOnce,
      loop && !this.staticPose ? Infinity : 1,
    );
    this.onState({ loop });
  }
  fit() {
    if (!this.models.size) return;
    const box = new THREE.Box3();
    for (const slot of this.models.values())
      box.union(new THREE.Box3().setFromObject(slot.root));
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3());
    const distance = Math.max(size.x, size.y, size.z, 0.5) * 2.2;
    this.controls.target.copy(center);
    this.camera.position
      .copy(center)
      .add(new THREE.Vector3(0, size.y * 0.1, distance));
    this.controls.update();
  }
  view(view: "front" | "back" | "left" | "right") {
    const distance = this.camera.position.distanceTo(this.controls.target);
    const direction =
      view === "back"
        ? new THREE.Vector3(0, 0, -1)
        : view === "left"
          ? new THREE.Vector3(-1, 0, 0)
          : view === "right"
            ? new THREE.Vector3(1, 0, 0)
            : new THREE.Vector3(0, 0, 1);
    this.camera.position
      .copy(this.controls.target)
      .addScaledVector(direction, distance);
    this.controls.update();
  }
  options(grid: boolean, axes: boolean, lights: boolean, background: string) {
    this.grid.visible = grid;
    this.axes.visible = axes;
    this.lights.visible = lights;
    this.renderer.setClearColor(background);
  }
  setBones(visible: boolean) {
    this.showBones = visible;
    for (const slot of this.models.values()) {
      if (visible && !slot.skeleton) {
        const root = slot.vrm.humanoid.getRawBoneNode("hips");
        if (root) {
          slot.skeleton = new THREE.SkeletonHelper(root);
          for (const material of Array.isArray(slot.skeleton.material)
            ? slot.skeleton.material
            : [slot.skeleton.material]) {
            material.depthTest = false;
            material.depthWrite = false;
          }
          slot.skeleton.renderOrder = 1000;
          this.scene.add(slot.skeleton);
        }
      }
      if (slot.skeleton) slot.skeleton.visible = visible;
    }
  }
  private clearAction() {
    this.poseEditor?.suspend();
    this.staticPose = false;
    if (this.active) this.active.clipPath = "";
    if (this.mixer && this.vrm) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.vrm.scene);
    }
    this.action = undefined;
    this.mixer = undefined;
    this.vrm?.humanoid.resetNormalizedPose();
    this.vrm?.expressionManager?.resetValues();
    this.onState({
      hasClip: false,
      staticPose: false,
      playing: false,
      time: 0,
      duration: 0,
      clipPath: "",
    });
  }
  private clearModel() {
    for (const slot of this.models.values()) this.removeSlot(slot);
    this.activePath = "";
    this.publishActive();
  }
  dispose() {
    this.disposed = true;
    this.modelEpoch++;
    this.animationEpoch++;
    this.modelRequest?.abort();
    this.animationRequest?.abort();
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.renderer.domElement.removeEventListener(
      "webglcontextlost",
      this.contextLost,
    );
    this.controls.dispose();
    this.clearModel();
    this.onState({ loading: false });
    VRMUtils.deepDispose(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
