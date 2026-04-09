import test from "node:test";
import assert from "node:assert/strict";

import { PtyManager } from "../electron/pty-manager.ts";

test("notifyThemeChanged sends SIGWINCH to the PTY child on unix platforms", () => {
  if (process.platform === "win32") {
    const manager = new PtyManager();
    manager.notifyThemeChanged(7);
    assert.ok(true);
    return;
  }
  const manager = new PtyManager() as PtyManager & {
    instances: Map<number, { pid?: number }>;
  };
  manager.instances.set(7, { pid: 4321 });

  const originalKill = process.kill;
  const calls: Array<{ pid: number; signal: NodeJS.Signals }> = [];
  (process as typeof process & {
    kill: (pid: number, signal: NodeJS.Signals) => boolean;
  }).kill = ((pid: number, signal: NodeJS.Signals) => {
    calls.push({ pid, signal });
    return true;
  }) as typeof process.kill;

  try {
    manager.notifyThemeChanged(7);
  } finally {
    process.kill = originalKill;
  }

  assert.deepEqual(calls, [{ pid: 4321, signal: "SIGWINCH" }]);
});

test("notifyThemeChanged ignores unknown PTYs", () => {
  const manager = new PtyManager();
  manager.notifyThemeChanged(999);
  assert.ok(true);
});

test("waitForStepResult resolves cancelled when abort signal is triggered", async () => {
  const manager = new PtyManager() as PtyManager & {
    instances: Map<number, { pid?: number }>;
  };
  manager.instances.set(7, { pid: 4321 });

  const controller = new AbortController();
  const waitPromise = manager.waitForStepResult(7, "cancel-token", 5000, controller.signal);

  controller.abort();
  const result = await waitPromise;

  assert.equal(result.ok, false);
  assert.equal(result.timeout, false);
  assert.equal(result.cancelled, true);
});

test("destroy terminates via PTY instance kill and clears tracked state", async () => {
  const manager = new PtyManager() as PtyManager & {
    instances: Map<number, { pid: number; kill: () => void }>;
    outputBuffers: Map<number, string[]>;
  };

  let instanceKillCalls = 0;
  manager.instances.set(11, {
    pid: 2468,
    kill: () => {
      instanceKillCalls += 1;
    },
  });
  manager.outputBuffers.set(11, ["line"]);

  const originalKill = process.kill;
  const signals: Array<NodeJS.Signals | 0 | undefined> = [];
  (process as typeof process & {
    kill: (pid: number, signal?: NodeJS.Signals | 0) => boolean;
  }).kill = ((_: number, signal?: NodeJS.Signals | 0) => {
    signals.push(signal);
    if (signal === 0) {
      throw new Error("process exited");
    }
    return true;
  }) as typeof process.kill;

  try {
    await manager.destroy(11);
  } finally {
    process.kill = originalKill;
  }

  assert.equal(instanceKillCalls, 1);
  assert.equal(manager.instances.has(11), false);
  assert.equal(manager.outputBuffers.has(11), false);

  if (process.platform === "win32") {
    assert.deepEqual(signals, []);
  } else {
    assert.equal(signals.includes("SIGTERM"), false);
    assert.equal(signals.includes("SIGKILL"), false);
  }
});
