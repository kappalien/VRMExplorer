import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { desktopAvailable } from "../../core/portable";
import { errorKey } from "../../core/assets";
import type { PreviewEngine } from "./PreviewEngine";
import { usePreview, type Playback } from "../../stores/preview";
import type { PoseBone } from "./pose";
export function PosePanel({
  getEngine,
  playback,
}: {
  getEngine: () => PreviewEngine | null;
  playback: Playback;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    revision: number;
  } | null>(null);
  const pose = playback.pose,
    disabled = !pose.active || playback.loading;
  const save = async () => {
    const engine = getEngine();
    if (!engine || saving) return;
    setSaving(true);
    setMessage(null);
    let revision = playback.pose.revision;
    try {
      const data = engine.exportPose();
      revision = usePreview.getState().playback.pose.revision;
      const saved = await invoke<boolean>("export_pose", {
        bytes: Array.from(data),
        title: t("pose:export"),
      });
      setMessage({ text: saved ? "pose:saved" : "pose:cancelled", revision });
    } catch (e) {
      setMessage({
        text:
          e instanceof Error && e.message.startsWith("errors:")
            ? e.message
            : errorKey(e),
        revision,
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="pose-panel" aria-label={t("pose:tab")}>
      <p>
        <small>{t("pose:hint")}</small>
      </p>
      {!playback.hasModel && <p>{t("animation:needModel")}</p>}
      <div className="pose-actions">
        <button
          disabled={!playback.hasModel || playback.loading}
          onClick={() => getEngine()?.editPose()}
        >
          {t(pose.active ? "pose:editing" : "pose:start")}
        </button>
        <button
          disabled={!playback.hasModel || playback.loading}
          onClick={() => getEngine()?.editPose(true)}
        >
          {t("pose:capture")}
        </button>
        <button
          disabled={disabled || !pose.undo}
          onClick={() => getEngine()?.undoPose(-1)}
        >
          {t("pose:undo")}
        </button>
        <button
          disabled={disabled || !pose.redo}
          onClick={() => getEngine()?.undoPose(1)}
        >
          {t("pose:redo")}
        </button>
      </div>
      <label>
        {t("pose:bone")}
        <select
          aria-label={t("pose:bone")}
          disabled={disabled}
          value={pose.selected}
          onChange={(e) =>
            getEngine()?.selectPoseBone(e.target.value as PoseBone)
          }
        >
          {(
            [
              "body",
              "leftArm",
              "rightArm",
              "leftLeg",
              "rightLeg",
              "leftFingers",
              "rightFingers",
            ] as const
          ).map((group) => {
            const bones = pose.available.filter((n) =>
              group === "body"
                ? !/^(left|right)/.test(n)
                : group.endsWith("Fingers")
                  ? n.startsWith(group.startsWith("left") ? "left" : "right") &&
                    /Thumb|Index|Middle|Ring|Little/.test(n)
                  : group.endsWith("Arm")
                    ? n.startsWith(
                        group.startsWith("left") ? "left" : "right",
                      ) && /Shoulder|Arm|Hand/.test(n)
                    : n.startsWith(
                        group.startsWith("left") ? "left" : "right",
                      ) && /Leg|Foot|Toes/.test(n),
            );
            return bones.length ? (
              <optgroup key={group} label={t("pose:groups." + group)}>
                {bones.map((n) => (
                  <option key={n} value={n}>
                    {t("pose:bones." + n)}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
      </label>
      <h3>{t("pose:rotation")}</h3>
      {([0, 1, 2] as const).map((axis) => (
        <label className="pose-axis" key={axis}>
          <span>{t("pose:axes." + axis)}</span>
          <input
            aria-label={t("pose:angle", { axis: t("pose:axes." + axis) })}
            type="range"
            min={-180}
            max={180}
            step={0.1}
            value={pose.angles[axis]}
            disabled={disabled}
            onChange={(e) =>
              getEngine()?.poseAxis(axis, Number(e.target.value))
            }
            onPointerUp={() => getEngine()?.commitPose()}
            onKeyUp={() => getEngine()?.commitPose()}
            onBlur={() => getEngine()?.commitPose()}
          />
          <PoseNumber
            label={t("pose:angleNumber", { axis: t("pose:axes." + axis) })}
            min={-180}
            max={180}
            step={0.1}
            value={Number(pose.angles[axis].toFixed(1))}
            disabled={disabled}
            onValue={(value) => getEngine()?.poseAxis(axis, value)}
            onCommit={() => getEngine()?.commitPose()}
          />
        </label>
      ))}
      {pose.selected === "hips" && (
        <>
          <h3>{t("pose:translation")}</h3>
          {([0, 1, 2] as const).map((axis) => (
            <label className="pose-axis" key={axis}>
              <span>{t("pose:axes." + axis)}</span>
              <PoseNumber
                label={t("pose:offset", { axis: t("pose:axes." + axis) })}
                min={-5}
                max={5}
                step={0.01}
                value={Number(pose.offset[axis].toFixed(3))}
                disabled={disabled}
                onValue={(value) => getEngine()?.poseAxis(axis, value, true)}
                onCommit={() => getEngine()?.commitPose()}
              />
            </label>
          ))}
        </>
      )}
      <div className="pose-actions">
        <button
          disabled={disabled}
          onClick={() => getEngine()?.resetPose(false)}
        >
          {t("pose:resetBone")}
        </button>
        <button
          disabled={disabled}
          onClick={() => getEngine()?.resetPose(true)}
        >
          {t("pose:resetAll")}
        </button>
        <button
          disabled={disabled || !desktopAvailable || saving}
          onClick={() => void save()}
        >
          {t(saving ? "pose:saving" : "pose:export")}
        </button>
      </div>
      <p>
        <small>{t("pose:scope")}</small>
      </p>
      {message && message.revision === pose.revision && (
        <p role={message.text.startsWith("errors:") ? "alert" : "status"}>
          {t(message.text)}
        </p>
      )}
    </section>
  );
}

function PoseNumber({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onValue,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onValue: (value: number) => void;
  onCommit: () => void;
}) {
  const [focused, setFocused] = useState(false),
    [draft, setDraft] = useState("");
  return (
    <input
      aria-label={label}
      type="number"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={focused ? draft : value}
      onFocus={() => {
        setDraft(String(value));
        setFocused(true);
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        if (e.target.value !== "" && Number.isFinite(Number(e.target.value)))
          onValue(Number(e.target.value));
      }}
      onBlur={() => {
        setFocused(false);
        onCommit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
