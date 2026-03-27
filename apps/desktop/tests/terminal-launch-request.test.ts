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

test("buildTerminalCreateRequest includes configId and launch command", () => {
  const terminal = makeTerminal({
    type: "claude",
    configId: "claude-work",
    initialPrompt: "hello",
  });

  const request = buildTerminalCreateRequest({
    terminal,
    worktreePath: "/repo",
    theme: "dark",
  });

  assert.equal(request.cwd, "/repo");
  assert.equal(request.terminalId, "terminal-1");
  assert.equal(request.configId, "claude-work");
  assert.equal(request.theme, "dark");
  assert.equal(request.shell, "claude");
  assert.deepEqual(request.args, ["hello"]);
});

test("buildTerminalCreateRequest omits prompt args when resuming session", () => {
  const terminal = makeTerminal({
    type: "codex",
    sessionId: "session-1",
    initialPrompt: "should-not-be-used",
    configId: "codex-a",
  });

  const request = buildTerminalCreateRequest({
    terminal,
    worktreePath: "/repo",
    theme: "light",
  });

  assert.equal(request.configId, "codex-a");
  assert.equal(request.shell, "codex");
  assert.deepEqual(request.args, ["resume", "session-1"]);
});
