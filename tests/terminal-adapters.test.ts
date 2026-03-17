import test from "node:test";
import assert from "node:assert/strict";

import {
  getComposerAdapter,
  getTerminalLaunchOptions,
  isComposerSupportedTerminal,
} from "../src/terminal/cliConfig.ts";

test("claude adapter exposes composer support and mac paste binding", () => {
  const adapter = getComposerAdapter("claude");
  assert.ok(adapter);
  assert.equal(adapter.inputMode, "paste");
  assert.equal(adapter.supportsImages, true);
  assert.equal(adapter.pasteKeySequence("darwin"), "\u001bv");
  assert.equal(adapter.imageFallback, "image-path");
  assert.ok(adapter.allowedStatuses.includes("waiting"));
});

test("codex adapter uses ctrl-v paste on every platform", () => {
  const adapter = getComposerAdapter("codex");
  assert.ok(adapter);
  assert.equal(adapter.inputMode, "paste");
  assert.equal(adapter.supportsImages, true);
  assert.equal(adapter.pasteKeySequence("darwin"), "\u0016");
  assert.equal(adapter.pasteKeySequence("win32"), "\u0016");
  assert.equal(adapter.imageFallback, "error");
});

test("shell uses direct text composer mode without image support", () => {
  const adapter = getComposerAdapter("shell");
  assert.ok(adapter);
  assert.equal(adapter.inputMode, "type");
  assert.equal(adapter.supportsImages, false);
  assert.equal(isComposerSupportedTerminal("shell"), true);
});

test("agent terminals beyond claude/codex are composer-supported", () => {
  assert.equal(isComposerSupportedTerminal("kimi"), true);
  assert.equal(isComposerSupportedTerminal("gemini"), true);
  assert.equal(isComposerSupportedTerminal("opencode"), true);
});

test("getTerminalLaunchOptions reuses centralized launch config", () => {
  assert.deepEqual(getTerminalLaunchOptions("claude", undefined), {
    shell: "claude",
    args: [],
  });
  assert.deepEqual(getTerminalLaunchOptions("codex", "session-1"), {
    shell: "codex",
    args: ["resume", "session-1"],
  });
});
