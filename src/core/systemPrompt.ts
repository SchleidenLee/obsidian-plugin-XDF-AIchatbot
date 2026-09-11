/**
 * 系统提示词构建模块
 * 
 * 参考 QwenPaw 的分层架构：
 * 1. 硬编码执行契约（PROTECTED_CONTRACT）- 不可被用户修改
 * 2. 用户选择的预设或自定义提示词（settings.systemPrompt）
 * 3. 运行时上下文（FILE_MENTION、OKF、RAG、Skills 等）
 */

/**
 * 硬编码执行契约 - 永远在系统提示词最前面，不可被用户覆盖
 * 
 * 这是防止模型幻觉的核心机制：
 * - 正向指令告诉模型"必须做什么"，而非"不要做什么"
 * - 明确定义"完成标准"，防止模型以承诺代替行动
 * - 要求工具调用必须在同一轮响应中执行
 */
export const PROTECTED_CONTRACT = `## 工具调用规则

你有可用的工具。需要查询、创建、修改数据时，必须在同一轮响应中调用工具。
用工具返回的真实数据回答，不用自己的记忆。

只使用当前可用的工具。如果工具不可用或调用失败，诚实告知用户，不要编造工具结果。

## 完成标准

回答必须有真实工具输出支撑。计划、承诺、下一步列表不算完成。

工具失败或不可用时，直接告知用户。诚实报告失败优于编造成功。
绝不编造工具返回的数据。

## 工具调用纪律

说要查询/创建/修改某物时，必须在同一轮响应中调用工具。
不要以"接下来我会..."结束而不调用工具。
每次需要数据时调用工具获取，不依赖对话记忆中的旧数据。

## 能力边界

你只能通过工具完成操作。没有对应工具的事情，你无法做到。
如果用户要求的功能没有对应工具，直接说明无法完成，不要假装可以做到。`;

/**
 * 提示词预设定义
 */
export interface PromptPreset {
	id: string;
	name: string;
	description: string;
	prompt: string;
}

/**
 * 内置提示词预设列表
 */
export const PROMPT_PRESETS: PromptPreset[] = [
	{
		id: "xdf-teaching",
		name: "XDF 雅思教学助手",
		description: "新东方雅思教学档案场景，自动连接 xdf-toolkits 查询学员、班级、课次等数据",
		prompt: `你是新东方雅思教学助手，当前库是固定结构的课程档案。

## 数据来源限制

班级名、学员名、课次号、日期、出勤、作业、分数只能来自 xdf-toolkits 工具返回的 JSON。
工具没返回的数据视为不存在。

不要用 search_notes 或聊天记录代替档案查询。

## 写入规则

写反馈、勾选、建档只用 MCP 的 write_* / create_*。
不要破坏 <!-- AI_GENERATED_START/END --> 标记。

结班测 OCR 不在本插件。`,
	},
	{
		id: "general",
		name: "通用 Obsidian 助手",
		description: "通用的 Obsidian 笔记管理助手，适合日常笔记整理和知识管理",
		prompt: `你是一个 Obsidian 笔记管理助手。

## 工作原则

- 帮助用户整理、搜索、管理笔记
- 创建笔记时遵循良好的 Markdown 格式
- 修改笔记前先读取现有内容
- 使用 wikilink [[]] 建立笔记间的关联

## 注意事项

- 不要修改用户没有提到的笔记
- 批量操作前确认用户意图`,
	},
];

/**
 * 根据预设 ID 获取预设
 */
export function getPresetById(id: string): PromptPreset | undefined {
	return PROMPT_PRESETS.find(p => p.id === id);
}

/**
 * 运行时上下文参数
 */
export interface SystemPromptContext {
	/** 是否启用 Vault 工具（非 "none" 时注入 FILE_MENTION_TOOL_PROMPT） */
	vaultToolMode: string;
	/** 路径特有上下文（CLI 模式说明、Local LLM 工具说明等） */
	pathContext?: string;
	/** OKF 知识库上下文 */
	okfContext?: string;
	/** RAG 搜索上下文 */
	ragContext?: string;
	/** Skills 技能提示 */
	skillsContext?: string;
	/** NoDiscovery 提示（vaultToolMode 为 "noSearch" 时） */
	noDiscoveryContext?: string;
	/** RAG 搜索工具提示 */
	ragSearchContext?: string;
}

/**
 * Vault 文件提及工具提示
 * 当用户通过 @ 提及文件时，告诉模型需要先读取文件内容
 */
export const FILE_MENTION_TOOL_PROMPT = `\n\nA bare vault-relative path in the user's message (for example \`folder/note.md\` or \`folder/document.pdf\`) is a file the user referenced by mention, not a literal string. Its content is not inlined into the message. Call read_note with that exact path before answering anything that depends on it.`;

/**
 * 构建完整的系统提示词
 * 
 * @param userPrompt - 用户自定义提示词（settings.systemPrompt）
 * @param context - 运行时上下文
 * @returns 完整的系统提示词字符串
 */
export function buildSystemPrompt(
	userPrompt: string,
	context: SystemPromptContext
): string {
	const parts: string[] = [];

	// 第 1 层：硬编码执行契约（永远在最前面）
	parts.push(PROTECTED_CONTRACT);

	// 第 2 层：路径特有上下文（CLI 模式说明、Local LLM 工具说明等）
	if (context.pathContext?.trim()) {
		parts.push(context.pathContext.trim());
	}

	// 第 3 层：用户自定义提示词
	if (userPrompt?.trim()) {
		parts.push(userPrompt.trim());
	}

	// 第 4 层：运行时上下文
	if (context.vaultToolMode !== "none") {
		parts.push(FILE_MENTION_TOOL_PROMPT.trim());
	}

	if (context.okfContext) {
		parts.push(context.okfContext.trim());
	}

	if (context.ragContext) {
		parts.push(context.ragContext.trim());
	}

	if (context.skillsContext) {
		parts.push(context.skillsContext.trim());
	}

	if (context.noDiscoveryContext) {
		parts.push(context.noDiscoveryContext.trim());
	}

	if (context.ragSearchContext) {
		parts.push(context.ragSearchContext.trim());
	}

	return parts.join("\n\n");
}
