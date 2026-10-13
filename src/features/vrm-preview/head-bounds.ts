import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
/** World-space bounds of vertices controlled by the head (including hair descendants). */
export function headBounds(vrm: VRM): THREE.Box3 {
  const head = vrm.humanoid.getRawBoneNode("head");
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  vrm.scene.updateMatrixWorld(true);
  if (head) {
    const headNodes = new Set<THREE.Object3D>();
    head.traverse((node) => headNodes.add(node));
    let vertices = 0;
    vrm.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !node.visible) return;
      const position = node.geometry.getAttribute("position");
      if (!position) return;
      vertices += position.count;
      if (vertices > 2_000_000) throw new Error("errors:tooLarge");
      if (node instanceof THREE.SkinnedMesh) {
        node.skeleton.update();
        const indices = node.geometry.getAttribute("skinIndex"),
          weights = node.geometry.getAttribute("skinWeight");
        if (!indices || !weights) return;
        const selected = new Set(
          node.skeleton.bones.flatMap((bone, index) =>
            headNodes.has(bone) ? [index] : [],
          ),
        );
        for (let i = 0; i < position.count; i++) {
          let influence = 0;
          for (let component = 0; component < 4; component++)
            if (selected.has(indices.getComponent(i, component)))
              influence += weights.getComponent(i, component);
          if (influence >= 0.25)
            bounds.expandByPoint(
              node.getVertexPosition(i, point).applyMatrix4(node.matrixWorld),
            );
        }
      } else if (headNodes.has(node))
        bounds.union(new THREE.Box3().setFromObject(node));
    });
  }
  if (head && !bounds.isEmpty()) {
    // Long hair and accessories can be weighted to the head far below the face.
    // Keep the portrait near the head joint instead of framing the full torso.
    const body = new THREE.Box3().setFromObject(vrm.scene);
    const height = body.getSize(new THREE.Vector3()).y;
    const anchor = head.getWorldPosition(new THREE.Vector3());
    if (Number.isFinite(height) && height > 0) {
      bounds.min.x = Math.max(bounds.min.x, anchor.x - height * 0.16);
      bounds.max.x = Math.min(bounds.max.x, anchor.x + height * 0.16);
      bounds.min.y = Math.max(bounds.min.y, anchor.y - height * 0.04);
      bounds.max.y = Math.min(bounds.max.y, anchor.y + height * 0.32);
    }
  }
  if (bounds.isEmpty()) {
    bounds.setFromObject(vrm.scene);
    const size = bounds.getSize(new THREE.Vector3());
    // Unmapped/non-humanoid models use their upper section instead of a blank image.
    bounds.min.y = bounds.max.y - size.y * 0.35;
  }
  const size = bounds.getSize(new THREE.Vector3());
  if (
    ![...bounds.min.toArray(), ...bounds.max.toArray()].every(
      Number.isFinite,
    ) ||
    Math.max(size.x, size.y, size.z) <= 0
  )
    throw new Error("errors:model");
  return bounds;
}
