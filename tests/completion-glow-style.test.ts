import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { getCompletionGlowStyle } from "../src/components/completionGlowStyles.ts";

test("completion glow styles use theme tokens and edge hairlines", () => {
  const left = getCompletionGlowStyle("left");
  const right = getCompletionGlowStyle("right");

  assert.equal(
    left.background,
    "linear-gradient(to right, var(--completion-glow), transparent)",
  );
  assert.equal(
    right.background,
    "linear-gradient(to left, var(--completion-glow), transparent)",
  );
  assert.equal(left.borderLeft, "1px solid var(--completion-glow-edge)");
  assert.equal(right.borderRight, "1px solid var(--completion-glow-edge)");
  assert.equal(left.boxSizing, "border-box");
  assert.equal(right.boxSizing, "border-box");
});

test("completion glow theme tokens are defined for dark and light themes", () => {
  const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(css, /:root,\s*\n\[data-theme="dark"]\s*\{[\s\S]*--completion-glow:/);
  assert.match(css, /:root,\s*\n\[data-theme="dark"]\s*\{[\s\S]*--completion-glow-edge:/);
  assert.match(css, /\[data-theme="light"]\s*\{[\s\S]*--completion-glow:/);
  assert.match(css, /\[data-theme="light"]\s*\{[\s\S]*--completion-glow-edge:/);
});
