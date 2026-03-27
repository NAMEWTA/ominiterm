# OminiTerm

面向 git worktree、本地终端和 AI 编程 Agent 的项目看板式桌面壳层。

当前工作树只保留仍在维护的桌面端产品线。历史 CLI、Hydra、Eval 工具链以及更早期的画布叙事文档已经从活跃目录移除；如果确实需要，请优先回看 git 历史。

[English README](./README.md)

## 当前分支快照

- 当前有效包只剩 `apps/desktop` 和 `apps/website`
- 桌面端主界面是「项目侧栏 + 项目看板 + 终端详情页 + 右侧栏」
- 核心数据模型是 `Project -> Worktree -> Terminal`
- 当前基线版本是 `0.0.1`
- 当前有效开发文档统一放在 [`docs/`](./docs/README.md)

## 子项目说明

- `apps/desktop`
  Electron 桌面应用本体，包括 React 渲染层、Electron 主进程、preload 桥接和桌面端测试。
- `apps/website`
  一个独立的 Vite 落地页项目。
- `supabase`
  认证与用量同步相关的后端配置。

## 当前桌面端能力

- 以项目为核心的工作方式：左侧切项目，中间看板看当前项目全部终端。
- 单终端详情页：需要深入时，进入全页终端视图。
- Composer：向当前聚焦终端统一发消息，支持部分 Agent CLI 的图片粘贴。
- 右侧栏：浏览当前终端所在 worktree 的文件树和 git diff。
- 工作区保存与恢复、自定义终端标题、星标、主题、字体、快捷键、认证、更新、额度和洞察报告。
- 当前内置终端类型：`shell`、`claude`、`codex`、`copilot`、`kimi`、`gemini`、`opencode`、`lazygit`、`tmux`。

## 快速开始

### 环境要求

- Node.js `24.13.0`
- pnpm `10.29.2`
- Git
- Python 3.x（仅当你需要重新生成桌面端图标时）

### 安装与启动

```bash
git clone https://github.com/NAMEWTA/ominiterm.git
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
pnpm website:build
```

## 二次开发入口

- [`docs/README.md`](./docs/README.md)
  当前有效文档总览和阅读顺序。
- [`docs/architecture.md`](./docs/architecture.md)
  当前包结构、核心数据模型、运行时文件和关键链路。
- [`docs/development.md`](./docs/development.md)
  二次开发命令、验证策略、常见改动入口和扩展方式。
- [`AGENTS.md`](./AGENTS.md)
  面向编码代理的仓库级工作说明。

## 当前分支说明

- 历史设计方案、Hydra/Eval 工具链和大批归档文档已经从工作树移除，默认请以 git 历史为准。
- 运行时命名统一为 `OminiTerm`，包括 `~/.ominiterm` 和桌面应用名。
- 当前主界面的重心是项目看板、终端详情页和右侧文件 / diff 面板。

## 致谢

本项目在实现过程中引用并借鉴了 [blueberrycongee/termcanvas](https://github.com/blueberrycongee/termcanvas) 的思路与实践，感谢原项目及作者。

## 许可证

[MIT](./LICENSE)
