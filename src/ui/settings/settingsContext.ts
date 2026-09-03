import type { LlmHubPlugin } from "src/plugin";

export interface SettingsContext {
  plugin: LlmHubPlugin;
  display: () => void;
  /** Mutable ref for RAG sync cancellation */
  syncCancelRef: { value: boolean };
}
