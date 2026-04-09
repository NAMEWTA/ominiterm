import type {
  LauncherConfigItem,
  TerminalLauncherConfigSnapshot,
  TerminalLauncherMeta,
  TerminalType,
} from "../types";

export interface LauncherOption {
  launcherId: string;
  label: string;
  terminalType: TerminalType;
  launcherMeta: TerminalLauncherMeta;
}

const TERMINAL_TYPES = new Set<TerminalType>([
  "shell",
  "claude",
  "codex",
  "copilot",
  "kimi",
  "gemini",
  "opencode",
  "lazygit",
  "tmux",
]);

export function resolveTerminalTypeFromLauncherId(launcherId: string): TerminalType {
  return TERMINAL_TYPES.has(launcherId as TerminalType)
    ? (launcherId as TerminalType)
    : "shell";
}

export function createLauncherConfigSnapshot(
  launcher: LauncherConfigItem,
): TerminalLauncherConfigSnapshot {
  return {
    hostShell: launcher.hostShell,
    startupCommands: launcher.startupCommands.map((step) => ({ ...step })),
  };
}

export function createTerminalLauncherMeta(
  launcher: LauncherConfigItem,
): TerminalLauncherMeta {
  return {
    launcherId: launcher.id,
    launcherName: launcher.name,
    launcherConfigSnapshot: createLauncherConfigSnapshot(launcher),
  };
}

export function createLauncherOptions(
  launchers: LauncherConfigItem[],
): LauncherOption[] {
  return launchers
    .filter((launcher) => launcher.enabled)
    .map((launcher) => ({
      launcherId: launcher.id,
      label: launcher.name || launcher.id,
      terminalType: resolveTerminalTypeFromLauncherId(launcher.id),
      launcherMeta: createTerminalLauncherMeta(launcher),
    }));
}
