<div align="center">

<img src="docs/icon.png" width="128" alt="TermCanvas app icon" />

# TermCanvas

**Your terminals, on an infinite canvas.**

[![GitHub release](https://img.shields.io/github/v/release/blueberrycongee/termcanvas)](https://github.com/blueberrycongee/termcanvas/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey)]()
[![Website](https://img.shields.io/badge/website-termcanvas-e8b840)](https://website-ten-mu-37.vercel.app)

[**termcanvas.dev →**](https://website-ten-mu-37.vercel.app)

</div>

<div align="center">
<img src="docs/image.png" alt="TermCanvas demo — multiple AI agents on an infinite canvas" />
</div>

[中文文档](./README.zh-CN.md)

## What is TermCanvas

TermCanvas spreads all your terminals across an infinite spatial canvas — no more tabs, no more split panes. Drag them around, zoom in to focus, zoom out to see the big picture, and annotate with freehand drawings.

It organizes everything in a **Project → Worktree → Terminal** hierarchy that mirrors how you actually use git. Add a project, and TermCanvas auto-detects its worktrees. Create a new worktree from the terminal, and it appears on the canvas instantly.

## Quick Start

**Download** — grab the latest build from [GitHub Releases](https://github.com/blueberrycongee/termcanvas/releases).

**Build from source:**

```bash
git clone https://github.com/blueberrycongee/termcanvas.git
cd termcanvas
npm install
npm run dev
```

**Install CLI tools** — after launching the app, go to Settings → General → Command line interface and click Register. This adds `termcanvas` and `hydra` to your PATH, and installs the Hydra skill into Claude Code and Codex skill directories.

## Features

**Canvas**
- Infinite canvas — pan, zoom, and arrange terminals freely
- Three-layer hierarchy — projects contain worktrees, worktrees contain terminals
- Live worktree detection — new worktrees appear automatically
- Double-click a terminal title bar to zoom-to-fit; drag to reorder; box-select multiple terminals
- Drawing tools — pen, text, rectangles, arrows for annotations
- Workspace save / save-as — persist your entire layout to a `.termcanvas` file

**AI coding agents**
- First-class support for Claude Code, Codex, Kimi, Gemini, and OpenCode
- Composer — a unified input bar that sends prompts to the focused agent, with image paste support
- Live session status and completion glow — see at a glance whether an agent is working, waiting, or done
- Session resume — close and reopen an agent terminal without losing context
- Inline diff cards — review an agent's changes without leaving the canvas

**Terminals**
- Shell, lazygit, and tmux terminals live alongside AI agents on the same canvas
- Star important terminals and cycle through them with `⌘ J` / `⌘ K`
- Four size presets, customizable titles, per-agent CLI override

**Usage tracking**
- Token usage and cost dashboard — total spend, per-project and per-model breakdown
- Hourly token heatmap, 24-hour cost sparkline, cache hit/miss stats
- Quota monitor — 5-hour and 7-day rate-limit utilization
- Cloud sync — sign in to aggregate usage across devices

**Settings** — 6 downloadable monospace fonts, dark/light theme, customizable keyboard shortcuts, minimum contrast ratio for accessibility, English and Chinese (auto-detected), auto-update with in-app changelog.

## CLI

Both CLIs are bundled with the app. Register them from Settings to use in any terminal.

### termcanvas

```
Usage: termcanvas <project|terminal|diff|state> <command> [args]

Project commands:
  project add <path>                          Add a project to the canvas
  project list                                List all projects
  project remove <id>                         Remove a project
  project rescan <id>                         Rescan worktrees for a project

Terminal commands:
  terminal create --worktree <path> --type <type>   Create a terminal
          [--prompt <text>] [--parent-terminal <id>] [--auto-approve]
  terminal list [--worktree <path>]            List terminals
  terminal status <id>                         Get terminal status
  terminal input <id> <text>                   Send text input to a terminal
  terminal output <id> [--lines N]             Read terminal output (default 50 lines)
  terminal destroy <id>                        Destroy a terminal

Other commands:
  diff <worktree-path> [--summary]             View git diff for a worktree
  state                                        Dump full canvas state as JSON

Flags:
  --json    Output in JSON format
```

<div align="center">

<img src="docs/hydra-icon.png" width="80" alt="Hydra icon" />

### hydra

</div>

Hydra lets you break a big task into smaller pieces and hand each piece to an AI agent running in its own git worktree. Every agent gets its own terminal on the canvas, so you can watch them all work in parallel.

**The easiest way to use Hydra is to ask your AI agent directly.** After running `hydra init` in your project, just tell your agent:

> *"Use Hydra to split this refactor into subtasks and run them in parallel."*

The agent already knows how to call `hydra spawn`, monitor progress, and merge results — you don't need to memorize any CLI flags.

**Setup:**

```bash
hydra init    # add Hydra instructions to your project's CLAUDE.md and AGENTS.md
```

This installs a skill that teaches Claude Code and Codex when and how to spawn sub-agents. Once initialized, the agent can use Hydra autonomously whenever a task benefits from parallelization.

**Manual usage** — you can also drive Hydra yourself:

```bash
hydra spawn --task "fix the login bug" --type claude --repo .
hydra list
hydra cleanup <agent-id>
```

`hydra spawn` creates a worktree + branch, opens a terminal on the canvas, and sends the task. Pass `--auto-approve` to inherit the parent agent's permission level. For read-only tasks (review, analysis), pass `--worktree <path>` to reuse an existing worktree.

## Keyboard Shortcuts

All shortcuts are customizable in Settings → Shortcuts.

| Shortcut | Action |
|----------|--------|
| `⌘ O` | Add project |
| `⌘ B` | Toggle sidebar |
| `⌘ /` | Toggle right panel (usage) |
| `⌘ T` | New terminal |
| `⌘ D` | Close focused terminal |
| `⌘ ;` | Rename terminal title |
| `⌘ ]` | Next terminal |
| `⌘ [` | Previous terminal |
| `⌘ E` | Unfocus / refocus last terminal |
| `⌘ F` | Star / unstar focused terminal |
| `⌘ J` | Next starred terminal |
| `⌘ K` | Previous starred terminal |
| `⌘ S` | Save workspace |
| `⌘ ⇧ S` | Save workspace as |
| `⌘ 1–4` | Terminal size: default / wide / tall / large |

> On Windows/Linux, replace `⌘` with `Ctrl`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron |
| Frontend | React, TypeScript |
| Terminal | xterm.js (WebGL), node-pty |
| State | Zustand |
| Styling | Tailwind CSS, Geist font |
| Drawing | perfect-freehand |
| Auth & sync | Supabase |
| Build | Vite, esbuild |

## Acknowledgements

- [lazygit](https://github.com/jesseduffield/lazygit) — TermCanvas integrates lazygit as a built-in terminal type for visual git management on the canvas.

## Contributing & License

Contributions welcome — fork, branch, and open a PR. Licensed under [MIT](LICENSE).
