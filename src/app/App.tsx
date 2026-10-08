import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Puzzle } from "lucide-react";
import { Splitter } from "../components/Splitter";
import {
  desktopAvailable,
  loadPortable,
  saveSettings,
  type PortableInfo,
} from "../core/portable";
import {
  PluginRegistry,
  type PanelContribution,
  type CommandContribution,
} from "../core/plugins";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "../stores/settings";
import { sizeUnits, type Settings } from "../core/settings";
import { ExplorerToolbar, ExplorerFiles } from "../features/explorer/Explorer";
import { PreviewWorkspace } from "../features/vrm-preview/PreviewWorkspace";
import { CacheSettings } from "../features/settings/CacheSettings";
export function App() {
  const { t, i18n } = useTranslation();
  const { settings, set } = useSettings();
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const [animationHost, setAnimationHost] = useState<HTMLElement | null>(null);
  const [info, setInfo] = useState<PortableInfo>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [panels, setPanels] = useState<PanelContribution[]>([]);
  const [commands, setCommands] = useState<CommandContribution[]>([]);
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandError, setCommandError] = useState("");
  useEffect(() => {
    let alive = true;
    if (!desktopAvailable) return;
    void loadPortable()
      .then((result) => {
        if (alive) {
          set(result.settings);
          setInfo(result.info);
          setLoaded(true);
          setError("");
        }
      })
      .catch(() => {
        if (alive) setError("errors:native");
      });
    return () => {
      alive = false;
    };
  }, [set, attempt]);
  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    const timer = setTimeout(() => {
      void saveSettings(settings)
        .then(() => {
          if (alive) {
            setSaved(true);
            setError("");
          }
        })
        .catch(() => {
          if (alive) setError("common:saveFailed");
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [settings, loaded]);
  useEffect(() => {
    void i18n.changeLanguage(settings.language);
    document.documentElement.lang = settings.language;
  }, [i18n, settings.language]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        settings.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : settings.theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme]);
  useEffect(() => {
    const registry = new PluginRegistry();
    for (const plugin of registry.discover())
      registry.activate(plugin, {
        log: () => {},
        translate: (key) => i18n.t(key),
        registerPanel: (panel) => {
          setPanels((p) => [...p, panel]);
          return () => setPanels((p) => p.filter((v) => v.id !== panel.id));
        },
        registerCommand: (command) => {
          setCommands((v) => [...v, command]);
          return () => setCommands((v) => v.filter((c) => c.id !== command.id));
        },
        clearThumbnailCache: async () => {
          await invoke("cache_control", { action: "clear", limitMib: null });
        },
      });
    return () => {
      registry.dispose();
    };
  }, [i18n]);
  const update = (patch: Partial<Settings>) => {
    setSaved(false);
    set({ ...settings, ...patch });
  };
  return (
    <div className="app">
      <header>
        <div className="brand">
          <Box size={22} />
          <strong>{t("title")}</strong>
          <span className="badge">{t("phase")}</span>
        </div>
        <button onClick={() => settingsDialog.current?.showModal()}>
          {t("settingsPage")}
        </button>
      </header>
      <main
        style={{
          gridTemplateColumns: `${Math.max(280, settings.navigationWidth)}px 6px minmax(280px,1fr) 6px ${settings.previewWidth}px`,
        }}
      >
        <section className="files" aria-label={t("files")}>
          <ExplorerToolbar />
          <ExplorerFiles />
        </section>
        <Splitter
          value={Math.max(280, settings.navigationWidth)}
          min={280}
          max={420}
          onChange={(v) => update({ navigationWidth: v })}
        />
        <section className="preview" aria-label={t("preview")}>
          <PreviewWorkspace animationHost={animationHost} />
        </section>
        <Splitter
          value={settings.previewWidth}
          min={260}
          max={600}
          direction={-1}
          onChange={(v) => update({ previewWidth: v })}
        />
        <section
          className="animation-pane"
          aria-label={t("animation")}
          ref={setAnimationHost}
        />
      </main>
      <dialog
        ref={settingsDialog}
        className="settings-page"
        aria-labelledby="settings-title"
      >
        <div className="settings-heading">
          <h2 id="settings-title">{t("settingsPage")}</h2>
          <button onClick={() => settingsDialog.current?.close()}>
            {t("closeSettings")}
          </button>
        </div>
        <div className="settings-preferences">
          <label>
            {t("language")}
            <select
              value={settings.language}
              onChange={(e) =>
                update({ language: e.target.value as Settings["language"] })
              }
            >
              <option value="zh-TW">{t("languageZh")}</option>
              <option value="en">{t("languageEn")}</option>
            </select>
          </label>
          <label>
            {t("theme")}
            <select
              value={settings.theme}
              onChange={(e) =>
                update({ theme: e.target.value as Settings["theme"] })
              }
            >
              {(["light", "dark", "system"] as const).map((v) => (
                <option key={v} value={v}>
                  {t(v)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="size-preference">
          {t("fileSizeUnit")}
          <select
            value={settings.fileSizeUnit}
            onChange={(e) =>
              update({
                fileSizeUnit: e.target.value as Settings["fileSizeUnit"],
              })
            }
          >
            {sizeUnits.map((unit) => (
              <option key={unit} value={unit}>
                {unit === "auto" ? t("sizeAuto") : unit}
              </option>
            ))}
          </select>
        </label>
        <section className="settings-tools">
          <CacheSettings />
          {commands.map((c) => (
            <button
              key={c.id}
              disabled={!desktopAvailable || commandBusy}
              onClick={() => {
                setCommandBusy(true);
                setCommandError("");
                void c
                  .run()
                  .catch(() => setCommandError("plugins:commandFailed"))
                  .finally(() => setCommandBusy(false));
              }}
            >
              {t(c.labelKey)}
            </button>
          ))}
          {commandError && (
            <p className="error" role="alert">
              {t(commandError)}
            </p>
          )}
          {panels.map((p) => (
            <section className="info" key={p.id}>
              <h3>
                <Puzzle size={16} />
                {t(p.titleKey)}
              </h3>
              <p>{t("portable")}</p>
              <code>{info?.root ?? "—"}</code>
              <p>
                {t("runtime")}: {info?.runtime ?? "—"}
              </p>
              <small>{t("external")}</small>
            </section>
          ))}
        </section>
      </dialog>
      <footer role="status">
        {error
          ? t(error)
          : !desktopAvailable
            ? t("browser")
            : saved
              ? t("ready")
              : t("loading")}
        {error && (
          <button
            onClick={() => {
              setLoaded(false);
              setAttempt((v) => v + 1);
            }}
          >
            {t("retry")}
          </button>
        )}
      </footer>
    </div>
  );
}
