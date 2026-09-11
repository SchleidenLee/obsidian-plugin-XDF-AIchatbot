# Harness 对比分析：QwenPaw vs XDF AI Chatbot

> 核心问题：同一模型（qwen-plus），QwenPaw 不幻觉，Chatbot 编造结果。

---

## 一、核心问题：模型编造结果

模型不调用工具，直接在文本中编造学员名、班级名、分数等数据，假装来自工具返回。

---

## 二、根因定位：系统提示词结构对比

### 2.1 Chatbot 实际发送给模型的系统提示词

通过代码分析（`Chat.tsx` 第 3006-3014 行），最终发送给模型的 system message 是：

```
You are a helpful AI assistant in an Obsidian vault.
Always be helpful and provide clear, concise responses. When working with notes, 
confirm actions and provide relevant feedback.

[FILE_MENTION_TOOL_PROMPT]

Additional instructions: 你是新东方雅思教学助手，当前库是固定结构的课程档案。

防幻觉（必须遵守）：
- 班级名、学员名、课次号、日期、出勤、作业、分数只能来自 xdf-toolkits 工具返回的 JSON。
  工具没返回的一律当作不存在。
- 禁止用嘴假装已调用工具。没有工具结果卡片就等于没查到。
- 工具报错或空列表时，原样告诉老师「查不到 / 工具失败」，不要编学号、人名、班课。
- 不要用 search_notes 或聊天记录代替档案查询。
- 写反馈、勾选、建档只用 MCP 的 write_* / create_*；不要破坏 <!-- AI_GENERATED_START/END -->。
- 结班测 OCR 不在本插件。
```

### 2.2 QwenPaw 实际发送给模型的系统提示词

通过代码分析（`protected_prompt.py`），QwenPaw 的 system message 以这段"受保护执行契约"**开头**：

```
# Protected execution contract

## Match the request
- Answer, explain, review, plan, or report status: inspect and respond; do not implement 
  the change under discussion or act externally unless asked.
- Diagnose: find and explain the cause; fix it only if asked.
- Change, build, run, or verify: use tools and deliver a real result.

## Finishing the job
For build, change, run, or verification work, deliver the requested result **backed by 
real tool output, not a description**. A classification, plan, stub, progress update, 
promise, partial result, or next-step list is not completion.

If a tool, install, or network call fails, say so and try a safe alternative. 
**Never invent files, data, API responses, or tool output.** 
An honest blocker is better than a fabricated success.

## Tool-use enforcement
When a tool can perform an action, **use it**. If you say you will run, check, create, 
or change something, **call the tool in the same response**. Do not end with a promise 
while a tool can continue the work.

For an action request, each response must make progress with tools, ask all necessary 
questions together, report a genuine blocker, or deliver the final result.
```

### 2.3 关键差异

| 差异点 | Chatbot | QwenPaw | 影响 |
|--------|---------|---------|------|
| **开头** | "You are a **helpful** AI assistant" | "# Protected **execution contract**" | Chatbot 开头鼓励"有帮助"，模型倾向于直接给答案 |
| **XDF 指令位置** | 作为 "**Additional instructions**" 追加 | 执行契约在**最前面**，最高优先级 | "附加指令"被模型视为可选建议 |
| **语言** | 开头英文，规则中文（混合） | 全英文（一致） | 混合语言降低指令遵从度 |
| **正向强制** | 无。只有"禁止 X"、"不要 Y" | "**use it**"、"**call the tool in the same response**" | 告诉模型"必须做什么"比"不要做什么"有效得多 |
| **完成定义** | 无定义 | "A promise, partial result, or next-step list **is not completion**" | 模型不知道什么才算"做完了" |
| **工具调用纪律** | "禁止用嘴假装" | "If you say you will run something, **call the tool in the same response**" | 正向指令更明确 |

---

## 三、为什么 Chatbot 的提示词导致编造

### 问题 1："Be helpful" 开头鼓励直接回答

```
You are a helpful AI assistant...Always be helpful and provide clear, concise responses.
```

这句话告诉模型"要有帮助、给清晰回答"。当用户问"张三的出勤怎么样"时，模型的第一反应是**直接给出一个有帮助的回答**，而不是先调用工具。

QwenPaw 的开头是"Protected execution contract"——告诉模型"你在执行任务"，不是"你在聊天"。

### 问题 2：防幻觉规则是"否定式"而非"肯定式"

Chatbot 的规则：
- "**禁止**用嘴假装"
- "**不要**编学号"
- "**不要**用 search_notes 代替"

QwenPaw 的规则：
- "**use it**"（用工具）
- "**call the tool** in the same response"（在同一轮调用工具）
- "**deliver** the requested result **backed by real tool output**"（用真实工具输出交付结果）

对于 qwen-plus 这种中等规模模型，**正向指令（"必须做 X"）比否定指令（"不要做 Y"）有效得多**。否定指令需要模型先理解"不要做的是什么"，然后在生成时抑制它——这对模型来说更难。

### 问题 3："Additional instructions" 框架削弱了规则

```typescript
systemPrompt += `\n\nAdditional instructions: ${settings.systemPrompt}`;
```

"Additional instructions" 在语义上是"补充说明"，模型会将其视为**可选的附加建议**而非**核心行为约束**。相比之下，QwenPaw 的执行契约是系统提示词的**第一部分**，模型会将其视为最重要的指令。

### 问题 4：没有定义"完成"

Chatbot 没有告诉模型什么才算"完成了任务"。模型不知道"给出一个没有工具结果支撑的回答"是不算完成的。

QwenPaw 明确列出：
> A classification, plan, stub, progress update, **promise**, **partial result**, or **next-step list** is not completion.

---

## 四、修复方案

### 方案：重写系统提示词

修改 `src/types/index.ts` 中的 `systemPrompt`，并修改 `Chat.tsx` 中的提示词构建逻辑。

#### 4.1 修改提示词构建逻辑（`Chat.tsx`）

将 XDF 的系统提示词从 "Additional instructions" 改为系统提示词的**主体**，而不是附加内容：

```typescript
// 修改前（Chat.tsx 第 3006-3014 行）
let systemPrompt = `You are a helpful AI assistant in an Obsidian vault.
Always be helpful and provide clear, concise responses...`;
// ...
if (settings.systemPrompt) {
    systemPrompt += `\n\nAdditional instructions: ${settings.systemPrompt}`;
}

// 修改后
let systemPrompt = settings.systemPrompt || `You are a helpful AI assistant...`;
```

#### 4.2 重写系统提示词内容（`types/index.ts`）

将当前的防幻觉规则替换为正向的执行契约：

```
你是新东方雅思教学助手，当前库是固定结构的课程档案。

## 工具调用规则

你需要查询任何数据（学员、班级、课次、出勤、作业、分数）时，必须在同一轮响应中调用 xdf-toolkits 的 MCP 工具。用工具返回的 JSON 数据回答，不用自己的记忆。

你说要查询/检查/创建/修改某物时，必须在同一轮响应中调用对应工具。不要以"接下来我会查询"结束而不调用工具。

## 完成标准

你的回答必须有真实的工具输出支撑。计划、进度更新、承诺、下一步列表不算完成。

如果工具返回空列表或报错，直接告诉老师"查不到"或"工具失败"。不要编造学号、人名、班课、分数。诚实报告失败优于编造成功。

## 数据来源限制

班级名、学员名、课次号、日期、出勤、作业、分数只能来自 xdf-toolkits 工具返回的 JSON。工具没返回的数据视为不存在。

不要用 search_notes 或聊天记录代替档案查询。

## 写入规则

写反馈、勾选、建档只用 MCP 的 write_* / create_*。不要破坏 <!-- AI_GENERATED_START/END --> 标记。

结班测 OCR 不在本插件。
```

#### 4.3 关键改动说明

| 改动 | 原来 | 现在 | 为什么有效 |
|------|------|------|-----------|
| 去掉 "be helpful" 开头 | "You are a helpful AI assistant" | 直接以角色定义开头 | 避免模型优先"直接给答案" |
| 去掉 "Additional instructions" 框架 | 作为追加内容 | 作为系统提示词主体 | 模型视为主指令而非可选建议 |
| 正向指令替代否定指令 | "禁止用嘴假装" | "必须调用 MCP 工具" | 正向指令对中等模型更有效 |
| 添加完成标准 | 无 | "计划、承诺不算完成" | 模型知道什么才算做完了 |
| 添加工具调用纪律 | 无 | "说要查询就必须在同一轮调用" | 防止"承诺不行动" |
| "诚实失败优于编造成功" | 有类似但较弱 | 明确写出 | 给模型一个"安全出口"——报错是可以的 |

---

## 五、其他辅助改进（次要）

以下改进可以进一步减少幻觉，但不如系统提示词改动关键：

| 改进 | 说明 | 优先级 |
|------|------|--------|
| 精简工具数量 | 将 vaultToolMode 默认设为 "none"，减少工具总数到 15 个以内 | P1 |
| 工具结果裁剪 | 超过 4000 字符的结果截断，防止上下文膨胀 | P1 |
| 工具输入容错 | 自动修正类型不匹配，防止工具调用失败后模型放弃 | P2 |

---

## 六、参考文件

| 文件 | 说明 |
|------|------|
| `references/QwenPaw/src/qwenpaw/runtime/protected_prompt.py` | QwenPaw 执行契约原文 |
| `src/types/index.ts` 第 957 行 | Chatbot 当前 systemPrompt 定义 |
| `src/ui/components/Chat.tsx` 第 3006-3014 行 | 系统提示词构建逻辑 |
| `src/core/openaiProvider.ts` 第 193-201 行 | buildMessages() 函数 |
