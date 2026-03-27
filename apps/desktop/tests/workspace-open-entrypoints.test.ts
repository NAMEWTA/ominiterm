import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

test("workspace open is exposed via sidebar button and keyboard shortcut", () => {
  const sidebarSource = readFileSync(
    new URL("../src/components/ProjectSidebar.tsx", import.meta.url),
    "utf8",
  );
  const shortcutSource = readFileSync(
    new URL("../src/hooks/useKeyboardShortcuts.ts", import.meta.url),
    "utf8",
  );

  assert.match(sidebarSource, /openWorkspaceFromDialog\(t\)/);
  assert.match(sidebarSource, /\{t\.open_workspace\}/);
  assert.match(shortcutSource, /matchesShortcut\(event, shortcuts\.openWorkspace\)/);
  assert.match(shortcutSource, /void openWorkspaceFromDialog\(t\);/);
});