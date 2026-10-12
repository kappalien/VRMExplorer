import {
  VRMHumanBoneList,
  VRMRequiredHumanBoneName,
  type VRM,
} from "@pixiv/three-vrm";
export interface BoneInfo {
  bone: string;
  required: boolean;
  node: string | null;
  parent: string | null;
}
export function inspectBones(
  humanoid: VRM["humanoid"],
  legacy: boolean,
): BoneInfo[] {
  const required = new Set<string>(Object.values(VRMRequiredHumanBoneName));
  if (legacy) {
    required.add("chest");
    required.add("neck");
  }
  return VRMHumanBoneList.map((bone) => {
    const node = humanoid.getRawBoneNode(bone);
    return {
      bone,
      required: required.has(bone),
      node: node ? node.name || node.uuid : null,
      parent: node?.parent ? node.parent.name || node.parent.uuid : null,
    };
  });
}
