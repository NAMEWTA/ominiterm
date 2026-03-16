<div align="center">

<img src="docs/icon.png" width="128" alt="TermCanvas app icon" />

# TermCanvas

**Your terminals, on an infinite canvas.**

[![GitHub release](https://img.shields.io/github/v/release/blueberrycongee/termcanvas)](https://github.com/blueberrycongee/termcanvas/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey)]()

<!-- screenshot placeholder -->
<img src="docs/screenshot.png" width="800" alt="TermCanvas screenshot — coming soon" />

</div>

[中文文档](./README.zh-CN.md)

## App Icon

The repository now includes a production-ready app icon set derived from the core TermCanvas mark. Packaged builds use:

- `build/icon.icns` for macOS
- `build/icon.ico` for Windows
- `build/icon.png` for Linux and general branding

The editable source lives at `build/icon.svg`.

## What is TermCanvas

TermCanvas spreads all your terminals across an infinite spatial canvas — no more tabs, no more split panes. Drag them around, zoom in to focus, zoom out to see the big picture, and annotate with freehand drawings.

It organizes everything in a **Project → Worktree → Terminal** hierarchy that mirrors how you actually use git. Add a project, and TermCanvas auto-detects its worktrees. Create a new worktree from the terminal, and it appears on the canvas instantly.

## Features

**Core**
- Infinite canvas — pan, zoom, and arrange terminals freely
- Three-layer hierarchy — projects contain worktrees, worktrees contain terminals
- Live worktree detection — new worktrees appear automatically
- Drawing tools — pen, text, rectangles, arrows for annotations

**AI Integration**
- Claude Code terminal with session status indicator
- Codex terminal support
- AI diff review cards

## Quick Start

**Download** — grab the latest build from [GitHub Releases](https://github.com/blueberrycongee/termcanvas/releases).

**Build from source:**

```bash
git clone https://github.com/blueberrycongee/termcanvas.git
cd termcanvas
npm install
npm run dev
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘ O` | Add project |
| `⌘ B` | Toggle sidebar |
| `⌘ T` | New terminal |
| `⌘ ]` | Next terminal |
| `⌘ [` | Previous terminal |
| `Esc` | Unfocus / refocus last terminal |
| `⌘ 1` | Terminal size: default |
| `⌘ 2` | Terminal size: wide |
| `⌘ 3` | Terminal size: tall |
| `⌘ 4` | Terminal size: large |

> On Windows/Linux, replace `⌘` with `Ctrl`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 41 |
| Frontend | React 19, TypeScript |
| Terminal | xterm.js 6, node-pty |
| State | Zustand 5 |
| Styling | Tailwind CSS 4, Geist font |
| Drawing | perfect-freehand |
| Build | Vite 7 |

## Contributing & License

Contributions welcome — fork, branch, and open a PR. Licensed under [MIT](LICENSE).
