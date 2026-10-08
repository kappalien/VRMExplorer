import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { usePreview } from "../../stores/preview";
import { useExplorer } from "../../stores/explorer";
import { errorKey, type ExplorerPrefs } from "../../core/assets";
import { desktopAvailable } from "../../core/portable";
import { VirtualList } from "../../components/VirtualList";
interface Source {
  id: number;
  displayName: string;
  path: string;
  pathKind: string;
  recursive: boolean;
  enabled: boolean;
  lastScanAt: number | null;
  scanStatus: string;
}
interface Motion {
  id: number;
  sourceId: number;
  path: string;
  fileName: string;
  fileSize: number;
  modifiedTime: number;
  favorite: boolean;
  lastUsedAt: number | null;
  missing: boolean;
  duration: number | null;
}
interface Snapshot {
  sources: Source[];
  motions: Motion[];
  running: boolean;
  progress: number;
  status: string;
}
export function AnimationLibrary() {
  const { t, i18n } = useTranslation();
  const selectedPath = usePreview((s) => s.animation?.path);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [busy, setBusy] = useState(desktopAvailable);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    sources: [],
    motions: [],
    running: false,
    progress: 0,
    status: "idle",
  });
  const [error, setError] = useState("");
  useEffect(() => {
    if (!desktopAvailable) return;
    let alive = true;
    let pending = false;
    const poll = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await invoke<Snapshot>("library_snapshot", {
          query: "",
        });
        if (alive) setSnapshot(result);
      } catch (e) {
        if (alive) setError(errorKey(e));
      } finally {
        pending = false;
      }
    };
    const pollAfterRestore = async () => {
      const result = await invoke<Snapshot>("library_snapshot", { query: "" });
      if (alive) setSnapshot(result);
    };
    pending = true;
    void (async () => {
      try {
        const [prefs, initial] = await Promise.all([
          invoke<ExplorerPrefs>("load_explorer"),
          invoke<Snapshot>("library_snapshot", { query: "" }),
        ]);
        if (!alive) return;
        setSnapshot(initial);
        const source = initial.sources.find((s) => s.id === prefs.lastSourceId);
        if (source) {
          await invoke("browse_directory", { path: source.path });
          if (!alive) return;
          if (!source.enabled)
            await invoke("library_action", { id: source.id, action: "toggle" });
          setSourceId(source.id);
          await useExplorer.getState().refreshGrants();
          if (!initial.running) await invoke("start_scan", { id: source.id });
          await pollAfterRestore();
        }
      } catch (e) {
        if (alive) setError(errorKey(e));
      } finally {
        pending = false;
        if (alive) setBusy(false);
      }
    })();
    const interval = setInterval(() => void poll(), 1500);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);
  const scan = async (id: number) => {
    setSourceId(id);
    await invoke("start_scan", { id });
    await useExplorer.getState().updatePrefs({ lastSourceId: id });
    setSnapshot(await invoke<Snapshot>("library_snapshot", { query: "" }));
  };
  const choose = async (existing?: Source) => {
    setBusy(true);
    setError("");
    try {
      let id: number | null;
      if (existing) {
        await invoke("browse_directory", { path: existing.path });
        if (!existing.enabled)
          await invoke("library_action", { id: existing.id, action: "toggle" });
        id = existing.id;
      } else {
        id = await invoke<number | null>("choose_source", {
          id: null,
          title: t("library:choose"),
        });
      }
      if (id !== null) {
        await useExplorer.getState().refreshGrants();
        await scan(id);
      }
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setBusy(false);
    }
  };
  const motions = snapshot.motions
    .filter((m) => m.sourceId === sourceId && !m.missing)
    .sort((a, b) =>
      a.fileName.localeCompare(b.fileName, i18n.language, { numeric: true }),
    );
  return (
    <section className="library">
      <div className="library-source-controls">
        <select
          aria-label={t("library:choose")}
          value={sourceId ?? ""}
          disabled={!desktopAvailable || busy || snapshot.running}
          onChange={(e) => {
            const source = snapshot.sources.find(
              (s) => s.id === Number(e.target.value),
            );
            if (source) void choose(source);
          }}
        >
          <option value="" disabled>
            {t("library:addSource")}
          </option>
          {snapshot.sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </select>
        <button
          disabled={!desktopAvailable || busy || snapshot.running}
          onClick={() => void choose()}
        >
          {t("library:addSource")}
        </button>
      </div>
      {snapshot.running && (
        <div role="status">
          {t("library:progress", { count: snapshot.progress })}
          <button
            onClick={() =>
              void invoke("cancel_scan").catch((e) => setError(errorKey(e)))
            }
          >
            {t("library:cancel")}
          </button>
        </div>
      )}
      {snapshot.status.startsWith("errors:") && (
        <p className="error">{t(snapshot.status)}</p>
      )}
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      <VirtualList
        key={sourceId}
        items={motions}
        itemKey={(m) => m.id}
        rowHeight={36}
        className="motion-list"
        label={t("library:title")}
        render={(m) => (
          <button
            className={`motion-row ${selectedPath === m.path ? "selected" : ""}`}
            aria-pressed={selectedPath === m.path}
            title={m.path}
            onClick={() =>
              usePreview.getState().setAnimation({
                path: m.path,
                name: m.fileName,
                kind: "vrma",
                size: m.fileSize,
                modified: m.modifiedTime,
              })
            }
          >
            {m.fileName}
          </button>
        )}
      />
    </section>
  );
}
