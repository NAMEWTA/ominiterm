import test from "node:test";
import assert from "node:assert/strict";
import type { LauncherConfigItem } from "../src/types/index.ts";

import {
  registerWindowKeydownListener,
  registerWindowKeyupListener,
} from "../src/shortcuts/listeners.ts";
import {
  getShortcutDefaultLauncherOption,
  resolveShortcutLauncherOption,
} from "../src/hooks/defaultLauncherOption.ts";

type KeyListener = (event: FakeKeyboardEvent) => void;

class FakeKeyboardEvent {
  cancelBubble = false;

  stopPropagation() {
    this.cancelBubble = true;
  }
}

class FakeWindowTarget {
  private readonly listeners = new Map<string, { capture: boolean; listener: KeyListener }[]>();

  addEventListener(
    type: string,
    listener: KeyListener,
    options?: boolean | AddEventListenerOptions,
  ) {
    const capture =
      options === true ||
      (typeof options === "object" && options?.capture === true);
    const current = this.listeners.get(type) ?? [];
    current.push({ capture, listener });
    this.listeners.set(type, current);
  }

  removeEventListener(
    type: string,
    listener: KeyListener,
    options?: boolean | EventListenerOptions,
  ) {
    const capture =
      options === true ||
      (typeof options === "object" && options?.capture === true);
    const current = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      current.filter(
        (entry) => entry.capture !== capture || entry.listener !== listener,
      ),
    );
  }

  dispatch(type: string, event: FakeKeyboardEvent) {
    const current = this.listeners.get(type) ?? [];
    for (const entry of current.filter((item) => item.capture)) {
      entry.listener(event);
    }
    if (event.cancelBubble) {
      return;
    }
    for (const entry of current.filter((item) => !item.capture)) {
      entry.listener(event);
      if (event.cancelBubble) {
        return;
      }
    }
  }
}

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

test("keydown shortcut listeners run before terminal bubble handlers stop propagation", () => {
  const fakeWindow = new FakeWindowTarget();
  const calls: string[] = [];
  const dispose = registerWindowKeydownListener(
    fakeWindow as unknown as Window,
    () => {
      calls.push("app");
    },
  );

  fakeWindow.addEventListener("keydown", (event) => {
    calls.push("terminal");
    event.stopPropagation();
  });

  fakeWindow.dispatch("keydown", new FakeKeyboardEvent());
  dispose();

  assert.deepEqual(calls, ["app", "terminal"]);
});

test("keyup shortcut listeners also register in capture phase", () => {
  const fakeWindow = new FakeWindowTarget();
  const calls: string[] = [];
  const dispose = registerWindowKeyupListener(
    fakeWindow as unknown as Window,
    () => {
      calls.push("app");
    },
  );

  fakeWindow.addEventListener("keyup", (event) => {
    calls.push("terminal");
    event.stopPropagation();
  });

  fakeWindow.dispatch("keyup", new FakeKeyboardEvent());
  dispose();

  assert.deepEqual(calls, ["app", "terminal"]);
});

test("shortcut default launcher option picks the first enabled launcher", () => {
  const option = getShortcutDefaultLauncherOption([
    makeLauncher("disabled", { enabled: false }),
    makeLauncher("custom-launcher", {
      name: "Custom Launcher",
      hostShell: "pwsh",
      mainCommand: {
        command: "custom-cli",
        args: ["--fast"],
      },
      startupCommands: [
        {
          label: "Prepare",
          command: "echo prepare",
          timeoutMs: 5000,
        },
      ],
    }),
    makeLauncher("claude"),
  ]);

  assert.equal(option?.launcherId, "custom-launcher");
  assert.equal(option?.terminalType, "shell");
  assert.equal(option?.launcherMeta.launcherId, "custom-launcher");
  assert.equal(option?.launcherMeta.launcherName, "Custom Launcher");
  assert.equal(option?.launcherMeta.launcherConfigSnapshot.hostShell, "pwsh");
  assert.equal(
    option?.launcherMeta.launcherConfigSnapshot.mainCommand.command,
    "custom-cli",
  );
  assert.deepEqual(
    option?.launcherMeta.launcherConfigSnapshot.mainCommand.args,
    ["--fast"],
  );
});

test("shortcut default launcher option returns null when no launcher is enabled", () => {
  const option = getShortcutDefaultLauncherOption([
    makeLauncher("disabled-1", { enabled: false }),
    makeLauncher("disabled-2", { enabled: false }),
  ]);

  assert.equal(option, null);
});

test("shortcut launcher resolution is pending while launchers are loading", () => {
  const option = resolveShortcutLauncherOption([], true);

  assert.equal(option, undefined);
});

test("shortcut launcher resolution falls back to shell only after launchers finish loading", () => {
  const option = resolveShortcutLauncherOption(
    [makeLauncher("disabled-1", { enabled: false })],
    false,
  );

  assert.equal(option, null);
});

test("shortcut launcher resolution returns launcher option once loaded", () => {
  const option = resolveShortcutLauncherOption(
    [
      makeLauncher("disabled", { enabled: false }),
      makeLauncher("custom-launcher", { name: "Custom Launcher" }),
    ],
    false,
  );

  assert.equal(option?.launcherId, "custom-launcher");
});
