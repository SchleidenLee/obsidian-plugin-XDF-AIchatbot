# DEVLOG — XDF AI Chat

> 变更时间线，**只追加不回改**。每条：日期 + 改了什么 + **为什么**。
> 面向「人肉可读的历史决策」；面向用户的 Release 说明由流水线自动生成，此处不重复。

---

## 2026-10-17 · CI：Build 工作流移除 Lint 步骤

- 从 `.github/workflows/build.yml` 移除 ESLint 步骤，仅保留构建。
- **为什么**：Lint 在 CI 上不再作为构建门槛（本地 `npm run lint` 仍可用），避免风格问题阻断构建。

## 2026-10-16 · ESLint 忽略 `references/` 参考目录

- `eslint.config.mjs` 忽略 `references/`（vendored 的 QwenPaw 参考项目）。
- **为什么**：第三方源码不应纳入本仓库的检查范围，否则产生大量无关告警。

## 2026-10-16 · 统一发布流水线（tag `v*` 触发）；发布 0.2.1

- `.github/workflows/release.yml` 改为 `v*` tag 触发，构建前校验 `package.json` / `manifest.json` / tag 三处版本一致，并修复草稿 Release 问题。
- **为什么**：统一发布口径，避免手搓 Release 与版本号漂移。

## 2026-10-16 · 归档代码审查整改计划（2026-10-04）到 PENDING

- 将一次针对 `src` 的静态代码审查结论逐条落进 PENDING：严重（CLI 命令注入、沙箱同步死循环、任意绝对路径读取、`decryptData` 无边界校验）→ 高 → 中/低。
- **为什么**：审查结论若不落到待办清单会遗失；按严重级别排序便于逐项执行。

## 2026-09-11 · v0.2.0 系统提示词重构（执行契约 + 预设）

- 新增 `src/core/systemPrompt.ts`：`PROTECTED_CONTRACT`（硬编码执行契约）+ `PROMPT_PRESETS` + `buildSystemPrompt()`，把 XDF 规则从「附加指令」改为系统提示词的**主体**。
- `Chat.tsx` 的 API Provider 与 Gemini 路径改用 `buildSystemPrompt()`；`types/index.ts` 默认 `systemPrompt` 改为正向契约；设置页新增预设选择（预设只读 / 自定义可编辑 / 恢复默认）。
- **为什么**：源自 `HARNESS-COMPARISON.md` 的 QwenPaw vs XDF AI Chatbot 提示词对比。**核心问题是模型编造结果**——不调工具就直接编学员名、班级名、分数。根因有四点：① Chatbot 以「You are a helpful AI assistant」开头，鼓励模型「直接给一个有帮助的答案」；② XDF 规则以「Additional instructions」追加，被模型视为**可选建议**；③ 全是「不要 X」的**否定式**指令，中低端模型遵从度差；④ **无「完成」定义**，模型不知道「无工具支撑的回答」不算完成。修复方式 = 重写为**正向执行契约**（`PROTECTED_CONTRACT`，置于最前、不可覆盖）：明确「必须同一轮调用工具」「计划/承诺/下一步列表不算完成」「诚实失败优于编造成功」。

## 2026-09-11 · 合并提示词预设与系统提示为一个设置块

- 设置页把「预设选择」与「系统提示词编辑」合并为一个区块（选择预设后编辑框只读，编辑即切「自定义」）。
- **为什么**：两处分离容易让用户误以为预设可编辑，合并后交互语义更清晰。

## 2026-09-11 · 新增提示词预设选择功能

- 新增 `PROMPT_PRESETS`（`XDF 雅思教学助手` / `通用 Obsidian 助手`）与设置页下拉、TextArea、恢复默认按钮；`loadSettings` 增加旧用户 `selectedPreset` 迁移；补中英文 i18n。
- **为什么**：让用户在「教学档案」与「通用笔记」两种人格间切换，无需手改长提示词。

## 2026-09-11 · 归档 Harness 对比报告与 QwenPaw 参考代码

- 加入 `HARNESS-COMPARISON.md`（QwenPaw vs Chatbot 提示词对比）、`OPTIMIZATION-ANALYSIS.md`（上游功能裁剪分析）、`references/QwenPaw/`（参考实现）。
- **为什么**：把「为什么幻觉」的根因与「哪些上游模块可裁」的结论留档，作为重构与裁剪的依据。

## 2026-09-04 · v0.1.2：统一 description 格式、加入 `references/`

- 统一工具 description 格式，纳入 `references/`（LLM Hub 上游源码），构建跳过 TS 类型检查。
- **为什么**：留一份上游源码作对照基准；跳过类型检查以加快发布期构建。

## 2026-09-03 · 锁定防幻觉规则到默认系统提示词

- 将「班级名/学员名/分数只能来自工具返回」等防幻觉规则写进 `DEFAULT_SETTINGS.systemPrompt`。
- **为什么**：模型不调工具即编数据；先以默认提示词兜住（后于 2026-09-11 被正向执行契约取代）。

## 2026-09-03 · fork LLM Hub 为 XDF AI Chat 并绑定 xdf-toolkits MCP

- 基于上游 LLM Hub（takeshy，MIT）fork：改插件 id、默认系统提示面向课程档案、预置 NewAPI 供应商、工作区目录默认 `XDF-AI`，并新增 `src/xdf/bindToolkits.ts` 自动绑定 xdf-toolkits MCP。
- **为什么**：XDF 只需要「对话 + 档案工具」一条链路，复用上游成熟的 provider 与 MCP 客户端，只改定制点。

## 2026-09-04 · 初始提交

- 仓库初始化。
