import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDefaultCommonConfig,
  buildDefaultToolConfig,
  DEFAULT_CODEX_TOML,
} from "../src/components/ai-config/accountDefaults.ts";

test("buildDefaultToolConfig adds claude defaults", () => {
  const toolConfig = buildDefaultToolConfig("claude");

  assert.deepEqual(toolConfig, {
    env: {
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1",
    },
    includeCoAuthoredBy: false,
    skipDangerousModePermissionPrompt: true,
  });
});

test("buildDefaultToolConfig adds codex default config snippet", () => {
  const toolConfig = buildDefaultToolConfig("codex");
  const configText = typeof toolConfig.config === "string" ? toolConfig.config : "";

  assert.match(configText, /model_provider\s*=\s*"OpenAI"/);
  assert.match(configText, /review_model\s*=\s*"gpt-5.4"/);
  assert.match(configText, /\[model_providers\.OpenAI\]/);
  assert.match(configText, /base_url\s*=\s*"https:\/\/gpt\.eacase\.de5\.net"/);
  assert.equal(configText, DEFAULT_CODEX_TOML);
});

test("buildDefaultCommonConfig keeps codex apiKey/baseUrl for user input", () => {
  const common = buildDefaultCommonConfig("codex");

  assert.equal(common.apiKey, "");
  assert.equal(common.model, "gpt-5.4");
  assert.equal(common.baseUrl, undefined);
});
