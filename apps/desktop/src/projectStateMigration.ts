import type { ProjectData } from "./types/index.ts";
import { normalizeStoredWorktreePath } from "./projectPaths.ts";

export function migrateProjects(projects: unknown[]): ProjectData[] {
  return projects.map((project: any) => {
    const projectPath = project.path;

    return {
      id: project.id,
      name: project.name,
      path: projectPath,
      worktrees: (project.worktrees ?? []).map((worktree: any) => ({
        id: worktree.id,
        name: worktree.name,
        path: normalizeStoredWorktreePath(projectPath, worktree.path),
        terminals: (worktree.terminals ?? []).map((terminal: any) => ({
          id: terminal.id,
          title: terminal.title,
          customTitle: terminal.customTitle,
          starred: terminal.starred ?? false,
          type: terminal.type,
          focused: terminal.focused ?? false,
          ptyId: null,
          status: "idle",
          scrollback: terminal.scrollback,
          sessionId: terminal.sessionId,
          parentTerminalId: terminal.parentTerminalId,
          initialPrompt: terminal.initialPrompt,
          autoApprove: terminal.autoApprove,
          origin: terminal.origin,
        })),
      })),
    };
  });
}
