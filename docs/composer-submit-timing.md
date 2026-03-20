# Composer Submit Timing Issue

**Baseline**: `62abb7f` (2026-03-20)
**File**: `electron/composer-submit.ts`

## Problem

When submitting text-only input to Claude Code via the Composer, the user
occasionally needs to press Enter twice. The text appears in Claude's input
field but does not submit on the first attempt.

## Root Cause

Claude Code uses Ink (React terminal renderer). Ink's paste handler has a
**100ms debounce** — it buffers bracketed-paste data and processes it as a
batch after 100ms of silence.

The current text-only submit sequence for Claude (aggregate strategy):

```
1. writeToPty: \x1b[200~text\x1b[201~   (bracketed paste)
2. await delayMs(120)                     (pasteDelayMs)
3. writeToPty: \r                         (submit)
```

The `\r` arrives ~120ms after the paste, which is only ~20ms after Ink's
debounce window closes. If the system is under load (Claude streaming output,
heavy rendering, etc.), the React state flush from the paste handler may not
complete before `\r` arrives. The `\r` then hits an empty/stale input field
and is silently dropped.

The user presses Enter again — this time the Composer is empty (cleared after
the first submit), so `getPassthroughSequence` forwards `\r` directly to the
PTY. By now Claude's input field has the text, and this second `\r` submits
successfully.

## Relevant Code Paths

### Text-only (current, fragile)

`composer-submit.ts:188-189` — sends text as **bracketed paste**:

```typescript
} else if (request.text.trim().length > 0) {
  writePtyData(ptyId, buildBracketedPaste(request.text), ...);
}
```

Then `composer-submit.ts:200-203` — fixed delay + submit:

```typescript
if (stagedImagePaths.length > 0 || request.text.trim().length > 0) {
  await deps.delayMs(adapter.pasteDelayMs);  // 120ms
}
writePtyData(ptyId, "\r", ...);
```

### Image+text (already fixed)

`composer-submit.ts:182-187` — images as bracketed paste, text as
**raw characters**:

```typescript
if (stagedImagePaths.length > 0) {
  writePtyData(ptyId, buildBracketedPaste(stagedImagePaths.join("\n")), ...);
  if (request.text.trim().length > 0) {
    writePtyData(ptyId, request.text, ...);  // raw characters
  }
}
```

Raw characters go through Ink's `useInput` path — no debounce, no paste
handler, no race condition.

## Why Image+Text Doesn't Have This Bug

Commit `4fb2612` switched the image+text path to send text as raw characters
instead of bracketed paste. Raw characters bypass Ink's paste handler entirely
and go through the synchronous `useInput` event loop. The `\r` at the end is
processed in the same synchronous flow, so it always sees the correct input
state.

## Historical Context

The paste-vs-submit timing has been a recurring issue. Relevant commit chain:

| Commit | Change | Outcome |
|--------|--------|---------|
| `a258ec1` | Add 120ms delay between paste and `\r` | Fixed the "always drops" case |
| `fd63c06` | Add extra delay for image pastes | Fixed image+text timing |
| `ff57fb4` | Replace fixed delay with output-gated submit | Too fast, broke image recognition |
| `e7d1216` | Restore fixed 120ms delay | Stable but still races under load |
| `55171c5` | Send all pastes in single write | Concatenation bugs |
| `840e15a` | Send each paste as separate write | React state race |
| `ad60913` | Per-terminal paste strategy (aggregate/separate) | Fixed Codex, Claude still races |
| `4fb2612` | Raw characters for text in image+text path | Fixed image+text, text-only unchanged |

## Proposed Fix

Unify the text-only path with the image+text path: send text as raw
characters instead of bracketed paste for the aggregate strategy.

```typescript
// Before (text-only, aggregate):
writePtyData(ptyId, buildBracketedPaste(request.text), ...);
// ... 120ms delay ...
writePtyData(ptyId, "\r", ...);

// After (text-only, aggregate):
writePtyData(ptyId, request.text, ...);
writePtyData(ptyId, "\r", ...);
// No delay needed — both go through Ink's useInput synchronously.
```

### Trade-offs

| | Bracketed Paste | Raw Characters |
|---|---|---|
| Ink path | Paste handler (async, debounced) | `useInput` (sync) |
| Multi-line | Triggers multi-line mode if `\n` present | Each char processed individually |
| Submit timing | Needs delay, still races | Immediate, no race |
| Performance | Single write for all text | Single write, same perf |

### Risks

- Raw characters go through Ink's `useInput` one keystroke at a time. For
  very long texts this is slower, but in practice the PTY write is a single
  buffer and Ink processes it in one event loop tick.
- If Claude Code ever changes its input handling to REQUIRE bracketed paste
  for text (e.g., to distinguish typed vs pasted input), this would break.
  Currently Claude Code treats both identically for text content.

### Scope

Only affects the `aggregate` strategy (Claude Code). The `separate` strategy
(Codex, Kimi, Gemini, OpenCode) continues using bracketed paste, which works
correctly for those CLIs' synchronous crossterm/stdin parsers.
