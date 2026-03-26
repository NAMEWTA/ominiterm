import test from "node:test";
import assert from "node:assert/strict";
import { getWorkspaceBaseName } from "../src/titleHelper.ts";

test("getWorkspaceBaseName strips ominiterm extension", () => {
  assert.equal(
    getWorkspaceBaseName("/tmp/workspace.ominiterm"),
    "workspace",
  );
});

test("getWorkspaceBaseName strips legacy termcanvas extension", () => {
  assert.equal(
    getWorkspaceBaseName("/tmp/workspace.termcanvas"),
    "workspace",
  );
});
