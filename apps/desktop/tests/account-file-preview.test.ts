import test from "node:test";
import assert from "node:assert/strict";

import { buildAccountPreviewFiles } from "../src/components/ai-config/accountFilePreview.ts";
import type { AiCliConfig } from "../src/types/ai-config.ts";

function makeConfig(overrides: Partial<AiCliConfig>): AiCliConfig {
  return {
    configId: "preview-1",
    type: "claude",
    name: "Preview",
    providerName: "Provider",
    displayName: "Display",
    commonConfig: {
      apiKey: "sk-test",
      model: "model-x",
    },
    toolConfig: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

test("buildAccountPreviewFiles builds claude settings preview", () => {
  const files = buildAccountPreviewFiles(
    makeConfig({
      type: "claude",
      commonConfig: {
        apiKey: "sk-claude",
        model: "claude-3-7-sonnet",
        baseUrl: "https://claude.example/v1",
      },
    }),
  );

  assert.equal(files.length, 1);
  assert.equal(files[0]?.path, "~/.claude/settings.json");
  assert.match(files[0]?.content ?? "", /ANTHROPIC_MODEL/);
});

test("buildAccountPreviewFiles builds codex auth and toml preview", () => {
  const files = buildAccountPreviewFiles(
    makeConfig({
      type: "codex",
      commonConfig: {
        apiKey: "sk-codex",
        model: "gpt-5-codex",
        baseUrl: "https://api.openai.com/v1",
      },
    }),
  );

  assert.equal(files.length, 2);
  assert.equal(files[0]?.path, "~/.codex/auth.json");
  assert.match(files[0]?.content ?? "", /OPENAI_API_KEY/);
  assert.equal(files[1]?.path, "~/.codex/config.toml");
  assert.match(files[1]?.content ?? "", /model = "gpt-5-codex"/);
});
