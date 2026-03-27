import test, { afterEach, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import { aiConfigManager } from "../electron/ai-config/ai-config-manager.ts";
import { AiConfigPersistence } from "../electron/ai-config/ai-config-persistence.ts";
import { AiConfigWriter } from "../electron/ai-config/ai-config-writer.ts";
import type { AiCliConfig } from "../electron/ai-config/ai-config-types.ts";
import { buildLaunchSpec, type LaunchResolverDeps } from "../electron/pty-launch.ts";

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
  let originalGetConfigDirForType: typeof AiConfigWriter.getConfigDirForType;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-integration-"));
    fakeHomeDir = path.join(testDir, "fake-home");
    configFile = path.join(testDir, "ai-config.json");
    repoDir = path.join(testDir, "repo");

    fs.mkdirSync(fakeHomeDir, { recursive: true });
    fs.mkdirSync(repoDir, { recursive: true });

    AiConfigPersistence._setConfigFileForTesting(configFile);
    aiConfigManager.reload();

    originalGetConfigDirForType = AiConfigWriter.getConfigDirForType;
    (
      AiConfigWriter as unknown as {
        getConfigDirForType: (type: string) => string;
      }
    ).getConfigDirForType = (type: string) => path.join(fakeHomeDir, `.${type}`);
  });

  afterEach(() => {
    (
      AiConfigWriter as unknown as {
        getConfigDirForType: (type: string) => string;
      }
    ).getConfigDirForType = originalGetConfigDirForType;

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
      commonConfig: { apiKey: "sk-test-123" },
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
    const configPath = path.join(configDir, "config.json");
    assert.equal(fs.existsSync(configPath), true);

    const written = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
      apiKey?: string;
    };
    assert.equal(written.apiKey, "sk-test-123");
  });

  test("should handle multiple configs of same type", () => {
    const config1: AiCliConfig = {
      configId: "claude-1",
      type: "claude",
      name: "Personal",
      providerName: "Claude Official",
      displayName: "Claude - Personal",
      commonConfig: { apiKey: "sk-1" },
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
      commonConfig: { apiKey: "sk-2" },
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
});