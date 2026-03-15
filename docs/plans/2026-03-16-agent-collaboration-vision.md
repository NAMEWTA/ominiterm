# AI Agent Collaboration Vision

## Goal

Enable multiple AI coding agents running inside TermCanvas to collaborate on complex tasks — with an external orchestrator (OpenClaw) handling the high-level coordination, and TermCanvas providing the terminal infrastructure and visual feedback.

## The Problem

Today's AI coding agents (Claude, Codex, Kimi, etc.) work in isolation. A developer manually assigns tasks, waits for results, reviews, and then assigns the next task. For a large feature that spans multiple modules, this is sequential and slow.

The ideal workflow: one agent writes the backend, another writes the frontend, a third writes tests — all in parallel, across separate worktrees, with an orchestrator coordinating handoffs and resolving conflicts.

## Why Not Build Workflow Into TermCanvas?

We considered building a workflow engine directly into TermCanvas (see discussion history). The core difficulty: TermCanvas interacts with agents through terminals (unstructured text I/O). Reliably detecting agent state, parsing output, and making orchestration decisions from raw terminal text is fragile and model-specific.

Instead, we delegate orchestration to **OpenClaw**, which already has:
- A reasoning engine (backed by LLMs) that can interpret terminal output
- The **Lobster workflow engine** for deterministic pipelines with approvals and resumable state
- A mature tool/skill system for defining reusable actions

TermCanvas focuses on what it does best: **managing terminals and providing visual feedback**. OpenClaw focuses on what it does best: **planning, deciding, and coordinating**.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  OpenClaw (Orchestrator)                                   │
│                                                            │
│  "Build auth module with tests"                            │
│       │                                                    │
│       ├──> Plan: 3 parallel tasks                          │
│       │    ├── backend (Claude in worktree-1)              │
│       │    ├── frontend (Codex in worktree-2)              │
│       │    └── tests (Claude in worktree-3)                │
│       │                                                    │
│       ├──> Monitor: poll status, read output, check diff   │
│       │                                                    │
│       └──> Coordinate: merge when all pass, resolve issues │
└──────────────────────┬─────────────────────────────────────┘
                       │  CLI / HTTP API
                       ▼
┌────────────────────────────────────────────────────────────┐
│  TermCanvas (Terminal Infrastructure)                      │
│                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ worktree-1  │  │ worktree-2  │  │ worktree-3  │       │
│  │ Claude      │  │ Codex       │  │ Claude      │       │
│  │ (backend)   │  │ (frontend)  │  │ (tests)     │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                            │
│  Visual canvas: user sees all agents working in real time  │
└────────────────────────────────────────────────────────────┘
```

## Example Workflow

User tells OpenClaw:

> "Add OAuth2 login to the project. Backend in Go, frontend in React. Write integration tests."

OpenClaw executes via TermCanvas CLI (see [CLI API Design](./2026-03-16-cli-api-design.md)):

```
1. termcanvas project add /path/to/repo
2. termcanvas terminal create --worktree /path/wt-backend --type claude
3. termcanvas terminal create --worktree /path/wt-frontend --type codex
4. termcanvas terminal create --worktree /path/wt-tests --type claude
5. termcanvas terminal input <backend-id> "Implement OAuth2 backend in Go..."
6. termcanvas terminal input <frontend-id> "Build OAuth2 login UI in React..."
7. # Poll until both complete:
   termcanvas terminal status <backend-id>   # → "waiting"
   termcanvas terminal status <frontend-id>  # → "waiting"
8. termcanvas diff /path/wt-backend --summary
9. termcanvas diff /path/wt-frontend --summary
10. # Feed context to test agent:
    termcanvas terminal input <test-id> "Write integration tests for the OAuth2 changes in wt-backend and wt-frontend..."
11. # Wait, review, merge
```

The user watches all of this happen on the TermCanvas canvas in real time — they can intervene at any point by clicking into a terminal and typing.

## Key Design Principles

1. **TermCanvas is dumb infrastructure.** It creates terminals, forwards I/O, reports status. It does not interpret agent output or make decisions.

2. **OpenClaw is the brain.** It reads terminal output, understands context, decides what to do next. If an agent fails, OpenClaw decides whether to retry, ask the user, or reassign.

3. **Human stays in the loop.** The canvas is always visible. The user can pause OpenClaw, take over a terminal manually, then let OpenClaw resume. This is not full autonomy — it's assisted autonomy with visual oversight.

4. **Git worktrees enable parallel agents.** Each agent works in its own worktree, so there are no file conflicts during parallel execution. Merging happens as a separate, coordinated step.

## Collaboration Patterns

### Pattern 1: Parallel implementation + merge
Multiple agents work on independent parts simultaneously. Orchestrator merges results after all complete.

### Pattern 2: Pipeline (sequential handoff)
Agent A writes code → Agent B reviews → Agent C writes tests → human approves. Each stage starts after the previous one completes.

### Pattern 3: Adversarial review
Agent A implements, Agent B tries to break it (finds bugs, writes adversarial tests). Iterate until Agent B can't find issues.

### Pattern 4: Specialist routing
Orchestrator analyzes the task and routes subtasks to the most suitable agent — Claude for architecture, Codex for boilerplate, Kimi for Chinese-language docs, etc.

## Prerequisites

This vision depends on the [CLI API](./2026-03-16-cli-api-design.md) being implemented first. Specifically:

- **Phase 1** (local server + CRUD) enables basic orchestration
- **Phase 2** (terminal I/O) enables the full feedback loop (status polling, output reading, input sending)
- **Phase 3** (OpenClaw skill) makes the integration turnkey

## Open Questions

- **Approval gates**: Should TermCanvas support a "pause and wait for human approval" primitive, or should OpenClaw handle this entirely through its own HITL mechanism?
- **Shared context**: How does the orchestrator efficiently share context between agents? Git diff is one channel. Should TermCanvas also expose a shared scratchpad or message bus?
- **Conflict resolution**: When parallel agents produce conflicting changes, who resolves — OpenClaw (automated), the user (manual), or a dedicated "merge agent"?
