import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { desktopAvailable } from "../../core/portable";
import { usePreview } from "../../stores/preview";
interface Snapshot {
  phase: string;
  version: string;
  notesZh: string;
  notesEn: string;
  downloaded: number;
  total: number;
  runtimeExtra: boolean;
  error: string;
  result: string;
  supported: boolean;
  automatic: boolean;
}
const empty: Snapshot = {
  phase: "idle",
  version: "",
  notesZh: "",
  notesEn: "",
  downloaded: 0,
  total: 0,
  runtimeExtra: false,
  error: "",
  result: "",
  supported: false,
  automatic: false,
};
export function UpdateSettings() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState(empty),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const alive = useRef(true);
  const hasDraft = usePreview((s) => s.playback.pose.available.length > 0);
  useEffect(() => {
    alive.current = true;
    if (desktopAvailable)
      void invoke<Snapshot>("update_snapshot")
        .then((s) => {
          if (alive.current) setState(s);
        })
        .catch((e) => {
          if (alive.current) setError(String(e));
        });
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!busy) return;
    let pending = false;
    const timer = setInterval(() => {
      if (pending) return;
      pending = true;
      void invoke<Snapshot>("update_snapshot")
        .then((s) => {
          if (alive.current) setState(s);
        })
        .finally(() => {
          pending = false;
        })
        .catch(() => {});
    }, 500);
    return () => clearInterval(timer);
  }, [busy]);
  const action = async (install: boolean) => {
    setConfirm(false);
    setBusy(true);
    setError("");
    try {
      let next = await invoke<Snapshot>("check_update");
      if (alive.current) setState(next);
      if (install && next.phase === "available") {
        next = await invoke<Snapshot>("prepare_update");
        if (alive.current) setState(next);
        await invoke("install_update");
      }
    } catch (e) {
      if (alive.current) setError(String(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const working =
    busy || ["checking", "downloading", "handoff"].includes(state.phase);
  const message = error || state.error;
  return (
    <section className="update-settings" aria-label={t("updates:title")}>
      <h3>{t("updates:title")}</h3>
      <p>
        <small>{t("updates:hint")}</small>
      </p>
      {!state.supported && <p>{t("updates:notPortable")}</p>}
      <label>
        <input
          type="checkbox"
          checked={state.automatic}
          disabled={working || !state.supported}
          onChange={(e) => {
            const automatic = e.target.checked;
            void invoke<Snapshot>("update_preferences", { automatic })
              .then(setState)
              .catch((e) => setError(String(e)));
          }}
        />
        {t("updates:automatic")}
      </label>
      <div className="pose-actions">
        <button
          disabled={!desktopAvailable || !state.supported || working}
          onClick={() => void action(false)}
        >
          {t("updates:check")}
        </button>
        <button
          disabled={!desktopAvailable || !state.supported || working}
          onClick={() => (hasDraft ? setConfirm(true) : void action(true))}
        >
          {t("updates:oneClick")}
        </button>
        {working && state.phase !== "handoff" && (
          <button
            onClick={() =>
              void invoke("cancel_update").catch((e) => setError(String(e)))
            }
          >
            {t("updates:cancel")}
          </button>
        )}
      </div>
      {confirm && (
        <div role="alertdialog" aria-label={t("updates:draftTitle")}>
          <p>{t("updates:draftWarning")}</p>
          <button onClick={() => setConfirm(false)}>
            {t("updates:keepDraft")}
          </button>
          <button onClick={() => void action(true)}>
            {t("updates:discardDraft")}
          </button>
        </div>
      )}
      <p role="status">
        {t("updates:phases." + state.phase)}
        {state.version && ` ${state.version}`}
      </p>
      {state.phase === "downloading" && (
        <>
          <progress
            aria-label={t("updates:progress")}
            value={state.downloaded}
            max={state.total || 1}
          />
          <p>
            {(state.downloaded / 1048576).toFixed(1)} /{" "}
            {(state.total / 1048576).toFixed(1)} {t("updates:mib")}
          </p>
        </>
      )}
      {state.runtimeExtra && <p>{t("updates:runtimeExtra")}</p>}
      {(state.notesZh || state.notesEn) && (
        <details>
          <summary>{t("updates:notes")}</summary>
          <p className="update-notes">
            {i18n.language === "zh-TW" ? state.notesZh : state.notesEn}
          </p>
        </details>
      )}
      {state.result && <p>{t("updates:results." + state.result)}</p>}
      {message && (
        <p
          role={message === "updates:cancelled" ? "status" : "alert"}
          className="error"
        >
          {t(message, { defaultValue: t("updates:failed") })}
        </p>
      )}
    </section>
  );
}
