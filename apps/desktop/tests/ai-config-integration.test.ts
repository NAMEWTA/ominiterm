import test, { afterEach, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import { aiConfigManager } from "../electron/ai-config/ai-config-manager.ts";
import { AiConfigPersistence } from "../electron/ai-config/ai-config-persistence.ts";
import { AiConfigWriter } from "../electron/ai-config/ai-config-writer.ts";
import type { AiCliConfig } from "../electron/ai-config/ai-config-types.ts";
import {
  buildLaunchSpec,
  PtyLaunchError,
  type LaunchResolverDeps,
} from "../electron/pty-launch.ts";

function createDeps(cwd: string): LaunchResolverDeps {
  return {
    platform: "darwin",
    pathDelimiter: ":",
    pathSeparator: "/",
    existsSync: (file) => [cwd, "/bin/zsh", "/usr/bin/codex"].includes(file),
    isExecutable: (file) => ["/bin/zsh", "/usr/bin/codex"].includes(file),
    getShellEnv: async () => ({
      HOME: "/Users/test",
      PATH: "/usr/bin:/bin",
      SHELL: "/bin/zsh",
    }),
  };
}

describe("AI Config Integration", () => {
  let testDir = "";
  let fakeHomeDir = "";
  let configFile = "";
  let repoDir = "";
  let originalConfigHomeEnv: string | undefined;
  let originalCodexFailEnv: string | undefined;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-integration-"));
    fakeHomeDir = path.join(testDir, "fake-home");
    configFile = path.join(testDir, "ai-config.json");
    repoDir = path.join(testDir, "repo");

    fs.mkdirSync(fakeHomeDir, { recursive: true });
    fs.mkdirSync(repoDir, { recursive: true });

    AiConfigPersistence._setConfigFileForTesting(configFile);
    aiConfigManager.reload();

    originalConfigHomeEnv = process.env.OMINITERM_AI_CONFIG_HOME;
    originalCodexFailEnv = process.env.OMINITERM_AI_CONFIG_FAIL_AFTER_CODEX_AUTH_FOR_TEST;
    process.env.OMINITERM_AI_CONFIG_HOME = fakeHomeDir;
    delete process.env.OMINITERM_AI_CONFIG_FAIL_AFTER_CODEX_AUTH_FOR_TEST;
  });

  afterEach(() => {
    if (originalConfigHomeEnv === undefined) {
      delete process.env.OMINITERM_AI_CONFIG_HOME;
    } else {
      process.env.OMINITERM_AI_CONFIG_HOME = originalConfigHomeEnv;
    }

    if (originalCodexFailEnv === undefined) {
      delete process.env.OMINITERM_AI_CONFIG_FAIL_AFTER_CODEX_AUTH_FOR_TEST;
    } else {
      process.env.OMINITERM_AI_CONFIG_FAIL_AFTER_CODEX_AUTH_FOR_TEST = originalCodexFailEnv;
    }

    AiConfigPersistence._resetConfigFilePath();
    aiConfigManager.reload();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test("should complete full workflow: add -> select -> terminal create -> write", async () => {
    const testConfig: AiCliConfig = {
      configId: "claude-test-1",
      type: "claude",
      name: "Test",
      providerName: "Claude Official",
      displayName: "Claude - Test",
      commonConfig: { apiKey: "sk-test-123", model: "claude-3-7-sonnet" },
      toolConfig: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 1. Add config
    aiConfigManager.addConfig(testConfig);

    // 2. Validate storage readback
    const retrieved = aiConfigManager.getConfig("claude-test-1");
    assert.ok(retrieved);
    assert.equal(retrieved.name, "Test");

    // 3. Validate type-based query used by account selector UI
    const byType = aiConfigManager.getConfigsByType("claude");
    assert.ok(byType.length > 0);
    assert.equal(byType[0].type, "claude");

    // 4. Set and validate default account
    aiConfigManager.setDefaultConfig("claude-test-1");
    const defaultConfig = aiConfigManager.getDefaultConfig("claude");
    assert.ok(defaultConfig);
    assert.equal(defaultConfig.configId, "claude-test-1");

    // 5. Simulate terminal creation with selected config
    await buildLaunchSpec(
      {
        cwd: repoDir,
        shell: "codex",
        args: ["--version"],
        configId: "claude-test-1",
      },
      createDeps(repoDir),
    );

    // 6. Validate tool config has been written to target location
    const configDir = AiConfigWriter.getConfigDirForType("claude");
    const configPath = path.join(configDir, "settings.json");
    assert.equal(fs.existsSync(configPath), true);

    const written = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
      env?: { ANTHROPIC_AUTH_TOKEN?: string };
    };
    assert.equal(written.env?.ANTHROPIC_AUTH_TOKEN, "sk-test-123");
  });

  test("should handle multiple configs of same type", () => {
    const config1: AiCliConfig = {
      configId: "claude-1",
      type: "claude",
      name: "Personal",
      providerName: "Claude Official",
      displayName: "Claude - Personal",
      commonConfig: { apiKey: "sk-1", model: "claude-3-7-sonnet" },
      toolConfig: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const config2: AiCliConfig = {
      configId: "claude-2",
      type: "claude",
      name: "Work",
      providerName: "Claude Official",
      displayName: "Claude - Work",
      commonConfig: { apiKey: "sk-2", model: "claude-3-5-haiku" },
      toolConfig: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    aiConfigManager.addConfig(config1);
    aiConfigManager.addConfig(config2);

    const byType = aiConfigManager.getConfigsByType("claude");
    assert.equal(byType.length, 2);

    aiConfigManager.setDefaultConfig("claude-1");
    const default1 = aiConfigManager.getConfig("claude-1");
    const default2 = aiConfigManager.getConfig("claude-2");

    assert.ok(default1);
    assert.ok(default2);
    assert.equal(default1.isDefault, true);
    assert.equal(default2.isDefault, false);
  });

  test("should fail launch when selected config does not exist", async () => {
    await assert.rejects(
      buildLaunchSpec(
        {
          cwd: repoDir,
          shell: "codex",
          args: ["--version"],
          configId: "missing-config-id",
        },
        createDeps(repoDir),
      ),
      (error: unknown) => {
        assert.ok(error instanceof PtyLaunchError);
        assert.equal(error.code, "ai-config-not-found");
        return true;
      },
    );
  });

  test("should fail launch when claude config model is missing", async () => {
    const claudeConfig: AiCliConfig = {
      configId: "claude-no-model",
      type: "claude",
      name: "NoModel",
      providerName: "Claude Official",
      displayName: "Claude - NoModel",
      commonConfig: { apiKey: "sk-test" },
      toolConfig: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    aiConfigManager.addConfig(claudeConfig);

    await assert.rejects(
      buildLaunchSpec(
        {
          cwd: repoDir,
          shell: "codex",
          args: ["--version"],
          configId: "claude-no-model",
        },
        createDeps(repoDir),
      ),
      (error: unknown) => {
        assert.ok(error instanceof PtyLaunchError);
        assert.equal(error.code, "ai-config-invalid");
        return true;
      },
    );
  });

  test("should write codex auth.json and config.toml", () => {
    const codexConfig: AiCliConfig = {
      configId: "codex-main",
      type: "codex",
      name: "Main",
      providerName: "OpenAI",
      displayName: "Codex - Main",
      commonConfig: {
        apiKey: "sk-codex-test",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-5-codex",
      },
      toolConfig: {
        config: "model = \"gpt-5-codex\"\n",
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    AiConfigWriter.writeConfigToTool("codex", codexConfig);

    const codexDir = AiConfigWriter.getConfigDirForType("codex");
    const authPath = path.join(codexDir, "auth.json");
    const tomlPath = path.join(codexDir, "config.toml");

    assert.equal(fs.existsSync(authPath), true);
    assert.equal(fs.existsSync(tomlPath), true);

    const auth = JSON.parse(fs.readFileSync(authPath, "utf-8")) as {
      OPENAI_API_KEY?: string;
    };
    assert.equal(auth.OPENAI_API_KEY, "sk-codex-test");

    const toml = fs.readFileSync(tomlPath, "utf-8");
    assert.match(toml, /model\s*=\s*"gpt-5-codex"/);
  });

  test("should rollback codex auth.json when config write fails", () => {
    const codexDir = AiConfigWriter.getConfigDirForType("codex");
    fs.mkdirSync(codexDir, { recursive: true });

    const authPath = path.join(codexDir, "auth.json");
    fs.writeFileSync(authPath, JSON.stringify({ OPENAI_API_KEY: "old-key" }, null, 2), "utf-8");

    process.env.OMINITERM_AI_CONFIG_FAIL_AFTER_CODEX_AUTH_FOR_TEST = "1";

    const codexConfig: AiCliConfig = {
      configId: "codex-main",
      type: "codex",
      name: "Main",
      providerName: "OpenAI",
      displayName: "Codex - Main",
      commonConfig: {
        apiKey: "new-key",
      },
      toolConfig: {
        config: "model = \"gpt-5\"\n",
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    assert.throws(() => {
      AiConfigWriter.writeConfigToTool("codex", codexConfig);
    }, {
      message: "Injected Codex config failure for testing",
    });

    const auth = JSON.parse(fs.readFileSync(authPath, "utf-8")) as {
      OPENAI_API_KEY?: string;
    };
    assert.equal(auth.OPENAI_API_KEY, "old-key");
  });

  test("should merge codex base_url and model by keys when config snippet is missing", () => {
    const codexDir = AiConfigWriter.getConfigDirForType("codex");
    fs.mkdirSync(codexDir, { recursive: true });

    const existingToml = [
      "model_provider = \"any\"",
      "model = \"old-model\"",
      "",
      "[model_providers.any]",
      "name = \"any\"",
      "wire_api = \"responses\"",
      "base_url = \"https://old.example/v1\"",
      "",
      "[mcp_servers.local]",
      "base_url = \"http://127.0.0.1:8080\"",
      "",
    ].join("\n");

    fs.writeFileSync(path.join(codexDir, "config.toml"), existingToml, "utf-8");

    const codexConfig: AiCliConfig = {
      configId: "codex-merge",
      type: "codex",
      name: "Merge",
      providerName: "OpenAI",
      displayName: "Codex - Merge",
      commonConfig: {
        apiKey: "merge-key",
        baseUrl: "https://new.example/v1",
        model: "gpt-5-codex",
      },
      toolConfig: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    AiConfigWriter.writeConfigToTool("codex", codexConfig);

    const writtenToml = fs.readFileSync(path.join(codexDir, "config.toml"), "utf-8");
    assert.match(writtenToml, /model\s*=\s*"gpt-5-codex"/);
    assert.match(
      writtenToml,
      /\[model_providers\.any\][\s\S]*base_url\s*=\s*"https:\/\/new\.example\/v1"/,
    );
    assert.match(writtenToml, /wire_api\s*=\s*"responses"/);
    assert.match(
      writtenToml,
      /\[mcp_servers\.local\][\s\S]*base_url\s*=\s*"http:\/\/127\.0\.0\.1:8080"/,
    );

    const auth = JSON.parse(fs.readFileSync(path.join(codexDir, "auth.json"), "utf-8")) as {
      OPENAI_API_KEY?: string;
    };
    assert.equal(auth.OPENAI_API_KEY, "merge-key");
  });

  test("should write gemini .env and opencode provider config", () => {
    const geminiConfig: AiCliConfig = {
      configId: "gemini-main",
      type: "gemini",
      name: "Main",
      providerName: "Google",
      displayName: "Gemini - Main",
      commonConfig: {
        apiKey: "gemini-key",
        baseUrl: "https://generativelanguage.googleapis.com",
      },
      toolConfig: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    AiConfigWriter.writeConfigToTool("gemini", geminiConfig);

    const geminiDir = AiConfigWriter.getConfigDirForType("gemini");
    const envPath = path.join(geminiDir, ".env");
    assert.equal(fs.existsSync(envPath), true);
    const envText = fs.readFileSync(envPath, "utf-8");
    assert.match(envText, /GEMINI_API_KEY=gemini-key/);

    const opencodeDir = AiConfigWriter.getConfigDirForType("opencode");
    fs.mkdirSync(opencodeDir, { recursive: true });
    fs.writeFileSync(
      path.join(opencodeDir, "opencode.json"),
      JSON.stringify({ provider: { existing: { options: { apiKey: "keep" } } } }, null, 2),
      "utf-8",
    );

    const opencodeConfig: AiCliConfig = {
      configId: "opencode-main",
      type: "opencode",
      name: "Main",
      providerName: "OpenCode",
      displayName: "OpenCode - Main",
      commonConfig: {
        apiKey: "opencode-key",
        baseUrl: "https://opencode.example/v1",
      },
      toolConfig: {
        provider: {
          npm: "@ai-sdk/openai",
          models: {
            "gpt-4.1": {
              name: "GPT-4.1",
            },
          },
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    AiConfigWriter.writeConfigToTool("opencode", opencodeConfig);

    const opencodeJson = JSON.parse(
      fs.readFileSync(path.join(opencodeDir, "opencode.json"), "utf-8"),
    ) as {
      provider?: Record<string, {
        npm?: string;
        options?: { apiKey?: string; baseURL?: string };
        models?: Record<string, { name?: string }>;
      }>;
    };

    assert.ok(opencodeJson.provider?.existing);
    assert.equal(opencodeJson.provider?.["opencode-main"]?.npm, "@ai-sdk/openai");
    assert.equal(opencodeJson.provider?.["opencode-main"]?.options?.apiKey, "opencode-key");
    assert.equal(
      opencodeJson.provider?.["opencode-main"]?.options?.baseURL,
      "https://opencode.example/v1",
    );
    assert.equal(opencodeJson.provider?.["opencode-main"]?.models?.["gpt-4.1"]?.name, "GPT-4.1");
  });

  test("should normalize opencode provider schema with strict defaults", () => {
    const opencodeConfig: AiCliConfig = {
      configId: "opencode-schema",
      type: "opencode",
      name: "Schema",
      providerName: "OpenCode",
      displayName: "OpenCode - Schema",
      commonConfig: {
        apiKey: "schema-key",
        baseUrl: "https://schema.example/v1",
        model: "gpt-4.1-mini",
      },
      toolConfig: {
        provider: {
          options: {
            headers: {
              "x-test": "1",
            },
            timeout: 30_000,
          },
          models: {
            bad: 123,
          },
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    AiConfigWriter.writeConfigToTool("opencode", opencodeConfig);

    const opencodeDir = AiConfigWriter.getConfigDirForType("opencode");
    const opencodeJson = JSON.parse(
      fs.readFileSync(path.join(opencodeDir, "opencode.json"), "utf-8"),
    ) as {
      provider?: Record<string, {
        npm?: string;
        options?: {
          apiKey?: string;
          baseURL?: string;
          headers?: Record<string, string>;
          timeout?: number;
        };
        models?: Record<string, { name?: string }>;
      }>;
    };

    const provider = opencodeJson.provider?.["opencode-schema"];
    assert.ok(provider);
    assert.equal(provider.npm, "@ai-sdk/openai-compatible");
    assert.equal(provider.options?.apiKey, "schema-key");
    assert.equal(provider.options?.baseURL, "https://schema.example/v1");
    assert.equal(provider.options?.headers?.["x-test"], "1");
    assert.equal(provider.options?.timeout, 30_000);
    assert.equal(provider.models?.["gpt-4.1-mini"]?.name, "gpt-4.1-mini");
    assert.equal(provider.models?.bad, undefined);
  });

  test("should replace or update live files when switching A to B", () => {
    const claudeA: AiCliConfig = {
      configId: "claude-a",
      type: "claude",
      name: "A",
      providerName: "Claude",
      displayName: "Claude - A",
      commonConfig: {
        apiKey: "claude-a-key",
        baseUrl: "https://claude-a.example",
        model: "claude-a-model",
      },
      toolConfig: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const claudeB: AiCliConfig = {
      configId: "claude-b",
      type: "claude",
      name: "B",
      providerName: "Claude",
      displayName: "Claude - B",
      commonConfig: {
        apiKey: "claude-b-key",
      },
      toolConfig: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    AiConfigWriter.writeConfigToTool("claude", claudeA);
    AiConfigWriter.writeConfigToTool("claude", claudeB);

    const claudeJson = JSON.parse(
      fs.readFileSync(
        path.join(AiConfigWriter.getConfigDirForType("claude"), "settings.json"),
        "utf-8",
      ),
    ) as { env?: Record<string, string> };
    assert.equal(claudeJson.env?.ANTHROPIC_AUTH_TOKEN, "claude-b-key");
    assert.equal(claudeJson.env?.ANTHROPIC_BASE_URL, undefined);
    assert.equal(claudeJson.env?.ANTHROPIC_MODEL, undefined);

    const codexA: AiCliConfig = {
      configId: "codex-a",
      type: "codex",
      name: "A",
      providerName: "Codex",
      displayName: "Codex - A",
      commonConfig: {
        apiKey: "codex-a-key",
      },
      toolConfig: {
        config: "model = \"gpt-a\"\n",
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const codexB: AiCliConfig = {
      configId: "codex-b",
      type: "codex",
      name: "B",
      providerName: "Codex",
      displayName: "Codex - B",
      commonConfig: {
        apiKey: "codex-b-key",
      },
      toolConfig: {
        config: "model = \"gpt-b\"\n",
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    AiConfigWriter.writeConfigToTool("codex", codexA);
    AiConfigWriter.writeConfigToTool("codex", codexB);

    const codexDir = AiConfigWriter.getConfigDirForType("codex");
    const codexAuth = JSON.parse(fs.readFileSync(path.join(codexDir, "auth.json"), "utf-8")) as {
      OPENAI_API_KEY?: string;
    };
    const codexToml = fs.readFileSync(path.join(codexDir, "config.toml"), "utf-8");
    assert.equal(codexAuth.OPENAI_API_KEY, "codex-b-key");
    assert.match(codexToml, /gpt-b/);
    assert.doesNotMatch(codexToml, /gpt-a/);

    const geminiA: AiCliConfig = {
      configId: "gemini-a",
      type: "gemini",
      name: "A",
      providerName: "Gemini",
      displayName: "Gemini - A",
      commonConfig: {
        apiKey: "gemini-a-key",
        baseUrl: "https://gemini-a.example",
      },
      toolConfig: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const geminiB: AiCliConfig = {
      configId: "gemini-b",
      type: "gemini",
      name: "B",
      providerName: "Gemini",
      displayName: "Gemini - B",
      commonConfig: {
        apiKey: "gemini-b-key",
      },
      toolConfig: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    AiConfigWriter.writeConfigToTool("gemini", geminiA);
    AiConfigWriter.writeConfigToTool("gemini", geminiB);

    const geminiEnv = fs.readFileSync(
      path.join(AiConfigWriter.getConfigDirForType("gemini"), ".env"),
      "utf-8",
    );
    assert.match(geminiEnv, /GEMINI_API_KEY=gemini-b-key/);
    assert.doesNotMatch(geminiEnv, /gemini-a-key/);
    assert.doesNotMatch(geminiEnv, /GOOGLE_GEMINI_BASE_URL=https:\/\/gemini-a\.example/);

    const opencodeA: AiCliConfig = {
      configId: "opencode-switch",
      type: "opencode",
      name: "A",
      providerName: "OpenCode",
      displayName: "OpenCode - A",
      commonConfig: {
        apiKey: "opencode-a-key",
        baseUrl: "https://opencode-a.example/v1",
      },
      toolConfig: {
        provider: {
          npm: "@ai-sdk/anthropic",
          models: {
            a: { name: "A" },
          },
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const opencodeB: AiCliConfig = {
      configId: "opencode-switch",
      type: "opencode",
      name: "B",
      providerName: "OpenCode",
      displayName: "OpenCode - B",
      commonConfig: {
        apiKey: "opencode-b-key",
        model: "b-model",
      },
      toolConfig: {
        provider: {
          options: {
            timeout: 20_000,
          },
          models: {
            bad: 1,
          },
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    AiConfigWriter.writeConfigToTool("opencode", opencodeA);
    AiConfigWriter.writeConfigToTool("opencode", opencodeB);

    const opencodeJson = JSON.parse(
      fs.readFileSync(
        path.join(AiConfigWriter.getConfigDirForType("opencode"), "opencode.json"),
        "utf-8",
      ),
    ) as {
      provider?: Record<string, {
        npm?: string;
        options?: { apiKey?: string; baseURL?: string; timeout?: number };
        models?: Record<string, { name?: string }>;
      }>;
    };

    const switched = opencodeJson.provider?.["opencode-switch"];
    assert.ok(switched);
    assert.equal(switched.npm, "@ai-sdk/openai-compatible");
    assert.equal(switched.options?.apiKey, "opencode-b-key");
    assert.equal(switched.options?.baseURL, undefined);
    assert.equal(switched.options?.timeout, 20_000);
    assert.equal(switched.models?.a, undefined);
    assert.equal(switched.models?.bad, undefined);
    assert.equal(switched.models?.["b-model"]?.name, "b-model");
  });
});