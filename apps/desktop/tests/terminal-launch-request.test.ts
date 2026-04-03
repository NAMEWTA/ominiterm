import test from "node:test";
import assert from "node:assert/strict";

import type { TerminalData } from "../src/types/index.ts";
import { buildTerminalCreateRequest } from "../src/terminal/terminalLaunchRequest.ts";

function makeTerminal(overrides: Partial<TerminalData> = {}): TerminalData {
  return {
    id: "terminal-1",
    title: "Claude",
    type: "claude",
    focused: false,
    ptyId: null,
    status: "idle",
    ...overrides,
  };
}

test("buildTerminalCreateRequest includes launch command", () => {
  const terminal = makeTerminal({
    type: "claude",
    initialPrompt: "hello",
  });

  const request = buildTerminalCreateRequest({
    terminal,
    worktreePath: "/repo",
    theme: "dark",
  });

  assert.equal(request.cwd, "/repo");
  assert.equal(request.terminalId, "terminal-1");
  assert.equal(request.theme, "dark");
  assert.equal(request.isResume, false);
  assert.equal(request.shell, "claude");
  assert.deepEqual(request.args, ["hello"]);
});

test("buildTerminalCreateRequest omits prompt args when resuming session", () => {
  const terminal = makeTerminal({
    type: "codex",
    sessionId: "session-1",
    initialPrompt: "should-not-be-used",
  });

  const request = buildTerminalCreateRequest({
    terminal,
    worktreePath: "/repo",
    theme: "light",
  });

  assert.equal(request.isResume, true);
  assert.equal(request.shell, "codex");
  assert.deepEqual(request.args, ["resume", "session-1"]);
});

test("buildTerminalCreateRequest maps launcher host shell for new sessions", () => {
  const terminal = makeTerminal({
    type: "codex",
    launcherId: "custom-launcher",
    launcherName: "Custom Launcher",
    initialPrompt: "ignored prompt",
    launcherConfigSnapshot: {
      hostShell: "bash",
      mainCommand: {
        command: "custom-cli",
        args: ["--fast"],
      },
      startupCommands: [
        {
          label: "Prepare",
          command: "echo prepare",
          timeoutMs: 5000,
        },
      ],
    },
  });

  const request = buildTerminalCreateRequest({
    terminal,
    worktreePath: "/repo",
    theme: "dark",
  });

  assert.equal(request.isResume, false);
  assert.equal(request.launcherId, "custom-launcher");
  assert.equal(request.launcherName, "Custom Launcher");
  assert.equal(request.launcherConfigSnapshot?.hostShell, "bash");
  assert.equal(
    request.launcherConfigSnapshot?.mainCommand.command,
    "custom-cli",
  );
  assert.deepEqual(request.launcherConfigSnapshot?.mainCommand.args, ["--fast"]);
  assert.equal(request.shell, "bash");
  assert.deepEqual(request.args, []);
});

test("buildTerminalCreateRequest keeps launcher auto host shell undefined", () => {
  const terminal = makeTerminal({
    type: "shell",
    launcherId: "launcher-auto",
    launcherName: "Launcher Auto",
    launcherConfigSnapshot: {
      hostShell: "auto",
      mainCommand: {
        command: "custom-cli",
        args: [],
      },
      startupCommands: [],
    },
  });

  const request = buildTerminalCreateRequest({
    terminal,
    worktreePath: "/repo",
    theme: "dark",
  });

  assert.equal(request.isResume, false);
  assert.equal(request.shell, undefined);
  assert.deepEqual(request.args, []);
});

test("buildTerminalCreateRequest keeps resume launch args when launcher snapshot exists", () => {
  const terminal = makeTerminal({
    type: "codex",
    sessionId: "resume-123",
    launcherId: "custom-launcher",
    launcherName: "Custom Launcher",
    launcherConfigSnapshot: {
      hostShell: "pwsh",
      mainCommand: {
        command: "custom-cli",
        args: ["--fast"],
      },
      startupCommands: [
        {
          label: "Prepare",
          command: "echo prepare",
          timeoutMs: 5000,
        },
      ],
    },
  });

  const request = buildTerminalCreateRequest({
    terminal,
    worktreePath: "/repo",
    theme: "dark",
  });

  assert.equal(request.isResume, true);
  assert.equal(request.shell, "codex");
  assert.deepEqual(request.args, ["resume", "resume-123"]);
});
