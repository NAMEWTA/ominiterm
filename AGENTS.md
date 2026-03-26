# OminiTerm Agent Guide

This repository is the refactored `pure-term` line of OminiTerm. Treat the current codebase as a pnpm monorepo centered on a project-board desktop shell, not the older infinite-canvas documentation or layout model.

## Working Principles

- Match the active stack: React 19 + TypeScript in `apps/desktop/src/`, Electron main-process code in `apps/desktop/electron/`, Zustand stores, Tailwind utility classes, and Node's built-in test runner.
- Keep formatting consistent with the repo: 2-space indentation, LF endings, semicolons, and double quotes.
- Prefer editing source files over generated output. Do not hand-edit `dist/`, `dist-cli/`, `dist-electron/`, `node_modules/`, `.ominiterm/`, `.hydra-task-*.md`, or `.hydra-result-*.md` unless the task is explicitly about generated artifacts or captured runtime output.
- Preserve cross-platform behavior. The desktop app supports Windows, macOS, and Linux, and several files in `apps/desktop/electron/` contain platform-specific logic.
- Keep docs aligned with behavior. When you change commands, package layout, runtime paths, or user-visible flows, update the matching docs in the same pass.

## Repository Map

- `apps/desktop/`: Electron desktop app, bundled CLIs, shipped skills, and desktop tests.
- `apps/desktop/src/`: React renderer for the project sidebar, project board, terminal detail view, composer, and right rail.
- `apps/desktop/electron/`: Electron main process, IPC handlers, PTY lifecycle, API server, auth, updater, usage services, and skill installation.
- `apps/desktop/cli/`: bundled `ominiterm` CLI entrypoint.
- `apps/desktop/skills/skills/`: skills shipped with the desktop app.
- `apps/desktop/tests/`: explicit desktop test suite list used by the package test script.
- `apps/website/`: small Vite-based marketing site.
- `tools/hydra/`: Hydra CLI for spawning sub-agents in OminiTerm terminals and git worktrees.
- `tools/eval/`: evaluation framework for single-agent and Hydra benchmark runs.
- `supabase/`: Supabase config and SQL migrations for auth and usage sync services.
- `docs/`: active developer docs for the refactored branch. Historical plans and older design notes should be read from git history unless a task explicitly restores them.
- `.agents/skills/`: local agent workflow skills used in this workspace.

## Common Commands

### Workspace Root

- Install deps: `pnpm install`
- Run desktop app in dev: `pnpm dev`
- Type-check all packages: `pnpm typecheck`
- Run workspace tests: `pnpm test`
- Build workspace: `pnpm build`
- Package desktop app: `pnpm desktop:package`

### Desktop App

- Dev: `pnpm --filter ominiterm dev`
- Build: `pnpm --filter ominiterm build`
- Type-check: `pnpm --filter ominiterm typecheck`
- Test: `pnpm --filter ominiterm test`

### Hydra CLI

- Build: `pnpm --filter @ominiterm/hydra build`
- Type-check: `pnpm --filter @ominiterm/hydra typecheck`
- Test: `pnpm --filter @ominiterm/hydra test`

### Eval Tooling

- Type-check: `pnpm --filter @ominiterm/eval typecheck`
- Test: `pnpm --filter @ominiterm/eval test`
- CLI help: `pnpm --filter @ominiterm/eval eval --help`

### Website

- Dev: `pnpm --filter @ominiterm/website dev`
- Build: `pnpm --filter @ominiterm/website build`

## Task-to-Code Map

- Project board shell and selection flow:
  `apps/desktop/src/App.tsx`, `apps/desktop/src/components/ProjectSidebar.tsx`, `apps/desktop/src/components/ProjectBoard.tsx`, `apps/desktop/src/components/TerminalDetailView.tsx`, `apps/desktop/src/stores/uiShellStore.ts`
- Project import, worktree sync, and path normalization:
  `apps/desktop/electron/project-scanner.ts`, `apps/desktop/src/projectPaths.ts`, `apps/desktop/src/stores/projectStore.ts`, `apps/desktop/src/stores/projectFocus.ts`, `apps/desktop/tests/api-rescan.test.ts`, `apps/desktop/tests/project-store-sync-worktrees.test.ts`
- Terminal creation, runtime, resize, output capture, and session tracking:
  `apps/desktop/electron/main.ts`, `apps/desktop/electron/pty-manager.ts`, `apps/desktop/electron/pty-launch.ts`, `apps/desktop/src/terminal/TerminalTile.tsx`, `apps/desktop/src/terminal/cliConfig.ts`, `apps/desktop/tests/pty-*.test.ts`, `apps/desktop/tests/terminal-*.test.ts`
- Composer and slash command submission:
  `apps/desktop/src/components/ComposerBar.tsx`, `apps/desktop/src/components/SlashCommandMenu.tsx`, `apps/desktop/src/components/composerInputBehavior.ts`, `apps/desktop/electron/composer-submit.ts`, `apps/desktop/src/stores/composerStore.ts`, `apps/desktop/tests/composer-*.test.ts`
- Right rail file tree and diff viewer:
  `apps/desktop/src/components/RightRail.tsx`, `apps/desktop/src/components/WorktreeFilesPanel.tsx`, `apps/desktop/src/components/WorktreeDiffPanel.tsx`, `apps/desktop/electron/git-diff.ts`, `apps/desktop/electron/git-watcher.ts`, `apps/desktop/tests/git-diff.test.ts`
- Workspace save/restore and title handling:
  `apps/desktop/src/snapshotState.ts`, `apps/desktop/src/titleHelper.ts`, `apps/desktop/src/stores/workspaceStore.ts`, `apps/desktop/electron/state-persistence.ts`, `apps/desktop/tests/state-persistence.test.ts`, `apps/desktop/tests/title-helper.test.ts`
- CLI, API server, and Hydra integration:
  `apps/desktop/cli/ominiterm.ts`, `apps/desktop/electron/api-server.ts`, `apps/desktop/electron/cli-registration.ts`, `apps/desktop/electron/skill-manager.ts`, `tools/hydra/src/`, `apps/desktop/tests/cli-registration.test.ts`, `tools/hydra/tests/*.test.ts`
- Eval framework:
  `tools/eval/src/cli.ts`, `tools/eval/src/runner.ts`, `tools/eval/src/evaluator.ts`, `tools/eval/src/results.ts`, `tools/eval/tests/*.test.ts`
- Auth, usage, quota, updater, and insights services:
  `apps/desktop/electron/auth.ts`, `apps/desktop/electron/usage-*.ts`, `apps/desktop/electron/quota-fetcher.ts`, `apps/desktop/electron/insights-*.ts`, `apps/desktop/electron/auto-updater.ts`, related stores in `apps/desktop/src/stores/`

## Editing Guidance

- Prefer minimal, local fixes. This branch already performed a large structural cleanup; avoid reintroducing removed abstractions unless the task explicitly calls for them.
- The active desktop UI is project-board based. Do not assume older canvas-only files or docs still exist.
- Treat `apps/desktop/build/` as source assets, but regenerate derived icons with `apps/desktop/scripts/generate-icons.py` instead of manually replacing every platform artifact when possible.
- If you add a new desktop test file under `apps/desktop/tests/`, also update the explicit file list in `apps/desktop/package.json` `test` script. The desktop test command does not use a glob.
- Keep package boundaries clean. `apps/website/`, `tools/hydra/`, and `tools/eval/` are separate packages and should only be touched when the task genuinely affects them.
- Skills shipped to users live under `apps/desktop/skills/skills/`. If behavior depends on a shipped skill, update both the skill content and the related Electron linking or registration logic.
- Avoid restoring deleted historical docs or runtime archives unless the user explicitly wants them back. The current branch intentionally keeps only the active developer documentation set.

## Validation Expectations

- For app or shared logic changes, run the narrowest relevant test first, then broader checks only if the change spans multiple areas.
- For renderer or Electron changes that affect typing or imports, run `pnpm typecheck`.
- For CLI or Hydra changes, run the relevant package-local tests in `tools/hydra/` and any impacted desktop tests.
- For eval changes, run `pnpm --filter @ominiterm/eval test`.
- For docs-only changes, tests are usually unnecessary, but verify that referenced paths, package names, commands, and versions match the current repo.

## Hydra Sub-Agent Tool

Use Hydra when task uncertainty is high, when the work naturally splits into independent subtasks, or when you need isolated git worktrees for parallel agent execution.

### Supported Agent Types

- `claude`
- `codex`
- `kimi`

### Recommended Workflow

1. Investigate first and write a precise task description.
2. Ensure OminiTerm is running and the target repo is already on the project board.
3. Spawn the agent with either a new worktree or an existing worktree.
4. Monitor the terminal status with `ominiterm terminal status <terminalId>`.
5. Also read the generated `.hydra-result-<agentId>.md` file before cleanup.
6. For code-change tasks, review the diff with `ominiterm diff <worktreePath> --summary`.
7. Clean up with `hydra cleanup <agentId>` or `hydra cleanup --all`.

### Rules

- Read-only tasks: `hydra spawn --task "..." --type <agent-type> --repo . --worktree <path>`
- Code-change tasks: `hydra spawn --task "..." --type <agent-type> --repo .`
- If you are already in full-access or auto-approve mode and you spawn Claude Code or Codex, pass `--auto-approve`.
- Do not fire-and-forget Hydra tasks. Always monitor them to a terminal state and review their output.
