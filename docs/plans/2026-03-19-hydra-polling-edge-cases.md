# Hydra Polling Edge Cases

Known edge cases in the Hydra polling/completion detection flow. To be addressed in future iterations.

## 1. Sub-agent crashes without writing resultFile

If the Claude process crashes or gets killed, PTY exits and terminal status becomes `"success"` (exit 0) or `"error"` (exit non-zero). But no resultFile is ever written.

- `"error"` is caught by the polling loop, but reading resultFile will fail.
- `"success"` is NOT recognized as a terminal state in the skill — the main brain will poll indefinitely.

Reference: `TerminalTile.tsx:526` — `currentStatus = exitCode === 0 ? "success" : "error"`

**Fix**: Recognize `"success"` as a terminal state in SKILL.md. Handle missing resultFile gracefully (report to user).

## 2. No timeout mechanism

If a sub-agent enters an infinite loop (e.g. tool call cycle, retry loop), the main brain will poll forever, consuming context with each cycle.

**Fix**: Add a max poll count or elapsed time threshold. After exceeding it, report the situation to the user instead of continuing to poll.

## 3. resultFile written before agent fully finishes

The agent might write resultFile and then do additional work (e.g. final commit, cleanup). Reading resultFile immediately could miss the final state.

**Fix**: Low risk in practice — the task file instructs agents to write resultFile as their last action. Monitor for real-world occurrences before adding complexity.
