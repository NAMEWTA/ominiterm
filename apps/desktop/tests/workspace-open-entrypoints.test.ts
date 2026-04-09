import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

test("workspace file open/save entrypoints are removed from sidebar and shortcuts", () => {
  const sidebarSource = readFileSync(
    new URL("../src/components/ProjectSidebar.tsx", import.meta.url),
    "utf8",
  );
  const shortcutSource = readFileSync(
    new URL("../src/hooks/useKeyboardShortcuts.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(sidebarSource, /openWorkspaceFromDialog\(t\)/);
  assert.doesNotMatch(sidebarSource, /\{t\.open_workspace\}/);
  assert.doesNotMatch(shortcutSource, /shortcuts\.openWorkspace/);
  assert.doesNotMatch(shortcutSource, /shortcuts\.saveWorkspace/);
  assert.doesNotMatch(shortcutSource, /shortcuts\.saveWorkspaceAs/);
});