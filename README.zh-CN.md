<div align="center">

<img src="docs/icon.png" width="128" alt="OminiTerm 应用图标" />

# OminiTerm

**你的终端，整理成项目看板。**

[![GitHub release](https://img.shields.io/github/v/release/blueberrycongee/ominiterm)](https://github.com/blueberrycongee/ominiterm/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey)]()
[![Website](https://img.shields.io/badge/website-ominiterm-e8b840)](https://website-ten-mu-37.vercel.app)

<br>

<img src="docs/image.png" alt="OminiTerm 演示 — 多个 AI agent 在项目终端看板中协作" />

</div>

<br>

OminiTerm 现在以“项目壳层”的方式组织终端：左侧项目导航，中间是当前项目的两列终端看板，需要深入时再进入单终端全页详情。

它仍然使用 **Project → Worktree → Terminal** 三层结构，和真实的 git 工作方式保持一致。添加项目后会自动识别 worktree，并可直接从项目看板新建终端。

<p align="right"><a href="./README.md">English →</a></p>

---

## 快速开始

**下载** —— 从 [GitHub Releases](https://github.com/blueberrycongee/ominiterm/releases) 获取最新构建。

**从源码构建：**

```bash
git clone https://github.com/blueberrycongee/ominiterm.git
cd ominiterm
pnpm install
pnpm dev
```

**安装命令行工具** —— 启动应用后，进入 设置 → 通用 → 命令行工具，点击注册。这会将 `ominiterm` 和 `hydra` 添加到你的 PATH。

---

## 功能特性

### 项目看板

以项目为主的工作壳层——从左侧栏切换项目，在统一的两列终端看板中查看当前项目全部终端，用 worktree 标签保留上下文，而不是靠嵌套浮动容器。

单击终端会聚焦并供 Composer 与快捷键使用；双击会进入独立的终端详情页，占满主内容区。

### AI 编程 Agent

原生支持 **Claude Code**、**Codex**、**Kimi**、**Gemini**、**OpenCode**。

- **Composer** —— 统一输入栏，向聚焦的 agent 发送提示，支持粘贴图片
- **实时状态** —— 一眼看到 agent 正在工作、等待还是已完成
- **会话恢复** —— 关闭并重新打开 agent 终端，不丢失上下文
- **右侧文件与变更面板** —— 不离开看板就能查看终端对应 worktree 的文件和 diff

### 终端

Shell、lazygit、tmux 与 AI agent 共存于同一项目看板。你可以在看板中聚焦终端、进入全页详情、自定义标题、星标重要终端，并为不同 agent 覆盖 CLI 路径。

### 用量追踪

Token 用量与成本看板——总花费、按项目和按模型分布。每小时 token 热力图、24 小时成本趋势图、缓存命中率。5 小时与 7 天速率限制配额监控。登录后跨设备同步用量。

### 设置

6 款可下载等宽字体 · 深色/浅色主题 · 自定义键盘快捷键 · 最小对比度无障碍设置 · 中英文自动检测 · 应用内自动更新与更新日志。

---

## 命令行工具

两个 CLI 都随应用打包。在设置中注册后即可在任意终端使用。

### ominiterm

<details>
<summary>完整命令参考</summary>

```
用法: ominiterm <project|terminal|diff|state> <command> [args]

项目命令:
  project add <path>                          添加项目到工作区
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

</details>

```bash
ominiterm project add ~/my-repo
ominiterm terminal create --worktree ~/my-repo --type claude
ominiterm terminal status <id>
ominiterm diff ~/my-repo --summary
```

<br>

<div align="center">
<img src="docs/hydra-icon.png" width="80" alt="Hydra icon" />

### hydra
</div>

<br>

Hydra 让你把大任务拆成小块，分派给不同的 AI agent，每个 agent 在独立的 git worktree 中工作。所有 agent 都有自己的看板终端，你可以同时观察它们并行推进。

**最简单的用法是直接告诉你的 AI agent。** 在项目中运行 `hydra init` 之后，只需对 agent 说：

> *"用 Hydra 把这次重构拆成子任务，并行执行。"*

Agent 已经知道如何调用 `hydra spawn`、监控进度、合并结果——你不需要记任何 CLI 参数。

```bash
hydra init    # 教会 Claude Code / Codex 在这个项目中使用 Hydra
```

<details>
<summary>手动使用</summary>

```bash
hydra spawn --task "fix the login bug" --type claude --repo .
hydra list
hydra cleanup <agent-id>
```

`hydra spawn` 会创建 worktree + 分支，在看板中打开终端，并发送任务。传入 `--auto-approve` 可继承父 agent 的权限级别。只读任务（审查、分析）可传入 `--worktree <path>` 复用已有 worktree。

</details>

---

## 快捷键

所有快捷键均可在 设置 → 快捷键 中自定义。Windows/Linux 上用 <kbd>Ctrl</kbd> 替换 <kbd>⌘</kbd>。

| 快捷键 | 功能 |
|--------|------|
| <kbd>⌘</kbd> <kbd>O</kbd> | 添加项目 |
| <kbd>⌘</kbd> <kbd>/</kbd> | 切换右侧面板（用量） |
| <kbd>⌘</kbd> <kbd>T</kbd> | 新建终端 |
| <kbd>⌘</kbd> <kbd>D</kbd> | 关闭聚焦的终端 |
| <kbd>⌘</kbd> <kbd>;</kbd> | 重命名终端标题 |
| <kbd>⌘</kbd> <kbd>]</kbd> | 下一个终端 |
| <kbd>⌘</kbd> <kbd>[</kbd> | 上一个终端 |
| <kbd>⌘</kbd> <kbd>F</kbd> | 星标 / 取消星标聚焦的终端 |
| <kbd>⌘</kbd> <kbd>S</kbd> | 保存工作区 |
| <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>S</kbd> | 工作区另存为 |
| <kbd>Esc</kbd> | 从终端详情页返回项目看板 |

---

<table>
<tr><td><b>桌面框架</b></td><td>Electron</td></tr>
<tr><td><b>前端</b></td><td>React · TypeScript</td></tr>
<tr><td><b>终端</b></td><td>xterm.js (WebGL) · node-pty</td></tr>
<tr><td><b>状态管理</b></td><td>Zustand</td></tr>
<tr><td><b>样式</b></td><td>Tailwind CSS · Geist</td></tr>
<tr><td><b>绘图</b></td><td>perfect-freehand</td></tr>
<tr><td><b>认证与同步</b></td><td>Supabase</td></tr>
<tr><td><b>构建</b></td><td>Vite · esbuild</td></tr>
</table>

<br>

**致谢** —— [lazygit](https://github.com/jesseduffield/lazygit) 作为内置终端类型集成，在画布上提供可视化的 git 管理。

**参与贡献** —— Fork、创建分支、发起 PR。基于 [MIT](LICENSE) 许可。

