# TermCanvas Agent Guide

This repository contains the TermCanvas desktop app, its bundled CLIs, the Hydra sub-agent tool, a small marketing site, and evaluation utilities. Prefer small, source-first changes and keep user-facing behavior aligned across app, CLI, docs, and tests.

## Working Principles

- Match the existing stack: React 19 + TypeScript in `src/`, Electron main-process code in `electron/`, Zustand stores, Tailwind utility classes, and Node's built-in test runner.
- Keep formatting consistent with the repo: 2-space indentation, LF endings, semicolons, and double quotes.
- Prefer editing source files over generated output. Do not hand-edit `dist/`, `dist-cli/`, `dist-electron/`, `node_modules/`, `.termcanvas/`, or `.hydra-result-*.md` unless the task is explicitly about generated artifacts or captured runtime output.
- Preserve cross-platform behavior. This app supports Windows, macOS, and Linux, and many files in `electron/` contain platform-specific logic.
- When you change user-facing features or commands, update the matching docs (`README.md`, `README.zh-CN.md`, `docs/`, skill files) in the same pass when needed.

## Repository Map

- `src/`: React renderer for the infinite canvas UI.
- `src/canvas/`, `src/terminal/`, `src/components/`, `src/toolbar/`: canvas interactions, terminal rendering, major UI surfaces.
- `src/stores/`: Zustand stores for projects, terminals, layout, settings, usage, auth, and workspace state.
- `electron/`: Electron main process, IPC handlers, PTY lifecycle, CLI registration, auth, usage sync, updater, API server, skill installation.
- `cli/`: bundled `termcanvas` CLI entrypoints.
- `hydra/`: standalone Hydra CLI for spawning sub-agents in git worktrees.
- `skills/skills/`: bundled skill definitions shipped with the app.
- `tests/`: root test suite for renderer/electron/shared logic.
- `website/`: separate Vite landing page project.
- `eval/`: evaluation tooling and scripts.
- `supabase/`: Supabase config and SQL migrations for usage sync.
- `docs/`: design notes, plans, reviews, and bug writeups. Check here before large refactors; many architectural decisions are documented here.

## Common Commands

### Root app

- Install deps: `npm install`
- Run desktop app in dev: `npm run dev`
- Type-check renderer/app code: `npm run typecheck`
- Build app: `npm run build`
- Run root tests: `npm test`
- Run a focused root test: `node --experimental-strip-types --test tests/<name>.test.ts`

### Hydra CLI

- Build: `cd hydra && npm run build`
- Type-check: `cd hydra && npm run typecheck`
- Test: `cd hydra && npm test`

### Eval tooling

- Type-check: `cd eval && npm run typecheck`
- Test: `cd eval && npm test`
- Run eval CLI: `cd eval && npm run eval -- --help`

### Website

- Dev server: `cd website && npm run dev`
- Build: `cd website && npm run build`

## Task-to-Code Map

- Terminal creation, launch, resize, and teardown:
  `electron/pty-manager.ts`, `electron/pty-launch.ts`, `electron/main.ts`, `src/terminal/TerminalTile.tsx`, `tests/pty-*.test.ts`, `tests/terminal-*.test.ts`
- Project/worktree discovery and canvas hierarchy:
  `electron/project-scanner.ts`, `electron/api-server.ts`, `src/stores/projectStore.ts`, `src/stores/projectFocus.ts`, `tests/project-*.test.ts`, `tests/api-rescan.test.ts`
- Composer and agent prompt submission:
  `src/components/ComposerBar.tsx`, `src/components/composerInputBehavior.ts`, `electron/composer-submit.ts`, `src/stores/composerStore.ts`, `tests/composer-*.test.ts`
- Slash commands and agent-specific affordances:
  `src/terminal/slashCommands.ts`, `src/components/SlashCommandMenu.tsx`, related tests in `tests/`
- Skills, CLI registration, and Hydra integration:
  `skills/skills/`, `electron/skill-manager.ts`, `electron/cli-registration.ts`, `hydra/src/`, `tests/hydra-skill.test.ts`, `hydra/tests/*.test.ts`
- Usage, auth, and cloud sync:
  `electron/auth.ts`, `electron/usage-*.ts`, `electron/quota-fetcher.ts`, `src/components/usage/`, `src/stores/authStore.ts`, `src/stores/usageStore.ts`

## Editing Guidance

- Prefer minimal, local fixes. This codebase has good feature clustering; avoid broad refactors unless the task requires them.
- Treat `build/` as source assets, but regenerate derived icons through `scripts/generate-icons.py` instead of manually replacing every platform artifact when possible.
- If you add a new root test file under `tests/`, also update the explicit file list in the root `package.json` `test` script. The root test command does not use a glob.
- `website/` and `eval/` are separate projects with their own `package.json`; do not assume root commands cover them.
- Skills are shipped from `skills/skills/`. If behavior depends on an installed skill, update both the skill content and any related Electron installation/linking logic.
- Avoid changing runtime-generated records in `.termcanvas/`, `*.termcanvas`, `docs/hydra/tasks/`, and `docs/hydra/results/` unless the task is specifically about those outputs or fixtures.

## Validation Expectations

- For app or shared logic changes, run the narrowest relevant test first, then broader checks if the change spans multiple areas.
- For renderer/Electron changes that affect typing or imports, run `npm run typecheck`.
- For CLI or Hydra changes, run the relevant package-local tests in `hydra/` and any impacted root tests.
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
3. Poll until every agent reaches a terminal state. Use `termcanvas terminal status <terminalId>`.
4. Also treat the `resultFile` returned by Hydra as a completion signal. Read it before cleanup.
5. For code-change tasks, review with `termcanvas diff <worktreePath> --summary`, then merge the branch.
6. Clean up with `hydra cleanup <agentId>`.

### Rules

- Do not use Hydra for simple, high-certainty fixes that are faster to do directly.
- Always monitor spawned agents to completion; do not fire-and-forget.
- For code-change agents, review the diff before merging.
