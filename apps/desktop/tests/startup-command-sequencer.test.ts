import test from "node:test";
import assert from "node:assert/strict";

import {
  runLauncherStartupFlow,
  runMainLauncherCommand,
  runStartupCommandSequence,
} from "../electron/startup-command-sequencer.ts";
import type { LauncherStartupEvent } from "../src/types/index.ts";
import type { PtyStepWaitResult } from "../electron/pty-manager.ts";

class FakePtyManager {
  writes: string[] = [];
  waitCalls: Array<{ ptyId: number; markerToken: string; timeoutMs: number }> = [];
  private readonly results: PtyStepWaitResult[];

  constructor(results: PtyStepWaitResult[]) {
    this.results = [...results];
  }

  write(_ptyId: number, data: string): void {
    this.writes.push(data);
  }

  async waitForStepResult(
    ptyId: number,
    markerToken: string,
    timeoutMs: number,
  ): Promise<PtyStepWaitResult> {
    this.waitCalls.push({ ptyId, markerToken, timeoutMs });
    const next = this.results.shift();
    if (!next) {
      throw new Error("Missing fake step result");
    }
    return next;
  }
}

const STARTUP_STEPS = [
  {
    label: "Prepare",
    command: "echo prepare",
    timeoutMs: 1000,
  },
  {
    label: "Install deps",
    command: "pnpm install",
    timeoutMs: 2000,
  },
  {
    label: "Build",
    command: "pnpm build",
    timeoutMs: 2000,
  },
];

test("runStartupCommandSequence stops on first failure", async () => {
  const ptyManager = new FakePtyManager([
    { ok: true, timeout: false, exitCode: 0 },
    { ok: false, timeout: false, exitCode: 1, stderrPreview: "ENOENT" },
  ]);
  const events: LauncherStartupEvent[] = [];

  const result = await runStartupCommandSequence({
    ptyManager,
    ptyId: 7,
    terminalId: "terminal-1",
    launcherId: "custom-launcher",
    hostShell: "bash",
    startupCommands: STARTUP_STEPS,
    emit: (event) => events.push(event),
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("Expected failed startup result");
  }
  assert.equal(result.failedStepIndex, 1);
  assert.equal(result.stepLabel, "Install deps");
  assert.equal(result.exitCode, 1);
  assert.equal(ptyManager.writes.length, 2);
  assert.equal(ptyManager.waitCalls.length, 2);
});

test("runStartupCommandSequence emits ordered startup events", async () => {
  const ptyManager = new FakePtyManager([
    { ok: true, timeout: false, exitCode: 0 },
    { ok: false, timeout: true, stderrPreview: "timeout" },
  ]);
  const events: LauncherStartupEvent[] = [];

  await runStartupCommandSequence({
    ptyManager,
    ptyId: 8,
    terminalId: "terminal-2",
    launcherId: "custom-launcher",
    hostShell: "pwsh",
    startupCommands: STARTUP_STEPS,
    emit: (event) => events.push(event),
  });

  assert.deepEqual(
    events.map((event) => event.type),
    ["step-start", "step-success", "step-start", "step-failed"],
  );
  assert.equal(events[3].timeoutMs, 2000);
});

test("runLauncherStartupFlow runs main launcher command only after startup success", async () => {
  const failureManager = new FakePtyManager([
    { ok: false, timeout: false, exitCode: 2 },
  ]);
  const failureResult = await runLauncherStartupFlow({
    ptyManager: failureManager,
    ptyId: 9,
    terminalId: "terminal-failure",
    launcherId: "custom-launcher",
    hostShell: "bash",
    startupCommands: [STARTUP_STEPS[0]],
    emit: () => {},
    mainCommand: {
      command: "codex",
      args: ["--fast"],
    },
  });

  assert.equal(failureResult.ok, false);
  assert.equal(
    failureManager.writes.some((write) => write.includes("codex")),
    false,
  );

  const successManager = new FakePtyManager([
    { ok: true, timeout: false, exitCode: 0 },
  ]);
  const successResult = await runLauncherStartupFlow({
    ptyManager: successManager,
    ptyId: 10,
    terminalId: "terminal-success",
    launcherId: "custom-launcher",
    hostShell: "pwsh",
    startupCommands: [STARTUP_STEPS[0]],
    emit: () => {},
    mainCommand: {
      command: "codex",
      args: ["--fast"],
    },
  });

  assert.equal(successResult.ok, true);
  assert.equal(
    successManager.writes.some((write) => write.includes("codex")),
    true,
  );
});

test("runStartupCommandSequence uses fallback actual shell family for wrapped steps", async () => {
  const ptyManager = new FakePtyManager([
    { ok: true, timeout: false, exitCode: 0 },
  ]);

  await runStartupCommandSequence({
    ptyManager,
    ptyId: 11,
    terminalId: "terminal-fallback",
    launcherId: "custom-launcher",
    hostShell: "bash",
    actualShell: "C:\\Windows\\System32\\cmd.exe",
    startupCommands: [STARTUP_STEPS[0]],
    emit: () => {},
  });

  assert.equal(ptyManager.writes.length, 1);
  assert.match(ptyManager.writes[0], /%ERRORLEVEL%/);
  assert.equal(ptyManager.writes[0].includes("__ominitermExit"), false);
});

test("runMainLauncherCommand uses fallback actual shell family", () => {
  const ptyManager = new FakePtyManager([]);

  runMainLauncherCommand({
    ptyManager,
    ptyId: 12,
    hostShell: "bash",
    actualShell: "C:\\Windows\\System32\\cmd.exe",
    mainCommand: {
      command: "echo",
      args: ["hello world"],
    },
  });

  assert.equal(ptyManager.writes.length, 1);
  assert.equal(ptyManager.writes[0], 'echo "hello world"\r');
});

test("runStartupCommandSequence PowerShell wrapper handles null LASTEXITCODE", async () => {
  const ptyManager = new FakePtyManager([
    { ok: true, timeout: false, exitCode: 0 },
  ]);

  await runStartupCommandSequence({
    ptyManager,
    ptyId: 13,
    terminalId: "terminal-pwsh",
    launcherId: "custom-launcher",
    hostShell: "pwsh",
    startupCommands: [STARTUP_STEPS[0]],
    emit: () => {},
  });

  assert.equal(ptyManager.writes.length, 1);
  assert.ok(ptyManager.writes[0].includes("$global:LASTEXITCODE = 0"));
  assert.ok(ptyManager.writes[0].includes("$ominitermSuccess = $?"));
  assert.ok(
    ptyManager.writes[0].includes(
      "if ($null -eq $ominitermExit -or $ominitermExit -eq 0) { $ominitermExit = 1 }",
    ),
  );
});

test("runMainLauncherCommand uses resolved shell when host shell is auto", () => {
  const ptyManager = new FakePtyManager([]);

  runMainLauncherCommand({
    ptyManager,
    ptyId: 15,
    hostShell: "auto",
    actualShell: "C:\\Windows\\System32\\cmd.exe",
    mainCommand: {
      command: "echo",
      args: ["auto shell"],
    },
  });

  assert.equal(ptyManager.writes.length, 1);
  assert.equal(ptyManager.writes[0], 'echo "auto shell"\r');
});

test("runMainLauncherCommand keeps explicit host shell behavior when no fallback is present", () => {
  const ptyManager = new FakePtyManager([]);

  runMainLauncherCommand({
    ptyManager,
    ptyId: 14,
    hostShell: "bash",
    mainCommand: {
      command: "codex",
      args: ["--fast"],
    },
  });

  assert.equal(ptyManager.writes.length, 1);
  assert.equal(ptyManager.writes[0], "'codex' '--fast'\r");
});