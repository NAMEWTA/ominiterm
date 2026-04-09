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

  const legacyMainCommand = value.mainCommand;

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

  if (
    legacyMainCommand &&
    typeof legacyMainCommand === "object" &&
    typeof legacyMainCommand.command === "string"
  ) {
    const legacyArgs = Array.isArray(legacyMainCommand.args)
      ? legacyMainCommand.args.filter((arg): arg is string => typeof arg === "string")
      : [];
    const entryCommand = buildLegacyCommandLine(
      value.hostShell,
      legacyMainCommand.command,
      legacyArgs,
    );
    if (entryCommand.length > 0) {
      startupCommands.push({
        label: "Entry",
        command: entryCommand,
        timeoutMs: 120000,
      });
    }
  }

  if (startupCommands.length === 0) {
    return undefined;
  }

  return {
    hostShell: value.hostShell,
    startupCommands,
  };
}

type SnapshotHostShell = TerminalLauncherConfigSnapshot["hostShell"];
type ShellFamily = "cmd" | "pwsh" | "posix";

function resolveShellFamily(hostShell: SnapshotHostShell): ShellFamily {
  if (hostShell === "cmd") {
    return "cmd";
  }
  if (hostShell === "pwsh") {
    return "pwsh";
  }
  if (hostShell === "bash" || hostShell === "zsh") {
    return "posix";
  }
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return /windows/i.test(userAgent) ? "pwsh" : "posix";
}

function quoteForCmd(value: string): string {
  if (!/[\s"]/u.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

function quoteForPowerShell(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteForPosix(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function buildLegacyCommandLine(
  hostShell: SnapshotHostShell,
  command: string,
  args: string[],
): string {
  const normalizedCommand = command.trim();
  if (normalizedCommand.length === 0) {
    return "";
  }

  const parts = [normalizedCommand, ...args];
  const shellFamily = resolveShellFamily(hostShell);
  if (shellFamily === "cmd") {
    return parts.map(quoteForCmd).join(" ");
  }
  if (shellFamily === "pwsh") {
    return `& ${parts.map(quoteForPowerShell).join(" ")}`;
  }
  return parts.map(quoteForPosix).join(" ");
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
