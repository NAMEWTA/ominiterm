import test from "node:test";
import assert from "node:assert/strict";
import { buildTaskFileContent, buildSpawnInput } from "../src/prompt.ts";

test("buildTaskFileContent includes task and worktree context", () => {
  const result = buildTaskFileContent({
    task: "Fix the login bug",
    worktreePath: "/tmp/repo/.worktrees/hydra-abc123",
    branch: "hydra/hydra-abc123",
    baseBranch: "main",
  });
  assert.ok(result.includes("Fix the login bug"));
  assert.ok(result.includes("/tmp/repo/.worktrees/hydra-abc123"));
  assert.ok(result.includes("hydra/hydra-abc123"));
  assert.ok(result.includes("main"));
});

test("buildTaskFileContent handles null branch (existing worktree)", () => {
  const result = buildTaskFileContent({
    task: "Refactor utils",
    worktreePath: "/tmp/repo/.worktrees/existing",
    branch: null,
    baseBranch: "develop",
  });
  assert.ok(result.includes("(existing worktree)"));
  assert.ok(result.includes("Refactor utils"));
  assert.ok(result.includes("develop"));
});

test("buildTaskFileContent includes safety rules and result file instruction", () => {
  const result = buildTaskFileContent({
    task: "Do something",
    worktreePath: "/tmp/wt",
    branch: "hydra/test",
    baseBranch: "main",
  });
  assert.ok(result.includes("Do not push to remote"));
  assert.ok(result.includes("Commit your changes"));
  assert.ok(result.includes(".hydra-result.md"));
});

test("buildSpawnInput is a single line", () => {
  const result = buildSpawnInput("Fix the bug in auth module");
  assert.ok(!result.includes("\n"), "Must be single line");
  assert.ok(result.includes("Fix the bug in auth module"));
  assert.ok(result.includes(".hydra-task.md"));
});

test("buildSpawnInput collapses newlines in task", () => {
  const result = buildSpawnInput("Line one\nLine two\r\nLine three");
  assert.ok(!result.includes("\n"), "Must not contain newlines");
  assert.ok(!result.includes("\r"), "Must not contain carriage returns");
  assert.ok(result.includes("Line one Line two Line three"));
});
