# Hydra: TermCanvas Sub-Agent Spawner

## Goal

Let an AI CLI (Claude Code, Codex, etc.) running inside a TermCanvas terminal spawn other AI CLI instances as sub-agents. Sub-agents appear as visible terminals on the TermCanvas canvas — the user can watch them work in real time and intervene at any point.

Hydra is a thin CLI that wraps the complex multi-step spawning flow into a single command. It does not duplicate capabilities that already exist in `termcanvas` CLI or `git`.

## Motivation

Today's AI CLI subagent systems (Claude Code's Agent tool, Codex's multi-agent) run subagents **in-process** — invisible to the user, no separate terminals, no visual feedback. The user has to trust that subagents are doing the right thing.

With TermCanvas, we have a visual canvas showing terminals across worktrees. If a main agent spawns sub-agents as **separate TermCanvas terminals**, the user gets:

- **Visibility**: watch every sub-agent's conversation in real time
- **Intervention**: click into any sub-agent's terminal and type
- **Isolation**: each sub-agent works in its own git worktree
- **Flexibility**: mix agent types (Claude for architecture, Codex for boilerplate, Kimi for Chinese docs)

## Architecture

```
User ↔ TermCanvas canvas (watch + intervene)
         │
    Claude Code / Codex (main agent, in a terminal)
         │
         │  $ hydra spawn --task "..." --type claude --repo .
         ▼
    Hydra CLI (thin wrapper)
         │
         ├─ git worktree add/remove
         ├─ termcanvas project rescan (new API)
         ├─ termcanvas terminal create/input/status/destroy
         │      │
         │      ▼
         └─ TermCanvas (terminal infrastructure + canvas visualization)
```

**Hard dependencies**: `git` + `termcanvas` CLI (TermCanvas must be running).

**No fallback mode**. If TermCanvas is not running, Hydra exits with an error.

## CLI Commands

### `hydra spawn`

The core command. Wraps the multi-step spawning flow into one call.

```bash
hydra spawn \
  --task "fix the concurrency bug in UserService.save()" \
  --type claude \
  --repo /path/to/project

# Optional:
  --worktree <path>      # Use existing worktree (no new worktree created)
  --base-branch main     # Base branch for new worktree (default: current branch)
```

Output (JSON):

```json
{
  "agentId": "hydra-1710648000-a1b2",
  "terminalId": "tc-xyz-123",
  "worktreePath": "/path/to/repo/.worktrees/hydra-1710648000-a1b2",
  "branch": "hydra/1710648000-a1b2"
}
```

The main agent uses this info with existing tools:

```bash
termcanvas terminal status tc-xyz-123        # check progress
termcanvas terminal output tc-xyz-123        # read output
termcanvas diff /path/to/.worktrees/hydra-…  # see changes
git merge hydra/1710648000-a1b2              # adopt
hydra cleanup hydra-1710648000-a1b2          # clean up
```

### `hydra list`

```bash
hydra list              # all agents
hydra list --repo .     # agents for current project only
```

Lists all spawned agents with their terminalId, worktreePath, branch.

### `hydra cleanup`

```bash
hydra cleanup <agentId>       # destroy terminal + remove worktree + delete branch
hydra cleanup --all           # clean up all completed agents
hydra cleanup --all --force   # clean up all agents (including running ones)
```

**That's it. Three commands.** Status, output, diff, and adopt use existing `termcanvas` CLI and `git` commands.

## Spawn Internal Flow

```
hydra spawn --task "fix bug" --type claude --repo .
│
├─ 1. Validate preconditions
│     ├─ TermCanvas running? (check ~/.termcanvas/port)
│     └─ Repo on canvas? (termcanvas project list --json)
│
├─ 2. Create workspace (when --worktree not specified)
│     ├─ git worktree add .worktrees/hydra-{id} -b hydra/{id} [base]
│     └─ termcanvas project rescan <project-id>
│
├─ 3. Create terminal
│     └─ termcanvas terminal create --worktree <path> --type <type>
│        → returns { id, type, title }
│
├─ 4. Wait for PTY ready
│     └─ Poll termcanvas terminal status <id>
│        Wait for status to become "waiting" (agent CLI initialized, showing prompt)
│        Timeout: 30s. On failure: cleanup and exit with error.
│
├─ 5. Send task
│     └─ termcanvas terminal input <id> "<task>\n"
│
├─ 6. Write agent record
│     └─ ~/.hydra/agents/{agentId}.json
│
└─ 7. Output result JSON
```

### PTY readiness timing

TermCanvas terminal status flow: `idle` → `running` → `active` (output during startup) → `waiting` (15s with no output, i.e. prompt is showing).

An agent CLI takes ~5s to initialize, then 15s of silence before `waiting` status. Total: ~20s from spawn to task delivery.

Acceptable for Phase 1. Future optimization: add prompt-ready detection to TermCanvas (detect `❯` or `>` characters) or reduce the waiting threshold.

### Agent type compatibility

All AI CLI types use the same flow: wait for prompt → send task text.

| Type | CLI binary | Notes |
|------|-----------|-------|
| claude | `claude` | Claude Code CLI |
| codex | `codex` | OpenAI Codex CLI |
| kimi | `kimi` | Kimi CLI |
| gemini | `gemini` | Gemini CLI |
| opencode | `opencode` | OpenCode CLI |

## Data Storage

```
~/.hydra/
└── agents/
    └── {agentId}.json
```

Agent record:

```typescript
interface AgentRecord {
  id: string              // hydra-{timestamp}-{random4}
  task: string            // task description
  type: string            // claude | codex | kimi | ...
  repo: string            // absolute path to project
  terminalId: string      // TermCanvas terminal ID
  worktreePath: string    // absolute path to worktree
  branch: string | null   // branch name (null when using existing worktree)
  baseBranch: string      // base branch
  ownWorktree: boolean    // whether cleanup should remove the worktree
  createdAt: string       // ISO timestamp
}
```

No `status` field. Status is queried in real time from TermCanvas. No stale cache.

`cleanup` deletes the JSON file.

## TermCanvas Changes

One new API endpoint:

```
POST /project/:id/rescan
```

Triggers immediate worktree re-scan for a project. Reuses existing `projectScanner.listWorktrees()` and `syncWorktrees()` logic.

CLI addition:

```bash
termcanvas project rescan <project-id>
```

Small change: one route + a few lines of logic in `api-server.ts`, one subcommand in `cli/termcanvas.ts`.

## Project Structure

Lives in the TermCanvas repo under `hydra/`:

```
hydra/
├── src/
│   ├── cli.ts              # Entry point, command routing (hand-written process.argv)
│   ├── spawn.ts            # hydra spawn
│   ├── list.ts             # hydra list
│   ├── cleanup.ts          # hydra cleanup
│   ├── termcanvas.ts       # termcanvas CLI call wrapper
│   └── store.ts            # ~/.hydra/ read/write
├── package.json
├── tsconfig.json
└── build.ts                # esbuild single-file bundle
```

### Tech stack

| Component | Choice |
|-----------|--------|
| Language | TypeScript |
| Runtime | Node.js |
| CLI parsing | Hand-written `process.argv` (zero dependencies) |
| External calls | `termcanvas` CLI + `git` via `child_process.execSync` |
| Build | esbuild single-file bundle |

No TypeScript imports from TermCanvas. Hydra calls TermCanvas through CLI/HTTP only. Fully decoupled.

## Implementation Phases

### Phase 1: Minimum viable

1. TermCanvas: add `POST /project/:id/rescan` API + CLI command
2. Hydra: implement `spawn` + `list` + `cleanup`
3. Verify: Claude Code in a TermCanvas terminal runs `hydra spawn`, sub-agent terminal appears on canvas

### Phase 2: Main agent education

1. Add Hydra usage instructions to project CLAUDE.md
2. Main agent autonomously decides when to use Hydra based on task uncertainty

### Phase 3 (optional): Analysis

1. `hydra analyze --branches branch1,branch2,...` — convergence analysis across multiple branches
2. Pure function: input git diffs, output report. Independent of spawn flow.
3. Works with any branches, not just Hydra-spawned ones.

## Example: Main Agent Workflow

```bash
# Main agent (Claude Code) decides task needs a sub-agent

# 1. Spawn
result=$(hydra spawn --task "Fix the race condition in OrderService.checkout(). \
  The bug is that concurrent requests can double-charge. \
  Add proper locking." --type claude --repo .)

# result contains agentId, terminalId, worktreePath, branch
# TermCanvas canvas now shows a new terminal with Claude working

# 2. Main agent continues other work, periodically checks:
termcanvas terminal status tc-xyz-123
# → "active" (still working)
# → "completed" (done)

# 3. Review sub-agent's work
termcanvas diff /path/to/.worktrees/hydra-1710648000-a1b2 --summary
# → +45 -12  src/services/OrderService.ts
# → +38 -0   src/services/__tests__/OrderService.test.ts

# 4. Adopt
git merge hydra/1710648000-a1b2

# 5. Clean up
hydra cleanup hydra-1710648000-a1b2
```

## Example: Multiple Sub-Agents

```bash
# Spawn 3 sub-agents for different tasks
a1=$(hydra spawn --task "Implement backend API for user settings" --type claude --repo .)
a2=$(hydra spawn --task "Build settings UI page with React" --type codex --repo .)
a3=$(hydra spawn --task "Write integration tests for settings feature" --type claude --repo .)

# User sees 3 new terminals on TermCanvas canvas, all working in parallel

# Wait for all to complete (main agent polls periodically)
# Then review and merge each one
```
