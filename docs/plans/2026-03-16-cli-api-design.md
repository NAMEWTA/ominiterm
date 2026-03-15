# TermCanvas CLI API Design

## Goal

Expose TermCanvas as a programmable terminal infrastructure that external AI agents (e.g., OpenClaw) can control via CLI. This turns TermCanvas from a manual visual tool into an automatable platform — users can operate the canvas by hand, or let an AI orchestrator drive it.

This is the foundational layer for the [AI Agent Collaboration Vision](./2026-03-16-agent-collaboration-vision.md).

## Motivation

TermCanvas manages multiple AI coding agents (Claude, Codex, Kimi, etc.) across git worktrees on a visual canvas. Currently all operations require manual interaction. By exposing a CLI, we enable:

- **OpenClaw integration**: OpenClaw acts as a high-level orchestrator — the user tells OpenClaw "set up 3 worktrees with Claude agents working on different tasks", and OpenClaw calls TermCanvas CLI to make it happen.
- **Scripting & automation**: Power users can write shell scripts to batch-create terminals, dispatch tasks, and query status.
- **Composability**: TermCanvas becomes a building block in larger AI workflows rather than a standalone app.

## Architecture

```
┌─────────────┐     shell commands     ┌──────────────┐     HTTP     ┌─────────────────┐
│  OpenClaw   │ ──────────────────────> │ termcanvas   │ ──────────> │ Electron Main   │
│  (or user   │                         │ CLI binary   │  localhost   │ Process          │
│   scripts)  │                         └──────────────┘             │ (local server)   │
└─────────────┘                                                      └────────┬────────┘
                                                                              │
                                                                     IPC      │
                                                                              ▼
                                                                     ┌─────────────────┐
                                                                     │ Renderer         │
                                                                     │ (React + Canvas) │
                                                                     └─────────────────┘
```

1. **Local HTTP server** — Runs inside Electron main process on a fixed or dynamic port (e.g., `localhost:17422`). Accepts JSON requests.
2. **CLI binary** (`termcanvas`) — Thin client that translates CLI commands into HTTP calls. Published as an npm package or bundled with the app.
3. **Renderer sync** — Main process forwards state changes to the renderer via existing IPC. The canvas updates in real time as CLI commands are executed.

## CLI Commands

### Project management

```bash
# Add a project to the canvas
termcanvas project add /path/to/repo

# List all projects
termcanvas project list

# Remove a project from the canvas
termcanvas project remove <project-id>
```

### Terminal management

```bash
# Create a terminal in a worktree
termcanvas terminal create --worktree /path --type claude
termcanvas terminal create --worktree /path --type shell

# List all terminals (optionally filter by worktree)
termcanvas terminal list [--worktree /path]

# Send input to a terminal
termcanvas terminal input <terminal-id> "write tests for the auth module"

# Get terminal status (idle/running/waiting/success/error)
termcanvas terminal status <terminal-id>

# Read terminal output (last N lines)
termcanvas terminal output <terminal-id> [--lines 50]

# Destroy a terminal
termcanvas terminal destroy <terminal-id>
```

### Diff & git

```bash
# Get diff for a worktree
termcanvas diff <worktree-path>

# Get diff summary (file list with +/- counts)
termcanvas diff <worktree-path> --summary
```

### Canvas control

```bash
# Navigate viewport to a specific project/worktree
termcanvas view <project-id>

# Get current canvas state (JSON)
termcanvas state
```

## Local Server API

The CLI is a thin wrapper. The real interface is the HTTP API:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/project/add` | Add project by path |
| GET | `/project/list` | List all projects |
| DELETE | `/project/:id` | Remove project |
| POST | `/terminal/create` | Create terminal (worktree, type) |
| GET | `/terminal/list` | List terminals |
| POST | `/terminal/:id/input` | Send input text |
| GET | `/terminal/:id/status` | Get status |
| GET | `/terminal/:id/output` | Read recent output |
| DELETE | `/terminal/:id` | Destroy terminal |
| GET | `/diff/:worktreePath` | Get diff |
| GET | `/state` | Full canvas state |

All responses are JSON. Errors use standard HTTP status codes.

## Security

- Server binds to `127.0.0.1` only — no external access.
- Optional auth token stored in `~/.termcanvas/auth` — CLI reads it automatically, external callers must include it in the `Authorization` header.
- Sensitive operations (destroy, remove) can require confirmation via a `--force` flag or token-based auth.

## Implementation Plan

### Phase 1: Local server + core CLI

1. Add a local HTTP server to Electron main process (express or native `http`)
2. Implement project and terminal CRUD endpoints
3. Build the `termcanvas` CLI binary (Node.js, minimal dependencies)
4. Wire server actions to existing store operations via IPC

### Phase 2: Terminal I/O

1. Implement `terminal/input` — forward text to PTY
2. Implement `terminal/output` — maintain a ring buffer of recent output per terminal
3. Implement `terminal/status` — expose current status

### Phase 3: OpenClaw integration

1. Write an OpenClaw skill/tool definition that wraps the TermCanvas CLI
2. Document how to configure OpenClaw to use TermCanvas as a tool
3. Example workflows: multi-agent task dispatch, automated code review pipeline

## Open Questions

- **Port selection**: Fixed port (e.g., 17422) or dynamic with port file (`~/.termcanvas/port`)?
- **Output streaming**: Should `terminal/output` support SSE/WebSocket for real-time streaming, or is polling sufficient?
- **Multi-window**: If multiple TermCanvas windows are open, how does the CLI target the right one?
