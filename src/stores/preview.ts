import { MAX_SCENE_MODELS } from "../core/scene-limits";
import type { LoadSummary, SceneModel } from "../features/vrm-preview/scene";
import type { PoseState } from "../features/vrm-preview/pose";
import type { BoneInfo } from "../features/vrm-preview/bones";
import { create } from "zustand";
import type { AssetEntry } from "../core/assets";
import type {
  ExpressionMode,
  ExpressionPreset,
} from "../features/vrm-preview/expressions";
export interface Playback {
  activeModelPath: string;
  sceneModels: SceneModel[];
  loadSummary: LoadSummary | null;
  pose: PoseState;
  bones: BoneInfo[];
  expression: ExpressionMode;
  availableExpressions: ExpressionPreset[];
  hasModel: boolean;
  hasClip: boolean;
  staticPose: boolean;
  playing: boolean;
  time: number;
  duration: number;
  speed: number;
  loop: boolean;
  error: string;
  loading: boolean;
  metadata: Record<string, unknown>;
  clipPath: string;
}
export const initialPlayback: Playback = {
  activeModelPath: "",
  sceneModels: [],
  loadSummary: null,
  pose: {
    active: false,
    selected: "hips",
    angles: [0, 0, 0],
    offset: [0, 0, 0],
    available: [],
    undo: false,
    redo: false,
    revision: 0,
  },
  bones: [],
  expression: "animation",
  availableExpressions: [],
  hasModel: false,
  hasClip: false,
  staticPose: false,
  playing: false,
  time: 0,
  duration: 0,
  speed: 1,
  loop: true,
  error: "",
  loading: false,
  metadata: {},
  clipPath: "",
};
export const usePreview = create<{
  model: AssetEntry | null;
  models: AssetEntry[];
  animation: AssetEntry | null;
  playback: Playback;
  setModel: (entry: AssetEntry) => void;
  setModels: (entries: AssetEntry[]) => void;
  activateModel: (path: string) => void;
  removeModel: (path: string) => void;
  setAnimation: (entry: AssetEntry) => void;
  update: (patch: Partial<Playback>) => void;
}>((set) => ({
  model: null,
  models: [],
  animation: null,
  playback: initialPlayback,
  setModel: (model) =>
    set((s) => ({
      model,
      models: s.models.some((m) => m.path === model.path)
        ? s.models.some(
            (m) =>
              m.path === model.path &&
              (m.size !== model.size || m.modified !== model.modified),
          )
          ? s.models.map((m) => (m.path === model.path ? model : m))
          : s.models
        : [model],
    })),
  setModels: (entries) =>
    set((s) => {
      const models = [
        ...new Map(
          entries.filter((e) => e.kind === "vrm").map((e) => [e.path, e]),
        ).values(),
      ];
      if (models.length > MAX_SCENE_MODELS)
        return { playback: { ...s.playback, error: "errors:sceneLimit" } };
      return {
        models,
        model:
          models.find((m) => m.path === s.model?.path) ?? models[0] ?? null,
      };
    }),
  activateModel: (path) =>
    set((s) => ({ model: s.models.find((m) => m.path === path) ?? s.model })),
  removeModel: (path) =>
    set((s) => {
      const models = s.models.filter((m) => m.path !== path);
      return {
        models,
        model: s.model?.path === path ? (models[0] ?? null) : s.model,
      };
    }),
  setAnimation: (animation) => set({ animation }),
  update: (patch) =>
    set((s) => ({
      playback: { ...s.playback, ...patch },
      ...(patch.activeModelPath !== undefined
        ? {
            model:
              s.models.find((entry) => entry.path === patch.activeModelPath) ??
              null,
          }
        : {}),
    })),
}));
