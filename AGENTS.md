# OminiTerm Agent Guide

This repository contains the OminiTerm desktop app, its bundled CLIs, the Hydra sub-agent tool, a small marketing site, and evaluation utilities. Prefer small, source-first changes and keep user-facing behavior aligned across app, CLI, docs, and tests.

## Working Principles

- Match the existing stack: React 19 + TypeScript in `apps/desktop/src/`, Electron main-process code in `apps/desktop/electron/`, Zustand stores, Tailwind utility classes, and Node's built-in test runner.
- Keep formatting consistent with the repo: 2-space indentation, LF endings, semicolons, and double quotes.
- Prefer editing source files over generated output. Do not hand-edit `dist/`, `dist-cli/`, `dist-electron/`, `node_modules/`, `.ominiterm/`, or `.hydra-result-*.md` unless the task is explicitly about generated artifacts or captured runtime output.
- Preserve cross-platform behavior. This app supports Windows, macOS, and Linux, and many files in `apps/desktop/electron/` contain platform-specific logic.
- When you change user-facing features or commands, update the matching docs (`README.md`, `README.zh-CN.md`, `docs/`, skill files) in the same pass when needed.

## Repository Map

- `apps/desktop/src/`: React renderer for the infinite canvas UI.
- `apps/desktop/src/canvas/`, `apps/desktop/src/terminal/`, `apps/desktop/src/components/`, `apps/desktop/src/toolbar/`: canvas interactions, terminal rendering, major UI surfaces.
- `apps/desktop/src/stores/`: Zustand stores for projects, terminals, layout, settings, usage, auth, and workspace state.
- `apps/desktop/electron/`: Electron main process, IPC handlers, PTY lifecycle, CLI registration, auth, usage sync, updater, API server, skill installation.
- `apps/desktop/cli/`: bundled `ominiterm` CLI entrypoints.
- `apps/desktop/skills/skills/`: bundled skill definitions shipped with the app.
- `apps/desktop/tests/`: desktop renderer/electron/shared test suite.
- `apps/website/`: separate Vite landing page project.
- `tools/hydra/`: standalone Hydra CLI for spawning sub-agents in git worktrees.
- `tools/eval/`: evaluation tooling and scripts.
- `supabase/`: Supabase config and SQL migrations for usage sync.
- `docs/`: design notes, plans, reviews, and bug writeups. Check here before large refactors; many architectural decisions are documented here.

## Common Commands

### Workspace root

- Install deps: `pnpm install`
- Run desktop app in dev: `pnpm dev`
- Type-check workspace packages: `pnpm typecheck`
- Build workspace: `pnpm build`
- Run workspace tests: `pnpm test`
- Package desktop app: `pnpm desktop:package`

### Hydra CLI

- Build: `pnpm --filter @ominiterm/hydra build`
- Type-check: `pnpm --filter @ominiterm/hydra typecheck`
- Test: `pnpm --filter @ominiterm/hydra test`

### Eval tooling

- Type-check: `pnpm --filter @ominiterm/eval typecheck`
- Test: `pnpm --filter @ominiterm/eval test`
- Run eval CLI: `pnpm --filter @ominiterm/eval eval -- --help`

### Website

- Dev server: `pnpm --filter @ominiterm/website dev`
- Build: `pnpm --filter @ominiterm/website build`

## Task-to-Code Map

- Terminal creation, launch, resize, and teardown:
  `apps/desktop/electron/pty-manager.ts`, `apps/desktop/electron/pty-launch.ts`, `apps/desktop/electron/main.ts`, `apps/desktop/src/terminal/TerminalTile.tsx`, `apps/desktop/tests/pty-*.test.ts`, `apps/desktop/tests/terminal-*.test.ts`
- Project/worktree discovery and canvas hierarchy:
  `apps/desktop/electron/project-scanner.ts`, `apps/desktop/electron/api-server.ts`, `apps/desktop/src/stores/projectStore.ts`, `apps/desktop/src/stores/projectFocus.ts`, `apps/desktop/tests/project-*.test.ts`, `apps/desktop/tests/api-rescan.test.ts`
- Composer and agent prompt submission:
  `apps/desktop/src/components/ComposerBar.tsx`, `apps/desktop/src/components/composerInputBehavior.ts`, `apps/desktop/electron/composer-submit.ts`, `apps/desktop/src/stores/composerStore.ts`, `apps/desktop/tests/composer-*.test.ts`
- Slash commands and agent-specific affordances:
  `apps/desktop/src/terminal/slashCommands.ts`, `apps/desktop/src/components/SlashCommandMenu.tsx`, related tests in `apps/desktop/tests/`
- Skills, CLI registration, and Hydra integration:
  `apps/desktop/skills/skills/`, `apps/desktop/electron/skill-manager.ts`, `apps/desktop/electron/cli-registration.ts`, `tools/hydra/src/`, `apps/desktop/tests/hydra-skill.test.ts`, `tools/hydra/tests/*.test.ts`
- Usage, auth, and cloud sync:
  `apps/desktop/electron/auth.ts`, `apps/desktop/electron/usage-*.ts`, `apps/desktop/electron/quota-fetcher.ts`, `apps/desktop/src/components/usage/`, `apps/desktop/src/stores/authStore.ts`, `apps/desktop/src/stores/usageStore.ts`

## Editing Guidance

- Prefer minimal, local fixes. This codebase has good feature clustering; avoid broad refactors unless the task requires them.
- Treat `apps/desktop/build/` as source assets, but regenerate derived icons through `apps/desktop/scripts/generate-icons.py` instead of manually replacing every platform artifact when possible.
- If you add a new desktop test file under `apps/desktop/tests/`, also update the explicit file list in `apps/desktop/package.json` `test` script. The desktop test command does not use a glob.
- `apps/website/` and `tools/eval/` are separate packages; do not assume desktop-only commands cover them.
- Skills are shipped from `apps/desktop/skills/skills/`. If behavior depends on an installed skill, update both the skill content and any related Electron installation/linking logic.
- Avoid changing runtime-generated records in `.ominiterm/`, `*.ominiterm`, `docs/hydra/tasks/`, and `docs/hydra/results/` unless the task is specifically about those outputs or fixtures.

## Validation Expectations

- For app or shared logic changes, run the narrowest relevant test first, then broader checks if the change spans multiple areas.
- For renderer/Electron changes that affect typing or imports, run `pnpm typecheck`.
- For CLI or Hydra changes, run the relevant package-local tests in `tools/hydra/` and any impacted `apps/desktop/tests/`.
- For docs-only changes, tests are usually unnecessary unless the change documents commands or behavior you also modified.

## Hydra Sub-Agent Tool

When task uncertainty is high (unclear root cause, multiple valid approaches, decomposable subtasks), investigate first, then use Hydra to spawn sub-agents.

### Choosing the right mode

Supported agent types currently include `claude`, `codex`, and `kimi`.

- Read-only tasks: `hydra spawn --task "..." --type <agent-type> --repo . --worktree <path>`
- Code-change tasks: `hydra spawn --task "..." --type <agent-type> --repo .`

### Permission inheritance

Sub-agents run as independent CLI processes. If they lack permissions, they can stall on approval prompts with no way for the parent agent to intervene.

- If you are already running in auto-approve / full-access mode and you spawn a Claude Code or Codex sub-agent, pass `--auto-approve`.
- Do not pass `--auto-approve` if your current session is approval-gated.
- `kimi` currently ignores `--auto-approve`.

### Recommended workflow

1. Investigate first and write a precise task description.
2. Spawn agents with the correct mode.
3. Poll until every agent reaches a terminal state. Use `ominiterm terminal status <terminalId>`.
4. Also treat the `resultFile` returned by Hydra as a completion signal. Read it before cleanup.
5. For code-change tasks, review with `ominiterm diff <worktreePath> --summary`, then merge the branch.
6. Clean up with `hydra cleanup <agentId>`.

### Rules

- Do not use Hydra for simple, high-certainty fixes that are faster to do directly.
- Always monitor spawned agents to completion; do not fire-and-forget.
- For code-change agents, review the diff before merging.

