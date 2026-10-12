import { useTranslation } from "react-i18next";
import type { BoneInfo } from "./bones";
export function BonePanel({
  bones,
  hasModel,
}: {
  bones: BoneInfo[];
  hasModel: boolean;
}) {
  const { t } = useTranslation();
  if (!hasModel) return <p>{t("preview:boneEmpty")}</p>;
  const missing = bones.filter((b) => b.required && b.node === null);
  return (
    <div className="bone-panel">
      <p role="status">
        {missing.length
          ? t("preview:boneMissing", { count: missing.length })
          : t("preview:boneComplete")}
      </p>
      <p>
        <small>{t("preview:boneScope")}</small>
      </p>
      <div className="bone-table-scroll">
        <table className="bone-table">
          <caption>{t("preview:boneMapping")}</caption>
          <thead>
            <tr>
              <th>{t("preview:boneStandard")}</th>
              <th>{t("preview:boneNode")}</th>
              <th>{t("preview:boneParent")}</th>
              <th>{t("preview:boneStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {bones.map((b) => (
              <tr
                key={b.bone}
                className={b.required && b.node === null ? "error" : undefined}
              >
                <th scope="row">
                  {b.bone}
                  <small>
                    {" "}
                    {t(
                      b.required
                        ? "preview:boneRequired"
                        : "preview:boneOptional",
                    )}
                  </small>
                </th>
                <td>{b.node ?? t("preview:boneUnset")}</td>
                <td>{b.parent ?? "—"}</td>
                <td>
                  {t(
                    b.node !== null
                      ? "preview:boneAssigned"
                      : b.required
                        ? "preview:boneMissingStatus"
                        : "preview:boneUnset",
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
