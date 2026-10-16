# ARCHITECTURE — XDF AI Chat

> 现状架构说明。定位与使用见 [README.md](./README.md)；待办见 [PENDING.md](./PENDING.md)；变更史见 [DEVLOG.md](./DEVLOG.md)。

## 1. 定位

Obsidian 桌面端插件（`isDesktopOnly: true`，id `xdf-aichatbot`，name `XDF AI Chat`，version `0.2.1`，minAppVersion `1.13.0`，author Schleiden）。上游蓝本是 [obsidian-llm-hub](https://github.com/takeshy/obsidian-llm-hub)（takeshy，MIT），本仓库是它的「教学档案 Agent 壳」分叉：保留多 provider 对话、MCP 客户端与 Vault 工具面，把默认系统提示、预置供应商、工作区目录改为面向新东方教学档案。

依赖同库另外两个插件：

- `xdf-base`：SQLite 档案镜像（本插件不直接调，经 xdf-toolkits 使用）。
- `xdf-toolkits`：教学档案 MCP 服务端，暴露查询 / 写入 / 建档工具。

本插件只负责「对话 + 模型调用 + MCP 客户端」；课务工具全部留在 xdf-toolkits。启用后自动把 `http://127.0.0.1:27183/mcp`（及 Toolkits 提供的 token）写进 `settings.mcpServers`，用户在聊天里说人话即可驱动档案查询/写入。

## 2. 目录结构

```
src/
├── main.ts                    入口，仅 re-export plugin.ts 的 LlmHubPlugin
├── plugin.ts                  插件主类：设设置、注册视图/命令、起停各管理器、自动绑定 xdf-toolkits
├── core/
│   ├── systemPrompt.ts        XDF 定制：PROTECTED_CONTRACT + 预设 + buildSystemPrompt()
│   ├── openaiProvider.ts      OpenAI 兼容 provider（XDF NewAPI 通道）
│   ├── gemini.ts / anthropicProvider.ts / localLlmProvider.ts / opencodeLocalProvider.ts / cliProvider.ts
│   ├── mcpClient.ts / mcpTools.ts / mcpStdioClient.ts   MCP 客户端（HTTP streamable + stdio）
│   ├── modelStreaming.ts      流式响应处理
│   ├── proxyFetch.ts          代理 / Node fetch（CONNECT 隧道）
│   ├── tools.ts               Vault 工具定义（15 个）
│   └── （其余：RAG、加密、编辑历史、Skills、OKF、Discord、sandbox 等上游模块，见 PENDING 裁剪节）
├── xdf/
│   └── bindToolkits.ts        XDF 定制入口：探测 xdf-toolkits 并把 MCP 服务器写入设置
├── vault/                     笔记基础设施：notes.ts / search.ts / toolExecutor.ts / fileTypes.ts
├── ui/
│   ├── ChatView.tsx           Obsidian ItemView（React 宿主）
│   ├── SettingsTab.tsx        设置页容器，逐块调用 displayXxxSettings()
│   ├── components/            聊天组件（Chat.tsx / InputArea.tsx / MessageList.tsx …）+ workflow/ 弹窗
│   └── settings/*.tsx         17 个子设置模块（apiProvider / workspace / mcpServers / slashCommand …）
├── types/index.ts             核心类型 + DEFAULT_SETTINGS（含默认 systemPrompt、预置供应商）
├── i18n/                      多语言（10 种语言，zh.ts / en.ts 为主）
├── workflow/                  工作流引擎（25+ 节点类型，待裁剪）
├── tracing/                   Langfuse 可观测性（待裁剪）
├── integrations/              Dashboard Hub / Discussion Hub 能力导出（待裁剪）
└── utils/                     EventEmitter / globMatcher / id / error 等
```

配套资源：`references/QwenPaw/`（vendored 的参考 Agent，**保留**，仅作提示词与 harness 参考）、`docs/`（上游文档与截图）、`LICENSE`（MIT，保留上游声明）。

## 3. 模块职责

| 模块 | 职责 | 关键点 |
|------|------|--------|
| `main.ts` | 插件入口 | 仅 `export { LlmHubPlugin as default } from "./plugin"` |
| `plugin.ts` | 插件生命周期：加载设置、注册 ChatView / CryptView / CliTerminalView / SettingsTab、起停 RAG / CLI / 加密 / 编辑历史 / Discord 等管理器、注册命令 | 加载后按 `xdfAutoBindToolkits` 调 `syncToolkitsMcp`，并每 8s 轮询重同步 |
| `core/systemPrompt.ts` | 系统提示词构建：`PROTECTED_CONTRACT`（硬编码执行契约）+ `PROMPT_PRESETS` + `buildSystemPrompt(userPrompt, context)` | XDF 防幻觉的核心机制，见第 5 节 |
| `xdf/bindToolkits.ts` | XDF 定制入口：读 `xdf-toolkits` 插件 `api.getStatus()`，生成 `McpServerConfig` 并 upsert 进 `settings.mcpServers` | 服务名固定 `xdf-toolkits`；无 api 时移除该条 |
| `core/openaiProvider.ts` | OpenAI 兼容 provider：文本/工具调用/流式 | XDF 走预置 NewAPI 通道 |
| `core/gemini.ts` 等 | 其余 provider（Gemini / Anthropic / 本地 LLM / OpenCode / CLI） | 上游能力，XDF 场景非必需 |
| `core/mcpClient.ts` / `mcpTools.ts` | MCP over HTTP（Streamable HTTP + JSON-RPC），`Mcp-Session-Id` 会话 | 连接 xdf-toolkits 的基础设施 |
| `core/mcpStdioClient.ts` | MCP over stdio（本地子进程） | 桌面端专用 |
| `core/modelStreaming.ts` | 统一流式 chunk 处理与回填 UI | — |
| `core/proxyFetch.ts` | HTTP CONNECT 代理 + Node fetch | 企业网关环境 |
| `core/tools.ts` + `src/vault/` | 15 个 Vault 工具（读/建/提议编辑/搜索/文件夹…） | 映射到 `notes.ts` / `search.ts` |
| `ui/ChatView.tsx` + `ui/components/*` | 聊天 UI 编排（Chat.tsx 负责构建系统提示、选 provider、调度工具） | 核心链路，见第 4 节 |
| `ui/SettingsTab.tsx` + `ui/settings/*` | 设置页；17 个子模块逐一 `displayXxxSettings()` 平铺渲染 | 分区改造见 PENDING |
| `types/index.ts` | 类型定义 + `DEFAULT_SETTINGS`（默认 systemPrompt、预置供应商、`DEFAULT_WORKSPACE_FOLDER = XDF-AI`） | 单一类型事实源 |

## 4. 数据流

XDF 实际只跑一条核心链路：

```
用户在 Chat 输入（可 @ 提及文件 / 挂附件）
   │
   ▼
ChatView.tsx（Obsidian ItemView）
   ▼
components/Chat.tsx（编排层）
   ├─ 构建系统提示：core/systemPrompt.ts 的 buildSystemPrompt(settings.systemPrompt, ctx)
   ├─ 选 provider：openaiProvider（NewAPI）/ gemini / …
   │      ▼
   │   core/mcpClient.ts  ← 读 settings.mcpServers（含托管的 xdf-toolkits 条目）
   │      │  POST http://127.0.0.1:27183/mcp   (JSON-RPC, Bearer token)
   │      ▼
   │   xdf-toolkits 插件 → xdf-base → vault/.xdf/xdf.db（SQLite）/ Markdown 档案
   ├─ 流式回填：core/modelStreaming.ts  →  UI
   ├─ 网络：core/proxyFetch.ts（代理 / CONNECT）
   └─ Vault 工具：core/tools.ts + src/vault/（读写笔记、搜索、提议编辑）
```

- **工具来源**：对话可用工具 = Vault 工具（`core/tools.ts`，受 `vaultToolMode` 控制）+ MCP 工具（`mcpTools.ts`，含 xdf-toolkits 的档案工具）。
- **写盘模型**：Vault 侧走 `propose_edit` 等安全编辑（先提议、用户点「应用」才落盘）；档案侧由 xdf-toolkits 的 `write_*` / `create_*` 工具负责。
- **系统提示注入点**：`Chat.tsx` 在调用 provider 前调 `buildSystemPrompt` 拼装完整系统提示（API Provider 路径与 Gemini 路径均已接入；CLI / Local LLM 路径尚未接入，见 PENDING）。

## 5. 系统提示词架构

XDF 的防幻觉改造集中在 [src/core/systemPrompt.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/systemPrompt.ts)。参考 QwenPaw 的分层 harness，分四层按序拼装：

1. **`PROTECTED_CONTRACT`**（[L18-L41](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/systemPrompt.ts#L18-L41)）：硬编码执行契约，**永远在最前面、不可被用户修改**。包含「工具调用规则 / 完成标准 / 工具调用纪律 / 能力边界」，全部为**正向指令**（「必须在同一轮调用工具」而非「不要假装」），并明确「计划、承诺、下一步列表不算完成」。
2. **pathContext**：路径特有上下文（CLI 模式说明、Local LLM 工具说明等）。
3. **用户提示词** `settings.systemPrompt`：由 `PROMPT_PRESETS`（`xdf-teaching` / `general`）或用户自定义提供，含数据来源限制、写入规则。
4. **运行时上下文**：`FILE_MENTION_TOOL_PROMPT`（`vaultToolMode !== "none"` 时注入）、OKF、RAG、Skills、NoDiscovery、RAG Search 等。

`buildSystemPrompt(userPrompt, context)`（[L137-L182](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/systemPrompt.ts#L137-L182)）负责把以上各层去空、`join("\n\n")`。设计动机与根因分析（「You are a helpful AI assistant」开头 / 「Additional instructions」追加 / 否定式指令 / 无完成定义）见 [DEVLOG.md](./DEVLOG.md) 的系统提示词重构条目。

**接入现状**：`Chat.tsx` 的 API Provider 与 Gemini 两条路径已改用 `buildSystemPrompt()`（[L3128](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/ui/components/Chat.tsx#L3128)、[L4033](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/ui/components/Chat.tsx#L4033)）；CLI 与 Local LLM 路径尚未接入（见 PENDING）。

## 6. 技术决策

| 决策 | 取舍 | 原因 |
|------|------|------|
| **fork 上游 LLM Hub 而非重写** | 保留全部上游模块（Workflow / RAG / Discord / Skills / CLI 等），只改默认值与绑定逻辑 | 快速拿到成熟的多 provider 对话与 MCP 客户端；裁剪留待后续（见 PENDING） |
| **工具面外置到 xdf-toolkits** | 本插件不做档案逻辑，只做 MCP 客户端 + 自动绑定 | 与 xdf-toolkits / Python 侧共用同一套工具语义 |
| **自动绑定而非手工配置 MCP** | 加载后 8s 轮询 `syncToolkitsMcp` 维持服务器条目 | 插件加载顺序不定，轮询保证 Toolkits 起停后本插件始终有正确 URL/token |
| **系统提示词分层（硬编码契约 + 用户预设）** | 契约不可被设置页覆盖 | 中低端模型对「正向 + 最前置」指令遵从度显著高于否定式「附加指令」 |
| **预置提示词「按预设/自定义」二选一** | 选择预设后 TextArea 只读，编辑时自动切到「自定义」 | 降低误改契约或改坏默认教学规则的概率 |

## 7. 构建与发布

- 构建：`npm run build` = `npm run generate:builtin-okf && node esbuild.config.mjs production`，产出 `main.js`。
- 开发：`npm run dev`（watch）；`npm run build:langfuse` 额外跑 `tsc -noEmit -skipLibCheck`。
- 测试 / 检查：`npm run test`（vitest）、`npm run lint`（eslint，已忽略 `references/`）。
- 发布：`.github/workflows/release.yml` 由 `v*` tag 触发，校验 `package.json` / `manifest.json` / tag 三处版本一致后构建发布；`build.yml` 为常规构建（已移除 Lint 步骤）。
- 版本：`version-bump.mjs` 同步 `package.json` / `manifest.json` / `versions.json`。

## 8. 约定

- **系统提示词必须经 `buildSystemPrompt()`**，不要在业务文件里手拼字符串（历史上「Additional instructions」拼接即幻觉根因）。
- **MCP 服务器 `xdf-toolkits` 由 `bindToolkits.ts` 托管**，勿手工改名或删除该条目。
- **LLM 调用统一走 provider 层**（`openaiProvider` 等），不要散落 `requestUrl`。
- **本地编译在 WSL 下执行**（路径用 WSL 风格）；git 提交/推送用 Windows 风格路径。
- 版本号三处需一致：`package.json` / `manifest.json` / release tag。
- 上游 MIT 声明与 `references/` 参考目录保留，不改写第三方源码。

## 9. 已知技术债

可行动项已拆分进 [PENDING.md](./PENDING.md)，此处仅列大类：

- **代码审查整改（2026-10-04）**：CLI 命令注入、沙箱同步死循环冻结主线程、任意绝对路径读取、`decryptData` 无边界校验、SSRF、工具参数解析静默置空、MCP stdio 缓冲无上限、子进程继承全部 env、RAG 线性扫描、事件监听器异常未隔离等（严重/高/中/低分级见 PENDING）。
- **系统提示词接入不完整**：CLI 与 Local LLM 路径尚未改用 `buildSystemPrompt()`。
- **上游模块未裁剪**：Discord / Discussion Hub / Workflow / Skills / OKF / RAG / Langfuse / CLI / 加密 / 编辑历史 / Web 搜索等 13 类模块仍在代码里（见 PENDING 模块裁剪节）。
- **设置页全平铺**：17 个子模块平铺、缺 Banner/Footer，低频项未折叠（见 PENDING 设置页 UI 改造节）。
- **超大文件**：`ui/components/Chat.tsx`（4600+ 行）、`core/gemini.ts`（1900+ 行）职责混杂。
