import test from "node:test";
import assert from "node:assert/strict";

import { validateAgentCommand } from "../electron/agent-command.ts";

test("validateAgentCommand resolves a command and captures its version", async () => {
  const result = await validateAgentCommand("codex", {
    cwd: "C:\\repo",
    resolveLaunchSpec: async () => ({
      cwd: "C:\\repo",
      file: "C:\\bin\\codex.cmd",
      args: ["--flag"],
      env: { PATH: "C:\\bin" },
    }),
    execFile: (_file, _args, _options, callback) => {
      callback(null, "codex 1.2.3\n", "");
    },
  });

  assert.deepEqual(result, {
    ok: true,
    resolvedPath: "C:\\bin\\codex.cmd",
    version: "codex 1.2.3",
  });
});

test("validateAgentCommand returns an error when launch spec resolution fails", async () => {
  const result = await validateAgentCommand("missing-cli", {
    cwd: "C:\\repo",
    resolveLaunchSpec: async () => {
      throw new Error("Executable not found: missing-cli");
    },
  });

  assert.deepEqual(result, {
    ok: false,
    error: "Executable not found: missing-cli",
  });
});

test("validateAgentCommand keeps a resolved path even when version probing fails", async () => {
  const result = await validateAgentCommand("claude", {
    cwd: "C:\\repo",
    resolveLaunchSpec: async () => ({
      cwd: "C:\\repo",
      file: "C:\\bin\\claude.exe",
      args: [],
      env: { PATH: "C:\\bin" },
    }),
    execFile: (_file, _args, _options, callback) => {
      callback(new Error("spawn failed"), "", "");
    },
  });

  assert.deepEqual(result, {
    ok: true,
    resolvedPath: "C:\\bin\\claude.exe",
    version: null,
  });
});
