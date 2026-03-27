import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { AiConfigManager } from "../electron/ai-config/ai-config-manager.ts";
import { AiConfigPersistence } from "../electron/ai-config/ai-config-persistence.ts";
import type { AiCliConfig } from "../electron/ai-config/ai-config-types.ts";

function makeMockConfig(configId = "claude-personal-1", name = "Personal"): AiCliConfig {
  const now = Date.now();
  return {
    configId,
    type: "claude",
    name,
    providerName: "Claude Official",
    displayName: `Claude - ${name}`,
    commonConfig: {
      apiKey: "sk-test-123",
      baseUrl: "https://api.anthropic.com",
    },
    toolConfig: {},
    createdAt: now,
    updatedAt: now,
  };
}

function withFreshManager(run: (manager: AiConfigManager) => void): void {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-manager-"));
  AiConfigPersistence._setConfigFileForTesting(path.join(testDir, "ai-config.json"));

  try {
    const manager = new AiConfigManager();
    run(manager);
  } finally {
    AiConfigPersistence._resetConfigFilePath();
    fs.rmSync(testDir, { recursive: true });
  }
}

function withMockedSaveFailure(run: () => void): void {
  const originalSave = AiConfigPersistence.save;
  (AiConfigPersistence as unknown as { save: typeof AiConfigPersistence.save }).save = () => {
    throw new Error("save failed");
  };

  try {
    run();
  } finally {
    (AiConfigPersistence as unknown as { save: typeof AiConfigPersistence.save }).save = originalSave;
  }
}

test("AiConfigManager: should add config", { concurrency: false }, () => {
  withFreshManager((manager) => {
    const mockConfig = makeMockConfig();
    manager.addConfig(mockConfig);

    const config = manager.getConfig("claude-personal-1");
    assert.ok(config);
    assert.equal(config.name, "Personal");
  });
});

test("AiConfigManager: should not add duplicate config", { concurrency: false }, () => {
  withFreshManager((manager) => {
    const mockConfig = makeMockConfig();
    manager.addConfig(mockConfig);

    assert.throws(() => manager.addConfig(makeMockConfig()), {
      message: "Configuration with ID 'claude-personal-1' already exists",
    });
  });
});

test("AiConfigManager: should get configs by type", { concurrency: false }, () => {
  withFreshManager((manager) => {
    manager.addConfig(makeMockConfig());

    const configs = manager.getConfigsByType("claude");
    assert.equal(configs.length, 1);
    assert.equal(configs[0].configId, "claude-personal-1");
  });
});

test("AiConfigManager: should return cloned config from getConfig", { concurrency: false }, () => {
  withFreshManager((manager) => {
    manager.addConfig(makeMockConfig());

    const config = manager.getConfig("claude-personal-1");
    assert.ok(config);
    config.name = "Mutated Name";
    config.commonConfig.apiKey = "mutated-key";

    const stored = manager.getConfig("claude-personal-1");
    assert.ok(stored);
    assert.equal(stored.name, "Personal");
    assert.equal(stored.commonConfig.apiKey, "sk-test-123");
  });
});

test("AiConfigManager: should update config while preserving immutable fields", { concurrency: false }, () => {
  withFreshManager((manager) => {
    manager.addConfig(makeMockConfig());
    const before = manager.getConfig("claude-personal-1");
    assert.ok(before);

    manager.updateConfig("claude-personal-1", {
      name: "Updated",
      configId: "should-not-change",
      createdAt: 1,
    });

    const updated = manager.getConfig("claude-personal-1");
    assert.ok(updated);
    assert.equal(updated.name, "Updated");
    assert.equal(updated.configId, "claude-personal-1");
    assert.equal(updated.createdAt, before.createdAt);
  });
});

test("AiConfigManager: should delete config", { concurrency: false }, () => {
  withFreshManager((manager) => {
    manager.addConfig(makeMockConfig());
    manager.deleteConfig("claude-personal-1");

    assert.equal(manager.getConfig("claude-personal-1"), null);
  });
});

test("AiConfigManager: should set default config and clear same-type previous default", { concurrency: false }, () => {
  withFreshManager((manager) => {
    manager.addConfig({ ...makeMockConfig("claude-personal-1", "Personal"), isDefault: true });
    manager.addConfig(makeMockConfig("claude-work-1", "Work"));

    manager.setDefaultConfig("claude-work-1");

    const personal = manager.getConfig("claude-personal-1");
    const work = manager.getConfig("claude-work-1");
    assert.ok(personal);
    assert.ok(work);
    assert.equal(personal.isDefault, false);
    assert.equal(work.isDefault, true);
    assert.equal(manager.getDefaultConfig("claude")?.configId, "claude-work-1");
  });
});

test("AiConfigManager: should clear same-type default when addConfig inserts new default", { concurrency: false }, () => {
  withFreshManager((manager) => {
    manager.addConfig({ ...makeMockConfig("claude-personal-1", "Personal"), isDefault: true });
    manager.addConfig({ ...makeMockConfig("claude-work-1", "Work"), isDefault: true });

    const personal = manager.getConfig("claude-personal-1");
    const work = manager.getConfig("claude-work-1");
    assert.ok(personal);
    assert.ok(work);
    assert.equal(personal.isDefault, false);
    assert.equal(work.isDefault, true);
  });
});

test("AiConfigManager: should clear same-type default when updateConfig sets default", { concurrency: false }, () => {
  withFreshManager((manager) => {
    manager.addConfig({ ...makeMockConfig("claude-personal-1", "Personal"), isDefault: true });
    manager.addConfig(makeMockConfig("claude-work-1", "Work"));

    manager.updateConfig("claude-work-1", { isDefault: true });

    const personal = manager.getConfig("claude-personal-1");
    const work = manager.getConfig("claude-work-1");
    assert.ok(personal);
    assert.ok(work);
    assert.equal(personal.isDefault, false);
    assert.equal(work.isDefault, true);
  });
});

test("AiConfigManager: should validate configId and type consistency on add", { concurrency: false }, () => {
  withFreshManager((manager) => {
    assert.throws(() => {
      manager.addConfig({
        ...makeMockConfig("gemini-personal-1", "Personal"),
        type: "claude",
      });
    }, {
      message: "Config ID prefix 'gemini' does not match type 'claude'. Config ID should start with 'claude-'",
    });
  });
});

test("AiConfigManager: should validate configId and type consistency on update", { concurrency: false }, () => {
  withFreshManager((manager) => {
    manager.addConfig(makeMockConfig("claude-personal-1", "Personal"));

    assert.throws(() => {
      manager.updateConfig("claude-personal-1", { type: "codex" });
    }, {
      message: "Config ID prefix 'claude' does not match type 'codex'. Config ID should start with 'codex-'",
    });
  });
});

test("AiConfigManager: should rollback addConfig when save fails", { concurrency: false }, () => {
  withFreshManager((manager) => {
    const config = makeMockConfig("claude-personal-1", "Personal");

    withMockedSaveFailure(() => {
      assert.throws(() => {
        manager.addConfig(config);
      }, {
        message: "save failed",
      });
    });

    assert.equal(manager.getConfig("claude-personal-1"), null);
  });
});

test("AiConfigManager: should rollback updateConfig when save fails", { concurrency: false }, () => {
  withFreshManager((manager) => {
    manager.addConfig(makeMockConfig("claude-personal-1", "Personal"));

    withMockedSaveFailure(() => {
      assert.throws(() => {
        manager.updateConfig("claude-personal-1", { name: "Mutated" });
      }, {
        message: "save failed",
      });
    });

    const config = manager.getConfig("claude-personal-1");
    assert.ok(config);
    assert.equal(config.name, "Personal");
  });
});

test("AiConfigManager: should rollback deleteConfig when save fails", { concurrency: false }, () => {
  withFreshManager((manager) => {
    manager.addConfig(makeMockConfig("claude-personal-1", "Personal"));

    withMockedSaveFailure(() => {
      assert.throws(() => {
        manager.deleteConfig("claude-personal-1");
      }, {
        message: "save failed",
      });
    });

    const config = manager.getConfig("claude-personal-1");
    assert.ok(config);
  });
});

test("AiConfigManager: should generate unique config ID", { concurrency: false }, () => {
  withFreshManager((manager) => {
    const id1 = manager.generateConfigId("claude", "personal");
    manager.addConfig(makeMockConfig(id1, "Personal"));

    const id2 = manager.generateConfigId("claude", "personal");
    assert.notEqual(id1, id2);
  });
});