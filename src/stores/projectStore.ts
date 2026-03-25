import { create } from "zustand";
import type {
  ProjectData,
  TerminalData,
  TerminalOrigin,
  TerminalStatus,
  TerminalType,
  WorktreeData,
} from "../types/index.ts";
import { normalizeProjectsFocus } from "./projectFocus.ts";
import { useWorkspaceStore } from "./workspaceStore.ts";
import { usePreferencesStore } from "./preferencesStore.ts";
import {
  withToggledTerminalStarred,
  withUpdatedTerminalCustomTitle,
  withUpdatedTerminalType,
} from "./terminalState.ts";
import { logSlowRendererPath } from "../utils/devPerf.ts";

interface ProjectStore {
  projects: ProjectData[];
  focusedProjectId: string | null;
  focusedWorktreeId: string | null;
  addProject: (project: ProjectData) => void;
  removeProject: (projectId: string) => void;
  removeWorktree: (projectId: string, worktreeId: string) => void;
  syncWorktrees: (
    projectPath: string,
    worktrees: { path: string; branch: string; isMain: boolean }[],
  ) => void;
  addTerminal: (
    projectId: string,
    worktreeId: string,
    terminal: TerminalData,
  ) => void;
  removeTerminal: (
    projectId: string,
    worktreeId: string,
    terminalId: string,
  ) => void;
  updateTerminalPtyId: (
    projectId: string,
    worktreeId: string,
    terminalId: string,
    ptyId: number | null,
  ) => void;
  updateTerminalStatus: (
    projectId: string,
    worktreeId: string,
    terminalId: string,
    status: TerminalStatus,
  ) => void;
  updateTerminalSessionId: (
    projectId: string,
    worktreeId: string,
    terminalId: string,
    sessionId: string | undefined,
  ) => void;
  updateTerminalType: (
    projectId: string,
    worktreeId: string,
    terminalId: string,
    type: TerminalType,
  ) => void;
  updateTerminalCustomTitle: (
    projectId: string,
    worktreeId: string,
    terminalId: string,
    customTitle: string,
  ) => void;
  updateTerminalScrollback: (
    projectId: string,
    worktreeId: string,
    terminalId: string,
    scrollback: string | undefined,
  ) => void;
  toggleTerminalStarred: (
    projectId: string,
    worktreeId: string,
    terminalId: string,
  ) => void;
  setFocusedTerminal: (
    terminalId: string | null,
    options?: { focusComposer?: boolean },
  ) => void;
  clearFocus: () => void;
  setProjects: (projects: ProjectData[]) => void;
}

interface ScannedWorktree {
  path: string;
  branch: string;
  isMain: boolean;
}

export interface TerminalLocation {
  terminal: TerminalData;
  projectId: string;
  worktreeId: string;
  worktree: WorktreeData;
  project: ProjectData;
}

let idCounter = 0;
export function generateId(): string {
  return `${Date.now()}-${++idCounter}`;
}

export function createTerminal(
  type: TerminalType = "shell",
  title?: string,
  initialPrompt?: string,
  autoApprove?: boolean,
  origin: TerminalOrigin = "user",
  parentTerminalId?: string,
): TerminalData {
  return {
    id: generateId(),
    title: title ?? (type === "shell" ? "Terminal" : type),
    type,
    focused: false,
    ptyId: null,
    status: "idle",
    starred: false,
    origin,
    ...(initialPrompt ? { initialPrompt } : {}),
    ...(autoApprove ? { autoApprove } : {}),
    ...(parentTerminalId ? { parentTerminalId } : {}),
  };
}

function markDirty() {
  useWorkspaceStore.getState().markDirty();
}

function destroyTerminalPty(ptyId: number | null | undefined) {
  if (ptyId == null || !window.termcanvas?.terminal) {
    return;
  }
  void window.termcanvas.terminal.destroy(ptyId).catch((err) => {
    console.error(`[projectStore] failed to destroy PTY ${ptyId}:`, err);
  });
}

function collectTerminalPtyIds(projects: ProjectData[]): number[] {
  const ids: number[] = [];
  for (const project of projects) {
    for (const worktree of project.worktrees) {
      for (const terminal of worktree.terminals) {
        if (terminal.ptyId != null) {
          ids.push(terminal.ptyId);
        }
      }
    }
  }
  return ids;
}

function mapTerminals(
  projects: ProjectData[],
  projectId: string,
  worktreeId: string,
  terminalId: string,
  fn: (terminal: TerminalData) => TerminalData,
): ProjectData[] {
  return projects.map((project) =>
    project.id !== projectId
      ? project
      : {
          ...project,
          worktrees: project.worktrees.map((worktree) =>
            worktree.id !== worktreeId
              ? worktree
              : {
                  ...worktree,
                  terminals: worktree.terminals.map((terminal) =>
                    terminal.id !== terminalId ? terminal : fn(terminal),
                  ),
                },
          ),
        },
  );
}

function inspectFocus(projects: ProjectData[], nextTerminalId: string | null) {
  let currentFocusedTerminalId: string | null = null;
  let nextProjectId: string | null = null;
  let nextWorktreeId: string | null = null;

  for (const project of projects) {
    for (const worktree of project.worktrees) {
      for (const terminal of worktree.terminals) {
        if (terminal.focused && currentFocusedTerminalId === null) {
          currentFocusedTerminalId = terminal.id;
        }
        if (nextTerminalId !== null && terminal.id === nextTerminalId) {
          nextProjectId = project.id;
          nextWorktreeId = worktree.id;
        }
      }
    }
  }

  return { currentFocusedTerminalId, nextProjectId, nextWorktreeId };
}

function updateFocusedTerminalFlags(
  projects: ProjectData[],
  previousFocusedTerminalId: string | null,
  nextFocusedTerminalId: string | null,
): ProjectData[] {
  if (previousFocusedTerminalId === nextFocusedTerminalId) {
    return projects;
  }

  let changed = false;
  const updated = projects.map((project) => {
    let projectChanged = false;
    const worktrees = project.worktrees.map((worktree) => {
      let worktreeChanged = false;
      const terminals = worktree.terminals.map((terminal) => {
        const shouldBeFocused = terminal.id === nextFocusedTerminalId;
        const touched =
          terminal.id === previousFocusedTerminalId ||
          terminal.id === nextFocusedTerminalId;
        if (!touched || terminal.focused === shouldBeFocused) {
          return terminal;
        }
        worktreeChanged = true;
        return { ...terminal, focused: shouldBeFocused };
      });
      if (!worktreeChanged) {
        return worktree;
      }
      projectChanged = true;
      return { ...worktree, terminals };
    });
    if (!projectChanged) {
      return project;
    }
    changed = true;
    return { ...project, worktrees };
  });

  return changed ? updated : projects;
}

function syncProjectWorktrees(
  project: ProjectData,
  worktrees: ScannedWorktree[],
): ProjectData {
  const existingByPath = new Map(
    project.worktrees.map((worktree) => [worktree.path, worktree]),
  );
  const synced = worktrees.map((worktree) => {
    const existing = existingByPath.get(worktree.path);
    if (!existing) {
      return {
        id: generateId(),
        name: worktree.branch,
        path: worktree.path,
        terminals: [],
      };
    }
    if (existing.name === worktree.branch) {
      return existing;
    }
    return {
      ...existing,
      name: worktree.branch,
    };
  });

  if (
    synced.length === project.worktrees.length &&
    synced.every((worktree, index) => worktree === project.worktrees[index])
  ) {
    return project;
  }

  return {
    ...project,
    worktrees: synced,
  };
}

function normalizeProjects(projects: ProjectData[]) {
  return normalizeProjectsFocus(
    projects.map((project) => ({
      ...project,
      worktrees: project.worktrees.map((worktree) => ({
        ...worktree,
        terminals: worktree.terminals.map((terminal) => ({
          ...terminal,
          starred: terminal.starred ?? false,
        })),
      })),
    })),
  );
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  focusedProjectId: null,
  focusedWorktreeId: null,

  addProject: (project) => {
    set((state) => normalizeProjects([...state.projects, project]));
    markDirty();
  },

  removeProject: (projectId) => {
    const ptyIds = collectTerminalPtyIds(
      useProjectStore
        .getState()
        .projects.filter((project) => project.id === projectId),
    );
    set((state) =>
      normalizeProjects(
        state.projects.filter((project) => project.id !== projectId),
      ),
    );
    for (const ptyId of ptyIds) {
      destroyTerminalPty(ptyId);
    }
    markDirty();
  },

  removeWorktree: (projectId, worktreeId) => {
    const ptyIds = collectTerminalPtyIds(
      useProjectStore
        .getState()
        .projects.filter((project) => project.id === projectId)
        .map((project) => ({
          ...project,
          worktrees: project.worktrees.filter(
            (worktree) => worktree.id === worktreeId,
          ),
        })),
    );
    set((state) =>
      normalizeProjects(
        state.projects.map((project) =>
          project.id !== projectId
            ? project
            : {
                ...project,
                worktrees: project.worktrees.filter(
                  (worktree) => worktree.id !== worktreeId,
                ),
              },
        ),
      ),
    );
    for (const ptyId of ptyIds) {
      destroyTerminalPty(ptyId);
    }
    markDirty();
  },

  syncWorktrees: (projectPath, worktrees) =>
    set((state) => {
      let changed = false;
      const nextProjects = state.projects.map((project) => {
        if (project.path !== projectPath) {
          return project;
        }
        const synced = syncProjectWorktrees(project, worktrees);
        if (synced !== project) {
          changed = true;
        }
        return synced;
      });

      if (!changed) {
        return state;
      }

      return normalizeProjects(nextProjects);
    }),

  addTerminal: (projectId, worktreeId, terminal) => {
    set((state) =>
      normalizeProjects(
        state.projects.map((project) =>
          project.id !== projectId
            ? project
            : {
                ...project,
                worktrees: project.worktrees.map((worktree) =>
                  worktree.id !== worktreeId
                    ? worktree
                    : {
                        ...worktree,
                        terminals: [...worktree.terminals, terminal],
                      },
                ),
              },
        ),
      ),
    );
    markDirty();
  },

  removeTerminal: (projectId, worktreeId, terminalId) => {
    const startedAt = performance.now();
    const location = findTerminalById(useProjectStore.getState().projects, terminalId);
    const ptyId = location?.terminal.ptyId ?? null;

    set((state) => {
      const currentOrder =
        state.projects
          .find((project) => project.id === projectId)
          ?.worktrees.find((worktree) => worktree.id === worktreeId)
          ?.terminals ?? [];
      const removedIndex = currentOrder.findIndex(
        (terminal) => terminal.id === terminalId,
      );
      const adjacentTerminalId =
        removedIndex === -1
          ? null
          : currentOrder[removedIndex + 1]?.id ??
            currentOrder[removedIndex - 1]?.id ??
            null;

      const filteredProjects = state.projects.map((project) =>
        project.id !== projectId
          ? project
          : {
              ...project,
              worktrees: project.worktrees.map((worktree) =>
                worktree.id !== worktreeId
                  ? worktree
                  : {
                      ...worktree,
                      terminals: worktree.terminals.filter(
                        (terminal) => terminal.id !== terminalId,
                      ),
                    },
              ),
            },
      );
      const normalized = normalizeProjects(filteredProjects);

      if (!location?.terminal.focused) {
        return normalized;
      }

      if (adjacentTerminalId) {
        const { currentFocusedTerminalId, nextProjectId, nextWorktreeId } =
          inspectFocus(normalized.projects, adjacentTerminalId);
        return {
          ...normalized,
          focusedProjectId: nextProjectId,
          focusedWorktreeId: nextWorktreeId,
          projects: updateFocusedTerminalFlags(
            normalized.projects,
            currentFocusedTerminalId,
            adjacentTerminalId,
          ),
        };
      }

      return {
        ...normalized,
        focusedProjectId: projectId,
        focusedWorktreeId: worktreeId,
      };
    });

    destroyTerminalPty(ptyId);
    logSlowRendererPath("projectStore.removeTerminal", startedAt, {
      thresholdMs: 8,
      details: { terminalId },
    });
    markDirty();
  },

  updateTerminalPtyId: (projectId, worktreeId, terminalId, ptyId) =>
    set((state) => ({
      ...state,
      projects: mapTerminals(
        state.projects,
        projectId,
        worktreeId,
        terminalId,
        (terminal) => ({ ...terminal, ptyId }),
      ),
    })),

  updateTerminalStatus: (projectId, worktreeId, terminalId, status) =>
    set((state) => ({
      ...state,
      projects: mapTerminals(
        state.projects,
        projectId,
        worktreeId,
        terminalId,
        (terminal) => ({ ...terminal, status }),
      ),
    })),

  updateTerminalSessionId: (projectId, worktreeId, terminalId, sessionId) =>
    set((state) => ({
      ...state,
      projects: mapTerminals(
        state.projects,
        projectId,
        worktreeId,
        terminalId,
        (terminal) => ({ ...terminal, sessionId }),
      ),
    })),

  updateTerminalType: (projectId, worktreeId, terminalId, type) =>
    set((state) => ({
      ...state,
      projects: mapTerminals(
        state.projects,
        projectId,
        worktreeId,
        terminalId,
        (terminal) => withUpdatedTerminalType(terminal, type),
      ),
    })),

  updateTerminalCustomTitle: (
    projectId,
    worktreeId,
    terminalId,
    customTitle,
  ) => {
    set((state) => ({
      ...state,
      projects: mapTerminals(
        state.projects,
        projectId,
        worktreeId,
        terminalId,
        (terminal) => withUpdatedTerminalCustomTitle(terminal, customTitle),
      ),
    }));
    markDirty();
  },

  updateTerminalScrollback: (projectId, worktreeId, terminalId, scrollback) =>
    set((state) => ({
      ...state,
      projects: mapTerminals(
        state.projects,
        projectId,
        worktreeId,
        terminalId,
        (terminal) => ({ ...terminal, scrollback }),
      ),
    })),

  toggleTerminalStarred: (projectId, worktreeId, terminalId) => {
    set((state) => ({
      ...state,
      projects: mapTerminals(
        state.projects,
        projectId,
        worktreeId,
        terminalId,
        withToggledTerminalStarred,
      ),
    }));
    markDirty();
  },

  setFocusedTerminal: (terminalId, options) => {
    const startedAt = performance.now();
    set((state) => {
      const { currentFocusedTerminalId, nextProjectId, nextWorktreeId } =
        inspectFocus(state.projects, terminalId);
      const projects = updateFocusedTerminalFlags(
        state.projects,
        currentFocusedTerminalId,
        terminalId,
      );

      if (
        projects === state.projects &&
        nextProjectId === state.focusedProjectId &&
        nextWorktreeId === state.focusedWorktreeId
      ) {
        return state;
      }

      return {
        ...state,
        projects,
        focusedProjectId: nextProjectId,
        focusedWorktreeId: nextWorktreeId,
      };
    });

    if (terminalId && options?.focusComposer !== false) {
      const composerEnabled = usePreferencesStore.getState().composerEnabled;
      if (composerEnabled) {
        window.dispatchEvent(new CustomEvent("termcanvas:focus-composer"));
      } else {
        window.dispatchEvent(
          new CustomEvent("termcanvas:focus-xterm", { detail: terminalId }),
        );
      }
    }

    logSlowRendererPath("projectStore.setFocusedTerminal", startedAt, {
      thresholdMs: 6,
      details: { terminalId },
    });
  },

  clearFocus: () =>
    set((state) => {
      const { currentFocusedTerminalId } = inspectFocus(state.projects, null);
      const projects = updateFocusedTerminalFlags(
        state.projects,
        currentFocusedTerminalId,
        null,
      );
      if (
        projects === state.projects &&
        state.focusedProjectId === null &&
        state.focusedWorktreeId === null
      ) {
        return state;
      }

      return {
        ...state,
        projects,
        focusedProjectId: null,
        focusedWorktreeId: null,
      };
    }),

  setProjects: (projects) => {
    set(() => normalizeProjects(projects));
    markDirty();
  },
}));

export function findTerminalById(
  projects: ProjectData[],
  terminalId: string,
): TerminalLocation | null {
  for (const project of projects) {
    for (const worktree of project.worktrees) {
      const terminal = worktree.terminals.find(
        (candidate) => candidate.id === terminalId,
      );
      if (terminal) {
        return {
          terminal,
          projectId: project.id,
          worktreeId: worktree.id,
          worktree,
          project,
        };
      }
    }
  }
  return null;
}

export function getChildTerminals(
  projects: ProjectData[],
  terminalId: string,
): TerminalLocation[] {
  const children: TerminalLocation[] = [];
  for (const project of projects) {
    for (const worktree of project.worktrees) {
      for (const terminal of worktree.terminals) {
        if (terminal.parentTerminalId === terminalId) {
          children.push({
            terminal,
            projectId: project.id,
            worktreeId: worktree.id,
            worktree,
            project,
          });
        }
      }
    }
  }
  return children;
}
