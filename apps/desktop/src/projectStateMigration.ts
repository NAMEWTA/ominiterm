import type {
  ProjectData,
  TerminalLauncherConfigSnapshot,
} from "./types/index.ts";
import { normalizeStoredWorktreePath } from "./projectPaths.ts";

function cloneLauncherConfigSnapshot(
  snapshot: unknown,
): TerminalLauncherConfigSnapshot | undefined {
  if (!snapshot || typeof snapshot !== "object") {
    return undefined;
  }

  const value = snapshot as {
    hostShell?: unknown;
    mainCommand?: {
      command?: unknown;
      args?: unknown;
    };
    startupCommands?: unknown;
  };

  if (
    value.hostShell !== "auto" &&
    value.hostShell !== "pwsh" &&
    value.hostShell !== "bash" &&
    value.hostShell !== "zsh" &&
    value.hostShell !== "cmd"
  ) {
    return undefined;
  }

  if (
    !value.mainCommand ||
    typeof value.mainCommand !== "object" ||
    typeof value.mainCommand.command !== "string"
  ) {
    return undefined;
  }

  const args = Array.isArray(value.mainCommand.args)
    ? value.mainCommand.args.filter(
        (arg): arg is string => typeof arg === "string",
      )
    : [];

  const startupCommands = Array.isArray(value.startupCommands)
    ? value.startupCommands
        .filter(
          (
            step,
          ): step is { label: string; command: string; timeoutMs: number } =>
            !!step &&
            typeof step === "object" &&
            typeof (step as { label?: unknown }).label === "string" &&
            typeof (step as { command?: unknown }).command === "string" &&
            typeof (step as { timeoutMs?: unknown }).timeoutMs === "number",
        )
        .map((step) => ({ ...step }))
    : [];

  return {
    hostShell: value.hostShell,
    mainCommand: {
      command: value.mainCommand.command,
      args: [...args],
    },
    startupCommands,
  };
}

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
        terminals: (worktree.terminals ?? []).map((terminal: any) => {
          const launcherConfigSnapshot = cloneLauncherConfigSnapshot(
            terminal.launcherConfigSnapshot,
          );

          return {
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
            ...(typeof terminal.launcherId === "string"
              ? { launcherId: terminal.launcherId }
              : {}),
            ...(typeof terminal.launcherName === "string"
              ? { launcherName: terminal.launcherName }
              : {}),
            ...(launcherConfigSnapshot ? { launcherConfigSnapshot } : {}),
          };
        }),
      })),
    };
  });
}
