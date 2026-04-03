import type {
  LauncherCommandStep,
  LauncherStartupEvent,
  TerminalLauncherConfigSnapshot,
} from "../src/types";
import {
  STARTUP_STEP_MARKER_PREFIX,
  type PtyStepWaitResult,
} from "./pty-manager.ts";

type StartupHostShell = TerminalLauncherConfigSnapshot["hostShell"];

interface StartupPtyController {
  write: (ptyId: number, data: string) => void;
  waitForStepResult: (
    ptyId: number,
    markerToken: string,
    timeoutMs: number,
  ) => Promise<PtyStepWaitResult>;
}

interface LauncherMainCommand {
  command: string;
  args: string[];
}

export interface StartupStepFailure {
  failedStepIndex: number;
  stepLabel: string;
  command: string;
  exitCode?: number;
  timeoutMs?: number;
  stderrPreview?: string;
}

export type StartupSequenceResult =
  | { ok: true }
  | ({ ok: false } & StartupStepFailure);

interface StartupSequenceParams {
  ptyManager: StartupPtyController;
  ptyId: number;
  terminalId: string;
  launcherId: string;
  hostShell: StartupHostShell;
  startupCommands: LauncherCommandStep[];
  emit: (event: LauncherStartupEvent) => void;
}

interface RunMainLauncherCommandParams {
  ptyManager: Pick<StartupPtyController, "write">;
  ptyId: number;
  hostShell: StartupHostShell;
  mainCommand: LauncherMainCommand;
}

type ShellFamily = "cmd" | "pwsh" | "posix";

function resolveShellFamily(hostShell: StartupHostShell): ShellFamily {
  if (hostShell === "cmd") {
    return "cmd";
  }
  if (hostShell === "pwsh") {
    return "pwsh";
  }
  if (hostShell === "bash" || hostShell === "zsh") {
    return "posix";
  }
  return process.platform === "win32" ? "pwsh" : "posix";
}

function normalizeStepLabel(step: LauncherCommandStep, stepIndex: number): string {
  const label = step.label.trim();
  return label.length > 0 ? label : `Step ${stepIndex + 1}`;
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

function buildCommandLine(
  command: string,
  args: string[],
  shellFamily: ShellFamily,
): string {
  const parts = [command, ...args];
  if (parts.length === 0) {
    return "";
  }

  if (shellFamily === "cmd") {
    return parts.map(quoteForCmd).join(" ");
  }

  if (shellFamily === "pwsh") {
    return `& ${parts.map(quoteForPowerShell).join(" ")}`;
  }

  return parts.map(quoteForPosix).join(" ");
}

function wrapStepCommand(
  command: string,
  markerToken: string,
  shellFamily: ShellFamily,
): string {
  const marker = `${STARTUP_STEP_MARKER_PREFIX}${markerToken}:`;

  if (shellFamily === "cmd") {
    return `${command} & echo ${marker}%ERRORLEVEL%`;
  }

  if (shellFamily === "pwsh") {
    return `${command}; $ominitermExit = $LASTEXITCODE; if ($null -eq $ominitermExit) { $ominitermExit = 0 }; Write-Output \"${marker}$ominitermExit\"`;
  }

  return `${command}; __ominitermExit=$?; printf '${marker}%s\\n' \"$__ominitermExit\"`;
}

function emitStartupEvent(
  emit: (event: LauncherStartupEvent) => void,
  event: Omit<LauncherStartupEvent, "timestamp">,
): void {
  emit({
    ...event,
    timestamp: Date.now(),
  });
}

export async function runStartupCommandSequence({
  ptyManager,
  ptyId,
  terminalId,
  launcherId,
  hostShell,
  startupCommands,
  emit,
}: StartupSequenceParams): Promise<StartupSequenceResult> {
  const totalSteps = startupCommands.length;
  if (totalSteps === 0) {
    return { ok: true };
  }

  const shellFamily = resolveShellFamily(hostShell);

  for (let stepIndex = 0; stepIndex < totalSteps; stepIndex += 1) {
    const step = startupCommands[stepIndex];
    const stepLabel = normalizeStepLabel(step, stepIndex);
    const markerToken = `${Date.now().toString(36)}-${stepIndex}-${Math.random().toString(36).slice(2, 8)}`;

    emitStartupEvent(emit, {
      type: "step-start",
      terminalId,
      launcherId,
      stepIndex,
      totalSteps,
      stepLabel,
      command: step.command,
    });

    const wrappedCommand = wrapStepCommand(step.command, markerToken, shellFamily);
    ptyManager.write(ptyId, `${wrappedCommand}\r`);

    const stepResult = await ptyManager.waitForStepResult(
      ptyId,
      markerToken,
      step.timeoutMs,
    );

    if (stepResult.ok) {
      emitStartupEvent(emit, {
        type: "step-success",
        terminalId,
        launcherId,
        stepIndex,
        totalSteps,
        stepLabel,
        command: step.command,
      });
      continue;
    }

    const failedEvent: LauncherStartupEvent = {
      type: "step-failed",
      terminalId,
      launcherId,
      stepIndex,
      totalSteps,
      stepLabel,
      command: step.command,
      ...(stepResult.exitCode !== undefined ? { exitCode: stepResult.exitCode } : {}),
      ...(stepResult.timeout ? { timeoutMs: step.timeoutMs } : {}),
      ...(stepResult.stderrPreview
        ? { stderrPreview: stepResult.stderrPreview }
        : {}),
      timestamp: Date.now(),
    };
    emit(failedEvent);

    return {
      ok: false,
      failedStepIndex: stepIndex,
      stepLabel,
      command: step.command,
      ...(stepResult.exitCode !== undefined ? { exitCode: stepResult.exitCode } : {}),
      ...(stepResult.timeout ? { timeoutMs: step.timeoutMs } : {}),
      ...(stepResult.stderrPreview
        ? { stderrPreview: stepResult.stderrPreview }
        : {}),
    };
  }

  return { ok: true };
}

export function runMainLauncherCommand({
  ptyManager,
  ptyId,
  hostShell,
  mainCommand,
}: RunMainLauncherCommandParams): void {
  const command = mainCommand.command.trim();
  if (command.length === 0) {
    return;
  }

  const shellFamily = resolveShellFamily(hostShell);
  const commandLine = buildCommandLine(command, mainCommand.args, shellFamily);
  ptyManager.write(ptyId, `${commandLine}\r`);
}
