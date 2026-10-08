import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Folder,
  FileImage,
  File,
  RefreshCw,
  List,
  LayoutGrid,
} from "lucide-react";
import { useExplorer } from "../../stores/explorer";
import {
  parentPath,
  filterEntries,
  images,
  thumbnailUrl,
  errorKey,
  type AssetEntry,
} from "../../core/assets";
import { desktopAvailable } from "../../core/portable";
import { useSettings } from "../../stores/settings";
import { formatFileSize } from "../../core/settings";
import { VirtualList } from "../../components/VirtualList";
export function ExplorerToolbar() {
  const { t } = useTranslation();
  const s = useExplorer();
  useEffect(() => {
    if (desktopAvailable) void useExplorer.getState().init();
  }, []);
  return (
    <div className="toolbar">
      <button
        title={t("explorer:back")}
        disabled={s.busy || s.index <= 0}
        onClick={() => void s.navigate(s.history[s.index - 1], s.index - 1)}
      >
        <ArrowLeft size={16} />
      </button>
      <button
        title={t("explorer:forward")}
        disabled={s.busy || s.index >= s.history.length - 1}
        onClick={() => void s.navigate(s.history[s.index + 1], s.index + 1)}
      >
        <ArrowRight size={16} />
      </button>
      <button
        title={t("explorer:up")}
        disabled={!s.path || s.busy}
        onClick={() =>
          void s.navigate(
            parentPath(s.path) === s.path ? "" : parentPath(s.path),
          )
        }
      >
        <ArrowUp size={16} />
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void s.navigate(
            String(new FormData(e.currentTarget).get("path") ?? s.path),
          );
        }}
      >
        <input
          aria-label={t("explorer:path")}
          placeholder={s.path || t("explorer:path")}
          key={s.path}
          name="path"
          defaultValue={s.path}
        />
      </form>
      <select
        aria-label={t("explorer:drives")}
        value={
          s.drives.find((d) =>
            s.path.toLowerCase().startsWith(d.toLowerCase()),
          ) ?? ""
        }
        disabled={!desktopAvailable || s.busy}
        onChange={(e) => {
          void s.navigate(e.target.value);
        }}
      >
        <option value="">{t("explorer:computer")}</option>
        {s.drives.map((d) => (
          <option value={d} key={d}>
            {d}
          </option>
        ))}
      </select>
      <button
        disabled={!s.path || s.busy}
        title={t("explorer:refresh")}
        onClick={() => void s.navigate(s.path, s.index)}
      >
        <RefreshCw size={16} />
      </button>
      <button
        className="view-toggle"
        disabled={s.busy || !desktopAvailable}
        aria-label={t(
          s.prefs.view === "thumbnails"
            ? "explorer:compactView"
            : "explorer:thumbnailView",
        )}
        title={t(
          s.prefs.view === "thumbnails"
            ? "explorer:compactView"
            : "explorer:thumbnailView",
        )}
        aria-pressed={s.prefs.view === "thumbnails"}
        onClick={() =>
          void s.updatePrefs({
            view: s.prefs.view === "thumbnails" ? "list" : "thumbnails",
          })
        }
      >
        {s.prefs.view === "thumbnails" ? (
          <List size={16} />
        ) : (
          <LayoutGrid size={16} />
        )}
      </button>
    </div>
  );
}
function Thumbnail({ entry }: { entry: AssetEntry }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!images.includes(entry.kind) && entry.kind !== "vrm") return;
    const controller = new AbortController();
    let alive = true;
    let objectUrl = "";
    void thumbnailUrl(entry.path, controller.signal)
      .then((u) => {
        objectUrl = u;
        if (alive) setUrl(u);
        else URL.revokeObjectURL(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entry.path, entry.kind, entry.size, entry.modified]);
  return url ? (
    <img src={url} alt="" />
  ) : entry.kind === "folder" ? (
    <Folder />
  ) : images.includes(entry.kind) ? (
    <FileImage />
  ) : (
    <File />
  );
}
export function ExplorerFiles() {
  const { t, i18n } = useTranslation();
  const fileSizeUnit = useSettings((s) => s.settings.fileSizeUnit);
  const s = useExplorer();
  const [menu, setMenu] = useState<AssetEntry | null>(null);
  const entries = useMemo(
    () => filterEntries(s.entries, "", "all", "name", false, i18n.language),
    [s.entries, i18n.language],
  );
  const choose = (entry: AssetEntry) => {
    setMenu(null);
    if (entry.kind === "folder") void s.navigate(entry.path);
    else s.select(entry);
  };
  return (
    <>
      {s.error && (
        <p role="alert" className="error">
          {t(s.error)}
        </p>
      )}
      {s.busy ? (
        <p role="status">{t("explorer:loading")}</p>
      ) : !s.path ? (
        <div className="empty">
          <Folder size={48} />
          <p>{t("explorer:empty")}</p>
          {s.drives.map((d) => (
            <button
              key={d}
              disabled={!desktopAvailable}
              onClick={() => void s.navigate(d)}
            >
              <Folder size={18} />
              {d}
            </button>
          ))}
        </div>
      ) : (
        <>
          <VirtualList
            key={`${s.path}:${s.prefs.view}`}
            items={entries}
            itemKey={(e) => e.path}
            rowHeight={s.prefs.view === "thumbnails" ? 148 : 40}
            minCellWidth={s.prefs.view === "thumbnails" ? 120 : undefined}
            className={`file-list ${s.prefs.view}`}
            label={t("files")}
            render={(e) => (
              <button
                key={e.path}
                className={`file-row ${s.selected?.path === e.path ? "selected" : ""}`}
                onClick={() => {
                  setMenu(null);
                  s.select(e);
                }}
                onDoubleClick={() => {
                  if (e.kind === "folder") void s.navigate(e.path);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && e.kind === "folder") {
                    event.preventDefault();
                    void s.navigate(e.path);
                  }
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenu(e);
                }}
                title={e.path}
              >
                <span className="file-icon">
                  {s.prefs.view === "thumbnails" ? (
                    <Thumbnail entry={e} />
                  ) : e.kind === "folder" ? (
                    <Folder size={18} />
                  ) : images.includes(e.kind) ? (
                    <FileImage size={18} />
                  ) : (
                    <File size={18} />
                  )}
                </span>
                <span className="filename">{e.name}</span>
                {s.prefs.view === "details" && (
                  <>
                    <span>
                      {e.kind === "folder"
                        ? t("explorer:folder")
                        : e.kind.toUpperCase()}
                    </span>
                    <span>
                      {e.kind === "folder"
                        ? "—"
                        : formatFileSize(e.size, fileSizeUnit, i18n.language)}
                    </span>
                    <time>
                      {e.modified
                        ? new Intl.DateTimeFormat(i18n.language, {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(e.modified)
                        : "—"}
                    </time>
                  </>
                )}
              </button>
            )}
          />
          {entries.length === 0 && <p>{t("explorer:noResults")}</p>}
          <div className="pagination">
            <span>{t("explorer:count", { count: entries.length })}</span>
          </div>
        </>
      )}
      {menu && (
        <div
          className="context-menu"
          role="menu"
          onKeyDown={(e) => {
            if (e.key === "Escape") setMenu(null);
          }}
        >
          <strong>{menu.name}</strong>
          <button role="menuitem" onClick={() => choose(menu)}>
            {t("explorer:preview")}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              void invoke("file_action", {
                path: menu.path,
                action: "copy",
              }).catch((e) => useExplorer.setState({ error: errorKey(e) }));
              setMenu(null);
            }}
          >
            {t("explorer:copyPath")}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              void invoke("file_action", {
                path: menu.path,
                action: "reveal",
              }).catch((e) => useExplorer.setState({ error: errorKey(e) }));
              setMenu(null);
            }}
          >
            {t("explorer:reveal")}
          </button>
          <button role="menuitem" onClick={() => setMenu(null)}>
            {t("explorer:close")}
          </button>
        </div>
      )}
    </>
  );
}
