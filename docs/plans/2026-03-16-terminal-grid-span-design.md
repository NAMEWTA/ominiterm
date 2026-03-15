# Terminal Grid Span Resizing

## Problem

Terminal size is hardcoded at 540x260 (magic numbers from early development). Users need to resize individual terminals — especially AI CLI terminals (Claude, Codex) which benefit from more visible context — while maintaining the grid-based layout for quick terminal management.

## Design

### Data Model

Add `span` field to `TerminalData`:

```ts
span: { cols: number; rows: number } // default { cols: 1, rows: 1 }
```

Four presets: 1x1, 2x1 (wide), 1x2 (tall), 2x2 (large).

### Base Cell Size

Derived from 80 cols x 24 rows at fontSize 13, lineHeight 1.4:
- `TERMINAL_W = 640`
- `TERMINAL_H = 480`

Replaces the current 540x260.

### Layout Algorithm

Replace `computeTerminalPosition` with bin-packing:

1. Maintain `occupied[][]` 2D array (cols x rows)
2. For each terminal, scan from (0,0) row-by-row to find first position that fits its span
3. Record position, mark cells as occupied
4. Pixel position: `x = col * (TERMINAL_W + GRID_GAP)`, `y = row * (TERMINAL_H + GRID_GAP)`
5. Pixel size: `w = span.cols * TERMINAL_W + (span.cols - 1) * GRID_GAP`, `h = span.rows * TERMINAL_H + (span.rows - 1) * GRID_GAP`

`computeWorktreeSize` updated to derive from actual occupied rows/cols.

### Interaction

**Right-click context menu** on terminal title bar:
- Shows 4 size options with current selection highlighted
- New `ContextMenu` component

**Keyboard shortcuts** (extends ShortcutMap):
- `Mod+1` -> 1x1
- `Mod+2` -> 2x1 (wide)
- `Mod+3` -> 1x2 (tall)
- `Mod+4` -> 2x2 (large)
- Acts on focused terminal

### Default Spans by Type

- `shell` -> 1x1
- `claude`, `codex`, `gemini`, `opencode`, `kimi` -> 2x1

### Files to Change

1. `types/index.ts` — add span to TerminalData
2. `layout.ts` — new base size, bin-packing algorithm, worktree size calculation
3. `terminal/TerminalTile.tsx` — width/height from span
4. `containers/WorktreeContainer.tsx` — pass span info, adapt drag reorder
5. `stores/projectStore.ts` — add updateTerminalSpan action
6. `stores/shortcutStore.ts` — add 4 shortcut entries
7. `hooks/useKeyboardShortcuts.ts` — handle span shortcuts
8. `App.tsx` — migration: add default span to existing terminals
9. New: `components/ContextMenu.tsx` — right-click menu component

### Out of Scope

- Pixel-level free resize
- Cross-worktree terminal span
- Drag reorder logic changes (only adapt position calculation for spans)
