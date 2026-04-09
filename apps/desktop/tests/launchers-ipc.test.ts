import test from "node:test";
import assert from "node:assert/strict";

import { registerLaunchersIpc } from "../electron/launchers-ipc.ts";
import type { LauncherConfigItem } from "../electron/launchers-config.ts";

function createLauncher(id: string): LauncherConfigItem {
  return {
    id,
    name: `Launcher ${id}`,
    enabled: true,
    hostShell: "pwsh",
    startupCommands: [
      {
        label: "Entry",
        command: `echo ${id}`,
        timeoutMs: 120000,
      },
    ],
    runPolicy: {
      runOnNewSessionOnly: true,
      onFailure: "stop",
    },
  };
}

test("registerLaunchersIpc registers all launchers channels", () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();

  const ipcMainMock = {
    handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
      handlers.set(channel, listener);
    },
  };

  registerLaunchersIpc(ipcMainMock, {
    get: async (_id: string) => null,
    list: async () => [] as LauncherConfigItem[],
    save: async (_launcher: LauncherConfigItem) => [] as LauncherConfigItem[],
    remove: async (_id: string) => [] as LauncherConfigItem[],
    reorder: async (_ids: string[]) => [] as LauncherConfigItem[],
  });

  assert.equal(handlers.has("launchers:get"), true);
  assert.equal(handlers.has("launchers:list"), true);
  assert.equal(handlers.has("launchers:save"), true);
  assert.equal(handlers.has("launchers:delete"), true);
  assert.equal(handlers.has("launchers:reorder"), true);
  assert.equal(handlers.size, 5);
});

test("launchers:get handler forwards string id and returns service result", async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  let receivedId: string | null = null;
  const expected = createLauncher("alpha");

  const ipcMainMock = {
    handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
      handlers.set(channel, listener);
    },
  };

  registerLaunchersIpc(ipcMainMock, {
    get: async (id: string) => {
      receivedId = id;
      return expected;
    },
    list: async () => [] as LauncherConfigItem[],
    save: async (_launcher: LauncherConfigItem) => [] as LauncherConfigItem[],
    remove: async (_id: string) => [] as LauncherConfigItem[],
    reorder: async (_ids: string[]) => [] as LauncherConfigItem[],
  });

  const handler = handlers.get("launchers:get");
  assert.ok(handler);

  const result = await handler({}, 42);
  assert.equal(receivedId, "42");
  assert.equal(result, expected);
});

test("launchers:list handler forwards no args and returns service result", async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  let receivedArgs: unknown[] | null = null;
  const expected = [createLauncher("alpha"), createLauncher("beta")];

  const ipcMainMock = {
    handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
      handlers.set(channel, listener);
    },
  };

  registerLaunchersIpc(ipcMainMock, {
    get: async (_id: string) => null,
    list: async (...args: unknown[]) => {
      receivedArgs = args;
      return expected;
    },
    save: async (_launcher: LauncherConfigItem) => [] as LauncherConfigItem[],
    remove: async (_id: string) => [] as LauncherConfigItem[],
    reorder: async (_ids: string[]) => [] as LauncherConfigItem[],
  });

  const handler = handlers.get("launchers:list");
  assert.ok(handler);

  const result = await handler({}, "ignored");
  assert.deepEqual(receivedArgs, []);
  assert.equal(result, expected);
});

test("launchers:save handler forwards payload and returns service result", async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  let receivedLauncher: LauncherConfigItem | null = null;
  const expected = [createLauncher("saved")];

  const ipcMainMock = {
    handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
      handlers.set(channel, listener);
    },
  };

  registerLaunchersIpc(ipcMainMock, {
    get: async (_id: string) => null,
    list: async () => [] as LauncherConfigItem[],
    save: async (launcher: LauncherConfigItem) => {
      receivedLauncher = launcher;
      return expected;
    },
    remove: async (_id: string) => [] as LauncherConfigItem[],
    reorder: async (_ids: string[]) => [] as LauncherConfigItem[],
  });

  const handler = handlers.get("launchers:save");
  assert.ok(handler);

  const payload = createLauncher("payload");
  const result = await handler({}, payload);
  assert.equal(receivedLauncher, payload);
  assert.equal(result, expected);
});

test("launchers:reorder handler forwards ids and returns service result", async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  let receivedIds: string[] | null = null;
  const expected = [createLauncher("b"), createLauncher("a")];

  const ipcMainMock = {
    handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
      handlers.set(channel, listener);
    },
  };

  registerLaunchersIpc(ipcMainMock, {
    get: async (_id: string) => null,
    list: async () => [] as LauncherConfigItem[],
    save: async (_launcher: LauncherConfigItem) => [] as LauncherConfigItem[],
    remove: async (_id: string) => [] as LauncherConfigItem[],
    reorder: async (ids: string[]) => {
      receivedIds = ids;
      return expected;
    },
  });

  const handler = handlers.get("launchers:reorder");
  assert.ok(handler);

  const payload = ["b", "a"];
  const result = await handler({}, payload);
  assert.equal(receivedIds, payload);
  assert.equal(result, expected);
});

test("launchers:delete handler forwards string id and returns service result", async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  let receivedId: string | null = null;
  const expected = [createLauncher("remaining")];

  const ipcMainMock = {
    handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
      handlers.set(channel, listener);
    },
  };

  registerLaunchersIpc(ipcMainMock, {
    get: async (_id: string) => null,
    list: async () => [] as LauncherConfigItem[],
    save: async (_launcher: LauncherConfigItem) => [] as LauncherConfigItem[],
    remove: async (id: string) => {
      receivedId = id;
      return expected;
    },
    reorder: async (_ids: string[]) => [] as LauncherConfigItem[],
  });

  const handler = handlers.get("launchers:delete");
  assert.ok(handler);

  const result = await handler({}, 123);
  assert.equal(receivedId, "123");
  assert.equal(result, expected);
});
