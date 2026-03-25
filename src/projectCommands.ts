import type { ProjectData, TerminalType, WorktreeData } from "./types";
import { createTerminal, generateId, useProjectStore } from "./stores/projectStore";
import { useNotificationStore } from "./stores/notificationStore";
import { useT } from "./i18n/useT";

type T = ReturnType<typeof useT>;

export async function addProjectFromDialog(t: T) {
  if (!window.termcanvas) {
    return;
  }

  const { notify } = useNotificationStore.getState();

  let dirPath: string | null;
  try {
    dirPath = await window.termcanvas.project.selectDirectory();
  } catch (err) {
    notify("error", t.error_dir_picker(err));
    return;
  }

  if (!dirPath) {
    return;
  }

  let info: Awaited<ReturnType<typeof window.termcanvas.project.scan>>;
  try {
    info = await window.termcanvas.project.scan(dirPath);
  } catch (err) {
    notify("error", t.error_scan(err));
    return;
  }

  if (!info) {
    notify("warn", t.error_not_git(dirPath));
    return;
  }

  useProjectStore.getState().addProject({
    id: generateId(),
    name: info.name,
    path: info.path,
    worktrees: info.worktrees.map((worktree) => ({
      id: generateId(),
      name: worktree.branch,
      path: worktree.path,
      terminals: [],
    })),
  });

  notify("info", t.info_added_project(info.name, info.worktrees.length));
}

export function chooseDefaultWorktree(
  project: ProjectData,
  focusedWorktreeId: string | null,
): WorktreeData | null {
  if (focusedWorktreeId) {
    const focused = project.worktrees.find(
      (worktree) => worktree.id === focusedWorktreeId,
    );
    if (focused) {
      return focused;
    }
  }
  return project.worktrees[0] ?? null;
}

export function createTerminalInWorktree(
  projectId: string,
  worktreeId: string,
  type: TerminalType,
  title?: string,
  initialPrompt?: string,
  autoApprove?: boolean,
) {
  const terminal = createTerminal(
    type,
    title,
    initialPrompt,
    autoApprove,
  );
  useProjectStore.getState().addTerminal(projectId, worktreeId, terminal);
  useProjectStore.getState().setFocusedTerminal(terminal.id);
  return terminal;
}
