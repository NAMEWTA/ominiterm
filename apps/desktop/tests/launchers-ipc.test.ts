import test from "node:test";
import assert from "node:assert/strict";

import { registerLaunchersIpc } from "../electron/launchers-ipc.ts";
import type { LauncherConfigItem } from "../electron/launchers-config.ts";

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
