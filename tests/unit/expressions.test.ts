import { expect, it } from "vitest";
import * as THREE from "three";
import {
  VRMExpression,
  VRMExpressionManager,
  VRMExpressionMorphTargetBind,
} from "@pixiv/three-vrm";
import {
  ExpressionControl,
  expressionPresets,
} from "../../src/features/vrm-preview/expressions";
it("six expression choices update actual morph weights without stacking and preserve animated lips/blinks", () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0], 3),
  );
  geometry.morphAttributes.position = expressionPresets.map(
    () => new THREE.Float32BufferAttribute([1, 0, 0], 3),
  );
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  const manager = new VRMExpressionManager();
  expressionPresets.forEach((name, index) => {
    const expression = new VRMExpression(name);
    expression.addBind(
      new VRMExpressionMorphTargetBind({
        primitives: [mesh],
        index,
        weight: 1,
      }),
    );
    manager.registerExpression(expression);
  });
  manager.registerExpression(new VRMExpression("aa"));
  manager.registerExpression(new VRMExpression("blink"));
  manager.setValue("aa", 0.4);
  manager.setValue("blink", 0.6);
  const control = new ExpressionControl();
  control.attach(manager);
  expect(control.available).toHaveLength(6);
  for (const [index, name] of expressionPresets.entries()) {
    expect(control.select(name)).toBe(true);
    manager.update();
    expect(mesh.morphTargetInfluences).toEqual(
      expressionPresets.map((_, i) => (i === index ? 1 : 0)),
    );
    expect(manager.getValue("aa")).toBe(0.4);
    expect(manager.getValue("blink")).toBe(0.6);
  }
  control.select("happy");
  manager.setValue("happy", 0.2);
  manager.setValue("sad", 0.8);
  control.apply();
  manager.update();
  expect(mesh.morphTargetInfluences![1]).toBe(1);
  expect(mesh.morphTargetInfluences![3]).toBe(0);
  control.select("animation");
  manager.setValue("sad", 0.8);
  control.apply();
  expect(manager.getValue("sad")).toBe(0.8);
  control.attach();
  expect(control.available).toEqual([]);
  expect(control.mode).toBe("animation");
  geometry.dispose();
  mesh.material.dispose();
});
it("unsupported expressions leave the previous choice unchanged", () => {
  const control = new ExpressionControl();
  const manager = new VRMExpressionManager();
  manager.registerExpression(new VRMExpression("happy"));
  control.attach(manager);
  control.select("happy");
  expect(control.select("surprised")).toBe(false);
  expect(control.mode).toBe("happy");
  expect(manager.getValue("happy")).toBe(1);
});
