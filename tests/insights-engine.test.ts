import test from "node:test";
import assert from "node:assert/strict";

import { buildCliInvocationArgs } from "../electron/insights-cli.ts";

test("buildCliInvocationArgs keeps Claude insights invocations unchanged", () => {
  assert.deepEqual(
    buildCliInvocationArgs([], "claude", "Reply with exactly: OK"),
    ["-p", "Reply with exactly: OK"],
  );
});

test("buildCliInvocationArgs skips the git repo check for Codex insights runs", () => {
  assert.deepEqual(
    buildCliInvocationArgs([], "codex", "Reply with exactly: OK"),
    ["exec", "--skip-git-repo-check", "Reply with exactly: OK"],
  );
});

test("buildCliInvocationArgs preserves launcher wrapper args", () => {
  assert.deepEqual(
    buildCliInvocationArgs(
      ["/d", "/s", "/c", "codex.cmd"],
      "codex",
      "Reply with exactly: OK",
    ),
    [
      "/d",
      "/s",
      "/c",
      "codex.cmd",
      "exec",
      "--skip-git-repo-check",
      "Reply with exactly: OK",
    ],
  );
});
