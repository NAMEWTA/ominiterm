import test from "node:test";
import assert from "node:assert/strict";

import { CREATABLE_TERMINAL_TYPES } from "../src/components/projectBoardOptions.ts";

test("project board terminal selector includes local shell option", () => {
  assert.equal(CREATABLE_TERMINAL_TYPES.includes("shell"), true);
});
