import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

test("account launch dialog exposes create without account action", () => {
  const source = readFileSync(
    new URL("../src/components/ai-config/AccountLaunchDialog.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /onCreateWithoutAccount: \(\) => void;/);
  assert.match(source, /onClick=\{onCreateWithoutAccount\}/);
  assert.match(source, />\s*Create Without Account\s*</);
  assert.match(source, /if \(selected\) \{\s*onCreate\(\);[\s\S]*onCreateWithoutAccount\(\);\s*\}/);
  assert.match(source, /Create Terminal \(No Account\)/);
});