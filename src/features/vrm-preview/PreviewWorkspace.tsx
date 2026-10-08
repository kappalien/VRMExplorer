import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PreviewEngine } from "./PreviewEngine";
import { usePreview } from "../../stores/preview";
import { useExplorer } from "../../stores/explorer";
import {
  images,
  pickAsset,
  errorKey,
  type AssetEntry,
} from "../../core/assets";
import { ImagePreview } from "../image-preview/ImagePreview";
import { desktopAvailable } from "../../core/portable";
import { AnimationLibrary } from "../animation-library/AnimationLibrary";
import { invoke } from "@tauri-apps/api/core";
import { expressionPresets } from "./expressions";
export function PreviewWorkspace({
  animationHost,
}: {
  animationHost: HTMLElement | null;
}) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<PreviewEngine | null>(null);
  const { model, animation, playback, setModel, setAnimation, update } =
    usePreview();
  const selected = useExplorer((s) => s.selected);
  const [grid, setGrid] = useState(true);
  const [axes, setAxes] = useState(true);
  const [lights, setLights] = useState(true);
  const [background, setBackground] = useState("#e5eaf2");
  const [engineVersion, setEngineVersion] = useState(0);
  const needsEngine = model !== null || animation !== null;
  useEffect(() => {
    if (!host.current || !needsEngine) return;
    let alive = true;
    let instance: PreviewEngine | undefined;
    void import("./PreviewEngine")
      .then(({ PreviewEngine }) => {
        if (!alive || !host.current) return;
        instance = new PreviewEngine(host.current, update);
        engine.current = instance;
        setEngineVersion((v) => v + 1);
      })
      .catch(() => {
        if (alive) update({ error: "errors:webgl" });
      });
    return () => {
      alive = false;
      engine.current = null;
      instance?.dispose();
    };
  }, [needsEngine, update]);
  useEffect(() => {
    if (selected?.kind === "vrm") setModel(selected);
    else if (selected?.kind === "vrma") setAnimation(selected);
  }, [selected, setModel, setAnimation]);
  useEffect(() => {
    if (model) void engine.current?.loadModel(model.path);
  }, [model, engineVersion]);
  useEffect(() => {
    if (animation) void engine.current?.loadAnimation(animation.path);
  }, [animation, engineVersion]);
  useEffect(() => {
    engine.current?.options(grid, axes, lights, background);
  }, [grid, axes, lights, background, engineVersion]);
  useEffect(() => {
    if (!desktopAvailable || !playback.hasClip || !playback.clipPath) return;
    void invoke("record_motion", {
      path: playback.clipPath,
      duration: playback.duration,
      played: playback.playing,
    }).catch((e) => update({ error: errorKey(e) }));
  }, [
    playback.hasClip,
    playback.clipPath,
    playback.duration,
    playback.playing,
    update,
  ]);
  const pick = async (kind: "vrm" | "vrma") => {
    try {
      const g = await pickAsset(
        kind,
        t(kind === "vrm" ? "preview:openModel" : "animation:choose"),
      );
      if (g) {
        await useExplorer.getState().refreshGrants();
        const entry: AssetEntry = {
          path: g.path,
          name: g.path.split(/[\\/]/).pop() ?? g.path,
          kind,
          size: 0,
          modified: 0,
        };
        if (kind === "vrm") setModel(entry);
        else setAnimation(entry);
      }
    } catch (e) {
      update({ error: errorKey(e) });
    }
  };
  const image = selected && images.includes(selected.kind) ? selected : null;
  return (
    <>
      <h2>{t("preview")}</h2>
      <div className="preview-controls">
        <button disabled={!desktopAvailable} onClick={() => void pick("vrm")}>
          {t("preview:openModel")}
        </button>
        {(["front", "back", "left", "right"] as const).map((v) => (
          <button
            key={v}
            disabled={!playback.hasModel}
            onClick={() => engine.current?.view(v)}
          >
            {t("preview:" + v)}
          </button>
        ))}
        <button
          disabled={!playback.hasModel}
          onClick={() => engine.current?.fit()}
        >
          {t("preview:reset")}
        </button>
      </div>
      <div
        ref={host}
        className="three-surface"
        style={{ display: image ? "none" : "block" }}
        aria-label={t("preview:canvas")}
      />
      {image && <ImagePreview key={image.path} entry={image} />}
      <div className="scene-options">
        {[
          ["grid", grid, setGrid],
          ["axes", axes, setAxes],
          ["lights", lights, setLights],
        ].map(([name, value, setter]) => (
          <label key={String(name)}>
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) =>
                (setter as (v: boolean) => void)(e.target.checked)
              }
            />
            {t("preview:" + name)}
          </label>
        ))}
        <label>
          {t("preview:background")}
          <input
            type="color"
            value={background}
            onChange={(e) => setBackground(e.target.value)}
          />
        </label>
      </div>
      {playback.loading && <p role="status">{t("explorer:loading")}</p>}
      {playback.error && (
        <p role="alert" className="error">
          {t(playback.error)}
        </p>
      )}
      <p>{model?.name ?? t("empty")}</p>
      {Object.keys(playback.metadata).length > 0 && (
        <details>
          <summary>{t("preview:metadata")}</summary>
          <dl className="metadata">
            {Object.entries(playback.metadata).map(([k, v]) => (
              <div key={k}>
                <dt>{t("preview:meta." + k, { defaultValue: k })}</dt>
                <dd>{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {animationHost &&
        createPortal(
          <div className="animation-workspace">
            <h2>{t("animation")}</h2>
            <AnimationLibrary />
            <p>{animation?.name ?? t("animation:empty")}</p>
            {!playback.hasModel && <p>{t("animation:needModel")}</p>}
            <section
              className="expression-controls"
              aria-label={t("animation:expressions")}
            >
              <h3>{t("animation:expressions")}</h3>
              <div className="expression-buttons">
                {(["animation", ...expressionPresets] as const).map((name) => {
                  const supported =
                    name === "animation" ||
                    playback.availableExpressions.includes(name);
                  return (
                    <button
                      key={name}
                      disabled={!playback.hasModel || !supported}
                      aria-pressed={playback.expression === name}
                      title={
                        !supported
                          ? t("animation:expressionUnavailable")
                          : undefined
                      }
                      onClick={() => engine.current?.setExpression(name)}
                    >
                      {t("animation:expression." + name)}
                    </button>
                  );
                })}
              </div>
              {playback.hasModel &&
                playback.availableExpressions.length <
                  expressionPresets.length && (
                  <small>{t("animation:expressionUnavailable")}</small>
                )}
            </section>
            <div className="play-controls">
              <button
                disabled={!playback.hasClip}
                onClick={() =>
                  playback.playing
                    ? engine.current?.pause()
                    : engine.current?.play()
                }
              >
                {t(
                  playback.staticPose
                    ? "animation:applyPose"
                    : playback.playing
                      ? "animation:pause"
                      : "animation:play",
                )}
              </button>
              <button
                disabled={!playback.hasClip}
                onClick={() => engine.current?.stop()}
              >
                {t("animation:stop")}
              </button>
              <button
                disabled={!playback.hasClip}
                onClick={() => {
                  engine.current?.stop();
                  engine.current?.play();
                }}
              >
                {t("animation:replay")}
              </button>
              <label>
                <input
                  type="checkbox"
                  disabled={playback.staticPose}
                  checked={playback.loop}
                  onChange={(e) => engine.current?.setLoop(e.target.checked)}
                />
                {t("animation:loop")}
              </label>
              <select
                disabled={playback.staticPose}
                aria-label={t("animation:speed")}
                value={playback.speed}
                onChange={(e) =>
                  engine.current?.setSpeed(Number(e.target.value))
                }
              >
                {[0.25, 0.5, 1, 1.5, 2].map((v) => (
                  <option key={v} value={v}>
                    {v}×
                  </option>
                ))}
              </select>
            </div>
            <input
              className="timeline"
              type="range"
              min="0"
              max={playback.duration || 1}
              step=".01"
              value={playback.time}
              disabled={!playback.hasClip || playback.staticPose}
              aria-label={t("animation:timeline")}
              onChange={(e) => engine.current?.seek(Number(e.target.value))}
            />
            <small>
              {playback.staticPose
                ? t("animation:staticPose")
                : `${playback.time.toFixed(2)} / ${playback.duration.toFixed(2)} ${t("animation:seconds")}`}
            </small>
          </div>,
          animationHost,
        )}
    </>
  );
}
