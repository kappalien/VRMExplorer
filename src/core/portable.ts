import { invoke, isTauri } from "@tauri-apps/api/core";
import { validateSettings, type Settings } from "./settings";
export type PortableInfo = { root: string; writable: boolean; runtime: string };
export const desktopAvailable = isTauri();
export async function loadPortable(): Promise<{
  info: PortableInfo;
  settings: Settings;
}> {
  if (!desktopAvailable) throw new Error("errors:desktopRequired");
  const result = await invoke<{ info: PortableInfo; settings: unknown }>(
    "load_settings",
  );
  return { ...result, settings: validateSettings(result.settings) };
}
export async function saveSettings(settings: Settings): Promise<void> {
  await invoke("save_settings", { settings: validateSettings(settings) });
}
