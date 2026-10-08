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
export class PreviewEngine {
  private expressions = new ExpressionControl();
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private vrm?: VRM;
  private animation?: VRMAnimation;
  private animationPath = "";
  private mixer?: THREE.AnimationMixer;
  private action?: THREE.AnimationAction;
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
  private staticPose = false;
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
      this.mixer?.update(delta);
      this.expressions.apply();
      this.vrm?.update(delta);
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
    const epoch = ++this.modelEpoch;
    this.modelRequest?.abort();
    const request = new AbortController();
    this.modelRequest = request;
    this.onState({ loading: true, error: "" });
    await this.loads
      .run(() => this.processModel(path, epoch), request.signal)
      .catch((e) => {
        if (!this.disposed && !request.signal.aborted) {
          this.clearModel();
          this.onState({
            loading: false,
            error:
              e instanceof Error && e.message.startsWith("errors:")
                ? e.message
                : "errors:model",
          });
        }
      });
  }
  private async processModel(path: string, epoch: number) {
    if (this.disposed || epoch !== this.modelEpoch) return;
    this.onState({ loading: true, error: "" });
    try {
      const data = await readAsset(path);
      if (this.disposed || epoch !== this.modelEpoch) return;
      inspectContainer(data, "vrm");
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      const gltf = await loader.parseAsync(data, "");
      const vrm = gltf.userData.vrm as VRM | undefined;
      if (!vrm) {
        VRMUtils.deepDispose(gltf.scene);
        throw new Error("errors:model");
      }
      if (this.disposed || epoch !== this.modelEpoch) {
        VRMUtils.deepDispose(vrm.scene);
        return;
      }
      this.clearModel();
      this.vrm = vrm;
      this.expressions.attach(vrm.expressionManager);
      VRMUtils.rotateVRM0(vrm);
      this.scene.add(vrm.scene);
      this.fit();
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
      this.onState({
        hasModel: true,
        expression: "animation",
        availableExpressions: this.expressions.available,
        loading: false,
        metadata: {
          ...meta,
          version: vrm.meta.metaVersion,
          meshes,
          materials: materials.size,
          triangles: Math.floor(triangles),
          bones: Object.keys(vrm.humanoid.humanBones).length,
        },
      });
      this.bind();
    } catch (e) {
      if (!this.disposed && epoch === this.modelEpoch) {
        this.clearModel();
        this.onState({
          loading: false,
          error:
            e instanceof Error && e.message.startsWith("errors:")
              ? e.message
              : "errors:model",
        });
      }
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
    this.action?.stop();
    this.vrm?.humanoid.resetNormalizedPose();
    this.vrm?.expressionManager?.resetValues();
    this.expressions.apply();
    this.vrm?.update(0);
    this.onState({ playing: false, time: 0 });
  }
  seek(time: number) {
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
    if (!this.vrm) return;
    const box = new THREE.Box3().setFromObject(this.vrm.scene);
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
  private clearAction() {
    this.staticPose = false;
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
    this.clearAction();
    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
      this.vrm = undefined;
    }
    this.expressions.attach();
    this.onState({
      hasModel: false,
      metadata: {},
      expression: "animation",
      availableExpressions: [],
    });
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
    VRMUtils.deepDispose(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
