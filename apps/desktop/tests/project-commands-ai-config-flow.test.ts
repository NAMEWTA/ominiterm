import test from "node:test";
import assert from "node:assert/strict";

import { createTerminalInWorktree, openWorkspaceFromDialog } from "../src/projectCommands.ts";
import { useProjectStore } from "../src/stores/projectStore.ts";
import { useNotificationStore } from "../src/stores/notificationStore.ts";

function ensureWindowDispatchEvent(): void {
  const target = globalThis as typeof globalThis & {
    window?: {
      dispatchEvent?: (event: Event) => boolean;
    };
  };

  if (!target.window) {
    target.window = {};
  }

  if (typeof target.window.dispatchEvent !== "function") {
    target.window.dispatchEvent = () => true;
  }
}

function resetProjectStore(): void {
  useProjectStore.setState({
    projects: [],
    focusedProjectId: null,
    focusedWorktreeId: null,
  });
}

test("createTerminalInWorktree persists selected configId from account selection", () => {
  ensureWindowDispatchEvent();
  resetProjectStore();

  useProjectStore.getState().setProjects([
    {
      id: "project-1",
      name: "Project",
      path: "/repo",
      worktrees: [
        {
          id: "worktree-1",
          name: "main",
          path: "/repo",
          terminals: [],
        },
      ],
    },
  ]);

  const terminal = createTerminalInWorktree(
    "project-1",
    "worktree-1",
    "claude",
    undefined,
    undefined,
    undefined,
    "claude-account-b",
  );

  const state = useProjectStore.getState();
  const created = state.projects[0]?.worktrees[0]?.terminals[0];

  assert.ok(created);
  assert.equal(created.id, terminal.id);
  assert.equal(created.type, "claude");
  assert.equal(created.configId, "claude-account-b");
  assert.equal(created.focused, true);
});

test("createTerminalInWorktree allows launching AI terminal without account configId", () => {
  ensureWindowDispatchEvent();
  resetProjectStore();

  useProjectStore.getState().setProjects([
    {
      id: "project-1",
      name: "Project",
      path: "/repo",
      worktrees: [
        {
          id: "worktree-1",
          name: "main",
          path: "/repo",
          terminals: [],
        },
      ],
    },
  ]);

  const terminal = createTerminalInWorktree(
    "project-1",
    "worktree-1",
    "codex",
  );

  const state = useProjectStore.getState();
  const created = state.projects[0]?.worktrees[0]?.terminals[0];

  assert.ok(created);
  assert.equal(created.id, terminal.id);
  assert.equal(created.type, "codex");
  assert.equal(created.configId, undefined);
  assert.equal(created.focused, true);
});

test("openWorkspaceFromDialog dispatches workspace-open event when a file is selected", async () => {
  const events: Array<{ type: string; detail?: string }> = [];
  const target = globalThis as typeof globalThis & {
    window?: {
      ominiterm?: {
        workspace?: {
          open?: () => Promise<string | null>;
        };
      };
      dispatchEvent?: (event: Event) => boolean;
    };
  };

  target.window = {
    ominiterm: {
      workspace: {
        open: async () => '{"version":2,"projects":[]}',
      },
    },
    dispatchEvent: (event: Event) => {
      const custom = event as CustomEvent<string>;
      events.push({ type: custom.type, detail: custom.detail });
      return true;
    },
  };

  await openWorkspaceFromDialog({
    open_workspace_error: (err: unknown) => `Open workspace failed: ${String(err)}`,
  } as ReturnType<typeof import("../src/i18n/useT.ts").useT>);

  assert.deepEqual(events, [
    { type: "ominiterm:open-workspace", detail: '{"version":2,"projects":[]}' },
  ]);
});

test("openWorkspaceFromDialog is a no-op when dialog is cancelled", async () => {
  const events: Event[] = [];
  const target = globalThis as typeof globalThis & {
    window?: {
      ominiterm?: {
        workspace?: {
          open?: () => Promise<string | null>;
        };
      };
      dispatchEvent?: (event: Event) => boolean;
    };
  };

  target.window = {
    ominiterm: {
      workspace: {
        open: async () => null,
      },
    },
    dispatchEvent: (event: Event) => {
      events.push(event);
      return true;
    },
  };

  await openWorkspaceFromDialog({
    open_workspace_error: (err: unknown) => `Open workspace failed: ${String(err)}`,
  } as ReturnType<typeof import("../src/i18n/useT.ts").useT>);

  assert.equal(events.length, 0);
});

test("openWorkspaceFromDialog reports errors via notification store", async () => {
  const notifications: Array<{ type: string; message: string }> = [];
  const notify = (type: "error" | "warn" | "info", message: string) => {
    notifications.push({ type, message });
  };
  useNotificationStore.setState((state) => ({ ...state, notify }));

  const target = globalThis as typeof globalThis & {
    window?: {
      ominiterm?: {
        workspace?: {
          open?: () => Promise<string | null>;
        };
      };
      dispatchEvent?: (event: Event) => boolean;
    };
  };

  target.window = {
    ominiterm: {
      workspace: {
        open: async () => {
          throw new Error("picker unavailable");
        },
      },
    },
    dispatchEvent: () => true,
  };

  await openWorkspaceFromDialog({
    open_workspace_error: (err: unknown) => `Open workspace failed: ${String(err)}`,
  } as ReturnType<typeof import("../src/i18n/useT.ts").useT>);

  assert.deepEqual(notifications, [
    {
      type: "error",
      message: "Open workspace failed: Error: picker unavailable",
    },
  ]);
});
