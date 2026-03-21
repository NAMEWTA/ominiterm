import test from "node:test";
import assert from "node:assert/strict";

import { buildCliInvocationArgs } from "../electron/insights-cli.ts";
import {
  aggregateFacets,
  buildSessionFingerprint,
  isSelfInsightSession,
  type SessionFacet,
  type SessionInfo,
} from "../electron/insights-shared.ts";

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

test("buildSessionFingerprint changes when source metadata changes", () => {
  const base = {
    id: "session-1",
    filePath: "/tmp/session-1.jsonl",
    cliTool: "codex" as const,
    projectPath: "/tmp/project",
    messageCount: 4,
    durationMinutes: 3,
    contentSummary: "user: hello",
    mtimeMs: 1000,
    fileSize: 200,
  };

  const first = buildSessionFingerprint(base);
  const changedMtime = buildSessionFingerprint({ ...base, mtimeMs: 2000 });
  const changedCli = buildSessionFingerprint({ ...base, cliTool: "claude" });

  assert.notEqual(first, changedMtime);
  assert.notEqual(first, changedCli);
});

test("isSelfInsightSession detects insight control prompts", () => {
  assert.equal(
    isSelfInsightSession(
      "Analyze this AI coding session and return a JSON object with exactly these fields:",
    ),
    true,
  );
  assert.equal(
    isSelfInsightSession("RESPOND WITH ONLY A VALID JSON OBJECT matching this schema:"),
    true,
  );
  assert.equal(isSelfInsightSession("user: fix the login bug"), false);
});

test("aggregateFacets reports analyzed totals and preserves pipeline counts", () => {
  const sessions: SessionInfo[] = [
    {
      id: "a",
      filePath: "/tmp/a.jsonl",
      cliTool: "codex",
      projectPath: "/tmp/project-a",
      messageCount: 10,
      durationMinutes: 12,
      contentSummary: "",
      mtimeMs: 30,
      fileSize: 300,
    },
    {
      id: "b",
      filePath: "/tmp/b.jsonl",
      cliTool: "codex",
      projectPath: "/tmp/project-b",
      messageCount: 4,
      durationMinutes: 6,
      contentSummary: "",
      mtimeMs: 20,
      fileSize: 200,
    },
    {
      id: "c",
      filePath: "/tmp/c.jsonl",
      cliTool: "codex",
      projectPath: "/tmp/project-c",
      messageCount: 8,
      durationMinutes: 9,
      contentSummary: "",
      mtimeMs: 10,
      fileSize: 100,
    },
  ];

  const facets: SessionFacet[] = [
    {
      session_id: "a",
      cli_tool: "codex",
      underlying_goal: "Fix auth",
      brief_summary: "Fixed auth issue.",
      goal_categories: { bug_fix: 1 },
      outcome: "fully_achieved",
      session_type: "single_task",
      friction_counts: {},
      user_satisfaction: "high",
      project_path: "/tmp/project-a",
    },
    {
      session_id: "b",
      cli_tool: "codex",
      underlying_goal: "Add report",
      brief_summary: "Added report export.",
      goal_categories: { feature: 1 },
      outcome: "mostly_achieved",
      session_type: "iterative",
      friction_counts: { retry: 1 },
      user_satisfaction: "medium",
      project_path: "/tmp/project-b",
    },
  ];

  const stats = aggregateFacets(facets, sessions, {
    sourceCli: "codex",
    analyzerCli: "codex",
    totalScannedSessions: 5,
    totalEligibleSessions: 3,
    cachedFacetSessions: 1,
    failedFacetSessions: 1,
    deferredFacetSessions: 0,
  });

  assert.equal(stats.totalSessions, 2);
  assert.equal(stats.totalMessages, 14);
  assert.equal(stats.totalDurationMinutes, 18);
  assert.equal(stats.totalScannedSessions, 5);
  assert.equal(stats.totalEligibleSessions, 3);
  assert.equal(stats.cachedFacetSessions, 1);
  assert.equal(stats.failedFacetSessions, 1);
  assert.equal(stats.sourceCli, "codex");
  assert.equal(stats.analyzerCli, "codex");
});
