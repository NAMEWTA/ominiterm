import test from "node:test";
import assert from "node:assert/strict";
import { updateWindowTitle } from "../src/titleHelper.ts";
import { useWorkspaceStore } from "../src/stores/workspaceStore.ts";

function withTitleCapture(run: (titles: string[]) => void) {
  const titles: string[] = [];
  const previousWindow = (globalThis as { window?: unknown }).window;

  (globalThis as { window?: unknown }).window = {
    ominiterm: {
      app: {
        setTitle: async (title: string) => {
          titles.push(title);
        },
      },
    },
  };

  try {
    run(titles);
  } finally {
    if (previousWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }
  }
}

test("updateWindowTitle uses fixed title when workspace is clean", async () => {
  useWorkspaceStore.setState({
    dirty: false,
    lastSavedAt: null,
    lastDirtyAt: null,
  });

  await new Promise<void>((resolve) => {
    withTitleCapture((titles) => {
      updateWindowTitle();
      assert.deepEqual(titles, ["OminiTerm"]);
      resolve();
    });
  });
});

test("updateWindowTitle prefixes dirty marker when unsaved changes exist", async () => {
  useWorkspaceStore.setState({
    dirty: true,
    lastSavedAt: null,
    lastDirtyAt: Date.now(),
  });

  await new Promise<void>((resolve) => {
    withTitleCapture((titles) => {
      updateWindowTitle();
      assert.deepEqual(titles, ["* OminiTerm"]);
      resolve();
    });
  });
});
