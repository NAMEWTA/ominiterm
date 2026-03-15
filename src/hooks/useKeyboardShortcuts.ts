import { useEffect } from "react";
import { useProjectStore, createTerminal } from "../stores/projectStore";
import { useCanvasStore } from "../stores/canvasStore";
import {
  computeGridCols,
  computeTerminalPosition,
  computeWorktreeSize,
  TERMINAL_W,
  TERMINAL_H,
  WT_PAD,
  WT_TITLE_H,
  PROJ_PAD,
  PROJ_TITLE_H,
} from "../layout";

function getAllTerminals() {
  const { projects } = useProjectStore.getState();
  const list: {
    projectId: string;
    worktreeId: string;
    terminalId: string;
    index: number;
  }[] = [];
  for (const p of projects) {
    for (const w of p.worktrees) {
      for (let i = 0; i < w.terminals.length; i++) {
        list.push({
          projectId: p.id,
          worktreeId: w.id,
          terminalId: w.terminals[i].id,
          index: list.length,
        });
      }
    }
  }
  return list;
}

function getFocusedTerminalIndex(list: ReturnType<typeof getAllTerminals>) {
  const { projects } = useProjectStore.getState();
  for (const p of projects) {
    for (const w of p.worktrees) {
      for (const t of w.terminals) {
        if (t.focused) {
          return list.findIndex((item) => item.terminalId === t.id);
        }
      }
    }
  }
  return -1;
}

function zoomToTerminal(
  projectId: string,
  worktreeId: string,
  terminalId: string,
) {
  const { projects } = useProjectStore.getState();
  const project = projects.find((p) => p.id === projectId);
  if (!project) return;
  const worktree = project.worktrees.find((w) => w.id === worktreeId);
  if (!worktree) return;
  const terminalIndex = worktree.terminals.findIndex(
    (t) => t.id === terminalId,
  );
  if (terminalIndex === -1) return;

  const cols = computeGridCols(worktree.terminals.length);
  const { x: gridX, y: gridY } = computeTerminalPosition(terminalIndex, cols);

  const absX =
    project.position.x + PROJ_PAD + worktree.position.x + WT_PAD + gridX;
  const absY =
    project.position.y +
    PROJ_TITLE_H +
    PROJ_PAD +
    worktree.position.y +
    WT_TITLE_H +
    WT_PAD +
    gridY;

  const padding = 60;
  const viewW = window.innerWidth - padding * 2;
  const viewH = window.innerHeight - padding * 2;
  const scale = Math.min(viewW / TERMINAL_W, viewH / TERMINAL_H) * 0.85;

  const centerX = -(absX + TERMINAL_W / 2) * scale + window.innerWidth / 2;
  const centerY = -(absY + TERMINAL_H / 2) * scale + window.innerHeight / 2;

  useCanvasStore.getState().animateTo(centerX, centerY, scale);
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Escape — close modals, clear focus
      if (e.key === "Escape") {
        useProjectStore.getState().clearFocus();
        return;
      }

      if (!isMod) return;

      // Cmd+B — toggle sidebar
      if (e.key === "b") {
        e.preventDefault();
        const store = useCanvasStore.getState();
        store.setSidebarCollapsed(!store.sidebarCollapsed);
        return;
      }

      // Cmd+T — new terminal in focused worktree
      if (e.key === "t") {
        e.preventDefault();
        const { focusedProjectId, focusedWorktreeId, addTerminal } =
          useProjectStore.getState();
        if (focusedProjectId && focusedWorktreeId) {
          const terminal = createTerminal("shell");
          addTerminal(focusedProjectId, focusedWorktreeId, terminal);
        }
        return;
      }

      // Cmd+] — focus next terminal + zoom
      if (e.key === "]") {
        e.preventDefault();
        const list = getAllTerminals();
        if (list.length === 0) return;
        const currentIndex = getFocusedTerminalIndex(list);
        const nextIndex =
          currentIndex === -1 ? 0 : (currentIndex + 1) % list.length;
        const next = list[nextIndex];
        useProjectStore.getState().setFocusedTerminal(next.terminalId);
        zoomToTerminal(next.projectId, next.worktreeId, next.terminalId);
        return;
      }

      // Cmd+[ — focus prev terminal + zoom
      if (e.key === "[") {
        e.preventDefault();
        const list = getAllTerminals();
        if (list.length === 0) return;
        const currentIndex = getFocusedTerminalIndex(list);
        const prevIndex =
          currentIndex <= 0 ? list.length - 1 : currentIndex - 1;
        const prev = list[prevIndex];
        useProjectStore.getState().setFocusedTerminal(prev.terminalId);
        zoomToTerminal(prev.projectId, prev.worktreeId, prev.terminalId);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
