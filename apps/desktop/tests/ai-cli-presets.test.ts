import test from "node:test";
import assert from "node:assert/strict";

import {
  CLI_PRESETS,
  getCliPreset,
  getConfigurableCliTypes,
} from "../src/config/aiCliPresets.ts";

test("CLI_PRESETS includes known Claude metadata", () => {
  const preset = getCliPreset("claude");

  assert.equal(preset.displayName, "Claude (Anthropic)");
  assert.equal(preset.commonFields.length > 0, true);
  assert.equal(preset.commonFields[0].key, "apiKey");
});

test("getConfigurableCliTypes returns only AI configurable types", () => {
  const types = getConfigurableCliTypes();

  assert.deepEqual(types, ["claude", "codex", "gemini", "opencode", "copilot", "kimi"]);
});

test("CLI_PRESETS maps all terminal types", () => {
  assert.ok(CLI_PRESETS.shell);
  assert.ok(CLI_PRESETS.tmux);
  assert.ok(CLI_PRESETS.lazygit);
});

test("Claude and Codex model fields are required", () => {
  const claudeModel = getCliPreset("claude").commonFields.find((field) => field.key === "model");
  const codexModel = getCliPreset("codex").commonFields.find((field) => field.key === "model");

  assert.ok(claudeModel);
  assert.ok(codexModel);
  assert.equal(claudeModel.required, true);
  assert.equal(codexModel.required, true);
});
