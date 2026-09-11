# XDF AI Chatbot 优化分析

> 基于 obsidian-llm-hub 上游项目的功能审计，针对 XDF 教学档案场景的裁剪与增强建议。

## 一、XDF 实际使用的功能链路

XDF 场景只需要一条核心链路：

```
聊天界面 → 系统提示词 → MCP (xdf-toolkits) → API 提供商 (NewAPI)
```

XDF 的定制集中在以下几点：

| 定制项 | 位置 | 说明 |
|--------|------|------|
| 插件 ID | `manifest.json` | `xdf-aichatbot` |
| 系统提示词 | `src/types/index.ts` DEFAULT_SETTINGS.systemPrompt | 新东方雅思教学助手，防幻觉规则 |
| API 提供商 | DEFAULT_SETTINGS.apiProviders | 预配置 XDF NewAPI (`api.schleiden.space`) |
| 工作区目录 | DEFAULT_WORKSPACE_FOLDER | `XDF-AI`（上游是 `LLMHub`） |
| MCP 自动绑定 | `src/xdf/bindToolkits.ts` | 自动注册 xdf-toolkits 为 MCP 服务器 |

---

## 二、建议移除的功能模块

以下模块与 XDF 教学档案场景无关，可安全裁剪。

### 2.1 Discord 集成

- **文件**: `src/core/discordService.ts`, `src/ui/settings/discordSettings.ts`
- **内容**: 完整的 Discord Bot 实现（WebSocket Gateway、频道消息、私信、命令系统）
- **移除理由**: 与教学管理完全无关，默认就是禁用的
- **关联**: `src/integrations/discussionHubCapabilities.ts` 一并移除

### 2.2 Discussion Hub / Dashboard Hub

- **文件**: `src/integrations/discussionHubCapabilities.ts`, `src/integrations/dashboardHubCapabilities.ts`
- **内容**: 多 AI 参与者讨论/投票、仪表板生成
- **移除理由**: 需要外部插件，教学场景不需要

### 2.3 Workflow 工作流引擎

- **文件**: `src/workflow/` 整个目录（约 20+ 文件）
- **内容**: 25+ 种节点类型的可视化工作流系统（variable, set, if, while, command, http, json, note, dialog, prompt, rag-sync, mcp, script, shell...），含 Mermaid 图渲染、AI 生成工作流、执行历史
- **移除理由**: XDF 的数据操作通过 MCP 工具完成，不需要可视化工作流编排
- **关联 UI**: `src/ui/workflowCodeBlock.ts`, `src/plugin/workflowManager.ts`, `src/plugin/workflowMigration.ts`

### 2.4 Skills 技能系统

- **文件**: `src/core/skillsLoader.ts`, `src/core/builtinSkills.ts`, `src/core/externalSkills.ts`, `src/core/runtimeSkills.ts`, `src/core/agentPlugins.ts`
- **内容**: 文件夹技能加载、外部技能导入（GitHub）、Agent 插件安装、运行时技能注册
- **移除理由**: 面向高级用户的扩展系统，XDF 不需要
- **关联 UI**: `src/ui/settings/skillsSettings.ts`, `src/ui/settings/externalSkillSettings.ts`, `src/ui/settings/agentPluginSettings.ts`
- **关联脚本**: `scripts/generate-builtin-okf.mjs`

### 2.5 OKF 知识库

- **文件**: `src/core/okfLoader.ts`, `src/core/okfDocumentTool.ts`, `src/core/builtinOkf.ts`, `src/generated/builtinOkfData.ts`
- **内容**: Open Knowledge Format 知识管理系统，内置 LLM Hub 帮助文档
- **移除理由**: 内置的是上游自己的帮助文档，XDF 的知识通过 xdf-toolkits MCP 提供
- **关联 UI**: `src/ui/settings/knowledgeSettings.ts`

### 2.6 RAG 语义搜索

- **文件**: `src/core/localRagStore.ts`, `src/core/localRagStorage.ts`, `src/core/ragSearchTool.ts`, `src/core/embeddingProvider.ts`, `src/core/pdfJs.ts`, `src/core/pdfInputMode.ts`
- **内容**: 完整的本地 embedding 向量索引系统（Internal/Combined/External 三种模式），支持多模态索引
- **移除理由**: XDF 的数据查询通过 xdf-toolkits MCP 工具完成（查学员、查班级、查课程），不需要本地向量索引
- **关联 UI**: `src/ui/settings/ragSettings.ts`

### 2.7 Langfuse 可观测性

- **文件**: `src/tracing/langfuse.ts`, `src/tracing/langfuse-noop.ts`, `src/core/tracingHooks.ts`
- **内容**: LLM 调用追踪和监控
- **移除理由**: 开发者调试工具，终端用户不需要
- **关联 UI**: `src/ui/settings/langfuseSettings.ts`

### 2.8 Codex Vault MCP Bridge

- **文件**: `src/core/codexVaultMcpBridge.ts`
- **内容**: 将 Vault 工具通过 MCP 协议暴露给 Codex CLI
- **移除理由**: XDF 不使用 Codex CLI

### 2.9 CLI 终端视图

- **文件**: `src/ui/CliTerminalView.ts`, `src/ui/components/CliTerminalPanel.tsx`
- **内容**: 完整的 TTY 终端模拟器（xterm.js + node-pty）
- **移除理由**: 面向开发者的高级功能
- **关联**: `src/core/cliProvider.ts`, `src/ui/settings/cliSettings.ts`, `src/ui/settings/CliPathModal.ts`
- **可选依赖**: `node-pty`, `@xterm/xterm`, `@xterm/addon-fit` 可从 package.json 移除

### 2.10 编辑历史

- **文件**: `src/core/editHistory.ts`, `src/core/editHistoryStore.ts`, `src/core/diffUtils.ts`
- **内容**: AI 编辑追踪、unified diff、版本恢复
- **移除理由**: XDF 的 AI 主要通过 MCP 写数据，不直接编辑笔记，不需要 diff 追踪
- **关联 UI**: `src/ui/settings/editHistorySettings.ts`

### 2.11 加密系统

- **文件**: `src/core/crypto.ts`, `src/core/cryptoCache.ts`, `src/core/credentialBundle.ts`, `src/core/secretStorage.ts`, `src/plugin/encryptionManager.ts`
- **内容**: 聊天记录和工作流日志加密，公钥/私钥体系
- **移除理由**: 教学档案数据敏感性由系统层面处理，不需要插件级加密
- **关联 UI**: `src/ui/settings/encryptionSettings.ts`, `src/ui/settings/credentialStorageSettings.ts`, `src/ui/CryptView.tsx`, `src/ui/passwordPrompt.ts`

### 2.12 Web 搜索

- **文件**: `src/core/webSearch.ts`
- **内容**: Gemini/OpenAI/Anthropic/Grok 的原生 Web 搜索
- **移除理由**: 教学助手场景不需要联网搜索
- **关联**: InputArea 中的搜索选择器 UI

### 2.13 CLI 提供商

- **文件**: `src/core/cliProvider.ts`
- **内容**: Antigravity CLI / Claude CLI / Codex CLI 集成
- **移除理由**: 面向开发者，XDF 用户通过 API 调用模型

### 移除后 package.json 可清理的依赖

```
@anthropic-ai/sdk    (如不使用 Anthropic 直连)
pdf-lib              (RAG PDF 处理)
node-pty             (CLI 终端)
@xterm/xterm         (CLI 终端)
@xterm/addon-fit     (CLI 终端)
langfuse             (可观测性)
```

---

## 三、保留的核心功能

| 模块 | 文件 | 说明 |
|------|------|------|
| AI 聊天核心 | `src/ui/ChatView.tsx`, `src/ui/components/Chat.tsx`, `src/ui/components/InputArea.tsx` | 流式对话、附件、消息渲染 |
| MCP 客户端 | `src/core/mcpClient.ts`, `src/core/mcpTools.ts`, `src/core/mcpStdioClient.ts` | 连接 xdf-toolkits 的基础设施 |
| XDF 自动绑定 | `src/xdf/bindToolkits.ts` | 核心定制：自动注册 MCP 服务器 |
| Vault 工具 | `src/core/tools.ts`, `src/vault/` | AI 读写笔记的基础能力 |
| OpenAI 兼容 API | `src/core/openaiProvider.ts` | NewAPI 调用通道 |
| 模型流式处理 | `src/core/modelStreaming.ts` | 流式响应处理 |
| 代理设置 | `src/core/proxyFetch.ts` | 企业网络环境 |
| 斜杠命令 | `src/ui/settings/slashCommandSettings.ts` | 快捷操作（可预置教学命令） |
| Mermaid 渲染 | `src/ui/mermaidRender.ts` | 图表展示 |
| 国际化 | `src/i18n/` | 只保留 zh.ts 和 en.ts |
| 类型定义 | `src/types/index.ts` | 核心类型和默认设置 |
| 插件主类 | `src/plugin.ts`, `src/main.ts` | 入口 |

---

## 四、建议新增/强化的功能

### 4.1 预置教学斜杠命令

当前默认只有一个 `infographic` 命令，可以预置：

| 命令 | 用途 |
|------|------|
| `/反馈` | 生成某位学员的课后反馈 |
| `/点名` | 查看某班级今日出勤 |
| `/课程总结` | 总结今日课程内容 |
| `/学员分析` | 分析某学员的学习情况 |
| `/建档` | 为某学员创建教学档案 |

### 4.2 精简设置面板

当前设置面板有 18 个区块，裁剪后建议只保留：

1. API 提供商（默认已配好 NewAPI，可折叠）
2. 工作区设置（系统提示词、工具限制）
3. MCP 服务器（含 XDF 自动绑定开关）
4. 斜杠命令
5. 代理设置（可选）

### 4.3 系统提示词优化

当前提示词已面向教学档案，可进一步：
- 加入具体的反馈格式模板
- 预置常见的教学场景引导
- 优化工具调用优先级说明

### 4.4 聊天模板

在聊天界面提供预置模板：
- 课后反馈模板
- 学员分析模板
- 课程总结模板

### 4.5 模型选择简化

默认只展示 NewAPI 提供的模型，隐藏不需要的提供商选项，降低用户困惑。

---

## 五、裁剪优先级

| 优先级 | 模块 | 原因 |
|--------|------|------|
| P0 - 立即移除 | Discord, Discussion Hub, Dashboard Hub | 完全无关，零风险 |
| P0 - 立即移除 | Langfuse, Codex Bridge | 开发者工具，零风险 |
| P1 - 尽快移除 | Workflow 工作流引擎 | 代码量大（20+ 文件），复杂度高 |
| P1 - 尽快移除 | RAG 语义搜索 | 代码量大，XDF 用 MCP 替代 |
| P1 - 尽快移除 | Skills 技能系统 + OKF | 扩展系统，XDF 不需要 |
| P2 - 可以移除 | CLI 终端 + CLI 提供商 | 面向开发者 |
| P2 - 可以移除 | 加密系统 | 插件级加密不需要 |
| P2 - 可以移除 | 编辑历史 | MCP 写数据不走编辑路径 |
| P3 - 评估后移除 | Web 搜索 | 确认教学场景确实不需要再移除 |

---

## 六、预期收益

| 指标 | 裁剪前（估算） | 裁剪后（估算） |
|------|---------------|---------------|
| 源文件数 | ~120+ | ~40-50 |
| 设置面板区块 | 18 个 | 5 个 |
| 可选依赖 | 3 个 | 0 个 |
| 维护复杂度 | 高（需跟踪上游所有功能） | 低（只关注核心链路） |
| 编译产物大小 | 较大 | 显著减小 |
