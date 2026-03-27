# AI CLI 账户管理

OminiTerm 支持在创建终端时选择和管理多个 AI CLI 账户，包括 Claude、Codex、Gemini、OpenCode 等。

## 快速开始

### 1. 添加账户

1. 打开 OminiTerm。
2. 点击「创建终端」。
3. 选择 AI CLI 类型（如 Claude）。
4. 点击「+ New Account」。
5. 填入账户名称和 API Key。
6. 点击「创建」。

### 2. 选择账户创建终端

1. 选择 AI CLI 类型。
2. 从下拉菜单中选择已有账户。
3. 点击「创建终端」。

### 3. 编辑账户配置

账户编辑器支持：

- 标准模式：预设字段（API Key、Base URL、模型等）。
- 高级模式：JSON 编辑器，支持自定义配置。

## 配置存储

所有账户信息存储在：

- 本地：`~/.ominiterm/ai-config.json`
- 工具特定：
  - Claude：`~/.claude/config.json`
  - Codex：`~/.codex/.codex`
  - Gemini：`~/.gemini/config.json`
  - OpenCode：`~/.opencode/config.json`

## 每个 AI CLI 的配置步骤

### Claude（Anthropic）

1. 获取 API Key：https://console.anthropic.com/apikeys
2. 新增账户，填入 API Key。
3. 可选：设置自定义 Base URL 和模型。

### Codex（OpenAI）

1. 获取 API Key：https://platform.openai.com/api-keys
2. 新增账户，填入 API Key。
3. 指定模型（默认 gpt-4）。

### Gemini（Google）

1. 获取 API Key：https://ai.google.dev/
2. 新增账户，填入 API Key。
3. 选择模型（如 gemini-2.0-flash）。

### OpenCode

1. 获取 API Key 或 Token。
2. 新增账户，填入密钥。
3. 可选：配置 Base URL。

## 常见问题

**Q：如何修改已有账户？**
A：在账户列表中选中账户后，可使用标准模式或高级 JSON 模式编辑。

**Q：支持多少个账户？**
A：无数量限制。每个 AI CLI 类型可添加多个账户。

**Q：如何删除账户？**
A：选中账户后，点击删除按钮（位于账户编辑面板）。

**Q：配置会被加密或备份吗？**
A：配置以纯文本形式存储。出于安全考虑，建议定期备份 `~/.ominiterm/` 目录。

## 隐私和安全

- 所有 API Key 和敏感信息存储在本地。
- OminiTerm 不上传或收集任何配置数据。
- 建议定期检查 `~/.ominiterm/ai-config.json` 的文件权限和备份策略。
