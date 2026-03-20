# Scroll-Pinning Bug: Evolution of Fixes

## Problem

During AI CLI (Claude, Codex) streaming output, the terminal viewport
fails to stay pinned to the bottom, or snaps back when the user tries
to scroll up to read history.

## Fix Attempts (chronological)

### Attempt 1: `9fd6689` — xterm.onScroll as single source of truth

- Used `xterm.onScroll()` (buffer-level event) + `programmaticScroll` boolean
  to track follow-bottom state.
- **Failed because**: `xterm.onScroll()` only fires for buffer-level pushes,
  NOT for user viewport scrolling. User scroll-up was invisible.

### Attempt 2: `9a75fd7` — viewport DOM scroll event

- Switched to `.xterm-viewport` native `scroll` event. Upgraded guard to
  `programmaticScrollCount` counter with `setTimeout(0)` for async dispatch.
- **Failed because**: still can't distinguish user scrolls from xterm's own
  internal auto-scroll. During streaming, counter is often >0 and user scrolls
  get swallowed by the guard.

### Attempt 3: `a32faa2` — relaxed guard for non-bottom scrolls

- Fixed the guard: only skip scroll events that are BOTH programmatic AND at
  bottom. User scrolls away from bottom are always honored.
- **Failed because**: same fundamental model — still deriving `followBottom`
  from scroll events. xterm internal scrolls, buffer/baseY timing, DOM scroll
  dispatch order can still cause misdetection.

### Attempt 4: `18fd0dc` — user input event tracking (current)

- **Fundamentally different approach**: track user INTENT via synchronous
  input events, not scroll POSITION via async scroll events.
- `wheel (deltaY < 0)` and `PageUp/Home keydown` → `userScrolledUp = true`
- `scroll` event only used for re-enabling: when `userScrolledUp` is true
  and viewport reaches bottom → reset to false.
- Write callback: `scrollToBottom()` unconditionally unless `userScrolledUp`.

## Why Attempt 4 is Different

| Aspect | Attempts 1–3 | Attempt 4 |
|--------|-------------|-----------|
| Signal source for "stop following" | scroll event (ambiguous) | wheel/keydown (unambiguous) |
| Race condition | scroll event timing vs write callback | None — input events are synchronous |
| Guard complexity | programmaticScroll counter + setTimeout | None needed |
| scroll event role | Both enable AND disable follow | Only re-enable (from scrolled-up → follow) |

The core insight: **scroll events don't carry "why" information**. No amount
of guarding can reliably distinguish user scrolls from programmatic/content
scrolls through the scroll event alone. Input events (wheel, keydown) are
synchronous, user-initiated, and never fired by programmatic scrolls.

## Known Remaining Edge Cases

1. **Scrollbar drag up**: only fires `scroll` events (no wheel/keydown),
   so `userScrolledUp` won't be set. User gets pulled back to bottom.
   Fix: detect via `pointerdown` position on viewport's scrollbar area.

2. **Home/PageUp false positive**: in full-screen TUI apps, these keys may
   be consumed by the app without actually scrolling the viewport.
   Mitigation: acceptable — worst case is auto-follow stops until viewport
   reaches bottom.

3. **wheel in mouse-reporting mode**: some TUI apps consume wheel events.
   Same mitigation as above.

These edge cases don't affect the primary use case (mouse wheel scroll-up
during Claude/Codex streaming).
