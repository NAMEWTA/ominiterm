import type {
  TerminalData,
  TerminalLauncherConfigSnapshot,
} from "../types/index.ts";
import type { CliCommandConfig } from "../stores/preferencesStore.ts";
import {
  getTerminalLaunchOptions,
  getTerminalPromptArgs,
} from "./cliConfig.ts";

export interface TerminalCreateRequest {
  cwd: string;
  shell?: string;
  args?: string[];
  terminalId?: string;
  theme?: "dark" | "light";
  launcherId?: string;
  launcherName?: string;
  launcherConfigSnapshot?: TerminalLauncherConfigSnapshot;
}

function cloneLauncherConfigSnapshot(
  snapshot: TerminalLauncherConfigSnapshot,
): TerminalLauncherConfigSnapshot {
  return {
    hostShell: snapshot.hostShell,
    mainCommand: {
      command: snapshot.mainCommand.command,
      args: [...snapshot.mainCommand.args],
    },
    startupCommands: snapshot.startupCommands.map((step) => ({ ...step })),
  };
}

interface BuildRequestParams {
  terminal: TerminalData;
  worktreePath: string;
  theme: "dark" | "light";
  cliOverride?: CliCommandConfig;
}

export function buildTerminalCreateRequest({
  terminal,
  worktreePath,
  theme,
  cliOverride,
}: BuildRequestParams): TerminalCreateRequest {
  const launch = getTerminalLaunchOptions(
    terminal.type,
    terminal.sessionId,
    terminal.autoApprove,
    cliOverride,
  );

  const request: TerminalCreateRequest = {
    cwd: worktreePath,
    terminalId: terminal.id,
    theme,
    ...(terminal.launcherId ? { launcherId: terminal.launcherId } : {}),
    ...(terminal.launcherName ? { launcherName: terminal.launcherName } : {}),
    ...(terminal.launcherConfigSnapshot
      ? {
          launcherConfigSnapshot: cloneLauncherConfigSnapshot(
            terminal.launcherConfigSnapshot,
          ),
        }
      : {}),
  };

  if (!launch) {
    return request;
  }

  const promptArgs =
    !terminal.sessionId && terminal.initialPrompt
      ? getTerminalPromptArgs(terminal.type, terminal.initialPrompt)
      : [];

  request.shell = launch.shell;
  request.args = [...launch.args, ...promptArgs];
  return request;
}
