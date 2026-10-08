import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { desktopAvailable } from "../../core/portable";
import { errorKey } from "../../core/assets";
interface CacheInfo {
  limitMib: number;
  usedBytes: number;
  entries: number;
}
export function CacheSettings() {
  const { t, i18n } = useTranslation();
  const [info, setInfo] = useState<CacheInfo>();
  const [limit, setLimit] = useState("256");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!desktopAvailable) return;
    let alive = true;
    void invoke<CacheInfo>("cache_control", { action: "info", limitMib: null })
      .then((value) => {
        if (alive) {
          setInfo(value);
          setLimit(String(value.limitMib));
        }
      })
      .catch((e) => {
        if (alive) setError(errorKey(e));
      });
    return () => {
      alive = false;
    };
  }, [revision]);
  const action = async (action: "clear" | "limit") => {
    setBusy(true);
    setError("");
    try {
      const result = await invoke<CacheInfo>("cache_control", {
        action,
        limitMib: action === "limit" ? Number(limit) : null,
      });
      setInfo(result);
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="cache-settings">
      <summary>{t("settings:cache")}</summary>
      <p>
        {t("settings:cacheUsage", {
          count: info?.entries ?? 0,
          size: new Intl.NumberFormat(i18n.language, {
            maximumFractionDigits: 1,
          }).format((info?.usedBytes ?? 0) / 1048576),
        })}
      </p>
      <label>
        {t("settings:cacheLimit")}
        <input
          type="number"
          min={16}
          max={2048}
          step={1}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
      </label>
      <div className="play-controls">
        <button
          disabled={
            !desktopAvailable ||
            busy ||
            !Number.isInteger(Number(limit)) ||
            Number(limit) < 16 ||
            Number(limit) > 2048
          }
          onClick={() => void action("limit")}
        >
          {t("settings:apply")}
        </button>
        <button
          disabled={!desktopAvailable || busy}
          onClick={() => void action("clear")}
        >
          {t("settings:clearCache")}
        </button>
        <button
          disabled={!desktopAvailable || busy}
          onClick={() => setRevision((v) => v + 1)}
        >
          {t("explorer:refresh")}
        </button>
      </div>
      <small>{t("settings:cacheDescription")}</small>
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
    </details>
  );
}
