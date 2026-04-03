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
    signal?: AbortSignal,
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

export class LauncherStartupCancelledError extends Error {
  constructor() {
    super("Launcher startup cancelled");
    this.name = "LauncherStartupCancelledError";
  }
}

interface StartupSequenceParams {
  ptyManager: StartupPtyController;
  ptyId: number;
  terminalId: string;
  launcherId: string;
  hostShell: StartupHostShell;
  actualShell?: string;
  startupCommands: LauncherCommandStep[];
  emit: (event: LauncherStartupEvent) => void;
  signal?: AbortSignal;
}

interface RunMainLauncherCommandParams {
  ptyManager: Pick<StartupPtyController, "write">;
  ptyId: number;
  hostShell: StartupHostShell;
  actualShell?: string;
  mainCommand: LauncherMainCommand;
  signal?: AbortSignal;
}

interface RunLauncherStartupFlowParams extends StartupSequenceParams {
  mainCommand: LauncherMainCommand;
}

function throwIfStartupCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new LauncherStartupCancelledError();
  }
}

type ShellFamily = "cmd" | "pwsh" | "posix";

function resolveShellFamilyFromExecutable(shellPath: string): ShellFamily | null {
  const normalized = shellPath.replace(/\\/g, "/").toLowerCase();
  const fileName = normalized.split("/").pop() ?? normalized;

  if (fileName === "cmd" || fileName === "cmd.exe") {
    return "cmd";
  }

  if (
    fileName === "pwsh" ||
    fileName === "pwsh.exe" ||
    fileName === "powershell" ||
    fileName === "powershell.exe"
  ) {
    return "pwsh";
  }

  if (
    fileName.includes("bash") ||
    fileName.includes("zsh") ||
    fileName === "sh" ||
    fileName.endsWith(".sh")
  ) {
    return "posix";
  }

  return null;
}

function resolveShellFamily(
  hostShell: StartupHostShell,
  actualShell?: string,
): ShellFamily {
  if (actualShell) {
    const inferred = resolveShellFamilyFromExecutable(actualShell);
    if (inferred) {
      return inferred;
    }
  }

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
    return `$global:LASTEXITCODE = 0; ${command}; $ominitermSuccess = $?; if ($ominitermSuccess) { $ominitermExit = $LASTEXITCODE; if ($null -eq $ominitermExit) { $ominitermExit = 0 } } else { $ominitermExit = $LASTEXITCODE; if ($null -eq $ominitermExit -or $ominitermExit -eq 0) { $ominitermExit = 1 } }; Write-Output \"${marker}$ominitermExit\"`;
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
  actualShell,
  startupCommands,
  emit,
  signal,
}: StartupSequenceParams): Promise<StartupSequenceResult> {
  const totalSteps = startupCommands.length;
  if (totalSteps === 0) {
    return { ok: true };
  }

  throwIfStartupCancelled(signal);

  const shellFamily = resolveShellFamily(hostShell, actualShell);

  for (let stepIndex = 0; stepIndex < totalSteps; stepIndex += 1) {
    throwIfStartupCancelled(signal);

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
      signal,
    );

    if (stepResult.cancelled) {
      throw new LauncherStartupCancelledError();
    }

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
  actualShell,
  mainCommand,
  signal,
}: RunMainLauncherCommandParams): void {
  throwIfStartupCancelled(signal);

  const command = mainCommand.command.trim();
  if (command.length === 0) {
    return;
  }

  const shellFamily = resolveShellFamily(hostShell, actualShell);
  const commandLine = buildCommandLine(command, mainCommand.args, shellFamily);
  ptyManager.write(ptyId, `${commandLine}\r`);
}

function runRawLauncherCommand(
  ptyManager: Pick<StartupPtyController, "write">,
  ptyId: number,
  command: string,
): void {
  const normalized = command.trim();
  if (normalized.length === 0) {
    return;
  }
  ptyManager.write(ptyId, `${normalized}\r`);
}

export async function runLauncherStartupFlow({
  ptyManager,
  ptyId,
  terminalId,
  launcherId,
  hostShell,
  actualShell,
  startupCommands,
  emit,
  mainCommand,
  signal,
}: RunLauncherStartupFlowParams): Promise<StartupSequenceResult> {
  const normalizedMainCommand = mainCommand.command.trim();
  const shouldUseCommandGroupOnlyMode =
    normalizedMainCommand.length === 0 && startupCommands.length > 0;

  const bootstrapCommands = shouldUseCommandGroupOnlyMode
    ? startupCommands.slice(0, -1)
    : startupCommands;

  const startupResult = await runStartupCommandSequence({
    ptyManager,
    ptyId,
    terminalId,
    launcherId,
    hostShell,
    actualShell,
    startupCommands: bootstrapCommands,
    emit,
    signal,
  });

  if (startupResult.ok) {
    if (shouldUseCommandGroupOnlyMode) {
      throwIfStartupCancelled(signal);
      const finalStep = startupCommands[startupCommands.length - 1];
      runRawLauncherCommand(ptyManager, ptyId, finalStep.command);
    } else {
      runMainLauncherCommand({
        ptyManager,
        ptyId,
        hostShell,
        actualShell,
        mainCommand,
        signal,
      });
    }
  }

  return startupResult;
}
