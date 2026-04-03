import test from "node:test";
import assert from "node:assert/strict";

import { buildStartupStatusMessage } from "../src/terminal/startupStatus.ts";

test("buildStartupStatusMessage step-failed includes step label and stderr preview", () => {
  const message = buildStartupStatusMessage({
    type: "step-failed",
    terminalId: "terminal-1",
    launcherId: "custom-launcher",
    stepIndex: 1,
    totalSteps: 3,
    stepLabel: "Install deps",
    command: "pnpm install",
    exitCode: 1,
    stderrPreview: "ENOENT: pnpm not found",
    timestamp: Date.now(),
  });

  assert.match(message, /Install deps/);
  assert.match(message, /ENOENT: pnpm not found/);
});
