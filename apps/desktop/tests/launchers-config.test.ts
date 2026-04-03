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

test("ensureLaunchersFile creates empty config when file is missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ot-launchers-"));
  const filePath = path.join(root, "nested", "launchers.json");

  ensureLaunchersFile(filePath);

  const json = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  assert.equal(json.version, 1);
  assert.ok(typeof json.updatedAt === "string");
  assert.deepEqual(json.launchers, []);

  fs.rmSync(root, { recursive: true, force: true });
});

test("loadLaunchersConfig initializes file when missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ot-launchers-"));
  const filePath = path.join(root, "launchers.json");

  const config = loadLaunchersConfig(filePath);

  assert.equal(config.version, 1);
  assert.deepEqual(config.launchers, []);
  assert.equal(fs.existsSync(filePath), true);

  fs.rmSync(root, { recursive: true, force: true });
});

test("saveLaunchersConfig rejects duplicate launcher ids", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ot-launchers-"));
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

  fs.rmSync(root, { recursive: true, force: true });
});

test("saveLaunchersConfig rejects timeoutMs outside allowed range", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ot-launchers-"));
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

  fs.rmSync(root, { recursive: true, force: true });
});

test("saveLaunchersConfig rejects non-fixed runPolicy", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ot-launchers-"));
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

  fs.rmSync(root, { recursive: true, force: true });
});

test("saveLaunchersConfig rejects missing required command field", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ot-launchers-"));
  const filePath = path.join(root, "launchers.json");
  const config = createValidConfig();

  config.launchers[0].mainCommand.command = "";

  assert.throws(
    () => saveLaunchersConfig(filePath, config),
    /mainCommand\.command/i,
  );

  fs.rmSync(root, { recursive: true, force: true });
});

test("saveLaunchersConfig persists config via tmp+rename", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ot-launchers-"));
  const filePath = path.join(root, "launchers.json");
  const tmpFilePath = `${filePath}.tmp`;
  const config = createValidConfig();

  saveLaunchersConfig(filePath, config);

  const loaded = loadLaunchersConfig(filePath);
  assert.deepEqual(loaded, config);
  assert.equal(fs.existsSync(tmpFilePath), false);

  fs.rmSync(root, { recursive: true, force: true });
});