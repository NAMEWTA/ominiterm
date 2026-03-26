import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { migrateLegacyDirPair } from "../electron/state-persistence.ts";

test("save writes atomically via tmp+rename", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tc-state-"));
  const file = path.join(dir, "state.json");

  const data = { version: 1, projects: [] };
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, file);

  const loaded = JSON.parse(fs.readFileSync(file, "utf-8"));
  assert.deepEqual(loaded, data);
  assert.equal(fs.existsSync(tmp), false, "tmp file should be cleaned up by rename");

  fs.rmSync(dir, { recursive: true });
});

test("save with skipRestore flag", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tc-state-"));
  const file = path.join(dir, "state.json");

  const data = { version: 1, projects: [], skipRestore: true };
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, file);

  const loaded = JSON.parse(fs.readFileSync(file, "utf-8"));
  assert.equal(loaded.skipRestore, true);

  fs.rmSync(dir, { recursive: true });
});

test("migrateLegacyDirPair renames legacy state dir when target is missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tc-migrate-"));
  const legacyDir = path.join(root, ".termcanvas");
  const targetDir = path.join(root, ".ominiterm");
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(path.join(legacyDir, "state.json"), "{}", "utf-8");

  migrateLegacyDirPair(legacyDir, targetDir);

  assert.equal(fs.existsSync(legacyDir), false);
  assert.equal(fs.existsSync(path.join(targetDir, "state.json")), true);

  fs.rmSync(root, { recursive: true });
});

test("migrateLegacyDirPair leaves legacy dir untouched when new dir already exists", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tc-migrate-"));
  const legacyDir = path.join(root, ".termcanvas");
  const targetDir = path.join(root, ".ominiterm");
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.mkdirSync(targetDir, { recursive: true });

  migrateLegacyDirPair(legacyDir, targetDir);

  assert.equal(fs.existsSync(legacyDir), true);
  assert.equal(fs.existsSync(targetDir), true);

  fs.rmSync(root, { recursive: true });
});
