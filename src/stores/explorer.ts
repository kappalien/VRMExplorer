import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import {
  errorKey,
  type AssetEntry,
  type ExplorerPrefs,
  type Grant,
} from "../core/assets";
interface ExplorerState {
  path: string;
  entries: AssetEntry[];
  history: string[];
  index: number;
  selected: AssetEntry | null;
  grants: Grant[];
  drives: string[];
  busy: boolean;
  error: string;
  prefs: ExplorerPrefs;
  init: () => Promise<void>;
  navigate: (path: string, historyIndex?: number) => Promise<void>;
  refreshGrants: () => Promise<void>;
  select: (entry: AssetEntry | null) => void;
  updatePrefs: (patch: Partial<ExplorerPrefs>) => Promise<void>;
}
let request = 0;
export const useExplorer = create<ExplorerState>((set, get) => ({
  path: "",
  entries: [],
  history: [],
  index: -1,
  selected: null,
  grants: [],
  drives: [],
  busy: false,
  error: "",
  prefs: { schemaVersion: 1, favorites: [], recent: [], view: "details" },
  init: async () => {
    try {
      const [prefs, drives] = await Promise.all([
        invoke<ExplorerPrefs>("load_explorer"),
        invoke<string[]>("list_drives"),
      ]);
      set({
        prefs,
        drives,
        ...(get().index < 0 ? { history: [""], index: 0 } : {}),
      });
      await get().refreshGrants();
      if (get().path === "" && (prefs.lastPath ?? prefs.recent[0]))
        await get().navigate(prefs.lastPath ?? prefs.recent[0]);
    } catch (e) {
      set({ error: errorKey(e) });
    }
  },
  refreshGrants: async () =>
    set({ grants: await invoke<Grant[]>("list_grants") }),
  select: (selected) => set({ selected }),
  navigate: async (path, historyIndex) => {
    const current = ++request;
    set({ busy: true, error: "" });
    try {
      await invoke("cancel_thumbnails");
      const entries = path
        ? await invoke<AssetEntry[]>("browse_directory", { path })
        : [];
      if (current !== request) return;
      const state = get();
      const history =
        historyIndex === undefined
          ? [...state.history.slice(0, state.index + 1), path]
          : state.history;
      set({
        path,
        entries,
        history,
        index: historyIndex ?? history.length - 1,
        busy: false,
        selected: null,
      });
      await get().updatePrefs({
        lastPath: path || state.prefs.lastPath || "",
        recent: path
          ? [path, ...state.prefs.recent.filter((p) => p !== path)].slice(0, 30)
          : state.prefs.recent,
      });
    } catch (e) {
      if (current === request) set({ busy: false, error: errorKey(e) });
    }
  },
  updatePrefs: async (patch) => {
    const prefs = { ...get().prefs, ...patch };
    set({ prefs });
    try {
      await invoke("save_explorer", { prefs });
    } catch (e) {
      set({ error: errorKey(e) });
    }
  },
}));
