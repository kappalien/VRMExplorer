import {
  VRMHumanBoneList,
  type VRM,
  type VRMPose,
  type VRMHumanBoneName,
} from "@pixiv/three-vrm";
import { Euler, Quaternion } from "three";
export type PoseBone = VRMHumanBoneName;
export interface PoseState {
  active: boolean;
  selected: PoseBone;
  angles: number[];
  offset: number[];
  available: PoseBone[];
  undo: boolean;
  redo: boolean;
  revision: number;
}
export const emptyPose: PoseState = {
  active: false,
  selected: "hips",
  angles: [0, 0, 0],
  offset: [0, 0, 0],
  available: [],
  undo: false,
  redo: false,
  revision: 0,
};
export const editableBones = VRMHumanBoneList.filter(
  (n) => n !== "leftEye" && n !== "rightEye",
);
export function poseAngles(pose: VRMPose, bone: PoseBone): number[] {
  const e = new Euler().setFromQuaternion(
    new Quaternion().fromArray(pose[bone]?.rotation ?? [0, 0, 0, 1]),
    "XYZ",
  );
  return [e.x, e.y, e.z].map((v) => (v * 180) / Math.PI);
}
export class PoseHistory {
  private entries: VRMPose[] = [];
  private cursor = -1;
  push(pose: VRMPose) {
    const copy = structuredClone(pose);
    if (JSON.stringify(this.entries[this.cursor]) === JSON.stringify(copy))
      return;
    this.entries = this.entries.slice(0, this.cursor + 1);
    this.entries.push(copy);
    if (this.entries.length > 80) this.entries.shift();
    this.cursor = this.entries.length - 1;
  }
  get canUndo() {
    return this.cursor > 0;
  }
  get canRedo() {
    return this.cursor < this.entries.length - 1;
  }
  move(direction: -1 | 1): VRMPose | undefined {
    if (direction === -1 ? !this.canUndo : !this.canRedo) return;
    this.cursor += direction;
    return structuredClone(this.entries[this.cursor]);
  }
}
// Normalized three-vrm rigs have identity rest rotations. Store only humanoid
// rest nodes and one sample at t=0: no original mesh, texture or expression data.
export function exportPose(vrm: VRM, pose: VRMPose): Uint8Array {
  const human = vrm.humanoid;
  const names = editableBones.filter((n) => human.getNormalizedBoneNode(n));
  if (!names.includes("hips")) throw new Error("errors:poseExport");
  const legacy = vrm.meta.metaVersion === "0";
  const convert = (v: number[]) =>
    v.map((n, i) => (legacy && (i === 0 || i === 2) ? -n : n));
  const nodes = names.map((name) => ({
    name,
    translation: convert(human.normalizedRestPose[name]?.position ?? [0, 0, 0]),
    children: [] as number[],
  }));
  if (!nodes.every((node) => node.translation.every(Number.isFinite)))
    throw new Error("errors:poseExport");
  const roots: number[] = [];
  names.forEach((name, i) => {
    const parent = human.getNormalizedBoneNode(name)?.parent;
    const parentIndex = names.findIndex(
      (n) => human.getNormalizedBoneNode(n) === parent,
    );
    if (parentIndex >= 0) nodes[parentIndex].children.push(i);
    else roots.push(i);
    const rest = human.normalizedRestPose[name]?.rotation ?? [0, 0, 0, 1];
    if (Math.abs(rest[0]) + Math.abs(rest[1]) + Math.abs(rest[2]) > 1e-6)
      throw new Error("errors:poseExport");
  });
  const hips = names.indexOf("hips");
  if (nodes[hips].translation[1] < 0.001) throw new Error("errors:poseExport");
  const values: number[] = [0];
  const bufferViews: {
    buffer: number;
    byteOffset: number;
    byteLength: number;
  }[] = [{ buffer: 0, byteOffset: 0, byteLength: 4 }];
  const accessors: object[] = [
    {
      bufferView: 0,
      componentType: 5126,
      count: 1,
      type: "SCALAR",
      min: [0],
      max: [0],
    },
  ];
  const channels: object[] = [],
    samplers: object[] = [];
  const add = (index: number, path: string, data: number[]) => {
    if (!data.every(Number.isFinite)) throw new Error("errors:poseExport");
    const view = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset: values.length * 4,
      byteLength: data.length * 4,
    });
    values.push(...data);
    accessors.push({
      bufferView: view,
      componentType: 5126,
      count: 1,
      type: data.length === 4 ? "VEC4" : "VEC3",
    });
    channels.push({ sampler: samplers.length, target: { node: index, path } });
    samplers.push({
      input: 0,
      output: accessors.length - 1,
      interpolation: "LINEAR",
    });
  };
  names.forEach((name, i) =>
    add(
      i,
      "rotation",
      convert(
        new Quaternion()
          .fromArray(pose[name]?.rotation ?? [0, 0, 0, 1])
          .normalize()
          .toArray(),
      ),
    ),
  );
  add(
    hips,
    "translation",
    convert(
      (human.normalizedRestPose.hips?.position ?? [0, 0, 0]).map(
        (v, i) => v + (pose.hips?.position?.[i] ?? 0),
      ),
    ),
  );
  const bin = new Float32Array(values);
  const json = {
    asset: { version: "2.0", generator: "VRM Explorer 1.3.0" },
    scene: 0,
    scenes: [{ nodes: roots }],
    nodes: nodes.map((node) =>
      node.children.length
        ? node
        : { name: node.name, translation: node.translation },
    ),
    extensionsUsed: ["VRMC_vrm_animation"],
    extensions: {
      VRMC_vrm_animation: {
        specVersion: "1.0",
        humanoid: {
          humanBones: Object.fromEntries(names.map((n, i) => [n, { node: i }])),
        },
      },
    },
    buffers: [{ byteLength: bin.byteLength }],
    bufferViews,
    accessors,
    animations: [{ name: "Pose", channels, samplers }],
  };
  const raw = new TextEncoder().encode(JSON.stringify(json)),
    length = Math.ceil(raw.length / 4) * 4;
  const result = new Uint8Array(12 + 8 + length + 8 + bin.byteLength),
    view = new DataView(result.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, result.length, true);
  view.setUint32(12, length, true);
  view.setUint32(16, 0x4e4f534a, true);
  result.fill(32, 20, 20 + length);
  result.set(raw, 20);
  view.setUint32(20 + length, bin.byteLength, true);
  view.setUint32(24 + length, 0x004e4942, true);
  values.forEach((v, i) => view.setFloat32(28 + length + i * 4, v, true));
  return result;
}
