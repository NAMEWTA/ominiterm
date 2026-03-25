import { create } from "zustand";
import type { ProjectData } from "../types";

export const RIGHT_RAIL_WIDTH = 360;
export const COLLAPSED_TAB_WIDTH = 36;
export const APP_TOOLBAR_HEIGHT = 44;
export const PROJECT_SIDEBAR_WIDTH = 248;
export const PROJECT_SIDEBAR_COLLAPSED_WIDTH = 0;

export type ContentMode = "projectBoard" | "terminalDetail";
export type RightRailTab = "usage" | "files" | "diff";

interface UiShellStore {
  selectedProjectId: string | null;
  contentMode: ContentMode;
  detailTerminalId: string | null;
  rightRailCollapsed: boolean;
  rightRailTab: RightRailTab;
  boardScrollByProject: Record<string, number>;
  setSelectedProjectId: (projectId: string | null) => void;
  setContentMode: (mode: ContentMode) => void;
  openTerminalDetail: (terminalId: string) => void;
  closeTerminalDetail: () => void;
  setRightRailCollapsed: (collapsed: boolean) => void;
  setRightRailTab: (tab: RightRailTab) => void;
  setBoardScroll: (projectId: string, scrollTop: number) => void;
  syncSelection: (
    projects: ProjectData[],
    focusedProjectId: string | null,
    focusedTerminalId: string | null,
  ) => void;
}

function chooseProjectId(
  projects: ProjectData[],
  currentSelectedProjectId: string | null,
  focusedProjectId: string | null,
): string | null {
  if (currentSelectedProjectId && projects.some((project) => project.id === currentSelectedProjectId)) {
    return currentSelectedProjectId;
  }
  if (focusedProjectId && projects.some((project) => project.id === focusedProjectId)) {
    return focusedProjectId;
  }
  return projects[0]?.id ?? null;
}

export const useUiShellStore = create<UiShellStore>((set, get) => ({
  selectedProjectId: null,
  contentMode: "projectBoard",
  detailTerminalId: null,
  rightRailCollapsed: true,
  rightRailTab: "usage",
  boardScrollByProject: {},

  setSelectedProjectId: (projectId) => {
    set({
      selectedProjectId: projectId,
      contentMode: "projectBoard",
      detailTerminalId: null,
    });
  },

  setContentMode: (mode) =>
    set((state) => ({
      contentMode: mode,
      detailTerminalId: mode === "terminalDetail" ? state.detailTerminalId : null,
    })),

  openTerminalDetail: (terminalId) =>
    set({
      contentMode: "terminalDetail",
      detailTerminalId: terminalId,
    }),

  closeTerminalDetail: () =>
    set({
      contentMode: "projectBoard",
      detailTerminalId: null,
    }),

  setRightRailCollapsed: (collapsed) => set({ rightRailCollapsed: collapsed }),

  setRightRailTab: (tab) => set({ rightRailTab: tab }),

  setBoardScroll: (projectId, scrollTop) =>
    set((state) => ({
      boardScrollByProject: {
        ...state.boardScrollByProject,
        [projectId]: scrollTop,
      },
    })),

  syncSelection: (projects, focusedProjectId, focusedTerminalId) => {
    const state = get();
    const nextSelectedProjectId = chooseProjectId(
      projects,
      state.selectedProjectId,
      focusedProjectId,
    );
    const detailTerminalExists =
      state.detailTerminalId !== null &&
      projects.some((project) =>
        project.worktrees.some((worktree) =>
          worktree.terminals.some((terminal) => terminal.id === state.detailTerminalId),
        ),
      );
    const focusedTerminalExists =
      focusedTerminalId !== null &&
      projects.some((project) =>
        project.worktrees.some((worktree) =>
          worktree.terminals.some((terminal) => terminal.id === focusedTerminalId),
        ),
      );

    set({
      selectedProjectId: nextSelectedProjectId,
      contentMode:
        state.contentMode === "terminalDetail" && detailTerminalExists
          ? "terminalDetail"
          : "projectBoard",
      detailTerminalId:
        state.contentMode === "terminalDetail" && detailTerminalExists
          ? state.detailTerminalId
          : null,
      rightRailTab:
        state.rightRailTab === "usage" || focusedTerminalExists
          ? state.rightRailTab
          : "usage",
    });
  },
}));
