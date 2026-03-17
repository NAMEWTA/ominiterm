import test from "node:test";
import assert from "node:assert/strict";

import { withUpdatedTerminalType } from "../src/stores/terminalState.ts";
import type { TerminalData } from "../src/types/index.ts";

test("withUpdatedTerminalType preserves the existing span", () => {
  const terminal: TerminalData = {
    id: "terminal-1",
    title: "Terminal",
    type: "shell",
    minimized: false,
    focused: false,
    ptyId: null,
    status: "idle",
    span: { cols: 1, rows: 1 },
  };

  const updated = withUpdatedTerminalType(terminal, "codex");

  assert.equal(updated.type, "codex");
  assert.deepEqual(updated.span, { cols: 1, rows: 1 });
});
