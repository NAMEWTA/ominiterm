import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

function readComponentSource(fileName: string): string {
  return readFileSync(new URL(`../src/components/ai-config/${fileName}`, import.meta.url), "utf8");
}

test("new and edit account dialogs use higher z-index than account launch dialog", () => {
  const launchSource = readComponentSource("AccountLaunchDialog.tsx");
  const newSource = readComponentSource("NewAccountDialog.tsx");
  const editSource = readComponentSource("EditAccountDialog.tsx");

  assert.match(launchSource, /className="fixed inset-0 z-50 /);
  assert.match(newSource, /className="fixed inset-0 z-60 /);
  assert.match(editSource, /className="fixed inset-0 z-60 /);
});