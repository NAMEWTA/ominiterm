import test from "node:test";
import assert from "node:assert/strict";
import { parseJsonOrDie, buildTermcanvasArgs } from "../src/termcanvas.ts";

test("parseJsonOrDie parses valid JSON", () => {
  const result = parseJsonOrDie('{"id":"abc","status":"running"}');
  assert.deepStrictEqual(result, { id: "abc", status: "running" });
});

test("parseJsonOrDie throws on invalid JSON", () => {
  assert.throws(() => parseJsonOrDie("not json"), /Failed to parse/);
});

test("buildTermcanvasArgs builds correct args", () => {
  const args = buildTermcanvasArgs("terminal", "status", ["tc-001"]);
  assert.deepStrictEqual(args, ["terminal", "status", "tc-001", "--json"]);
});
