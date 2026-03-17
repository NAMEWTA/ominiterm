<div align="center">

<img src="docs/icon.png" width="128" alt="TermCanvas 应用图标" />

# TermCanvas

**你的终端，铺在无限画布上。**

[![GitHub release](https://img.shields.io/github/v/release/blueberrycongee/termcanvas)](https://github.com/blueberrycongee/termcanvas/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey)]()

</div>

[English](./README.md)

## 什么是 TermCanvas

TermCanvas 把你所有的终端铺在一张无限空间画布上——不再有标签页，不再有分屏。自由拖拽、放大聚焦、缩小俯瞰，还能用手绘工具做标注。

它以 **Project → Worktree → Terminal** 三层结构来组织一切，和你使用 git 的方式完全一致。添加一个项目，TermCanvas 自动检测它的 worktree；在终端里新建一个 worktree，画布上立刻出现。

## 功能特性

**画布**
- 无限画布——自由平移、缩放、排列终端
- 三层层级——项目包含 worktree，worktree 包含终端
- 实时 worktree 检测——新建 worktree 自动出现
- 绘图工具——画笔、文字、矩形、箭头标注
- 工作区存档——将完整布局保存为文件

**AI 编程 Agent**
- 原生支持 Claude Code、Codex、Kimi、Gemini、OpenCode
- 实时会话状态——一眼看到 agent 正在工作、等待还是已完成
- 内联 diff 卡片——不离开画布就能审查 agent 的代码变更

**命令行工具**
- `termcanvas` —— 从终端控制画布：添加项目、创建终端、读取输出、查看 diff
- `hydra` —— 在隔离的 git worktree 中派生 AI 子 agent，然后审查并合并它们的工作

## 快速开始

**下载** —— 从 [GitHub Releases](https://github.com/blueberrycongee/termcanvas/releases) 获取最新构建。

**从源码构建：**

```bash
git clone https://github.com/blueberrycongee/termcanvas.git
cd termcanvas
npm install
npm run dev
```

**安装命令行工具** —— 启动应用后，进入 设置 → 通用 → 命令行工具，点击注册。这会将 `termcanvas` 和 `hydra` 添加到你的 PATH。

## 命令行工具

两个 CLI 都随应用打包。在设置中注册后即可在任意终端使用。

### termcanvas

```bash
termcanvas project add ~/my-repo     # 添加项目到画布
termcanvas project list              # 列出项目
termcanvas terminal create --worktree ~/my-repo --type claude
termcanvas terminal status <id>      # 检查终端状态
termcanvas diff ~/my-repo --summary  # 查看 worktree diff
```

### hydra

Hydra 在隔离的 git worktree 中派生 AI 编程 agent，通过 TermCanvas 管理。

```bash
hydra spawn --task "fix the login bug" --type claude --repo .
hydra list                           # 列出运行中的 agent
hydra cleanup <agent-id>             # 清理 worktree 和终端
hydra init                           # 将 hydra 说明添加到项目 CLAUDE.md
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `⌘ O` | 添加项目 |
| `⌘ B` | 切换侧边栏 |
| `⌘ T` | 新建终端 |
| `⌘ ]` | 下一个终端 |
| `⌘ [` | 上一个终端 |
| `Esc` | 取消聚焦 / 恢复上次聚焦 |
| `⌘ 1` | 终端尺寸：默认 |
| `⌘ 2` | 终端尺寸：宽 |
| `⌘ 3` | 终端尺寸：高 |
| `⌘ 4` | 终端尺寸：大 |

> Windows/Linux 上用 `Ctrl` 替换 `⌘`。

## 技术栈

| 层级 | 技术 |
|------|-----|
| 桌面框架 | Electron |
| 前端 | React, TypeScript |
| 终端 | xterm.js, node-pty |
| 状态管理 | Zustand |
| 样式 | Tailwind CSS, Geist 字体 |
| 绘图 | perfect-freehand |
| 构建 | Vite |

## 参与贡献 & 许可证

欢迎贡献——Fork、创建分支、发起 PR。基于 [MIT](LICENSE) 许可。
