import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { AiConfigPersistence } from "../electron/ai-config/ai-config-persistence.ts";
import type { AiConfigDatabase } from "../electron/ai-config/ai-config-types.ts";

test("AiConfigPersistence: should return empty DB if file does not exist", () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-"));
  const configFile = path.join(testDir, "ai-config.json");

  AiConfigPersistence._setConfigFileForTesting(configFile);

  try {
    const db = AiConfigPersistence.load();
    assert.equal(db.version, 1);
    assert.deepEqual(db.configs, {});
  } finally {
    AiConfigPersistence._resetConfigFilePath();
    fs.rmSync(testDir, { recursive: true });
  }
});

test("AiConfigPersistence: should save and load config correctly", () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-"));
  const configFile = path.join(testDir, "ai-config.json");

  AiConfigPersistence._setConfigFileForTesting(configFile);

  try {
    const testDb: AiConfigDatabase = {
      version: 1,
      configs: {
        "claude-1": {
          configId: "claude-1",
          type: "claude",
          name: "Personal",
          providerName: "Claude Official",
          displayName: "Claude - Personal",
          commonConfig: {
            apiKey: "sk-test-123",
            baseUrl: "https://api.anthropic.com",
          },
          toolConfig: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDefault: true,
        },
      },
      metadata: {
        lastUpdated: Date.now(),
      },
    };

    // Save
    AiConfigPersistence.save(testDb);
    assert.equal(fs.existsSync(configFile), true);

    // Load
    const loaded = AiConfigPersistence.load();
    assert.equal(loaded.configs["claude-1"] !== undefined, true);
    assert.equal(loaded.configs["claude-1"].name, "Personal");
  } finally {
    AiConfigPersistence._resetConfigFilePath();
    fs.rmSync(testDir, { recursive: true });
  }
});

test("AiConfigPersistence: should handle corrupted file gracefully", () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-"));
  const configFile = path.join(testDir, "ai-config.json");

  AiConfigPersistence._setConfigFileForTesting(configFile);

  try {
    fs.writeFileSync(configFile, "invalid json {{{", "utf-8");

    const db = AiConfigPersistence.load();
    assert.deepEqual(db.configs, {});
  } finally {
    AiConfigPersistence._resetConfigFilePath();
    fs.rmSync(testDir, { recursive: true });
  }
});

test("AiConfigPersistence: should write atomically via tmp+rename", () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-"));
  const configFile = path.join(testDir, "ai-config.json");

  AiConfigPersistence._setConfigFileForTesting(configFile);

  try {
    const testDb: AiConfigDatabase = {
      version: 1,
      configs: {},
      metadata: {
        lastUpdated: 0,
      },
    };

    AiConfigPersistence.save(testDb);

    // Verify tmp file was cleaned up
    const tmpFile = configFile + ".tmp";
    assert.equal(fs.existsSync(tmpFile), false, "tmp file should be cleaned up by rename");

    // Verify config file exists
    assert.equal(fs.existsSync(configFile), true);
  } finally {
    AiConfigPersistence._resetConfigFilePath();
    fs.rmSync(testDir, { recursive: true });
  }
});

test("AiConfigPersistence: should create backup", () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-"));
  const configFile = path.join(testDir, "ai-config.json");

  AiConfigPersistence._setConfigFileForTesting(configFile);

  try {
    const testDb: AiConfigDatabase = {
      version: 1,
      configs: {},
      metadata: {
        lastUpdated: 0,
      },
    };

    // Save initial config
    AiConfigPersistence.save(testDb);
    assert.equal(fs.existsSync(configFile), true);

    // Create backup
    AiConfigPersistence.backup();

    // Find backup file
    const files = fs.readdirSync(testDir);
    const backupFiles = files.filter((f) => f.startsWith("ai-config.json.") && f.endsWith(".backup"));
    assert.equal(backupFiles.length, 1);
  } finally {
    AiConfigPersistence._resetConfigFilePath();
    fs.rmSync(testDir, { recursive: true });
  }
});

test("AiConfigPersistence: getConfigFilePath returns correct path", () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-"));
  const configFile = path.join(testDir, "ai-config.json");

  AiConfigPersistence._setConfigFileForTesting(configFile);

  try {
    assert.equal(AiConfigPersistence.getConfigFilePath(), configFile);
  } finally {
    AiConfigPersistence._resetConfigFilePath();
    fs.rmSync(testDir, { recursive: true });
  }
});
