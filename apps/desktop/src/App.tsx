import { useEffect, useMemo, useState } from "react";
import { Toolbar } from "./toolbar/Toolbar";
import { NotificationToast } from "./components/NotificationToast";
import { initUpdaterListeners } from "./stores/updaterStore";
import { ComposerBar } from "./components/ComposerBar";
import { usePreferencesStore } from "./stores/preferencesStore";
import { ShortcutHints } from "./components/ShortcutHints";
import { RightRail } from "./components/RightRail";
import { WelcomePopup } from "./components/WelcomePopup";
import { useProjectStore } from "./stores/projectStore";
import { useSplitLayoutStore } from "./stores/splitLayoutStore";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useT } from "./i18n/useT";
import { loadAllDownloadedFonts } from "./terminal/fontLoader";
import { normalizeProjectsFocus } from "./stores/projectFocus";
import {
  APP_TOOLBAR_HEIGHT,
  useUiShellStore,
} from "./stores/uiShellStore";
import { shouldRunAutoSaveBackstop, useWorkspaceStore } from "./stores/workspaceStore";
import { snapshotState } from "./snapshotState";
import { updateWindowTitle } from "./titleHelper";
import { useNotificationStore } from "./stores/notificationStore";
import { logSlowRendererPath } from "./utils/devPerf";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { ProjectBoard } from "./components/ProjectBoard";
import { TerminalDetailView } from "./components/TerminalDetailView";
import { migrateProjects } from "./projectStateMigration";
import type { ProjectData } from "./types";

function restoreFromData(data: Record<string, unknown>) {
  try {
    if (data.projects && Array.isArray(data.projects)) {
      const projects = data.projects as ProjectData[];
      useProjectStore.setState(
        normalizeProjectsFocus(migrateProjects(projects)),
      );

      // Restore board layouts for each project
      for (const project of projects) {
        if (project.boardLayout) {
          useSplitLayoutStore
            .getState()
            .setLayout(project.id, project.boardLayout);
        }
      }
    }
  } catch (err) {
    console.error("[restoreFromData] failed to restore state:", err);
  }
}

function useWorktreeWatcher() {
  const projectCount = useProjectStore((state) => state.projects.length);

  useEffect(() => {
    if (!window.ominiterm || projectCount === 0) {
      return;
    }

    const inFlight = new Set<string>();
    const pending = new Set<string>();
    const latestSeqByPath = new Map<string, number>();
    let disposed = false;

    const scheduleRescan = (projectPath: string) => {
      if (inFlight.has(projectPath)) {
        pending.add(projectPath);
        return;
      }

      inFlight.add(projectPath);
      const seq = (latestSeqByPath.get(projectPath) ?? 0) + 1;
      latestSeqByPath.set(projectPath, seq);

      void window.ominiterm.project
        .rescanWorktrees(projectPath)
        .then((worktrees) => {
          if (disposed) {
            return;
          }
          if (latestSeqByPath.get(projectPath) !== seq) {
            return;
          }
          useProjectStore.getState().syncWorktrees(projectPath, worktrees);
        })
        .catch((err) => {
          if (!disposed) {
            console.error(
              `[useWorktreeWatcher] failed to rescan ${projectPath}:`,
              err,
            );
          }
        })
        .finally(() => {
          inFlight.delete(projectPath);
          if (!disposed && pending.delete(projectPath)) {
            scheduleRescan(projectPath);
          }
        });
    };

    const rescanAll = () => {
      const { projects } = useProjectStore.getState();
      for (const project of projects) {
        scheduleRescan(project.path);
      }
    };

    rescanAll();
    const interval = setInterval(rescanAll, 5000);
    window.addEventListener("focus", rescanAll);

    return () => {
      disposed = true;
      clearInterval(interval);
      window.removeEventListener("focus", rescanAll);
    };
  }, [projectCount]);
}

function useStatePersistence() {
  useEffect(() => {
    if (!window.ominiterm) {
      return;
    }
    window.ominiterm.state
      .load()
      .then((saved) => {
        if (!saved) {
          return;
        }
        const data = saved as Record<string, unknown>;
        if (data.skipRestore) {
          window.ominiterm.state.save({ skipRestore: false });
          return;
        }
        restoreFromData(data);
        useWorkspaceStore.getState().setWorkspacePath(null);
        useWorkspaceStore.getState().markClean();
      })
      .catch((err) => {
        console.error("[useStatePersistence] failed to load state:", err);
      });
  }, []);
}

function useAutoSave() {
  useEffect(() => {
    if (!window.ominiterm) {
      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const saveSnapshot = async () => {
      const startedAt = performance.now();
      try {
        await window.ominiterm.state.save(snapshotState());
        useWorkspaceStore.setState((state) => ({
          ...state,
          lastSavedAt: Date.now(),
        }));
      } catch (err) {
        console.error("[useAutoSave] failed to save recovery snapshot:", err);
      } finally {
        logSlowRendererPath("App.autoSaveSnapshot", startedAt, {
          thresholdMs: 20,
        });
      }
    };

    const unsubscribe = useWorkspaceStore.subscribe((state, prev) => {
      if (state.dirty && state.lastDirtyAt !== prev.lastDirtyAt) {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          void saveSnapshot();
        }, 5000);
      }

      if (!state.dirty && prev.dirty && debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    });

    const backstopTimer = setInterval(() => {
      const { dirty, lastDirtyAt, lastSavedAt } = useWorkspaceStore.getState();
      if (shouldRunAutoSaveBackstop({ dirty, lastDirtyAt, lastSavedAt })) {
        void saveSnapshot();
      }
    }, 60_000);

    return () => {
      unsubscribe();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      clearInterval(backstopTimer);
    };
  }, []);
}

function useWorkspaceOpen() {
  const t = useT();

  useEffect(() => {
    const handler = (event: Event) => {
      const { dirty } = useWorkspaceStore.getState();
      if (
        dirty &&
        !window.confirm("Unsaved changes will be lost. Continue?")
      ) {
        return;
      }

      const raw = (event as CustomEvent<string>).detail;
      void (async () => {
        try {
          restoreFromData(JSON.parse(raw));
          await window.ominiterm?.state.save(raw);
          useWorkspaceStore.getState().setWorkspacePath(null);
          useWorkspaceStore.getState().markClean();
        } catch (err) {
          console.error("[useWorkspaceOpen] failed to parse workspace file:", err);
          useNotificationStore
            .getState()
            .notify("error", t.open_workspace_error(err));
        }
      })();
    };
    window.addEventListener("ominiterm:open-workspace", handler);
    return () =>
      window.removeEventListener("ominiterm:open-workspace", handler);
  }, [t]);
}

function useCloseHandler() {
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const t = useT();

  useEffect(() => {
    if (!window.ominiterm) {
      return;
    }

    const unsubscribe = window.ominiterm.app.onBeforeClose(() => {
      const { dirty } = useWorkspaceStore.getState();
      if (!dirty) {
        void (async () => {
          const startedAt = performance.now();
          try {
            await window.ominiterm.state.save(snapshotState());
          } catch (err) {
            console.error("[CloseHandler] failed to save recovery snapshot:", err);
          } finally {
            logSlowRendererPath("App.closeRecoverySnapshot", startedAt, {
              thresholdMs: 20,
            });
            window.ominiterm.app.confirmClose();
          }
        })();
        return;
      }

      setShowCloseDialog(true);
    });

    return unsubscribe;
  }, []);

  const handleSave = async () => {
    try {
      const snap = snapshotState();
      const { workspacePath } = useWorkspaceStore.getState();

      if (workspacePath) {
        await window.ominiterm.workspace.saveToPath(workspacePath, snap);
      } else {
        const savedPath = await window.ominiterm.workspace.save(snap);
        if (!savedPath) {
          return;
        }
        useWorkspaceStore.getState().setWorkspacePath(savedPath);
      }
      await window.ominiterm.state.save(snap);
      useWorkspaceStore.getState().markClean();
      window.ominiterm.app.confirmClose();
    } catch (err) {
      console.error("[CloseHandler] save failed:", err);
      useNotificationStore
        .getState()
        .notify("error", t.save_error(String(err)));
    }
  };

  const handleDiscard = async () => {
    await window.ominiterm.state.save({ skipRestore: true });
    window.ominiterm.app.confirmClose();
  };

  return {
    showCloseDialog,
    handleSave,
    handleDiscard,
    handleCancel: () => setShowCloseDialog(false),
  };
}

function CloseDialog({
  onSave,
  onDiscard,
  onCancel,
}: {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="mb-2 text-[15px] font-medium text-[var(--text-primary)]">
          {t.save_workspace_title}
        </h2>
        <p className="mb-6 text-[13px] text-[var(--text-secondary)]">
          {t.save_workspace_desc}
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="rounded-md px-3 py-1.5 text-[13px] text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--border)] hover:text-[var(--text-primary)]"
            onClick={onCancel}
          >
            {t.cancel}
          </button>
          <button
            className="rounded-md px-3 py-1.5 text-[13px] text-[var(--red)] transition-colors duration-150 hover:bg-[var(--surface-hover)]"
            onClick={onDiscard}
          >
            {t.dont_save}
          </button>
          <button
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-[13px] text-white transition-all duration-150 hover:brightness-110"
            onClick={onSave}
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  useWorktreeWatcher();
  useStatePersistence();
  useAutoSave();
  useWorkspaceOpen();
  useKeyboardShortcuts();

  const composerEnabled = usePreferencesStore((state) => state.composerEnabled);
  const projects = useProjectStore((state) => state.projects);
  const focusedProjectId = useProjectStore((state) => state.focusedProjectId);
  const focusedWorktreeId = useProjectStore((state) => state.focusedWorktreeId);
  const selectedProjectId = useUiShellStore((state) => state.selectedProjectId);
  const projectSidebarWidth = useUiShellStore((state) => state.projectSidebarWidth);
  const projectSidebarCollapsed = useUiShellStore(
    (state) => state.projectSidebarCollapsed,
  );
  const contentMode = useUiShellStore((state) => state.contentMode);
  const detailTerminalId = useUiShellStore((state) => state.detailTerminalId);
  const setSelectedProjectId = useUiShellStore((state) => state.setSelectedProjectId);
  const setProjectSidebarWidth = useUiShellStore((state) => state.setProjectSidebarWidth);
  const setProjectSidebarCollapsed = useUiShellStore(
    (state) => state.setProjectSidebarCollapsed,
  );
  const setBoardScroll = useUiShellStore((state) => state.setBoardScroll);
  const boardScrollByProject = useUiShellStore((state) => state.boardScrollByProject);
  const openTerminalDetail = useUiShellStore((state) => state.openTerminalDetail);
  const closeTerminalDetail = useUiShellStore((state) => state.closeTerminalDetail);
  const syncSelection = useUiShellStore((state) => state.syncSelection);
  const setFocusedTerminal = useProjectStore((state) => state.setFocusedTerminal);
  const { showCloseDialog, handleSave, handleDiscard, handleCancel } =
    useCloseHandler();

  const [showWelcome, setShowWelcome] = useState(() => {
    return !(
      localStorage.getItem("ominiterm-welcome-seen") ??
      localStorage.getItem("termcanvas-welcome-seen")
    );
  });

  useEffect(() => initUpdaterListeners(), []);

  useEffect(() => {
    loadAllDownloadedFonts();
  }, []);

  useEffect(() => {
    const unsubscribe = useWorkspaceStore.subscribe(() => updateWindowTitle());
    updateWindowTitle();
    return unsubscribe;
  }, []);

  useEffect(() => {
    const focusedTerminalId = (() => {
      for (const project of projects) {
        for (const worktree of project.worktrees) {
          const focusedTerminal = worktree.terminals.find((terminal) => terminal.focused);
          if (focusedTerminal) {
            return focusedTerminal.id;
          }
        }
      }
      return null;
    })();

    syncSelection(projects, focusedProjectId, focusedTerminalId);
  }, [focusedProjectId, projects, syncSelection]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const detailLocation = useMemo(() => {
    if (!detailTerminalId) {
      return null;
    }
    for (const project of projects) {
      for (const worktree of project.worktrees) {
        const terminal = worktree.terminals.find(
          (candidate) => candidate.id === detailTerminalId,
        );
        if (terminal) {
          return { project, worktree, terminal };
        }
      }
    }
    return null;
  }, [detailTerminalId, projects]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--text-primary)]">
      <Toolbar onShowTutorial={() => setShowWelcome(true)} />
      <div
        className="flex h-full min-h-0 pt-11"
        style={{ height: `calc(100vh - ${APP_TOOLBAR_HEIGHT}px)` }}
      >
        <ProjectSidebar
          projects={projects}
          selectedProjectId={selectedProjectId}
          width={projectSidebarWidth}
          collapsed={projectSidebarCollapsed}
          detailTerminalId={detailTerminalId}
          onSelectProject={setSelectedProjectId}
          onResizeWidth={setProjectSidebarWidth}
          onCollapsedChange={setProjectSidebarCollapsed}
          onOpenTerminal={(projectId, terminalId) => {
            setSelectedProjectId(projectId);
            setFocusedTerminal(terminalId, { focusComposer: false });
            openTerminalDetail(terminalId);
          }}
        />

        <main className="min-h-0 min-w-0 flex-1">
          {contentMode === "terminalDetail" && detailLocation ? (
            <TerminalDetailView
              project={detailLocation.project}
              worktree={detailLocation.worktree}
              terminal={detailLocation.terminal}
              onBack={closeTerminalDetail}
            />
          ) : (
            <ProjectBoard
              project={selectedProject}
              focusedWorktreeId={focusedWorktreeId}
              boardScrollTop={
                selectedProject ? boardScrollByProject[selectedProject.id] ?? 0 : 0
              }
              onBoardScroll={(scrollTop) => {
                if (selectedProject) {
                  setBoardScroll(selectedProject.id, scrollTop);
                }
              }}
              onOpenDetail={openTerminalDetail}
            />
          )}
        </main>

        <RightRail />
      </div>

      {composerEnabled && <ComposerBar />}
      <ShortcutHints />
      <NotificationToast />
      {showCloseDialog && (
        <CloseDialog
          onSave={handleSave}
          onDiscard={handleDiscard}
          onCancel={handleCancel}
        />
      )}
      {showWelcome && (
        <WelcomePopup
          onClose={() => {
            localStorage.setItem("ominiterm-welcome-seen", "1");
            setShowWelcome(false);
          }}
        />
      )}
    </div>
  );
}
