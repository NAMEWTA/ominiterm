---
name: hydra
description: Spawn AI sub-agents in isolated git worktrees via Hydra. Use when tasks can be parallelized or decomposed.
alwaysApply: false
---

# Hydra Sub-Agent Tool

When task uncertainty is high (unclear root cause, multiple valid approaches,
decomposable subtasks), investigate first, then use hydra to spawn sub-agents.

## Workflow

1. Investigate the problem yourself first, form a clear task description
2. Spawn: `hydra spawn --task "<specific task>" --type claude --repo .`
3. **You MUST poll all agents until every one reaches "completed" or "error".**
   Poll each agent every 30s: `termcanvas terminal status <terminalId>`
   Do NOT ask the user whether to poll. Do NOT stop working while agents run.
   Continue with other work or poll in a loop.
4. Review results: `termcanvas diff <worktreePath> --summary`
5. Adopt changes: `git merge <branch>`
6. Clean up: `hydra cleanup <agentId>`

## Rules

- After spawning, you are responsible for monitoring until completion.
- Never assume an agent finished just because spawn returned successfully.
- If an agent is stuck in "waiting" for >2 minutes, check its terminal output.
- When NOT to use: simple fixes, high-certainty tasks, faster to do yourself.
