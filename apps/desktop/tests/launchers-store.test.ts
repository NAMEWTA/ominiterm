import test from "node:test";
import assert from "node:assert/strict";

import { useLaunchersStore, validateDraft } from "../src/stores/launchersStore.ts";
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

function resetLaunchersStore() {
  useLaunchersStore.setState({
    launchers: [],
    selectedLauncherId: null,
    draft: null,
    mainCommandArgsText: "",
    loading: false,
    saving: false,
    error: null,
    validationErrors: {},
  });
}

function withLaunchersApi(
  launchersApi: Partial<Window["ominiterm"]["launchers"]>,
  run: () => Promise<void>,
) {
  const previousWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    ominiterm: {
      launchers: {
        get: async () => null,
        list: async () => [],
        save: async () => [],
        delete: async () => [],
        reorder: async () => [],
        onStartupEvent: () => () => {},
        ...launchersApi,
      },
    },
  };

  return run().finally(() => {
    if (previousWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
      return;
    }

    (globalThis as { window?: unknown }).window = previousWindow;
  });
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

test("saveDraft blocks renaming when target launcher id already exists", async () => {
  resetLaunchersStore();

  const alpha = createValidLauncherDraft();
  alpha.id = "alpha";
  alpha.name = "Alpha";

  const beta = createValidLauncherDraft();
  beta.id = "beta";
  beta.name = "Beta";

  const saveCalls: LauncherConfigItem[] = [];
  const deleteCalls: string[] = [];

  await withLaunchersApi(
    {
      save: async (launcher) => {
        saveCalls.push(launcher);
        return [launcher];
      },
      delete: async (id) => {
        deleteCalls.push(id);
        return [];
      },
    },
    async () => {
      useLaunchersStore.setState({
        launchers: [alpha, beta],
        selectedLauncherId: alpha.id,
        draft: {
          ...alpha,
          id: " beta ",
        },
        mainCommandArgsText: "-l",
        error: null,
        validationErrors: {},
      });

      const ok = await useLaunchersStore.getState().saveDraft();

      assert.equal(ok, false);
      assert.match(useLaunchersStore.getState().error ?? "", /already exists/i);
      assert.equal(useLaunchersStore.getState().saving, false);
      assert.deepEqual(saveCalls, []);
      assert.deepEqual(deleteCalls, []);
    },
  );
});
