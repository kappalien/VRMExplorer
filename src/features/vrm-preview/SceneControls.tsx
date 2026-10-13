import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { PreviewEngine } from "./PreviewEngine";
import type { Playback } from "../../stores/preview";
import { usePreview } from "../../stores/preview";
import { desktopAvailable } from "../../core/portable";
import { errorKey } from "../../core/assets";

export function PngExport({
  getEngine,
  disabled,
}: {
  getEngine: () => PreviewEngine | null;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false),
    [saving, setSaving] = useState(false);
  const [edge, setEdge] = useState(2048),
    [transparent, setTransparent] = useState(true),
    [helpers, setHelpers] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  const save = async () => {
    if (saving || !getEngine()) return;
    setSaving(true);
    setMessage("");
    try {
      const bytes = await getEngine()!.exportPng(edge, transparent, helpers);
      const saved = await invoke<boolean>("export_png", {
        bytes: Array.from(bytes),
        title: t("preview:exportPng"),
      });
      setMessage(saved ? "preview:pngSaved" : "preview:pngCancelled");
    } catch (e) {
      setMessage(
        e instanceof Error && e.message.startsWith("errors:")
          ? e.message
          : errorKey(e),
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <button
        disabled={disabled || !desktopAvailable}
        onClick={() => {
          setMessage("");
          setOpen(true);
        }}
      >
        {t("preview:exportPng")}
      </button>
      <dialog
        ref={dialog}
        className="png-dialog"
        aria-labelledby="png-export-title"
        onCancel={(e) => {
          if (saving) e.preventDefault();
          else setOpen(false);
        }}
        onClose={() => setOpen(false)}
      >
        <h2 id="png-export-title">{t("preview:exportPng")}</h2>
        <p>{t("preview:pngHint")}</p>
        <label>
          {t("preview:pngResolution")}
          <select
            disabled={saving}
            value={edge}
            onChange={(e) => setEdge(Number(e.target.value))}
          >
            {[1024, 2048, 4096].map((size) => (
              <option key={size} value={size}>
                {size} px
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            disabled={saving}
            type="checkbox"
            checked={transparent}
            onChange={(e) => setTransparent(e.target.checked)}
          />
          {t("preview:pngTransparent")}
        </label>
        <label>
          <input
            disabled={saving}
            type="checkbox"
            checked={helpers}
            onChange={(e) => setHelpers(e.target.checked)}
          />
          {t("preview:pngHelpers")}
        </label>
        {message && (
          <p role={message.startsWith("errors:") ? "alert" : "status"}>
            {t(message)}
          </p>
        )}
        <div className="preview-controls">
          <button disabled={saving || disabled} onClick={() => void save()}>
            {t(saving ? "preview:pngSaving" : "preview:pngSave")}
          </button>
          <button disabled={saving} onClick={() => setOpen(false)}>
            {t("common:closeSettings")}
          </button>
        </div>
      </dialog>
    </>
  );
}
export function SceneControls({
  getEngine,
  playback,
}: {
  getEngine: () => PreviewEngine | null;
  playback: Playback;
}) {
  const { t, i18n } = useTranslation();
  const { model, activateModel, removeModel } = usePreview();
  const active = playback.sceneModels.find((slot) => slot.path === model?.path);
  const summary = playback.loadSummary;
  const number = (value: number, decimals = 1) =>
    new Intl.NumberFormat(i18n.language, {
      maximumFractionDigits: decimals,
    }).format(value);
  return (
    <>
      {!!playback.sceneModels.length && (
        <details
          className="scene-management"
          open={playback.sceneModels.length > 1 ? true : undefined}
        >
          <summary>
            {t("preview:sceneModels", { count: playback.sceneModels.length })}
          </summary>
          <p>
            <small>{t("preview:sceneHint")}</small>
          </p>
          <div className="preview-controls">
            <label>
              {t("preview:activeModel")}
              <select
                aria-label={t("preview:activeModel")}
                value={active?.path ?? ""}
                disabled={playback.loading}
                onChange={(e) => activateModel(e.target.value)}
              >
                {playback.sceneModels.map((slot) => (
                  <option key={slot.path} value={slot.path}>
                    {slot.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={!active || playback.loading}
              onClick={() => active && removeModel(active.path)}
            >
              {t("preview:removeModel")}
            </button>
            <button
              disabled={playback.loading}
              onClick={() => getEngine()?.arrange()}
            >
              {t("preview:arrange")}
            </button>
          </div>
          {active && (
            <div className="scene-transform">
              {(["X", "Y", "Z"] as const).map((name, axis) => (
                <label key={name}>
                  {t("preview:scenePosition", { axis: name })}
                  <input
                    type="number"
                    min={-100}
                    max={100}
                    step={0.1}
                    disabled={playback.loading}
                    value={Number(active.position[axis].toFixed(3))}
                    onChange={(e) => {
                      if (e.target.value !== "")
                        getEngine()?.transformModel(
                          axis,
                          Number(e.target.value),
                        );
                    }}
                  />
                </label>
              ))}
              <label>
                {t("preview:sceneYaw")}
                <input
                  type="number"
                  min={-180}
                  max={180}
                  step={5}
                  disabled={playback.loading}
                  value={Number(active.yaw.toFixed(1))}
                  onChange={(e) => {
                    if (e.target.value !== "")
                      getEngine()?.transformModel(
                        0,
                        Number(e.target.value),
                        true,
                      );
                  }}
                />
              </label>
            </div>
          )}
        </details>
      )}
      {summary && (
        <details className="load-summary">
          <summary>{t("preview:loadSummary")}</summary>
          <dl className="metadata">
            {(["readMs", "parseMs", "firstRenderMs", "totalMs"] as const).map(
              (name) => (
                <div key={name}>
                  <dt>{t("preview:" + name)}</dt>
                  <dd>{number(summary[name])} ms</dd>
                </div>
              ),
            )}
            <div>
              <dt>{t("preview:readBytes")}</dt>
              <dd>{number(summary.bytes / 1024 / 1024)} MiB</dd>
            </div>
            <div>
              <dt>{t("preview:textureCount")}</dt>
              <dd>{number(summary.textures, 0)}</dd>
            </div>
            <div>
              <dt>{t("preview:maxTexture")}</dt>
              <dd>
                {summary.maxTextureWidth} × {summary.maxTextureHeight} px
              </dd>
            </div>
            <div>
              <dt>{t("preview:estimatedTexture")}</dt>
              <dd>{number(summary.estimatedTextureBytes / 1024 / 1024)} MiB</dd>
            </div>
          </dl>
          <p>
            <small>{t("preview:loadSummaryHint")}</small>
          </p>
        </details>
      )}
    </>
  );
}
