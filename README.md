# OminiTerm

Project-board desktop shell for git worktrees, local terminals, and AI coding agents.

The current `pure-term` branch is a cleaned-up pnpm monorepo. If you previously used older canvas-centric docs, start from the developer docs linked below instead of relying on historical screenshots or archived notes.

[中文说明](./README.zh-CN.md)

## Current Snapshot

- Monorepo layout: `apps/desktop`, `apps/website`, `tools/hydra`, `tools/eval`
- Desktop shell layout: Project Sidebar + Project Board + Terminal Detail + Right Rail
- Core data model: `Project -> Worktree -> Terminal`
- Bundled CLI tools: `ominiterm`, `hydra`
- Active docs are intentionally lean and live under [`docs/`](./docs/README.md)

## Package Map

- `apps/desktop`
  The Electron desktop app, renderer, bundled CLI entrypoints, shipped skills, and desktop tests.
- `apps/website`
  A lightweight Vite landing page.
- `tools/hydra`
  Sub-agent orchestration CLI that spawns agents into OminiTerm terminals and git worktrees.
- `tools/eval`
  Benchmark runner for single-agent and Hydra evaluation workflows.
- `supabase`
  Auth and usage-sync backend configuration.

## Desktop Capabilities

- Worktree-aware project board with a left project navigator and a two-column terminal board.
- Terminal detail mode for a full-page view of a single terminal.
- Composer for sending prompts to the focused terminal, including image paste for supported agent CLIs.
- Right rail for browsing worktree files and live git diffs.
- Workspace save and restore, custom terminal titles, starring, themes, fonts, and shortcuts.
- Supported terminal types: `shell`, `claude`, `codex`, `copilot`, `kimi`, `gemini`, `opencode`, `lazygit`, `tmux`.

## Quick Start

### Requirements

- Node.js `24.13.0`
- pnpm `10.29.2`
- Git
- Python 3.x only if you need to regenerate desktop icons

### Install and Run

```bash
git clone https://github.com/blueberrycongee/ominiterm.git
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
```

## CLI and Tooling

### `ominiterm`

The desktop app exposes a local HTTP API server and bundles the `ominiterm` CLI as a thin wrapper around that API. Use it to add projects, create terminals, inspect status and output, query diffs, and dump the current state.

### `hydra`

Hydra creates an isolated worktree for each sub-agent, opens a matching terminal inside OminiTerm, writes a task file into the worktree, and stores agent metadata under `~/.hydra/agents/`.

### Eval

The eval tool supports `single-claude`, `single-codex`, and `hydra` benchmark runs. Results are written under `tools/eval/results/<runId>/`.

## Developer Docs

- [`docs/README.md`](./docs/README.md)
  Reading order and active documentation map.
- [`docs/architecture.md`](./docs/architecture.md)
  Monorepo structure, desktop architecture, data model, and runtime files.
- [`docs/development.md`](./docs/development.md)
  Secondary-development workflow, commands, validation, and extension points.
- [`docs/tooling/cli-and-hydra.md`](./docs/tooling/cli-and-hydra.md)
  Internal relationship between the desktop app, `ominiterm`, and Hydra.
- [`docs/tooling/eval-framework.md`](./docs/tooling/eval-framework.md)
  Evaluation runner structure and command reference.
- [`AGENTS.md`](./AGENTS.md)
  Repository-specific guidance for coding agents.

## Notes for This Branch

- Historical design plans and large doc archives were intentionally removed from the working tree during cleanup.
- Runtime naming has been unified around `OminiTerm`, including `~/.ominiterm`, the `ominiterm` CLI, and the packaged app name.
- The desktop app still contains auth, usage, quota, updater, and insights services, but the active shell in this branch is centered on the project board and right rail.

## Acknowledgements

This project references and draws inspiration from [blueberrycongee/termcanvas](https://github.com/blueberrycongee/termcanvas). Many thanks to the original project and its author.

## License

[MIT](./LICENSE)
