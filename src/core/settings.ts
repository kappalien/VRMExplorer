export const sizeUnits = [
  "auto",
  "B",
  "KB",
  "MB",
  "GB",
  "KiB",
  "MiB",
  "GiB",
] as const;
export type FileSizeUnit = (typeof sizeUnits)[number];
export type Settings = {
  schemaVersion: 1;
  language: "zh-TW" | "en";
  theme: "light" | "dark" | "system";
  fileSizeUnit: FileSizeUnit;
  navigationWidth: number;
  previewWidth: number;
};
export const defaults: Settings = {
  schemaVersion: 1,
  language: "zh-TW",
  theme: "system",
  fileSizeUnit: "auto",
  navigationWidth: 220,
  previewWidth: 380,
};
export function validateSettings(value: unknown): Settings {
  const v = value as Partial<Settings> | null;
  if (
    !v ||
    v.schemaVersion !== 1 ||
    !["zh-TW", "en"].includes(v.language ?? "") ||
    !["light", "dark", "system"].includes(v.theme ?? "") ||
    !sizeUnits.includes(v.fileSizeUnit ?? "auto") ||
    !Number.isFinite(v.navigationWidth) ||
    !Number.isFinite(v.previewWidth) ||
    v.navigationWidth! < 160 ||
    v.navigationWidth! > 420 ||
    v.previewWidth! < 260 ||
    v.previewWidth! > 600
  )
    throw new Error("errors:invalidSettings");
  return {
    schemaVersion: 1,
    language: v.language!,
    theme: v.theme!,
    fileSizeUnit: v.fileSizeUnit ?? "auto",
    navigationWidth: v.navigationWidth!,
    previewWidth: v.previewWidth!,
  };
}

export function formatFileSize(
  bytes: number,
  unit: FileSizeUnit,
  language: string,
): string {
  const binary = ["B", "KiB", "MiB", "GiB", "TiB"];
  const decimal = ["B", "KB", "MB", "GB"];
  const autoIndex = Math.min(
    4,
    Math.max(0, Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024))),
  );
  const label = unit === "auto" ? binary[autoIndex] : unit;
  const index = binary.indexOf(label);
  const divisor = index >= 0 ? 1024 ** index : 1000 ** decimal.indexOf(label);
  return `${new Intl.NumberFormat(language, { maximumFractionDigits: label === "B" ? 0 : 2 }).format(bytes / divisor)} ${label}`;
}
