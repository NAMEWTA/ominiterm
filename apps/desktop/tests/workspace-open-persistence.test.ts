import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

test("useWorkspaceOpen persists selected workspace payload immediately", () => {
  const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(source, /await window\.ominiterm\?\.state\.save\(raw\);/);
  assert.match(source, /window\.addEventListener\("ominiterm:open-workspace", handler\)/);
});

test("useWorkspaceOpen reports parse failures via notifications", () => {
  const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(source, /\[useWorkspaceOpen\] failed to parse workspace file:/);
  assert.match(source, /notify\("error", t\.open_workspace_error\(err\)\)/);
});