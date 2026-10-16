# PENDING — XDF AI Chat

> 待办清单。分区：**⚪ 待定**（方案未定）/ **🟡 已定待做**（方案已定，等动手）/ **🟢 进行中**。
> 完成一项后：从本文件**删除**该条 → 在 [DEVLOG.md](./DEVLOG.md) 追加一行 → 现状变了就更新 [ARCHITECTURE.md](./ARCHITECTURE.md)。

> 注：本文件由原 `PENDING`（无扩展名，「系统提示词重构」）、`UI-REFACTOR.md`、`OPTIMIZATION-ANALYSIS.md`、`HARNESS-COMPARISON.md` 合并迁移而来。其中已完成项（新建 `src/core/systemPrompt.ts`、`PROTECTED_CONTRACT`、`types/index.ts` 默认提示词改写、`Chat.tsx` 的 API Provider 与 Gemini 两条路径接入 `buildSystemPrompt()`、提示词预设选择功能）已迁入 [DEVLOG.md](./DEVLOG.md)；`HARNESS-COMPARISON.md` 的根因分析已作为「系统提示词重构」条目迁入 DEVLOG。仅未完成部分保留在下文 B。
> 注：下方「代码审查整改」的行号基准为 **2026-10-04** 的源码快照，动手时以实际代码为准。

---

## 🟢 进行中

（无）

---

## 🟡 已定待做

### A. 代码审查整改（2026-10-04）

> 来源：一次针对 `obsidian-plugin-XDF-AIchatbot/src` 的静态代码审查，逐条对照真实源码核对文件与行号后整理。按严重级别排列：严重（可利用 / 可致主线程冻结）→ 高 → 中/低。

#### 严重

- [ ] **CLI Provider 命令注入（`shell:true` + 历史拼接进 argv）** — [cliProvider.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/cliProvider.ts#L211-L211)（211, 249, 397, 468, 574-596, 975, 727-728, 1132）
  - 现象：Windows 下多处 PATH 回退使用 `shell: true`——`resolveWindowsCustomPath` 对 `.cmd/.bat/未知扩展` 返回 `shell:true`（211），Antigravity PATH 回退（249）、Claude PATH 回退 `return { command: "claude", args, shell: true }`（397）、Codex PATH 回退（468）。同时 `formatHistoryAsPrompt`（574-596）把系统提示 + 全部消息历史拼成字符串，Claude 首轮经 `-p prompt` 放进 argv（975，prompt 来自 727-728/976）、Antigravity 经 `--print` 放进 argv（727-728）。
  - 影响：只要历史/系统提示中含 `& | > < ^ %VAR%` 等 cmd.exe 元字符，就会被二次解释，导致任意命令执行（用户内容或网页/工具返回值即可注入）。
  - 修复方向：默认 `shell: false` 并对 `.cmd/.bat` 显式经 `cmd.exe /d /s /c` 且只允许固定命令名；或改为写入 stdin/临时文件传递 prompt，彻底避免把不可信文本放进 argv；对 `shell:true` 分支的命令与参数做转义/白名单校验。

- [ ] **沙箱同步死循环冻结主线程（超时回调无法触发）** — [sandboxExecutor.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/sandboxExecutor.ts#L49-L49)（49, 128-134）
  - 现象：沙箱 iframe 内用 `new Function('input', code)` 同步执行模型提供的代码（49）；父窗口用 `window.setTimeout` 实现超时（128-134）。
  - 影响：代码进入同步死循环时，iframe 与父窗口共享同一主线程事件循环，超时回调永远不会被调度，Promise 永不 settle——整个 Obsidian 界面冻结。
  - 修复方向：迁移到 Web Worker（可 terminate）或独立进程；至少对同步执行施加指令级/CPU 预算限制；补充测试。

- [ ] **任意绝对路径文件读取（无白名单/根目录限制）** — [localRagStore.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/localRagStore.ts#L1034-L1034)（1034, 1045, 1205-1210）
  - 现象：`loadRagMediaAttachments` 判断 `isAbsolute`（1034）后直接 `fs.promises.readFile(ref.filePath)`（1045）；`extractPdfPagesAttachment` 同样在 1205 判定绝对路径后 `fs.promises.readFile(filePath)`（1210）。
  - 影响：`filePath` 若可被模型/外部 RAG 索引/配置影响，等于开放任意本机文件读取（如私钥、凭据），继承 Node 权限。
  - 修复方向：读取前校验路径位于允许的根目录白名单内（`path.resolve` + 前缀判断，防 `..` 逃逸与符号链接），非白名单拒绝并记录。

- [ ] **`decryptData` 对畸形输入无边界校验** — [crypto.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/crypto.ts#L181-L184)（181-184）
  - 现象：从 base64 解出的 `combined` 直接取 `combined[0]<<8 | combined[1]` 得到 `keyLength`，随后 `slice` 切分 AES key/IV/data，未校验最小长度、`keyLength` 合理性或剩余字节是否充足。
  - 影响：畸形/截断输入产生越界或空切片，后续 `crypto.subtle.decrypt` 抛底层异常；边界处可能被用于探测行为差异。
  - 修复方向：解密前校验 `combined.length` 最小值、`keyLength` 范围及切片长度，非法即抛明确错误。

#### 高

- [ ] **SSRF：代理/Node fetch 不拦截内网、环回与云元数据地址** — [proxyFetch.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/proxyFetch.ts#L100-L110)（100-110, 131-242, 252-403）
  - 现象：`createNodeFetch`（131-242）直接用 Node `http/https` 按 URL 请求；`createProxyFetch`（252-403）经 CONNECT 隧道转发；`shouldBypass`（100-110）只做代理绕过匹配，均无对目标地址的私网/环回/元数据过滤。
  - 影响：模型可控 URL 时可访问 `127.0.0.1`、`169.254.169.254`、内网段等，形成 SSRF。
  - 修复方向：请求前解析主机（含 DNS 解析后 IP）并拒绝环回/私有/链路本地/元数据网段，限制协议与端口，必要时校验重定向目标。

- [ ] **工具参数解析失败静默置空对象** — [openaiProvider.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/openaiProvider.ts#L256-L256)（256, 634, 675, 869, 905, 966）；[gemini.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/gemini.ts#L1521-L1521)（1521）
  - 现象：`parseToolArguments`（256）解析失败返回 `null`，调用处一律 `?? {}`（634/675/905/966）静默变空参数；流式累积时 `existing.arguments += ...` 未同步补 `name`（869）；gemini 对 `argsBuffer` 直接 `JSON.parse`（1521），失败回落 `startArgs`。
  - 影响：解析失败被伪装成「无参数调用」，错误工具以空参执行，既难诊断又可能触发破坏性操作。
  - 修复方向：解析失败应作为工具调用错误上报（含原始字符串与原因），不要回落空对象；累积分支补齐 `name`/`id`。

- [ ] **MCP stdio 读取缓冲无上限** — [mcpStdioClient.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/mcpStdioClient.ts#L381-L388)（381-388）
  - 现象：`handleData` 用 `Buffer.concat([this.readBuffer, data])` 无限累积（382），未见分帧失败或超长数据的上限保护。
  - 影响：对端发送无换行/超长数据或异常分帧时缓冲持续增长，内存膨胀甚至 OOM。
  - 修复方向：设置读取缓冲上限与分帧超时，超限即关闭连接并报错。

- [ ] **子进程继承全部环境变量且超时只杀直接进程** — [scriptRunner.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/scriptRunner.ts#L73-L81)（73-81, 95-106）；[mcpStdioClient.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/mcpStdioClient.ts#L236-L246)（236-246）
  - 现象：`scriptRunner` spawn 时 `env: { ...process.env, ...env }`（77-80），超时用 `proc.kill()`（98）仅杀直接子进程；`mcpStdioClient` 同样 `{ ...process.env, ...this.config.env }`（236-238）。
  - 影响：子进程可获得宿主全部环境变量（含令牌等敏感值）；超时后其派生的孙进程可能残留，形成孤儿进程。
  - 修复方向：改白名单式 env 传递；超时/中止时按进程树终止（Windows `taskkill /T` 或等价手段）。

- [ ] **RAG 全量向量线性扫描** — [localRagStore.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/localRagStore.ts#L605-L620)（605-620, 931）
  - 现象：`search` 逐条遍历全部索引向量并逐个计算 `cosineSimilarity`（605-620），相似度函数为纯 JS 循环（931 起）。
  - 影响：向量规模增大时查询耗时线性上升，主线程卡顿。
  - 修复方向：引入近似最近邻索引（HNSW/IVF）或移出主线程；至少做批量/分块与提前剪枝。

- [ ] **`EventEmitter.emit` 未隔离监听器异常** — [EventEmitter.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/utils/EventEmitter.ts#L38-L47)（38-47）
  - 现象：`emit` 在 `for (const listener of [...listeners]) listener(...args)`（43-45）中直接同步调用，无 try/catch。
  - 影响：任一监听器抛错会中断后续监听器，并冒泡到 emit 调用点，破坏跨组件事件链。
  - 修复方向：逐个监听器包裹 try/catch，隔离并记录异常，保证其余监听器继续执行。

#### 中/低

- [ ] **PBKDF2 迭代次数偏低** — [crypto.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/crypto.ts#L55-L55)（55）：`iterations: 100000`。→ 提升至 OWASP 推荐量级（如 ≥ 600000），保留版本协商兼容历史密文。
- [ ] **`arrayBufferToBase64` O(n²) 拼接且重复实现** — [crypto.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/crypto.ts#L400-L407)（400-407）；[localRagStore.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/localRagStore.ts#L146-L146)（146）。→ 改分块 `String.fromCharCode(...subarray)`/`Buffer.toString("base64")`，抽为共享工具。
- [ ] **`pathAccess.ts` 路径校验不完整** — [pathAccess.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/pathAccess.ts#L1-L13)（1-13）：`isUnsafePath` 未先 `decodeURIComponent`，漏判 `C:relative` 等形态。→ 校验前先解码（并处理解码失败），补充盘符相对路径与 UNC，必要时对最终解析路径再判定。
- [ ] **`workspaceStateManager` 对 `sourceRagSettings` 缺 undefined 防御** — [workspaceStateManager.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/workspaceStateManager.ts#L299-L303)（299-303, 317-319, 341-345）。→ 读取前统一 `Array.isArray(...) ? ... : []`，加载/迁移时补默认值。
- [ ] **Gemini Deep Research 30 分钟长轮询** — [gemini.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/gemini.ts#L1928-L2006)（1928-2006）：`maxPolls = 180`、约 10s 间隔。→ 改事件/回调或指数退避轮询，保证可取消并对超时给明确结果。
- [ ] **超大文件建议拆分** — [Chat.tsx](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/ui/components/Chat.tsx)（约 4600+ 行）、[gemini.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/gemini.ts)（约 1900+ 行）。→ 按职责拆分为多个模块。
- [ ] **魔法数分散** — 多处（如 [sandboxExecutor.ts:15](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/sandboxExecutor.ts#L15-L15) 的 `10_000`、[gemini.ts:1953](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/gemini.ts#L1953-L1953) 的 `maxPolls`、轮询间隔等）。→ 集中到常量模块并命名导出。
- [ ] **`buildSdkFetch` 等重复实现** — [openaiProvider.ts:39](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/openaiProvider.ts#L39-L39)；[anthropicProvider.ts:19](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/anthropicProvider.ts#L19-L19)。→ 抽取为共享工具函数。

#### 设计如此 / 非问题

- `thinkTagParser` 解析 ` thinking...<｜end▁of▁thinking｜>` 属模型自由推理文本，本身无法结构化，**保留现有实现**（结构化的明确例外，见 C），仅需补边界测试（跨 chunk 标签切分、部分前缀匹配、未闭合标签、连续标签）。
- 上游保留的大体量模块（Workflow / RAG / Discord / Skills / OKF 等）并非缺陷，是否裁剪见 E。

### B. 系统提示词重构后续待办

- [ ] **CLI / Local LLM 路径接入 `buildSystemPrompt()`** — 目前 [Chat.tsx](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/ui/components/Chat.tsx#L3128-L3128) 仅 API Provider（L3128）与 Gemini（L4033）两条路径改用 `buildSystemPrompt()`；CLI 路径（有较多特有逻辑）、Local LLM 路径（有 marker mode 分支）仍走旧逻辑，XDF 不常用，优先级低。
- [ ] 可选：测试实际对话效果，验证幻觉是否减少。
- [ ] 可选：添加工具结果裁剪（超过阈值截断，防止上下文膨胀）。
- [ ] 可选：添加工具输入容错（自动修正类型不匹配，防止工具调用失败后模型放弃）。

### C. 结构化输出改造（建议）

> 原则：**凡「模型可控、且需要被程序解析」的输出，应优先走原生结构化输出通道**，而不是让模型生成自由文本后再用正则/`JSON.parse` 猜测。自由文本解析脆弱、易受提示注入与格式漂移影响；原生结构化通道由协议层保证形状。

- [ ] 工具调用参数：依赖 provider 的原生 tool calling / function calling，参数由协议保证为结构化对象；解析失败按错误上报而非静默置空（对应 A·高「工具参数解析失败静默置空」）。
- [ ] 网页 HTML 锚点正则解析：[gemini.ts:197](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/gemini.ts#L197-L197)（`anchorPattern` 抓 `<a href>`）→ 改用带结构化结果的搜索工具输出，避免正则解析。
- [ ] 其他「文本里塞 JSON 再 parse」的路径：统一改为 `responseSchema`（Gemini）/ `response_format`·`json_schema`（OpenAI 兼容）等结构化通道。
- [ ] **例外**：[thinkTagParser.ts](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/core/thinkTagParser.ts) 解析 ` thinking...` 属模型自由推理文本，无法结构化，**保留现有实现**，仅补边界测试。

### D. 设置页 UI 改造（来自 `UI-REFACTOR.md`，📋 待改造，最复杂）

现状问题：无 Banner；17 个子模块全平铺（`SettingDefinitionItem`）；无版本/作者信息；已有分组概念但全平铺。

- [ ] **添加 Banner**：图标 `🤖` + 标题 `XDF AI Chat` + 副标题 `基于 LLM 的教学档案 Agent`。
- [ ] **调整设置分区**：首页放高频项（API Provider、Base URL、API Key、模型选择）；把其余 13 个低频子模块（凭证存储、CLI、本地 LLM、代理、工作区、聊天、知识库、编辑历史、加密、Langfuse、斜杠命令、技能、外部技能、Agent 插件、RAG、MCP 服务器、Discord）移入「高级设置」折叠区。
- [ ] **添加 Footer**：版本号 + 作者（`Schleiden`）。
- 改动文件：[SettingsTab.tsx](file:///x:/AI/projects/XDF-obsidian-system/obsidian-plugin/obsidian-plugin-XDF-AIchatbot/src/ui/SettingsTab.tsx)（Banner/Footer + 调整 `getSettingDefinitions()` 返回结构）、`src/ui/settings/*.tsx`（把 13 个 `displayXxxSettings` 调用移到折叠区）。
- 预估工作量：Banner/Footer ~20 行；分区调整 ~50 行。建议最后做。

### E. 模块裁剪（来自 `OPTIMIZATION-ANALYSIS.md`）

> 基于上游 obsidian-llm-hub 的功能审计。XDF 场景只需一条核心链路：`聊天界面 → 系统提示词 → MCP (xdf-toolkits) → API 提供商 (NewAPI)`。

**建议移除的 13 类模块：**

| # | 模块 | 主要文件 | 移除理由 |
|---|------|----------|----------|
| 1 | Discord 集成 | `core/discordService.ts`、`ui/settings/discordSettings.ts`（+ `integrations/discussionHubCapabilities.ts` 关联） | 与教学管理完全无关，默认即禁用 |
| 2 | Discussion Hub / Dashboard Hub | `integrations/discussionHubCapabilities.ts`、`integrations/dashboardHubCapabilities.ts` | 需外部插件，教学场景不需要 |
| 3 | Workflow 工作流引擎 | `src/workflow/`（20+ 文件）、`ui/workflowCodeBlock.ts`、`plugin/workflowManager.ts`、`plugin/workflowMigration.ts` | 数据操作走 MCP 工具，不需要可视化编排 |
| 4 | Skills 技能系统 | `core/skillsLoader.ts`、`builtinSkills.ts`、`externalSkills.ts`、`runtimeSkills.ts`、`agentPlugins.ts`（+ `ui/settings/skillsSettings.ts` 等、`scripts/generate-builtin-okf.mjs`） | 面向高级用户的扩展系统，XDF 不需要 |
| 5 | OKF 知识库 | `core/okfLoader.ts`、`okfDocumentTool.ts`、`builtinOkf.ts`、`generated/builtinOkfData.ts`（+ `ui/settings/knowledgeSettings.ts`） | 内置的是上游帮助文档，XDF 知识经 MCP 提供 |
| 6 | RAG 语义搜索 | `core/localRagStore.ts`、`localRagStorage.ts`、`ragSearchTool.ts`、`embeddingProvider.ts`、`pdfJs.ts`、`pdfInputMode.ts`（+ `ui/settings/ragSettings.ts`） | 数据查询走 MCP 工具，不需要本地向量索引 |
| 7 | Langfuse 可观测性 | `tracing/langfuse.ts`、`langfuse-noop.ts`、`core/tracingHooks.ts`（+ `ui/settings/langfuseSettings.ts`） | 开发者调试工具 |
| 8 | Codex Vault MCP Bridge | `core/codexVaultMcpBridge.ts` | XDF 不使用 Codex CLI |
| 9 | CLI 终端视图 | `ui/CliTerminalView.ts`、`ui/components/CliTerminalPanel.tsx`（关联 `core/cliProvider.ts`、`ui/settings/cliSettings.ts`、`CliPathModal.ts`；可选依赖 `node-pty`/`@xterm/xterm`/`@xterm/addon-fit` 可移除） | 面向开发者的高级功能 |
| 10 | 编辑历史 | `core/editHistory.ts`、`editHistoryStore.ts`、`diffUtils.ts`（+ `ui/settings/editHistorySettings.ts`） | AI 主要通过 MCP 写数据，不走笔记编辑路径 |
| 11 | 加密系统 | `core/crypto.ts`、`cryptoCache.ts`、`credentialBundle.ts`、`secretStorage.ts`、`plugin/encryptionManager.ts`（+ `ui/settings/encryptionSettings.ts`、`credentialStorageSettings.ts`、`ui/CryptView.tsx`、`passwordPrompt.ts`） | 数据敏感性由系统层处理 |
| 12 | Web 搜索 | `core/webSearch.ts`（+ InputArea 搜索选择器 UI） | 教学助手不需要联网搜索 |
| 13 | CLI 提供商 | `core/cliProvider.ts` | 面向开发者，XDF 通过 API 调用模型 |

**移除后 `package.json` 可清理的依赖：** `@anthropic-ai/sdk`（若不用 Anthropic 直连）、`pdf-lib`、`node-pty`、`@xterm/xterm`、`@xterm/addon-fit`、`langfuse`。

**保留的核心功能：** 聊天核心（`ui/ChatView.tsx`、`ui/components/Chat.tsx`、`InputArea.tsx`）、MCP 客户端（`core/mcpClient.ts`、`mcpTools.ts`、`mcpStdioClient.ts`）、XDF 自动绑定（`src/xdf/bindToolkits.ts`）、Vault 工具（`core/tools.ts`、`src/vault/`）、OpenAI 兼容 API（`core/openaiProvider.ts`）、模型流式（`core/modelStreaming.ts`）、代理（`core/proxyFetch.ts`）、斜杠命令（`ui/settings/slashCommandSettings.ts`）、Mermaid（`ui/mermaidRender.ts`）、国际化（`src/i18n/`，只留 zh/en）、类型（`types/index.ts`）、插件主类（`plugin.ts`/`main.ts`）。

**建议新增/强化的功能：**

- [ ] **预置教学斜杠命令**（当前默认只有 `infographic`）：`/反馈`（生成某学员课后反馈）、`/点名`（查看某班级今日出勤）、`/课程总结`（总结今日课程内容）、`/学员分析`（分析某学员学习情况）、`/建档`（为某学员创建教学档案）。
- [ ] **精简设置面板至 5 区块**（详见 D）：① API 提供商（默认已配 NewAPI，可折叠）② 工作区设置（系统提示词、工具限制）③ MCP 服务器（含 XDF 自动绑定开关）④ 斜杠命令 ⑤ 代理设置（可选）。
- [ ] 其他可选：系统提示词加入反馈格式模板与教学场景引导；聊天界面预置模板（课后反馈/学员分析/课程总结）；模型选择只展示 NewAPI 提供模型、隐藏多余 provider。

**裁剪优先级：**

| 优先级 | 模块 | 原因 |
|--------|------|------|
| P0 立即移除 | Discord、Discussion Hub、Dashboard Hub | 完全无关，零风险 |
| P0 立即移除 | Langfuse、Codex Bridge | 开发者工具，零风险 |
| P1 尽快移除 | Workflow 工作流引擎 | 代码量大（20+ 文件），复杂度高 |
| P1 尽快移除 | RAG 语义搜索 | 代码量大，XDF 用 MCP 替代 |
| P1 尽快移除 | Skills 技能系统 + OKF | 扩展系统，XDF 不需要 |
| P2 可以移除 | CLI 终端 + CLI 提供商 | 面向开发者 |
| P2 可以移除 | 加密系统 | 插件级加密不需要 |
| P2 可以移除 | 编辑历史 | MCP 写数据不走编辑路径 |
| P3 评估后移除 | Web 搜索 | 确认教学场景确实不需要再移除 |

---

## ⚪ 待定

（无）
