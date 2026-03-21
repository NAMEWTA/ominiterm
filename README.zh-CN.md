<div align="center">

<img src="docs/icon.png" width="128" alt="TermCanvas 应用图标" />

# TermCanvas

**你的终端，铺在无限画布上。**

[![GitHub release](https://img.shields.io/github/v/release/blueberrycongee/termcanvas)](https://github.com/blueberrycongee/termcanvas/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey)]()
[![Website](https://img.shields.io/badge/website-termcanvas-e8b840)](https://website-ten-mu-37.vercel.app)

</div>

<div align="center">
<img src="docs/image.png" alt="TermCanvas 演示 — 多个 AI agent 在无限画布上协作" />
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
- 双击终端标题栏缩放至适合视口
- 拖拽排序 worktree 内的终端
- 框选——拖拽一次选中多个终端
- 绘图工具——画笔、文字、矩形、箭头标注（可开关）
- 工作区存档——将完整布局保存为 `.termcanvas` 文件，支持另存为，带脏状态追踪

**AI 编程 Agent**
- 原生支持 Claude Code、Codex、Kimi、Gemini、OpenCode
- Composer——统一输入栏，向聚焦的 agent 发送提示，支持粘贴图片
- 实时会话状态——一眼看到 agent 正在工作、等待还是已完成
- 完成闪光——agent 完成一轮时的视觉脉冲提示
- 会话恢复——关闭并重新打开 agent 终端，不丢失上下文
- CLI 自动检测——TermCanvas 自动发现已安装的 agent CLI；可在设置中逐个覆盖
- 内联 diff 卡片——不离开画布就能审查 agent 的代码变更
- 文件与目录树卡片——在画布上与终端并排浏览文件

**通用终端**
- Shell、lazygit、tmux 与 AI agent 共存于同一画布
- 星标终端——标记重要终端，用 `⌘ J` / `⌘ K` 快速切换
- `⌘ ;` 重命名终端标题
- 终端尺寸预设：默认、宽、高、大

**用量追踪**
- Token 用量与成本看板——总花费、按项目分布、按模型分布
- 每小时 token 热力图与 24 小时成本趋势图
- 缓存命中率统计
- 配额监控——5 小时与 7 天速率限制利用率，自适应轮询
- 云同步——登录后通过 Supabase 跨设备汇总用量

**设置**
- **显示** —— 6 款等宽字体可选（Geist Mono、Geist Pixel Square、JetBrains Mono、Fira Code、IBM Plex Mono、Hack），一键下载；字号 6–24 px
- **主题** —— 深色与浅色模式，暖石色调配色，ANSI 颜色符合无障碍标准
- **Agent** —— 自动检测或手动覆盖每个 agent 类型的 CLI 路径
- **快捷键** —— 所有键盘快捷键均可自定义并持久保存
- **Composer** —— 开关实验性的 Composer 输入栏
- **绘图** —— 开关绘图工具栏
- **高级** —— 最小对比度滑块（1–7），提升终端文本可读性
- **国际化** —— 支持中文和英文（自动检测系统语言）
- **自动更新** —— 应用内更新通知并显示更新日志

**命令行工具**
- `termcanvas` —— 从终端控制画布：管理项目、创建/销毁终端、发送输入、读取输出、查看 diff
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

**安装命令行工具** —— 启动应用后，进入 设置 → 通用 → 命令行工具，点击注册。这会将 `termcanvas` 和 `hydra` 添加到你的 PATH，并把 Hydra skill 安装到 Claude Code 与 Codex 的 skill 目录。

## 命令行工具

两个 CLI 都随应用打包。在设置中注册后即可在任意终端使用。

### termcanvas

```
用法: termcanvas <project|terminal|diff|state> <command> [args]

项目命令:
  project add <path>                          添加项目到画布
  project list                                列出所有项目
  project remove <id>                         移除项目
  project rescan <id>                         重新扫描项目的 worktree

终端命令:
  terminal create --worktree <path> --type <type>   创建终端
          [--prompt <text>] [--parent-terminal <id>] [--auto-approve]
  terminal list [--worktree <path>]            列出终端
  terminal status <id>                         获取终端状态
  terminal input <id> <text>                   向终端发送文本输入
  terminal output <id> [--lines N]             读取终端输出（默认 50 行）
  terminal destroy <id>                        销毁终端

其他命令:
  diff <worktree-path> [--summary]             查看 worktree 的 git diff
  state                                        导出完整画布状态为 JSON

标志:
  --json    以 JSON 格式输出
```

<div align="center">

<img src="docs/hydra-icon.png" width="80" alt="Hydra icon" />

### hydra

</div>

Hydra 让你把大任务拆成小块，分派给不同的 AI agent——Claude、Codex、Kimi、Gemini 或 OpenCode。每个 agent 拥有独立的 git worktree 和画布上的独立终端，你可以同时观察它们并行工作，随时介入。

**派生 agent：**

```bash
hydra spawn --task "fix the login bug" --type claude --repo .
# → 返回 JSON: { agentId, terminalId, worktreePath, branch, resultFile }
```

这会创建一个新的 worktree + 分支，在画布上打开终端，并将任务发送给 agent。agent 在完全隔离的环境中工作——只能修改自己 worktree 内的文件。

传入 `--auto-approve` 可继承父 agent 的权限级别（Claude 映射为 `--dangerously-skip-permissions`，Codex 映射为 `--dangerously-bypass-approvals-and-sandbox`）。

**只读任务**（代码审查、分析）可以指向已有的 worktree，不创建新分支：

```bash
hydra spawn --task "审查 auth 模块的安全漏洞" --type claude --repo . --worktree ./my-worktree
```

**监控、审查与合并：**

```bash
hydra list                              # 查看所有 agent 及其状态
termcanvas terminal status <id>         # 检查 agent 是否完成
termcanvas diff <worktree> --summary    # 审查 agent 的变更
cat <resultFile>                        # 读取 agent 的总结报告
git merge <branch>                      # 采纳变更
hydra cleanup <agent-id>                # 清理 worktree 和终端
```

**初始化：**

```bash
hydra init    # 将 Hydra 使用说明添加到项目的 CLAUDE.md 和 AGENTS.md
```

这会教会你的主 AI agent 在合适的时机自动派生子 agent。

## 快捷键

所有快捷键均可在 设置 → 快捷键 中自定义。

| 快捷键 | 功能 |
|--------|------|
| `⌘ O` | 添加项目 |
| `⌘ B` | 切换侧边栏 |
| `⌘ /` | 切换右侧面板（用量） |
| `⌘ T` | 新建终端 |
| `⌘ D` | 关闭聚焦的终端 |
| `⌘ ;` | 重命名终端标题 |
| `⌘ ]` | 下一个终端 |
| `⌘ [` | 上一个终端 |
| `⌘ E` | 取消聚焦 / 恢复上次聚焦 |
| `⌘ F` | 星标 / 取消星标聚焦的终端 |
| `⌘ J` | 下一个星标终端 |
| `⌘ K` | 上一个星标终端 |
| `⌘ S` | 保存工作区 |
| `⌘ ⇧ S` | 工作区另存为 |
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
| 终端 | xterm.js (WebGL), node-pty |
| 状态管理 | Zustand |
| 样式 | Tailwind CSS, Geist 字体 |
| 绘图 | perfect-freehand |
| 认证与同步 | Supabase |
| 构建 | Vite, esbuild |

## 致谢

- [lazygit](https://github.com/jesseduffield/lazygit) — TermCanvas 集成了 lazygit 作为内置终端类型，在画布上提供可视化的 git 管理。

## 参与贡献 & 许可证

欢迎贡献——Fork、创建分支、发起 PR。基于 [MIT](LICENSE) 许可。
