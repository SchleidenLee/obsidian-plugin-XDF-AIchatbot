import { DEFAULT_EDIT_HISTORY_SETTINGS } from "src/types";
import type { SettingsContext } from "./settingsContext";

export function displayEditHistorySettings(_containerEl: HTMLElement, ctx: SettingsContext): void {
  const { plugin } = ctx;

  // Edit history is always enabled with fixed context lines — no UI needed.
  // Ensure settings exist with defaults.
  if (!plugin.settings.editHistory) {
    plugin.settings.editHistory = { ...DEFAULT_EDIT_HISTORY_SETTINGS };
  }
  plugin.settings.editHistory.enabled = true;
}
