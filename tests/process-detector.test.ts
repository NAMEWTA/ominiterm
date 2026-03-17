import test from "node:test";
import assert from "node:assert/strict";

import { parsePsOutput } from "../electron/process-detector.ts";

const HEADER = "  PID  PPID ARGS\n";

test("detects direct child claude process", () => {
  const ps = HEADER +
    "  100     1 /bin/zsh\n" +
    "  200   100 claude\n";

  const results = parsePsOutput(ps, [100]);
  assert.equal(results.length, 1);
  assert.equal(results[0].cliType, "claude");
  assert.equal(results[0].pid, 200);
});

test("detects node /path/to/claude as claude", () => {
  const ps = HEADER +
    "  100     1 /bin/zsh\n" +
    "  200   100 node /usr/local/bin/claude --help\n";

  const results = parsePsOutput(ps, [100]);
  assert.equal(results.length, 1);
  assert.equal(results[0].cliType, "claude");
});

test("detects bun /path/to/codex as codex", () => {
  const ps = HEADER +
    "  100     1 /bin/zsh\n" +
    "  200   100 bun /home/user/.bun/bin/codex\n";

  const results = parsePsOutput(ps, [100]);
  assert.equal(results.length, 1);
  assert.equal(results[0].cliType, "codex");
});

test("detects npx codex as codex", () => {
  const ps = HEADER +
    "  100     1 /bin/zsh\n" +
    "  200   100 npx codex --flag\n";

  const results = parsePsOutput(ps, [100]);
  assert.equal(results.length, 1);
  assert.equal(results[0].cliType, "codex");
});

test("detects bunx gemini as gemini", () => {
  const ps = HEADER +
    "  100     1 /bin/zsh\n" +
    "  200   100 bunx gemini\n";

  const results = parsePsOutput(ps, [100]);
  assert.equal(results.length, 1);
  assert.equal(results[0].cliType, "gemini");
});

test("non-CLI child (vim) returns empty result", () => {
  const ps = HEADER +
    "  100     1 /bin/zsh\n" +
    "  200   100 vim somefile.txt\n";

  const results = parsePsOutput(ps, [100]);
  assert.equal(results.length, 0);
});

test("non-direct child is ignored", () => {
  const ps = HEADER +
    "  100     1 /bin/zsh\n" +
    "  200   100 bash\n" +
    "  300   200 claude\n";

  // Shell PID is 100 — claude (PID 300) is a grandchild via bash (PID 200)
  const results = parsePsOutput(ps, [100]);
  assert.equal(results.length, 0);
});

test("multiple shell PIDs with different children", () => {
  const ps = HEADER +
    "  100     1 /bin/zsh\n" +
    "  101     1 /bin/bash\n" +
    "  200   100 claude\n" +
    "  300   101 codex\n";

  const results = parsePsOutput(ps, [100, 101]);
  assert.equal(results.length, 2);
  assert.equal(results[0].cliType, "claude");
  assert.equal(results[1].cliType, "codex");
});

test("detects tmux as direct child", () => {
  const ps = HEADER +
    "  100     1 /bin/zsh\n" +
    "  200   100 tmux new -s main\n";

  const results = parsePsOutput(ps, [100]);
  assert.equal(results.length, 1);
  assert.equal(results[0].cliType, "tmux");
});

test("detects lazygit", () => {
  const ps = HEADER +
    "  100     1 /bin/zsh\n" +
    "  200   100 lazygit\n";

  const results = parsePsOutput(ps, [100]);
  assert.equal(results.length, 1);
  assert.equal(results[0].cliType, "lazygit");
});

test("detects opencode", () => {
  const ps = HEADER +
    "  100     1 /bin/zsh\n" +
    "  200   100 opencode\n";

  const results = parsePsOutput(ps, [100]);
  assert.equal(results.length, 1);
  assert.equal(results[0].cliType, "opencode");
});

test("returns empty for no matching children", () => {
  const ps = HEADER +
    "  100     1 /bin/zsh\n" +
    "  200   999 claude\n";

  const results = parsePsOutput(ps, [100]);
  assert.equal(results.length, 0);
});

test("handles empty ps output", () => {
  const results = parsePsOutput("", [100]);
  assert.equal(results.length, 0);
});

test("node without CLI arg is not detected", () => {
  const ps = HEADER +
    "  100     1 /bin/zsh\n" +
    "  200   100 node server.js\n";

  const results = parsePsOutput(ps, [100]);
  assert.equal(results.length, 0);
});
