# XDF AI Chat

新东方教学档案的 Agent 壳。从 [LLM Hub](https://github.com/takeshy/obsidian-llm-hub)（MIT，作者 takeshy）魔改。

本插件负责对话和模型调用；课务工具在同库的 [XDF Toolkits](https://github.com/SchleidenLee/obsidian-plugin-XDF-tookits)。启用后会自动把 `http://127.0.0.1:27183/mcp`（及 Toolkits 提供的 token）写进 MCP 服务器列表。

## 安装

1. 先装并启用 `xdf-base`、`xdf-toolkits`
2. BRAT：`SchleidenLee/obsidian-plugin-XDF-AIchatbot`  
   或从 Release 放下 `main.js` / `manifest.json` / `styles.css` 到 `.obsidian/plugins/xdf-aichatbot/`
3. 设置里把 NewAPI 的 Key 填进预置的「XDF NewAPI」

## 相对上游改了什么

- 插件 id：`xdf-aichatbot`
- 默认系统提示面向课程档案
- 预置 NewAPI 兼容供应商
- 自动绑定 xdf-toolkits
- 工作区目录默认 `XDF-AI`

工作流、RAG、Discord 等上游功能仍在代码里，第一期不必用。

保留 LLM Hub 的 MIT 与原作者声明。
