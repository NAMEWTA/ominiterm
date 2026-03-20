# Composer Paste Strategy: Per-Terminal Image+Text Handling

## Problem

When the Composer sends an image + text together to Claude Code, the image
path and text get concatenated into one string (e.g. `image-1.png你好`)
instead of being recognized separately.

## Root Cause

Claude Code's Ink-based React hook `KKq` (usePasteHandler) has a **100ms
debounce aggregation** layer:

1. Each bracketed paste event's text is pushed into a `chunks[]` array.
2. A 100ms timeout is set/reset on each new chunk.
3. When the timeout fires, all chunks are joined: `chunks.join("")`.
4. The joined string is split by `/ (?=\/|[A-Za-z]:\\)/` (space + path
   start) or `\n` (newline).
5. Parts matching `/\.(png|jpe?g|gif|webp)$/i` are treated as images
   (`Hf1`); the rest as text.

This means two separate bracketed paste writes arriving <100ms apart are
joined into a single string that Claude cannot split back into image path
and text.

Previous attempts:
- **120ms inter-paste delay** (v0.8.12 `e7d1216`): avoids coalescing but
  introduces a React state race that can drop the second paste (text lost).
- **Single write with join** (v0.8.13 `55171c5`): eliminates the race but
  the tokenizer concatenates image path + text.
- **Separate writes without delay** (v0.8.14 `840e15a`): same as single
  write in practice — OS/pty coalesces synchronous writes.

## Why Codex Has No Problem

Codex CLI is Rust + crossterm. Each bracketed paste is parsed independently
at the byte level (no JS debounce aggregation). Sending separate pastes
works correctly without any delay.

## Solution: Per-Terminal Paste Strategy

Add a `pasteStrategy` field to `ComposerAdapterConfig`:

| Strategy | Behavior | Used by |
|----------|----------|---------|
| `aggregate` | Combine all image paths + text into a **single** bracketed paste, separated by `\n`. Claude's own splitting logic handles the rest. | Claude Code |
| `separate` | Send each image path as its own bracketed paste, then text as another. No inter-paste delay needed since Codex/others parse them independently. | Codex, Kimi, Gemini, OpenCode |

### Aggregate format (Claude)

```
\x1b[200~/path/to/image-1.png\n/path/to/image-2.png\nuser text here\x1b[201~
```

Claude's parsing:
1. Single paste event → no debounce coalescing issue.
2. Split by `\n` → `["/path/image-1.png", "/path/image-2.png", "user text"]`.
3. `Hf1` detects image paths by extension → images attached, text kept.

### Separate format (Codex etc.)

```
Write 1: \x1b[200~/path/to/image-1.png\x1b[201~
Write 2: \x1b[200~user text here\x1b[201~
Write 3: \r
```

Codex parses each paste independently. No delay between writes needed
(verified empirically by Hydra Codex agent on Codex 0.116.0).

## Verification

- Claude: reverse-engineered from `cli.js` (v2.1.78). The `KKq` hook,
  100ms debounce (`SbY=100`), `chunks.join("")`, newline splitting, and
  `Hf1` regex are all confirmed in source.
- Codex: empirically tested by Hydra agent. Single paste with
  `path\ntext` renders as multi-line text (broken). Separate paste with
  path-only correctly shows `[Image #1]`.

## Known Edge Case

If user text contains a line that ends with `.png`/`.jpg`/`.gif`/`.webp`,
Claude's `Hf1` would classify it as an image path. Probability is very
low. Possible future mitigation: append a zero-width space (`\u200B`) to
such lines to break the regex match.

## Files to Change

1. `src/terminal/cliConfig.ts` — add `pasteStrategy: "aggregate" | "separate"` to `ComposerAdapterConfig`.
2. `electron/composer-submit.ts` — branch on `pasteStrategy` in `submitBracketedPaste()`.
3. `tests/composer-submit.test.ts` — add tests for both strategies.
