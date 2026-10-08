import type { VRMExpressionManager } from "@pixiv/three-vrm";
export const expressionPresets = [
  "neutral",
  "happy",
  "angry",
  "sad",
  "relaxed",
  "surprised",
] as const;
export type ExpressionPreset = (typeof expressionPresets)[number];
export type ExpressionMode = "animation" | ExpressionPreset;
export class ExpressionControl {
  private manager?: VRMExpressionManager;
  mode: ExpressionMode = "animation";
  attach(manager?: VRMExpressionManager) {
    this.manager = manager;
    this.mode = "animation";
  }
  get available(): ExpressionPreset[] {
    if (!this.manager) return [];
    return expressionPresets.filter(
      (name) => name === "neutral" || !!this.manager?.getExpression(name),
    );
  }
  select(mode: ExpressionMode): boolean {
    if (mode !== "animation" && !this.available.includes(mode)) return false;
    this.mode = mode;
    // Only emotional presets are controlled; animation-driven lips and blinking remain intact.
    for (const name of expressionPresets) this.manager?.setValue(name, 0);
    this.apply();
    return true;
  }
  apply() {
    if (this.mode === "animation") return;
    for (const name of expressionPresets)
      this.manager?.setValue(name, name === this.mode ? 1 : 0);
  }
}
