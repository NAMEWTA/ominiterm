# OminiTerm

Project-board desktop shell for git worktrees, local terminals, and AI coding agents.

The current branch keeps only the active desktop product line. Historical CLI, Hydra, eval tooling, and older canvas-centric docs have been removed from the working tree and should be read from git history if needed.

[中文说明](./README.zh-CN.md)

## Current Snapshot

- Active packages: `apps/desktop`, `apps/website`
- Desktop layout: Project Sidebar + Project Board + Terminal Detail + Right Rail
- Core data model: `Project -> Worktree -> Terminal`
- Current baseline version: `0.0.1`
- Active developer docs live under [`docs/`](./docs/README.md)

## Package Map

- `apps/desktop`
  Electron desktop app, renderer, main-process code, preload bridge, and desktop tests.
- `apps/website`
  Lightweight Vite landing page.
- `supabase`
  Auth and usage-sync backend configuration.

## Desktop Capabilities

- Worktree-aware project board with a left project navigator and a two-column terminal board.
- Terminal detail mode for a full-page view of a single terminal.
- Composer for sending prompts to the focused terminal, including image paste for supported agent CLIs.
- Right rail for browsing worktree files and live git diffs.
- Workspace save and restore, custom terminal titles, starring, themes, fonts, shortcuts, auth, updater, quota, and insights.
- Supported terminal types: `shell`, `claude`, `codex`, `copilot`, `kimi`, `gemini`, `opencode`, `lazygit`, `tmux`.

## Quick Start

### Requirements

- Node.js `24.13.0`
- pnpm `10.29.2`
- Git
- Python 3.x only if you need to regenerate desktop icons

### Install and Run

```bash
git clone https://github.com/NAMEWTA/ominiterm.git
cd ominiterm
pnpm install
pnpm dev
```

### Common Commands

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm desktop:package
pnpm website:build
```

## Developer Docs

- [`docs/README.md`](./docs/README.md)
  Reading order and active documentation map.
- [`docs/architecture.md`](./docs/architecture.md)
  Package layout, desktop architecture, runtime files, and major data flows.
- [`docs/development.md`](./docs/development.md)
  Local development workflow, validation matrix, and common change entry points.
- [`AGENTS.md`](./AGENTS.md)
  Repository-specific guidance for coding agents.

## Notes for This Branch

- Historical plans, Hydra/eval tooling, and legacy packaged CLI wiring were intentionally removed from the active tree.
- Runtime naming is unified around `OminiTerm`, including `~/.ominiterm` and the packaged desktop app name.
- The active shell is centered on the project board and right rail rather than the older infinite-canvas-only workflow.

## Acknowledgements

This project references and draws inspiration from [blueberrycongee/termcanvas](https://github.com/blueberrycongee/termcanvas). Many thanks to the original project and its author.

## License

[MIT](./LICENSE)
