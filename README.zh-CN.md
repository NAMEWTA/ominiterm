# OminiTerm

面向 git worktree、本地终端和 AI 编程 Agent 的项目看板式桌面壳层。

当前 `pure-term` 分支已经完成一轮 pnpm monorepo 重构和文档清理。如果你之前看过旧版偏「无限画布」的资料，建议直接从下方开发文档入口重新建立认知，不要再依赖历史截图或旧方案文档。

[English README](./README.md)

## 当前分支快照

- 仓库结构已经收敛为 `apps/desktop`、`apps/website`、`tools/hydra`、`tools/eval`
- 桌面端主界面已经收敛为「项目侧栏 + 项目看板 + 终端详情页 + 右侧栏」
- 核心数据模型是 `Project -> Worktree -> Terminal`
- 随桌面端一起打包的 CLI 只有 `ominiterm` 和 `hydra`
- 当前有效文档已经重建为一套轻量开发文档，统一放在 [`docs/`](./docs/README.md)

## 子项目说明

- `apps/desktop`
  Electron 桌面应用本体，包括 React 渲染层、Electron 主进程、打包时附带的 CLI、技能资源和桌面端测试。
- `apps/website`
  一个独立的 Vite 落地页项目。
- `tools/hydra`
  子 Agent 编排 CLI。负责创建 worktree、在 OminiTerm 中打开终端、写入任务文件并跟踪 Agent 元数据。
- `tools/eval`
  面向单 Agent 与 Hydra 模式的评测框架。
- `supabase`
  认证与用量同步相关的后端配置。

## 当前桌面端能力

- 以项目为核心的工作方式：左侧切项目，中间看板看当前项目全部终端。
- 单终端详情页：需要深入时，进入全页终端视图。
- Composer：向当前聚焦终端统一发消息，支持部分 Agent CLI 的图片粘贴。
- 右侧栏：浏览当前终端所在 worktree 的文件树和 git diff。
- 工作区保存与恢复、自定义终端标题、星标、主题、字体、快捷键。
- 当前内置终端类型：`shell`、`claude`、`codex`、`copilot`、`kimi`、`gemini`、`opencode`、`lazygit`、`tmux`。

## 快速开始

### 环境要求

- Node.js `24.13.0`
- pnpm `10.29.2`
- Git
- Python 3.x（仅当你需要重新生成桌面端图标时）

### 安装与启动

```bash
git clone https://github.com/blueberrycongee/ominiterm.git
cd ominiterm
pnpm install
pnpm dev
```

### 常用命令

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm desktop:package
```

## 命令行与配套工具

### `ominiterm`

桌面端启动后会在本地打开一个 HTTP API Server，`ominiterm` CLI 只是这个 API 的薄封装。它可以做项目增删、终端创建、状态查询、输出读取、diff 查询和状态导出。

### `hydra`

Hydra 会为每个子 Agent 创建独立 worktree，在 OminiTerm 中打开对应终端，把任务写入 worktree 中的任务文件，再把 Agent 元数据写到 `~/.hydra/agents/`。

### Eval

评测工具支持 `single-claude`、`single-codex` 和 `hydra` 三种模式。结果默认写入 `tools/eval/results/<runId>/`。

## 二次开发入口

- [`docs/README.md`](./docs/README.md)
  当前有效文档总览和阅读顺序。
- [`docs/architecture.md`](./docs/architecture.md)
  系统架构、核心数据模型、运行时文件和关键链路。
- [`docs/development.md`](./docs/development.md)
  二次开发命令、验证策略、常见改动入口和扩展方式。
- [`docs/tooling/cli-and-hydra.md`](./docs/tooling/cli-and-hydra.md)
  `ominiterm`、Hydra 与桌面端之间的关系和工作流。
- [`docs/tooling/eval-framework.md`](./docs/tooling/eval-framework.md)
  评测框架的命令、结果目录和扩展点。
- [`AGENTS.md`](./AGENTS.md)
  面向编码代理的仓库级工作说明。

## 当前分支说明

- 历史设计方案、问题复盘和大批归档文档已经在本分支清理出工作树，默认请以 git 历史为准，不要在没有明确需求时把它们整批搬回来。
- 运行时命名已经统一为 `OminiTerm`，包括 `~/.ominiterm`、`ominiterm` CLI 和桌面应用名。
- 代码里仍然保留了认证、用量、额度、更新器、洞察报告等服务，但当前主界面的重心已经是项目看板和右侧文件 / diff 面板。

## 许可证

[MIT](./LICENSE)
