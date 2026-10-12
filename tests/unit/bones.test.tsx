import { it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  VRMHumanoid,
  VRMRequiredHumanBoneName,
  type VRMHumanBones,
} from "@pixiv/three-vrm";
import * as THREE from "three";
import "../../src/locales/i18n";
import { inspectBones } from "../../src/features/vrm-preview/bones";
import { BonePanel } from "../../src/features/vrm-preview/BonePanel";
it("reads original nodes and applies version-specific chest and neck requirements", () => {
  const nodes = Object.fromEntries(
    Object.values(VRMRequiredHumanBoneName).map((name) => {
      const node = new THREE.Bone();
      node.name = `raw_${name}`;
      return [name, { node }];
    }),
  ) as unknown as VRMHumanBones;
  const humanoid = new VRMHumanoid(nodes);
  const current = inspectBones(humanoid, false);
  expect(current.filter((b) => b.required && b.node === null)).toEqual([]);
  expect(current.find((b) => b.bone === "hips")?.node).toBe("raw_hips");
  const legacy = inspectBones(humanoid, true);
  expect(
    legacy.filter((b) => b.required && b.node === null).map((b) => b.bone),
  ).toEqual(["chest", "neck"]);
  render(<BonePanel bones={legacy} hasModel />);
  expect(screen.getByRole("status").textContent).toContain("2");
  expect(screen.getByRole("table")).toBeTruthy();
  cleanup();
  render(<BonePanel bones={[]} hasModel={false} />);
  expect(screen.queryByRole("table")).toBeNull();
  cleanup();
});
