import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { imageUrl, errorKey, type AssetEntry } from "../../core/assets";
export function ImagePreview({ entry }: { entry: AssetEntry }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [dimensions, setDimensions] = useState("");
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    let objectUrl = "";
    void imageUrl(entry.path)
      .then((u) => {
        objectUrl = u;
        if (alive) {
          setUrl(u);
          setError("");
          setScale(1);
          setRotation(0);
        } else URL.revokeObjectURL(u);
      })
      .catch((e) => {
        if (alive) setError(errorKey(e));
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entry.path]);
  return (
    <>
      <div className="image-toolbar">
        <button
          onClick={() => setScale((v) => Math.max(0.1, v / 1.25))}
          aria-label={t("preview:zoomOut")}
        >
          −
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale((v) => Math.min(8, v * 1.25))}
          aria-label={t("preview:zoomIn")}
        >
          +
        </button>
        <button
          onClick={() => {
            setScale(1);
            setRotation(0);
          }}
        >
          {t("preview:fit")}
        </button>
        <button onClick={() => setRotation((v) => v + 90)}>
          {t("preview:rotate")}
        </button>
      </div>
      <div
        ref={surface}
        className="image-surface"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.scrollLeft -= e.movementX;
            e.currentTarget.scrollTop -= e.movementY;
          }
        }}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      >
        {error ? (
          <p role="alert">{t(error)}</p>
        ) : url ? (
          <img
            src={url}
            alt={entry.name}
            style={{
              width: `${scale * 100}%`,
              maxWidth: "none",
              transform: `rotate(${rotation}deg)`,
            }}
            onLoad={(e) =>
              setDimensions(
                `${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`,
              )
            }
            onError={() => setError("errors:image")}
          />
        ) : (
          <p>{t("explorer:loading")}</p>
        )}
      </div>
      <p>
        {entry.name} · {dimensions}
      </p>
      <small>{t("preview:imageLimit")}</small>
    </>
  );
}
