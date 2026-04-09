import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

test("startup restore uses global persisted state without workspace file event flow", () => {
  const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(source, /window\.ominiterm\.state\s*\.load\(\)/);
  assert.doesNotMatch(source, /ominiterm:open-workspace/);
  assert.doesNotMatch(source, /open_workspace_error/);
});

test("close flow no longer writes skipRestore or workspace files", () => {
  const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(source, /await window\.ominiterm\.state\.save\(snapshotState\(\)\);/);
  assert.doesNotMatch(source, /skipRestore/);
  assert.doesNotMatch(source, /window\.ominiterm\.workspace\./);
});