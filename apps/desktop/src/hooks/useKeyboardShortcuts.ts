import { useEffect } from "react";
import { useProjectStore } from "../stores/projectStore";
import { matchesShortcut, useShortcutStore } from "../stores/shortcutStore";
import { registerWindowKeydownListener } from "../shortcuts/listeners";
import { useNotificationStore } from "../stores/notificationStore";
import { useComposerStore } from "../stores/composerStore";
import { usePreferencesStore } from "../stores/preferencesStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useUiShellStore } from "../stores/uiShellStore";
import { shouldIgnoreShortcutTarget } from "./shortcutTarget";
import { snapshotState } from "../snapshotState";
import { updateWindowTitle } from "../titleHelper";
import { useT } from "../i18n/useT";
import {
  addProjectFromDialog,
  chooseDefaultWorktree,
  createTerminalInWorktree,
  openWorkspaceFromDialog,
} from "../projectCommands";
import { useLaunchersStore } from "../stores/launchersStore";
import { getShortcutDefaultLauncherOption } from "./defaultLauncherOption";

export function useKeyboardShortcuts() {
  const shortcuts = useShortcutStore((state) => state.bindings);
  const t = useT();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (shouldIgnoreShortcutTarget(event)) {
        return;
      }

      if (event.key === "Escape") {
        const { contentMode, closeTerminalDetail } = useUiShellStore.getState();
        if (contentMode === "terminalDetail") {
          event.preventDefault();
          closeTerminalDetail();
          return;
        }
      }

      if (matchesShortcut(event, shortcuts.addProject)) {
        event.preventDefault();
        void addProjectFromDialog(t);
        return;
      }

      if (matchesShortcut(event, shortcuts.openWorkspace)) {
        event.preventDefault();
        void openWorkspaceFromDialog(t);
        return;
      }

      if (matchesShortcut(event, shortcuts.toggleRightPanel)) {
        event.preventDefault();
        const state = useUiShellStore.getState();
        state.setRightRailCollapsed(!state.rightRailCollapsed);
        return;
      }

      if (matchesShortcut(event, shortcuts.toggleSidebar)) {
        event.preventDefault();
        const state = useUiShellStore.getState();
        state.toggleProjectSidebarCollapsed();
        return;
      }

      if (matchesShortcut(event, shortcuts.newTerminal)) {
        event.preventDefault();
        const { selectedProjectId } = useUiShellStore.getState();
        const { projects, focusedWorktreeId } = useProjectStore.getState();
        const project =
          projects.find((candidate) => candidate.id === selectedProjectId) ?? null;
        if (!project) {
          return;
        }
        const worktree = chooseDefaultWorktree(project, focusedWorktreeId);
        if (!worktree) {
          return;
        }
        const launcherOption = getShortcutDefaultLauncherOption(
          useLaunchersStore.getState().launchers,
        );
        if (launcherOption) {
          createTerminalInWorktree(
            project.id,
            worktree.id,
            launcherOption.terminalType,
            undefined,
            undefined,
            undefined,
            launcherOption.launcherMeta,
          );
          return;
        }
        createTerminalInWorktree(project.id, worktree.id, "shell");
        return;
      }

      if (matchesShortcut(event, shortcuts.saveWorkspace)) {
        event.preventDefault();
        const snap = snapshotState();
        const { workspacePath } = useWorkspaceStore.getState();
        if (workspacePath) {
          void window.ominiterm.workspace
            .saveToPath(workspacePath, snap)
            .then(async () => {
              await window.ominiterm.state.save(snap);
              useWorkspaceStore.getState().markClean();
              updateWindowTitle();
            })
            .catch((err) => {
              useNotificationStore
                .getState()
                .notify("error", t.save_error(String(err)));
            });
        } else {
          void window.ominiterm.workspace
            .save(snap)
            .then(async (savedPath) => {
              if (!savedPath) {
                return;
              }
              useWorkspaceStore.getState().setWorkspacePath(savedPath);
              await window.ominiterm.state.save(snap);
              useWorkspaceStore.getState().markClean();
              updateWindowTitle();
            })
            .catch((err) => {
              useNotificationStore
                .getState()
                .notify("error", t.save_error(String(err)));
            });
        }
        return;
      }

      if (matchesShortcut(event, shortcuts.saveWorkspaceAs)) {
        event.preventDefault();
        const snap = snapshotState();
        void window.ominiterm.workspace
          .save(snap)
          .then(async (savedPath) => {
            if (!savedPath) {
              return;
            }
            useWorkspaceStore.getState().setWorkspacePath(savedPath);
            await window.ominiterm.state.save(snap);
            useWorkspaceStore.getState().markClean();
            updateWindowTitle();
          })
          .catch((err) => {
            useNotificationStore
              .getState()
              .notify("error", t.save_error(String(err)));
          });
        return;
      }

      const { projects } = useProjectStore.getState();
      const { selectedProjectId, contentMode, detailTerminalId, openTerminalDetail } =
        useUiShellStore.getState();
      const project =
        projects.find((candidate) => candidate.id === selectedProjectId) ?? null;
      const terminals = project
        ? project.worktrees.flatMap((worktree) =>
            worktree.terminals.map((terminal) => ({
              projectId: project.id,
              worktreeId: worktree.id,
              terminal,
            })),
          )
        : [];
      const focusedIndex = terminals.findIndex(({ terminal }) => terminal.focused);

      if (matchesShortcut(event, shortcuts.toggleStarFocused)) {
        event.preventDefault();
        if (focusedIndex === -1) {
          return;
        }
        const focused = terminals[focusedIndex];
        useProjectStore
          .getState()
          .toggleTerminalStarred(
            focused.projectId,
            focused.worktreeId,
            focused.terminal.id,
          );
        return;
      }

      if (matchesShortcut(event, shortcuts.renameTerminalTitle)) {
        event.preventDefault();
        if (focusedIndex === -1) {
          useNotificationStore
            .getState()
            .notify("warn", t.composer_rename_title_missing_target);
          return;
        }
        const focused = terminals[focusedIndex];
        const { composerEnabled } = usePreferencesStore.getState();
        if (composerEnabled) {
          useComposerStore
            .getState()
            .enterRenameTerminalTitleMode(
              focused.terminal.id,
              focused.terminal.customTitle ?? "",
            );
        } else {
          window.dispatchEvent(
            new CustomEvent("ominiterm:focus-custom-title", {
              detail: focused.terminal.id,
            }),
          );
        }
        return;
      }

      if (matchesShortcut(event, shortcuts.closeFocused)) {
        event.preventDefault();
        if (focusedIndex === -1) {
          return;
        }
        const focused = terminals[focusedIndex];
        useProjectStore
          .getState()
          .removeTerminal(
            focused.projectId,
            focused.worktreeId,
            focused.terminal.id,
          );
        return;
      }

      if (
        matchesShortcut(event, shortcuts.nextTerminal) ||
        matchesShortcut(event, shortcuts.prevTerminal)
      ) {
        event.preventDefault();
        if (terminals.length === 0) {
          return;
        }
        const movingForward = matchesShortcut(event, shortcuts.nextTerminal);
        const nextIndex =
          focusedIndex === -1
            ? 0
            : movingForward
              ? (focusedIndex + 1) % terminals.length
              : (focusedIndex - 1 + terminals.length) % terminals.length;
        const next = terminals[nextIndex];
        useProjectStore.getState().setFocusedTerminal(next.terminal.id);
        if (contentMode === "terminalDetail" && detailTerminalId) {
          openTerminalDetail(next.terminal.id);
        }
      }
    };

    return registerWindowKeydownListener(window, handler);
  }, [shortcuts, t]);
}

