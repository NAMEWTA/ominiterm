import test from "node:test";
import assert from "node:assert/strict";

import type { LauncherConfigItem } from "../src/types/index.ts";
import { getProjectBoardLauncherOptions } from "../src/components/projectBoardOptions.ts";

function makeLauncher(
  id: string,
  overrides: Partial<LauncherConfigItem> = {},
): LauncherConfigItem {
  return {
    id,
    name: overrides.name ?? id,
    enabled: overrides.enabled ?? true,
    hostShell: overrides.hostShell ?? "auto",
    mainCommand: overrides.mainCommand ?? {
      command: id,
      args: [],
    },
    startupCommands: overrides.startupCommands ?? [],
    runPolicy: overrides.runPolicy ?? {
      runOnNewSessionOnly: true,
      onFailure: "stop",
    },
  };
}

test("project board options include enabled launchers in order", () => {
  const options = getProjectBoardLauncherOptions([
    makeLauncher("claude"),
    makeLauncher("disabled", { enabled: false }),
    makeLauncher("custom-launcher", { name: "Custom Launcher" }),
  ]);

  assert.deepEqual(
    options.map((option) => option.launcherId),
    ["claude", "custom-launcher"],
  );
  assert.equal(options[0].terminalType, "claude");
  assert.equal(options[1].terminalType, "shell");
});
