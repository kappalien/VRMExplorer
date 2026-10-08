import { create } from "zustand";
import type { AssetEntry } from "../core/assets";
import type {
  ExpressionMode,
  ExpressionPreset,
} from "../features/vrm-preview/expressions";
export interface Playback {
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
  animation: AssetEntry | null;
  playback: Playback;
  setModel: (entry: AssetEntry) => void;
  setAnimation: (entry: AssetEntry) => void;
  update: (patch: Partial<Playback>) => void;
}>((set) => ({
  model: null,
  animation: null,
  playback: initialPlayback,
  setModel: (model) => set({ model }),
  setAnimation: (animation) => set({ animation }),
  update: (patch) => set((s) => ({ playback: { ...s.playback, ...patch } })),
}));
