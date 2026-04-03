import test from "node:test";
import assert from "node:assert/strict";

import { validateDraft } from "../src/stores/launchersStore.ts";
import type { LauncherConfigItem } from "../src/types/index.ts";

function createValidLauncherDraft(): LauncherConfigItem {
  return {
    id: "shell-default",
    name: "Shell",
    enabled: true,
    hostShell: "auto",
    mainCommand: {
      command: "bash",
      args: ["-l"],
    },
    startupCommands: [],
    runPolicy: {
      runOnNewSessionOnly: true,
      onFailure: "stop",
    },
  };
}

test("validateDraft fails when name is empty", () => {
  const draft = createValidLauncherDraft();
  draft.name = "   ";

  const result = validateDraft(draft);

  assert.equal(result.ok, false);
  assert.equal(result.errors.name, "required");
});

test("validateDraft fails when main command is empty", () => {
  const draft = createValidLauncherDraft();
  draft.mainCommand.command = "   ";

  const result = validateDraft(draft);

  assert.equal(result.ok, false);
  assert.equal(result.errors.mainCommandCommand, "required");
});
