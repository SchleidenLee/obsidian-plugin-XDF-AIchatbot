import type { Plugin } from "obsidian";
import type { McpServerConfig } from "src/types";

const TOOLKITS_ID = "xdf-toolkits";
const SERVER_NAME = "xdf-toolkits";

interface ToolkitsApi {
  getStatus?: () => {
    running?: boolean;
    url?: string;
    token?: string;
    port?: number;
  };
}

function getToolkitsApi(plugin: Plugin): ToolkitsApi | null {
  const plugins = (
    plugin.app as unknown as {
      plugins: { plugins: Record<string, { api?: ToolkitsApi }> };
    }
  ).plugins?.plugins;
  return plugins?.[TOOLKITS_ID]?.api ?? null;
}

export function buildToolkitsServerConfig(plugin: Plugin): McpServerConfig | null {
  const api = getToolkitsApi(plugin);
  const status = api?.getStatus?.();
  const url =
    status?.url ||
    (status?.port ? `http://127.0.0.1:${status.port}/mcp` : "http://127.0.0.1:27183/mcp");
  const headers: Record<string, string> = {};
  if (status?.token) headers.Authorization = `Bearer ${status.token}`;
  return {
    name: SERVER_NAME,
    transport: "http",
    url,
    headers,
    enabled: true,
  };
}

/** Keep a managed xdf-toolkits MCP entry in settings. */
export async function syncToolkitsMcp(plugin: Plugin & { settings: { mcpServers: McpServerConfig[] }; saveSettings: () => Promise<void> }): Promise<boolean> {
  const next = buildToolkitsServerConfig(plugin);
  if (!next) {
    const idx = plugin.settings.mcpServers.findIndex((s) => s.name === SERVER_NAME);
    if (idx >= 0) {
      plugin.settings.mcpServers.splice(idx, 1);
      await plugin.saveSettings();
      return true;
    }
    return false;
  }
  const idx = plugin.settings.mcpServers.findIndex((s) => s.name === SERVER_NAME);
  if (idx >= 0) {
    const prev = plugin.settings.mcpServers[idx];
    const same =
      prev.url === next.url &&
      prev.headers?.Authorization === next.headers?.Authorization &&
      prev.enabled === true;
    if (same) return false;
    plugin.settings.mcpServers[idx] = { ...prev, ...next, enabled: true };
  } else {
    plugin.settings.mcpServers.unshift(next);
  }
  await plugin.saveSettings();
  return true;
}
