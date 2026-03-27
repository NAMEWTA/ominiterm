import test from "node:test";
import assert from "node:assert/strict";

import { shouldIgnoreShortcutTarget } from "../src/hooks/shortcutTarget.ts";
import {
  eventToShortcut,
  formatShortcut,
  matchesShortcut,
} from "../src/stores/shortcutStore.ts";
import {
  DEFAULT_SHORTCUTS,
  LEGACY_DEFAULT_SHORTCUTS,
  createResolvedBindings,
} from "../src/shortcuts/catalog.ts";
import { getTerminalFocusOrder } from "../src/stores/projectFocus.ts";
import type { ProjectData } from "../src/types/index.ts";

const STORAGE_KEY = "ominiterm-shortcuts";

function withPlatform(
  platform: "darwin" | "win32" | "linux",
  run: () => void,
) {
  const previousWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    ominiterm: {
      app: { platform },
    },
  };

  try {
    run();
  } finally {
    if (previousWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }
  }
}

function createKeyboardEvent(
  overrides: Partial<KeyboardEvent> = {},
): KeyboardEvent {
  return {
    key: "b",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: null,
    ...overrides,
  } as KeyboardEvent;
}

function createTarget(
  tagName: string,
  isContentEditable: boolean = false,
  className: string = "",
): EventTarget {
  return {
    tagName,
    isContentEditable,
    className,
  } as unknown as EventTarget;
}

function installLocalStorage(initialValue?: string) {
  const backingStore = new Map<string, string>();
  if (initialValue !== undefined) {
    backingStore.set(STORAGE_KEY, initialValue);
  }

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        return backingStore.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        backingStore.set(key, value);
      },
      removeItem(key: string) {
        backingStore.delete(key);
      },
      clear() {
        backingStore.clear();
      },
    },
  });
}

async function loadShortcutStoreModule(tag: string) {
  return import(`../src/stores/shortcutStore.ts?${tag}`);
}

test("matchesShortcut uses command as mod on macOS", () => {
  withPlatform("darwin", () => {
    assert.equal(
      matchesShortcut(createKeyboardEvent({ metaKey: true }), "mod+b"),
      true,
    );
    assert.equal(
      matchesShortcut(createKeyboardEvent({ ctrlKey: true }), "mod+b"),
      false,
    );
  });
});

test("eventToShortcut ignores ctrl-only combos on macOS", () => {
  withPlatform("darwin", () => {
    assert.equal(eventToShortcut(createKeyboardEvent({ ctrlKey: true })), "");
    assert.equal(eventToShortcut(createKeyboardEvent({ metaKey: true })), "mod+b");
  });
});

test("matchesShortcut uses ctrl as mod on Windows", () => {
  withPlatform("win32", () => {
    assert.equal(
      matchesShortcut(createKeyboardEvent({ ctrlKey: true }), "mod+b"),
      true,
    );
    assert.equal(
      matchesShortcut(createKeyboardEvent({ metaKey: true }), "mod+b"),
      false,
    );
  });
});

test("editable targets still ignore plain typing shortcuts", () => {
  withPlatform("darwin", () => {
    assert.equal(
      shouldIgnoreShortcutTarget(
        createKeyboardEvent({ target: createTarget("TEXTAREA") }),
      ),
      true,
    );
  });
});

test("editable targets allow command shortcuts to reach the app on macOS", () => {
  withPlatform("darwin", () => {
    assert.equal(
      shouldIgnoreShortcutTarget(
        createKeyboardEvent({
          target: createTarget("TEXTAREA"),
          metaKey: true,
        }),
      ),
      false,
    );
    assert.equal(
      shouldIgnoreShortcutTarget(
        createKeyboardEvent({
          target: createTarget("TEXTAREA"),
          ctrlKey: true,
        }),
      ),
      true,
    );
  });
});

test("xterm helper textarea still ignores printable keys without modifiers", () => {
  withPlatform("darwin", () => {
    assert.equal(
      shouldIgnoreShortcutTarget(
        createKeyboardEvent({
          key: "?",
          target: createTarget("TEXTAREA", false, "xterm-helper-textarea"),
        }),
      ),
      true,
    );
  });
});

test("xterm helper textarea allows non-printable global shortcuts without modifiers", () => {
  withPlatform("darwin", () => {
    assert.equal(
      shouldIgnoreShortcutTarget(
        createKeyboardEvent({
          key: "F2",
          target: createTarget("TEXTAREA", false, "xterm-helper-textarea"),
        }),
      ),
      false,
    );
    assert.equal(
      shouldIgnoreShortcutTarget(
        createKeyboardEvent({
          key: "PageDown",
          target: createTarget("TEXTAREA", false, "xterm-helper-textarea"),
        }),
      ),
      false,
    );
  });
});

test("new default shortcuts prefer the reorganized keymap", () => {
  assert.equal(DEFAULT_SHORTCUTS.toggleSidebar, "mod+b");
  assert.equal(DEFAULT_SHORTCUTS.toggleRightPanel, "mod+shift+b");
  assert.equal(DEFAULT_SHORTCUTS.renameTerminalTitle, "f2");
  assert.equal(DEFAULT_SHORTCUTS.nextTerminal, "mod+pagedown");
  assert.equal(DEFAULT_SHORTCUTS.prevTerminal, "mod+pageup");
});

test("resolved bindings include legacy aliases until a shortcut is customized", () => {
  assert.deepEqual(createResolvedBindings({}).toggleSidebar, ["mod+b", "mod+\\"]);
  assert.deepEqual(createResolvedBindings({}).toggleRightPanel, [
    "mod+shift+b",
    "mod+/",
  ]);
  assert.deepEqual(createResolvedBindings({}).renameTerminalTitle, ["f2", "mod+;"]);
  assert.deepEqual(createResolvedBindings({}).nextTerminal, [
    "mod+pagedown",
    "mod+]",
  ]);
  assert.deepEqual(createResolvedBindings({ toggleSidebar: "alt+s" }).toggleSidebar, [
    "alt+s",
  ]);
});

test("legacy aliases continue to match while defaults are still active", () => {
  const bindings = createResolvedBindings({});

  withPlatform("darwin", () => {
    assert.equal(
      matchesShortcut(
        createKeyboardEvent({ key: "\\", metaKey: true }),
        bindings.toggleSidebar,
      ),
      true,
    );
    assert.equal(
      matchesShortcut(
        createKeyboardEvent({ key: "/", metaKey: true }),
        bindings.toggleRightPanel,
      ),
      true,
    );
    assert.equal(
      matchesShortcut(
        createKeyboardEvent({ key: ";", metaKey: true }),
        bindings.renameTerminalTitle,
      ),
      true,
    );
    assert.equal(
      matchesShortcut(
        createKeyboardEvent({ key: "]", metaKey: true }),
        bindings.nextTerminal,
      ),
      true,
    );
    assert.equal(
      matchesShortcut(
        createKeyboardEvent({ key: "[", metaKey: true }),
        bindings.prevTerminal,
      ),
      true,
    );
  });
});

test("matchesShortcut accepts array bindings for new non-printable defaults", () => {
  withPlatform("win32", () => {
    assert.equal(
      matchesShortcut(
        createKeyboardEvent({ key: "F2" }),
        createResolvedBindings({}).renameTerminalTitle,
      ),
      true,
    );
    assert.equal(
      matchesShortcut(
        createKeyboardEvent({ key: "PageDown", ctrlKey: true }),
        createResolvedBindings({}).nextTerminal,
      ),
      true,
    );
    assert.equal(
      matchesShortcut(
        createKeyboardEvent({ key: "PageUp", ctrlKey: true }),
        createResolvedBindings({}).prevTerminal,
      ),
      true,
    );
  });
});

test("formatShortcut renders named keys in a desktop-friendly way", () => {
  assert.equal(formatShortcut("f2", false), "F2");
  assert.equal(formatShortcut("pageup", false), "Page Up");
  assert.equal(formatShortcut("mod+pagedown", false), "Ctrl Page Down");
  assert.equal(formatShortcut("mod+shift+b", true), "⌘ ⇧ B");
});

test("shortcut store migrates legacy full-map defaults to empty overrides", async () => {
  installLocalStorage(JSON.stringify(LEGACY_DEFAULT_SHORTCUTS));

  const { useShortcutStore, SHORTCUT_STORAGE_VERSION } =
    await loadShortcutStoreModule("legacy-defaults");
  const state = useShortcutStore.getState();

  assert.deepEqual(state.overrides, {});
  assert.equal(state.shortcuts.toggleSidebar, DEFAULT_SHORTCUTS.toggleSidebar);
  assert.equal(
    state.bindings.renameTerminalTitle.includes(LEGACY_DEFAULT_SHORTCUTS.renameTerminalTitle),
    true,
  );
  assert.deepEqual(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"), {
    version: SHORTCUT_STORAGE_VERSION,
    overrides: {},
  });
});

test("shortcut store preserves customized legacy values as overrides during migration", async () => {
  installLocalStorage(
    JSON.stringify({
      ...LEGACY_DEFAULT_SHORTCUTS,
      toggleSidebar: "alt+s",
      nextTerminal: "alt+n",
    }),
  );

  const { useShortcutStore } = await loadShortcutStoreModule("legacy-custom");
  const state = useShortcutStore.getState();

  assert.deepEqual(state.overrides, {
    toggleSidebar: "alt+s",
    nextTerminal: "alt+n",
  });
  assert.deepEqual(state.bindings.toggleSidebar, ["alt+s"]);
  assert.deepEqual(state.bindings.nextTerminal, ["alt+n"]);
});

test("shortcut store resetAll clears overrides back to versioned defaults", async () => {
  installLocalStorage();

  const { useShortcutStore, SHORTCUT_STORAGE_VERSION } =
    await loadShortcutStoreModule("reset-all");
  useShortcutStore.getState().setShortcut("toggleSidebar", "alt+s");
  useShortcutStore.getState().resetAll();

  assert.deepEqual(useShortcutStore.getState().overrides, {});
  assert.equal(
    useShortcutStore.getState().shortcuts.toggleSidebar,
    DEFAULT_SHORTCUTS.toggleSidebar,
  );
  assert.deepEqual(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"), {
    version: SHORTCUT_STORAGE_VERSION,
    overrides: {},
  });
});

test("terminal focus order follows natural project/worktree/array order", () => {
  const projects: ProjectData[] = [
    {
      id: "project-1",
      name: "Project One",
      path: "/tmp/project-1",
      position: { x: 0, y: 0 },
      collapsed: false,
      zIndex: 1,
      worktrees: [
        {
          id: "worktree-1",
          name: "main",
          path: "/tmp/project-1",
          position: { x: 0, y: 0 },
          collapsed: false,
          terminals: [
            {
              id: "terminal-1",
              title: "Terminal 1",
              type: "shell",
              minimized: false,
              focused: false,
              ptyId: 101,
              status: "idle",
              span: { cols: 1, rows: 1 },
            },
            {
              id: "terminal-2",
              title: "Terminal 2",
              type: "codex",
              minimized: false,
              focused: false,
              ptyId: 102,
              status: "idle",
              span: { cols: 1, rows: 1 },
              parentTerminalId: "terminal-1",
            },
            {
              id: "terminal-3",
              title: "Terminal 3",
              type: "claude",
              minimized: false,
              focused: false,
              ptyId: 103,
              status: "idle",
              span: { cols: 1, rows: 1 },
            },
          ],
        },
        {
          id: "worktree-2",
          name: "feature",
          path: "/tmp/project-1-feature",
          position: { x: 0, y: 200 },
          collapsed: false,
          terminals: [
            {
              id: "terminal-4",
              title: "Terminal 4",
              type: "shell",
              minimized: false,
              focused: false,
              ptyId: 104,
              status: "idle",
              span: { cols: 1, rows: 1 },
              parentTerminalId: "terminal-2",
            },
          ],
        },
      ],
    },
  ];

  assert.deepEqual(
    getTerminalFocusOrder(projects).map((terminal) => terminal.terminalId),
    ["terminal-1", "terminal-2", "terminal-3", "terminal-4"],
  );
});

