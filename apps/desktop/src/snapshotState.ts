import { useProjectStore } from "./stores/projectStore";
import { useSplitLayoutStore } from "./stores/splitLayoutStore";
import { serializeAllTerminals } from "./terminal/terminalRegistry";
import { logSlowRendererPath } from "./utils/devPerf";

export interface WorkspaceSnapshot {
  version: number;
  projects: ReturnType<typeof useProjectStore.getState>["projects"];
}

export function buildSnapshotState(): WorkspaceSnapshot {
  const startedAt = performance.now();
  const scrollbacks = serializeAllTerminals();
  const layouts = useSplitLayoutStore.getState().layouts;

  const projects = useProjectStore.getState().projects.map((project) => ({
    ...project,
    boardLayout: layouts[project.id],
    worktrees: project.worktrees.map((worktree) => ({
      ...worktree,
      terminals: worktree.terminals.map((terminal) => ({
        ...terminal,
        scrollback:
          scrollbacks[terminal.id] ?? terminal.scrollback ?? undefined,
        ptyId: null,
      })),
    })),
  }));

  const snapshot = {
    version: 2,
    projects,
  };

  logSlowRendererPath("snapshotState.build", startedAt, {
    thresholdMs: 20,
    details: {
      projects: projects.length,
      terminals: projects.reduce(
        (count, project) =>
          count +
          project.worktrees.reduce(
            (worktreeCount, worktree) => worktreeCount + worktree.terminals.length,
            0,
          ),
        0,
      ),
    },
  });

  return snapshot;
}

export function snapshotState(): string {
  const startedAt = performance.now();
  const serialized = JSON.stringify(buildSnapshotState(), null, 2);
  logSlowRendererPath("snapshotState.serialize", startedAt, {
    thresholdMs: 20,
    details: { bytes: serialized.length },
  });
  return serialized;
}
