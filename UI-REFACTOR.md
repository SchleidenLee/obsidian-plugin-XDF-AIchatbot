# XDF AI Chat UI 改造方案

## 状态：📋 待改造（最复杂）

## 现状问题

- ❌ 没有 Banner
- ❌ 17 个子模块全部平铺（用 `SettingDefinitionItem`）
- ❌ 没有版本/作者信息
- ✅ 已经有分组概念（但全是平铺）

## 改造方案

### 1. 添加 Banner

```html
<div class="xdf-banner">
  <div class="xdf-banner-icon">🤖</div>
  <div>
    <h1 class="xdf-banner-title">XDF AI Chat</h1>
    <p class="xdf-banner-desc">基于 LLM 的教学档案 Agent</p>
  </div>
</div>
```

### 2. 调整设置分区

**首页（高频设置）：**
- API Provider（选择提供商）
- Base URL
- API Key
- 模型选择

**高级设置（折叠区）：**
- 凭证存储
- CLI
- 本地 LLM
- 代理
- 工作区
- 聊天
- 知识库
- 编辑历史
- 加密
- Langfuse
- 斜杠命令
- 技能
- 外部技能
- Agent 插件
- RAG
- MCP 服务器
- Discord

### 3. 添加 Footer

```html
<div class="xdf-footer">
  <span class="xdf-version">v0.1.2</span>
  <span class="xdf-author">· Schleiden</span>
</div>
```

## 改动文件

- `src/ui/SettingsTab.tsx` — 添加 Banner/Footer，调整 `getSettingDefinitions()` 返回结构
- `src/ui/settings/*.tsx` — 把 13 个低频子模块移到高级设置折叠区

## 预估工作量

- Banner/Footer：~20 行 HTML
- 设置分区调整：~50 行（把 13 个 `displayXxxSettings` 调用移到折叠区）
- 这是最复杂的改造，建议最后做
