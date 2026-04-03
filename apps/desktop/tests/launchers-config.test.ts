import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ensureLaunchersFile,
  loadLaunchersConfig,
  saveLaunchersConfig,
  type LaunchersConfigFile,
} from "../electron/launchers-config.ts";

const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 600000;

function createValidConfig(): LaunchersConfigFile {
  return {
    version: 1,
    updatedAt: "2026-04-03T12:00:00.000Z",
    launchers: [
      {
        id: "codex",
        name: "Codex",
        enabled: true,
        hostShell: "auto",
        mainCommand: {
          command: "codex",
          args: [],
        },
        startupCommands: [
          {
            label: "sync deps",
            command: "pnpm install",
            timeoutMs: 120000,
          },
        ],
        runPolicy: {
          runOnNewSessionOnly: true,
          onFailure: "stop",
        },
      },
    ],
  };
}

function withTempRoot(run: (root: string) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ot-launchers-"));
  try {
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("ensureLaunchersFile creates empty config when file is missing", () => {
  withTempRoot((root) => {
    const filePath = path.join(root, "nested", "launchers.json");

    ensureLaunchersFile(filePath);

    const json = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    assert.equal(json.version, 1);
    assert.ok(typeof json.updatedAt === "string");
    assert.deepEqual(json.launchers, []);
  });
});

test("loadLaunchersConfig initializes file when missing", () => {
  withTempRoot((root) => {
    const filePath = path.join(root, "launchers.json");

    const config = loadLaunchersConfig(filePath);

    assert.equal(config.version, 1);
    assert.deepEqual(config.launchers, []);
    assert.equal(fs.existsSync(filePath), true);
  });
});

test("loadLaunchersConfig throws on invalid JSON", () => {
  withTempRoot((root) => {
    const filePath = path.join(root, "launchers.json");
    fs.writeFileSync(filePath, "{ invalid json", "utf-8");

    assert.throws(
      () => loadLaunchersConfig(filePath),
      /failed to parse config file/i,
    );
  });
});

test("loadLaunchersConfig rejects unsupported version", () => {
  withTempRoot((root) => {
    const filePath = path.join(root, "launchers.json");
    const rawConfig = {
      ...createValidConfig(),
      version: 2,
    };

    fs.writeFileSync(filePath, JSON.stringify(rawConfig, null, 2), "utf-8");

    assert.throws(
      () => loadLaunchersConfig(filePath),
      /config\.version must be 1/i,
    );
  });
});

test("loadLaunchersConfig rejects invalid launcher field", () => {
  withTempRoot((root) => {
    const filePath = path.join(root, "launchers.json");
    const rawConfig = JSON.parse(JSON.stringify(createValidConfig())) as {
      launchers: Array<{ hostShell: string }>;
    };
    rawConfig.launchers[0].hostShell = "fish";

    fs.writeFileSync(filePath, JSON.stringify(rawConfig, null, 2), "utf-8");

    assert.throws(
      () => loadLaunchersConfig(filePath),
      /hostShell is invalid/i,
    );
  });
});

test("saveLaunchersConfig rejects duplicate launcher ids", () => {
  withTempRoot((root) => {
    const filePath = path.join(root, "launchers.json");
    const config = createValidConfig();

    config.launchers.push({
      ...config.launchers[0],
      name: "Codex Copy",
    });

    assert.throws(
      () => saveLaunchersConfig(filePath, config),
      /duplicate launcher id/i,
    );
  });
});

test("saveLaunchersConfig rejects timeoutMs outside allowed range", () => {
  withTempRoot((root) => {
    const filePath = path.join(root, "launchers.json");

    const tooSmall = createValidConfig();
    tooSmall.launchers[0].startupCommands[0].timeoutMs = MIN_TIMEOUT_MS - 1;

    const tooLarge = createValidConfig();
    tooLarge.launchers[0].startupCommands[0].timeoutMs = MAX_TIMEOUT_MS + 1;

    assert.throws(
      () => saveLaunchersConfig(filePath, tooSmall),
      /timeoutMs/i,
    );
    assert.throws(
      () => saveLaunchersConfig(filePath, tooLarge),
      /timeoutMs/i,
    );
  });
});

test("saveLaunchersConfig rejects non-fixed runPolicy", () => {
  withTempRoot((root) => {
    const filePath = path.join(root, "launchers.json");
    const config = createValidConfig();

    config.launchers[0].runPolicy = {
      runOnNewSessionOnly: false,
      onFailure: "stop",
    } as LaunchersConfigFile["launchers"][number]["runPolicy"];

    assert.throws(
      () => saveLaunchersConfig(filePath, config),
      /runPolicy/i,
    );
  });
});

test("saveLaunchersConfig rejects empty main and empty startup commands", () => {
  withTempRoot((root) => {
    const filePath = path.join(root, "launchers.json");
    const config = createValidConfig();

    config.launchers[0].mainCommand.command = "";
    config.launchers[0].startupCommands = [];

    assert.throws(
      () => saveLaunchersConfig(filePath, config),
      /at least one command/i,
    );
  });
});

test("saveLaunchersConfig allows empty main command when startup commands exist", () => {
  withTempRoot((root) => {
    const filePath = path.join(root, "launchers.json");
    const config = createValidConfig();

    config.launchers[0].mainCommand.command = "";

    saveLaunchersConfig(filePath, config);

    const loaded = loadLaunchersConfig(filePath);
    assert.equal(loaded.launchers[0].mainCommand.command, "");
    assert.equal(loaded.launchers[0].startupCommands.length, 1);
  });
});

test("saveLaunchersConfig persists config via tmp+rename", () => {
  withTempRoot((root) => {
    const filePath = path.join(root, "launchers.json");
    const tmpFilePath = `${filePath}.tmp`;
    const config = createValidConfig();

    saveLaunchersConfig(filePath, config);

    const loaded = loadLaunchersConfig(filePath);
    assert.deepEqual(loaded, config);
    assert.equal(fs.existsSync(tmpFilePath), false);
  });
});