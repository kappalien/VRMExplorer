import { useTranslation } from "react-i18next";
export function Splitter({
  value,
  min,
  max,
  onChange,
  direction = 1,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  direction?: number;
}) {
  const { t } = useTranslation();
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div
      className="splitter"
      role="separator"
      aria-label={t("splitter")}
      aria-orientation="vertical"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onKeyDown={(e) => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          onChange(
            e.key === "Home"
              ? min
              : e.key === "End"
                ? max
                : clamp(
                    value + (e.key === "ArrowRight" ? 10 : -10) * direction,
                  ),
          );
        }
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          onChange(clamp(value + e.movementX * direction));
      }}
      onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
    />
  );
}
