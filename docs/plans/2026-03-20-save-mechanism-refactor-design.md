# Save Mechanism Refactor Design

## Problem

1. No auto-save — state only saved when user clicks "Save" in the close dialog
2. "Save" button opens a file picker (Save-As semantics), confusing
3. PTY processes killed with SIGHUP on close, no time for AI CLIs to flush session data
4. Session JSONL files lost → `claude --resume` / `codex resume` fails on restart

## Design

### 1. Workspace Store

New `workspaceStore.ts` (not canvasStore — that only owns viewport/panel state):

```ts
interface WorkspaceState {
  workspacePath: string | null;  // associated .termcanvas file
  dirty: boolean;
  lastSavedAt: number | null;
  setWorkspacePath(path: string | null): void;
  markDirty(): void;
  markClean(): void;
}
```

Title bar shows document name: `workspacePath` basename or "Untitled", with `*` suffix when dirty.

### 2. Dirty Tracking

**Event-based, not snapshot-comparison.** Only intentional user mutations mark dirty:

- Project/worktree add/remove/reorder/rename
- Terminal add/remove/resize/move
- Drawing element changes
- Browser card changes
- Canvas viewport changes (pan/zoom)

**NOT dirty-triggering** (runtime recovery data):
- Terminal scrollback updates
- Terminal status changes (active/waiting/idle)
- Session ID capture
- PTY ID assignment

Implementation: call `workspaceStore.markDirty()` from the relevant store actions in `projectStore`, `drawingStore`, `browserCardStore`, and `canvasStore`.

### 3. Save Semantics

| Action | Behavior |
|--------|----------|
| **Cmd+S** | Has `workspacePath` → silent overwrite; no path → open file picker (first save). Always also writes `state.json`. |
| **Cmd+Shift+S** | Always open file picker. Update `workspacePath` after save. Also writes `state.json`. |
| **Auto-save** | Dirty-triggered debounce (5s after last dirty mark) + 60s max-interval backstop. Writes `state.json` only, never the `.termcanvas` file. |
| **Close (dirty)** | Dialog: Save / Don't Save / Cancel. "Save" = same as Cmd+S. |
| **Close (clean)** | Write `state.json` (final recovery snapshot) then exit directly, no dialog. |
| **Open workspace** | Check dirty first → Save/Discard/Cancel gate before loading new data. |

### 4. Close Dialog Changes

Current dialog text ("保存工作区？") stays. Behavior changes:

- **Save**: behaves like Cmd+S (silent save if has path, file picker if not). On success → exit. On failure → show error, keep window open (no force-close on error).
- **Don't Save**: set `skipRestore` flag in `state.json` (don't wipe the file — preserves last autosaved recovery state). On next startup, check flag and skip restore if set.
- **Cancel**: dismiss dialog, stay open.

### 5. Auto-Save Implementation

```
useAutoSave() hook in App.tsx:
  - Subscribe to workspaceStore.dirty
  - On dirty=true: start 5s debounce timer
  - On timer fire: snapshotState() → state.save() → reset timer
  - 60s max-interval backstop: if dirty and >60s since last save, force save
  - On dirty=false (user did Cmd+S): cancel pending timer
```

### 6. Atomic state.json Writes

Change `StatePersistence.save()` to write-to-temp + rename:

```ts
save(state: unknown) {
  const tmp = STATE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf-8");
  fs.renameSync(tmp, STATE_FILE);
}
```

Prevents truncated recovery file on crash during write.

### 7. Graceful PTY Shutdown

Move graceful kill to `ptyManager.destroy()` level (covers all teardown paths: app close, terminal unmount, workspace switch).

```ts
async destroy(id: number): Promise<void> {
  const instance = this.instances.get(id);
  if (!instance) return;
  this.instances.delete(id);
  this.outputBuffers.delete(id);

  instance.kill("SIGTERM");

  // Wait up to 5s for process to exit, check every 100ms
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      process.kill(instance.pid, 0); // check alive
    } catch {
      return; // already exited
    }
    await new Promise(r => setTimeout(r, 100));
  }

  // Still alive after 5s → force kill
  try {
    process.kill(instance.pid, "SIGKILL");
  } catch { /* already gone */ }
}

async destroyAll(): Promise<void> {
  // Send SIGTERM to all in parallel, then wait
  const ids = [...this.instances.keys()];
  await Promise.all(ids.map(id => this.destroy(id)));
}
```

Note: `destroy()` becomes async. All callers must be updated.

### 8. New IPC Endpoints

| Endpoint | Purpose |
|----------|---------|
| `workspace:save-to-path` | Silent write data to a given file path (no dialog) |
| `workspace:set-title` | Update window title with document name |

### 9. New Keyboard Shortcuts

Add to `shortcutStore.ts`:

```ts
saveWorkspace: "mod+s",
saveWorkspaceAs: "mod+shift+s",
```

Handle in `useKeyboardShortcuts.ts`. These shortcuts must NOT be captured by terminal xterm — they should propagate to the app handler (already the case for Cmd+ combos via existing `hasPrimaryModifier` logic in TerminalTile).

### 10. Files to Change

| File | Change |
|------|--------|
| `src/stores/workspaceStore.ts` | **NEW** — workspacePath, dirty, lastSavedAt |
| `src/stores/canvasStore.ts` | Call `markDirty()` on viewport changes |
| `src/stores/projectStore.ts` | Call `markDirty()` on user-intent mutations |
| `src/stores/drawingStore.ts` | Call `markDirty()` on element changes |
| `src/stores/browserCardStore.ts` | Call `markDirty()` on card changes |
| `src/stores/shortcutStore.ts` | Add `saveWorkspace`, `saveWorkspaceAs` |
| `src/hooks/useKeyboardShortcuts.ts` | Handle Cmd+S / Cmd+Shift+S |
| `src/App.tsx` | Refactor `useCloseHandler`; add `useAutoSave` hook; add open-workspace dirty gate |
| `electron/pty-manager.ts` | `destroy()` → async graceful shutdown (SIGTERM → 5s → SIGKILL) |
| `electron/main.ts` | `app:close-confirmed` → async; add `workspace:save-to-path` IPC; update title |
| `electron/state-persistence.ts` | Atomic write (tmp + rename); `skipRestore` flag |
| `electron/preload.ts` | Expose new IPC endpoints |
| `src/i18n/en.ts` | Update copy |
| `src/i18n/zh.ts` | Update copy |

### 11. Out of Scope

- Auto-save to `.termcanvas` file (always state.json only)
- Session validation before `--resume` (separate improvement)
- Configurable graceful shutdown timeout (hardcode 5s for now)
