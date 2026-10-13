import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { VRM, VRMPose } from "@pixiv/three-vrm";
import {
  editableBones,
  exportPose,
  poseAngles,
  PoseHistory,
  type PoseBone,
  type PoseState,
} from "./pose";
export class PoseEditor {
  active = false;
  private visible = false;
  private selected: PoseBone = "hips";
  private history = new PoseHistory();
  private draft?: VRMPose;
  private revision = 0;
  private gizmo: TransformControls;
  private handles = new THREE.Group();
  private geometry = new THREE.SphereGeometry(0.012, 10, 8);
  private material = new THREE.MeshBasicMaterial({
    color: 0x4285ff,
    depthTest: false,
  });
  private selectedMaterial = new THREE.MeshBasicMaterial({
    color: 0xffbb22,
    depthTest: false,
  });
  private down?: { x: number; y: number };
  private available: PoseBone[];
  constructor(
    private vrm: VRM,
    private scene: THREE.Object3D,
    private camera: THREE.Camera,
    private canvas: HTMLCanvasElement,
    private orbit: OrbitControls,
    private pause: () => void,
    private notify: (state: PoseState) => void,
  ) {
    this.available = editableBones.filter((n) =>
      vrm.humanoid.getNormalizedBoneNode(n),
    );
    this.selected = this.available.includes("hips")
      ? "hips"
      : this.available[0];
    this.gizmo = new TransformControls(camera, canvas);
    this.gizmo.setMode("rotate");
    this.gizmo.setSpace("local");
    this.gizmo.setSize(0.65);
    scene.add(this.gizmo.getHelper(), this.handles);
    this.gizmo.addEventListener("dragging-changed", (e) => {
      orbit.enabled = !e.value;
    });
    this.gizmo.addEventListener("objectChange", () => {
      this.draft = this.vrm.humanoid.getNormalizedPose();
      this.emit();
    });
    this.gizmo.addEventListener("mouseUp", () => this.commit());
    this.available.forEach((n) => {
      const mesh = new THREE.Mesh(this.geometry, this.material);
      mesh.userData.bone = n;
      mesh.renderOrder = 2000;
      this.handles.add(mesh);
    });
    canvas.addEventListener("pointerdown", this.pointerDown);
    canvas.addEventListener("pointerup", this.pointerUp);
    this.handles.visible = false;
    this.gizmo.enabled = false;
    this.emit();
  }
  private pointerDown = (e: PointerEvent) => {
    if (e.button === 0) this.down = { x: e.clientX, y: e.clientY };
  };
  private pointerUp = (e: PointerEvent) => {
    const down = this.down;
    this.down = undefined;
    if (
      !down ||
      !this.visible ||
      !this.active ||
      this.gizmo.dragging ||
      this.gizmo.axis ||
      Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5
    )
      return;
    const rect = this.canvas.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const hit = ray.intersectObjects(this.handles.children, false)[0];
    if (hit) this.select(hit.object.userData.bone);
  };
  show(visible: boolean) {
    this.visible = visible;
    this.refreshGizmo();
  }
  private refreshGizmo() {
    this.handles.visible = this.visible && this.active;
    const node = this.vrm.humanoid.getNormalizedBoneNode(this.selected);
    if (this.visible && this.active && node) {
      this.gizmo.enabled = true;
      this.gizmo.attach(node);
    } else {
      this.gizmo.detach();
      this.gizmo.enabled = false;
      this.orbit.enabled = true;
    }
  }
  tick() {
    if (!this.handles.visible) return;
    this.handles.children.forEach((mesh) => {
      const bone = mesh.userData.bone as PoseBone;
      this.vrm.humanoid
        .getNormalizedBoneNode(bone)
        ?.getWorldPosition(mesh.position);
      (mesh as THREE.Mesh).material =
        bone === this.selected ? this.selectedMaterial : this.material;
    });
  }
  start(capture = false) {
    this.pause();
    if (capture || !this.draft) {
      this.draft = this.vrm.humanoid.getNormalizedPose();
      this.history.push(this.draft);
    }
    this.active = true;
    this.vrm.humanoid.setNormalizedPose(this.draft);
    this.refreshGizmo();
    this.emit();
  }
  suspend() {
    this.active = false;
    this.refreshGizmo();
    this.emit();
  }
  select(bone: PoseBone) {
    if (!this.available.includes(bone)) return;
    this.selected = bone;
    this.refreshGizmo();
    this.emit();
  }
  setAxis(axis: number, value: number, translation = false) {
    if (!this.active || !Number.isFinite(value) || axis < 0 || axis > 2) return;
    const node = this.vrm.humanoid.getNormalizedBoneNode(this.selected);
    if (!node) return;
    if (translation) {
      if (this.selected !== "hips") return;
      node.position.setComponent(
        axis,
        (this.vrm.humanoid.normalizedRestPose.hips?.position?.[axis] ?? 0) +
          THREE.MathUtils.clamp(value, -5, 5),
      );
    } else {
      const values = poseAngles(
        this.vrm.humanoid.getNormalizedPose(),
        this.selected,
      );
      values[axis] = THREE.MathUtils.clamp(value, -180, 180);
      node.quaternion.setFromEuler(
        new THREE.Euler(
          ...(values.map((v) => (v * Math.PI) / 180) as [
            number,
            number,
            number,
          ]),
          "XYZ",
        ),
      );
    }
    this.draft = this.vrm.humanoid.getNormalizedPose();
    this.emit();
  }
  commit() {
    if (!this.active) return;
    this.draft = this.vrm.humanoid.getNormalizedPose();
    this.history.push(this.draft);
    this.emit();
  }
  reset(all: boolean) {
    if (!this.active) return;
    if (all) this.vrm.humanoid.resetNormalizedPose();
    else {
      const node = this.vrm.humanoid.getNormalizedBoneNode(this.selected),
        rest = this.vrm.humanoid.normalizedRestPose[this.selected];
      if (node && rest) {
        node.quaternion.fromArray(rest.rotation ?? [0, 0, 0, 1]);
        if (this.selected === "hips")
          node.position.fromArray(rest.position ?? [0, 0, 0]);
      }
    }
    this.commit();
  }
  undo(direction: -1 | 1) {
    if (!this.active) return;
    const pose = this.history.move(direction);
    if (pose) {
      this.draft = pose;
      this.vrm.humanoid.setNormalizedPose(pose);
      this.emit();
    }
  }
  bytes() {
    if (!this.active) throw new Error("errors:poseExport");
    this.commit();
    return exportPose(this.vrm, this.vrm.humanoid.getNormalizedPose());
  }
  private emit() {
    const pose = this.draft ?? this.vrm.humanoid.getNormalizedPose();
    this.notify({
      active: this.active,
      selected: this.selected,
      angles: poseAngles(pose, this.selected),
      offset: pose.hips?.position ?? [0, 0, 0],
      available: this.available,
      undo: this.history.canUndo,
      redo: this.history.canRedo,
      revision: ++this.revision,
    });
  }
  dispose() {
    this.canvas.removeEventListener("pointerdown", this.pointerDown);
    this.canvas.removeEventListener("pointerup", this.pointerUp);
    this.gizmo.detach();
    this.scene.remove(this.gizmo.getHelper(), this.handles);
    this.gizmo.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.selectedMaterial.dispose();
    this.orbit.enabled = true;
  }
}
