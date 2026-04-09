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
    startupCommands: [
      {
        label: "Entry",
        command: "bash -l",
        timeoutMs: 120000,
      },
    ],
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

test("validateDraft succeeds when startup commands exist", () => {
  const draft = createValidLauncherDraft();
  draft.startupCommands = [
    {
      label: "Step 1",
      command: "claude",
      timeoutMs: 120000,
    },
  ];

  const result = validateDraft(draft);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, {});
});

test("validateDraft fails when startup commands are empty", () => {
  const draft = createValidLauncherDraft();
  draft.startupCommands = [];

  const result = validateDraft(draft);

  assert.equal(result.ok, false);
  assert.equal(result.errors.entryCommand, "required");
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

test("saveDraft blocks creating a new launcher when id already exists", async () => {
  resetLaunchersStore();

  const alpha = createValidLauncherDraft();
  alpha.id = "alpha";
  alpha.name = "Alpha";

  const saveCalls: LauncherConfigItem[] = [];

  await withLaunchersApi(
    {
      save: async (launcher) => {
        saveCalls.push(launcher);
        return [launcher];
      },
    },
    async () => {
      useLaunchersStore.setState({
        launchers: [alpha],
        selectedLauncherId: null,
        draft: {
          ...alpha,
          id: " alpha ",
        },
        error: null,
        validationErrors: {},
      });

      const ok = await useLaunchersStore.getState().saveDraft();

      assert.equal(ok, false);
      assert.match(useLaunchersStore.getState().error ?? "", /already exists/i);
      assert.equal(useLaunchersStore.getState().saving, false);
      assert.deepEqual(saveCalls, []);
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

test("store exposes createDraftForNewLauncher for empty launcher list", () => {
  resetLaunchersStore();

  const store = useLaunchersStore.getState() as unknown as {
    createDraftForNewLauncher?: () => void;
  };

  assert.equal(typeof store.createDraftForNewLauncher, "function");
  store.createDraftForNewLauncher?.();

  const draft = useLaunchersStore.getState().draft;
  assert.notEqual(draft, null);
  assert.equal(draft?.id, "launcher-1");
  assert.equal(draft?.name, "Launcher 1");
  assert.equal(useLaunchersStore.getState().selectedLauncherId, null);
});

test("store exposes startup command editing actions", () => {
  resetLaunchersStore();

  const state = useLaunchersStore.getState();

  assert.equal(typeof (state as any).addDraftStartupCommand, "function");
  assert.equal(typeof (state as any).updateDraftStartupCommandLabel, "function");
  assert.equal(typeof (state as any).updateDraftStartupCommandCommand, "function");
  assert.equal(typeof (state as any).updateDraftStartupCommandTimeoutMs, "function");
  assert.equal(typeof (state as any).moveDraftStartupCommand, "function");
  assert.equal(typeof (state as any).removeDraftStartupCommand, "function");
});

test("startup command actions support add/update/move/remove", () => {
  resetLaunchersStore();

  useLaunchersStore.setState({
    draft: {
      ...createValidLauncherDraft(),
      startupCommands: [],
    },
  });

  const store = useLaunchersStore.getState() as any;

  store.addDraftStartupCommand();
  store.addDraftStartupCommand();

  let draft = useLaunchersStore.getState().draft;
  assert.equal(draft?.startupCommands.length, 2);

  store.updateDraftStartupCommandLabel(0, "Prepare");
  store.updateDraftStartupCommandCommand(0, "echo prepare");
  store.updateDraftStartupCommandTimeoutMs(0, 5000);

  store.updateDraftStartupCommandLabel(1, "Launch");
  store.updateDraftStartupCommandCommand(1, "echo launch");
  store.updateDraftStartupCommandTimeoutMs(1, 9000);

  store.moveDraftStartupCommand(1, -1);
  draft = useLaunchersStore.getState().draft;
  assert.equal(draft?.startupCommands[0].label, "Launch");
  assert.equal(draft?.startupCommands[1].label, "Prepare");

  store.removeDraftStartupCommand(1);
  draft = useLaunchersStore.getState().draft;
  assert.equal(draft?.startupCommands.length, 1);
  assert.equal(draft?.startupCommands[0].command, "echo launch");
  assert.equal(draft?.startupCommands[0].timeoutMs, 9000);
});
