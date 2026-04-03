import test from "node:test";
import assert from "node:assert/strict";

import { useLaunchersStore, validateDraft } from "../src/stores/launchersStore.ts";
import { useNotificationStore } from "../src/stores/notificationStore.ts";
import type {
  LauncherConfigItem,
  LauncherStartupEvent,
} from "../src/types/index.ts";

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
    lastStartupEvent: null,
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

test("consumeStartupEvent stores failed event and triggers warning notification", () => {
  resetLaunchersStore();

  const originalNotify = useNotificationStore.getState().notify;
  const originalDismiss = useNotificationStore.getState().dismiss;
  let notifiedType: string | null = null;
  let notifiedMessage = "";

  useNotificationStore.setState({
    notifications: [],
    notify: (type, message) => {
      notifiedType = type;
      notifiedMessage = message;
    },
    dismiss: originalDismiss,
  });

  try {
    const event: LauncherStartupEvent = {
      type: "step-failed",
      terminalId: "terminal-1",
      launcherId: "custom-launcher",
      stepIndex: 0,
      totalSteps: 2,
      stepLabel: "Install deps",
      command: "pnpm install",
      exitCode: 1,
      stderrPreview: "ENOENT",
      timestamp: Date.now(),
    };

    useLaunchersStore.getState().consumeStartupEvent(event);

    assert.equal(useLaunchersStore.getState().lastStartupEvent?.type, "step-failed");
    assert.equal(notifiedType, "warn");
    assert.match(notifiedMessage, /Install deps/);
  } finally {
    useNotificationStore.setState({
      notifications: [],
      notify: originalNotify,
      dismiss: originalDismiss,
    });
  }
});
