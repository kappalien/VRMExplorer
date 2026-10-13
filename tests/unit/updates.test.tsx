import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { UpdateSettings } from "../../src/features/settings/UpdateSettings";
import { usePreview, initialPlayback } from "../../src/stores/preview";
import i18n from "../../src/locales/i18n";
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("../../src/core/portable", () => ({ desktopAvailable: true }));
const snapshot = {
  phase: "idle",
  version: "",
  notesZh: "",
  notesEn: "",
  downloaded: 0,
  total: 20,
  runtimeExtra: false,
  error: "",
  result: "",
  supported: true,
  automatic: false,
};
beforeEach(async () => {
  invoke.mockReset();
  await i18n.changeLanguage("zh-TW");
  usePreview.setState({ playback: initialPlayback });
  invoke.mockImplementation(async (command: string) =>
    command === "check_update"
      ? { ...snapshot, phase: "available", version: "1.5.0" }
      : command === "prepare_update"
        ? { ...snapshot, phase: "ready" }
        : snapshot,
  );
});
afterEach(cleanup);
describe("one click updates", () => {
  it("cancels a pending check without starting installation", async () => {
    let rejectCheck: (reason: string) => void = () => {};
    invoke.mockImplementation((command: string) => {
      if (command === "check_update")
        return new Promise((_, reject) => {
          rejectCheck = reject;
        });
      if (command === "cancel_update") rejectCheck("updates:cancelled");
      return Promise.resolve(snapshot);
    });
    render(<UpdateSettings />);
    await waitFor(() =>
      expect(
        (screen.getByText(i18n.t("updates:oneClick")) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByText(i18n.t("updates:oneClick")));
    fireEvent.click(await screen.findByText(i18n.t("updates:cancel")));
    await screen.findByText(i18n.t("updates:cancelled"));
    expect(invoke).toHaveBeenCalledWith("cancel_update");
    expect(invoke).not.toHaveBeenCalledWith("prepare_update");
    expect(invoke).not.toHaveBeenCalledWith("install_update");
  });
  it("checks, prepares and hands off without another click", async () => {
    render(<UpdateSettings />);
    await waitFor(() =>
      expect(
        (screen.getByText(i18n.t("updates:oneClick")) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByText(i18n.t("updates:oneClick")));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("install_update"));
    expect(
      invoke.mock.calls
        .filter((c) => c[0] !== "update_snapshot")
        .map((c) => c[0]),
    ).toEqual(["check_update", "prepare_update", "install_update"]);
  });
  it("does not discard a pose draft until confirmed", async () => {
    usePreview.setState({
      playback: {
        ...initialPlayback,
        pose: { ...initialPlayback.pose, available: ["hips"] },
      },
    });
    render(<UpdateSettings />);
    await waitFor(() =>
      expect(
        (screen.getByText(i18n.t("updates:oneClick")) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByText(i18n.t("updates:oneClick")));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(invoke).not.toHaveBeenCalledWith("check_update");
    fireEvent.click(screen.getByText(i18n.t("updates:keepDraft")));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(invoke).not.toHaveBeenCalledWith("install_update");
  });
  it("signature failure never hands off and has a translated error", async () => {
    invoke.mockImplementation(async (command: string) => {
      if (command === "check_update") throw "updates:signature";
      return snapshot;
    });
    render(<UpdateSettings />);
    await waitFor(() =>
      expect(
        (screen.getByText(i18n.t("updates:oneClick")) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByText(i18n.t("updates:oneClick")));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toBe(
      i18n.t("updates:signature"),
    );
    expect(invoke).not.toHaveBeenCalledWith("install_update");
  });
});
