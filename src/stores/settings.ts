import { create } from "zustand";
import { defaults, type Settings } from "../core/settings";
export const useSettings = create<{
  settings: Settings;
  set: (settings: Settings) => void;
}>((set) => ({ settings: defaults, set: (settings) => set({ settings }) }));
