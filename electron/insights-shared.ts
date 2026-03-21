import crypto from "node:crypto";
import path from "node:path";

export type InsightsCliTool = "claude" | "codex";

export interface SessionInfo {
  id: string;
  filePath: string;
  cliTool: InsightsCliTool;
  projectPath: string;
  messageCount: number;
  durationMinutes: number;
  contentSummary: string;
  mtimeMs: number;
  fileSize: number;
}

export interface SessionFacet {
  session_id: string;
  cli_tool: InsightsCliTool;
  underlying_goal: string;
  brief_summary: string;
  goal_categories: Record<string, number>;
  outcome:
    | "fully_achieved"
    | "mostly_achieved"
    | "partially_achieved"
    | "not_achieved"
    | "unclear";
  session_type:
    | "single_task"
    | "multi_task"
    | "iterative"
    | "exploratory"
    | "quick_question";
  friction_counts: Record<string, number>;
  user_satisfaction: "high" | "medium" | "low" | "unclear";
  project_path: string;
}

export interface InsightsProgress {
  jobId: string;
  stage:
    | "validating"
    | "scanning"
    | "extracting_facets"
    | "aggregating"
    | "analyzing"
    | "generating_report";
  current: number;
  total: number;
  message: string;
}

export interface InsightsError {
  code:
    | "cli_not_found"
    | "auth_failed"
    | "cli_error"
    | "parse_error"
    | "job_in_progress"
    | "unknown";
  message: string;
  detail?: string;
}

export interface InsightsPipelineCounts {
  sourceCli: InsightsCliTool;
  analyzerCli: InsightsCliTool;
  totalScannedSessions: number;
  totalEligibleSessions: number;
  cachedFacetSessions: number;
  failedFacetSessions: number;
  deferredFacetSessions: number;
}

export interface AggregatedStats extends InsightsPipelineCounts {
  totalSessions: number;
  totalMessages: number;
  totalDurationMinutes: number;
  cliBreakdown: Record<string, number>;
  outcomeBreakdown: Record<string, number>;
  sessionTypeBreakdown: Record<string, number>;
  goalCategories: Record<string, number>;
  frictionCounts: Record<string, number>;
  satisfactionBreakdown: Record<string, number>;
  projectBreakdown: Record<string, number>;
}

export interface InsightsResult {
  stats: AggregatedStats;
  projectAreas: string;
  interactionStyle: string;
  whatWorks: string;
  frictionAnalysis: string;
  suggestions: string;
  atAGlance: string;
}

export type InsightsGenerateResult =
  | { ok: true; jobId: string; reportPath: string }
  | { ok: false; jobId: string; error: InsightsError };

const SELF_INSIGHT_MARKERS = [
  "Analyze this AI coding session and return a JSON object",
  "RESPOND WITH ONLY A VALID JSON OBJECT",
  "Write a concise AT-A-GLANCE summary",
  "Analyze this Claude Code session and extract structured facets.",
];

export function buildSessionFingerprint(
  session: Pick<SessionInfo, "cliTool" | "filePath" | "mtimeMs" | "fileSize">,
): string {
  return crypto
    .createHash("sha1")
    .update(
      JSON.stringify([
        session.cliTool,
        path.resolve(session.filePath),
        session.mtimeMs,
        session.fileSize,
      ]),
    )
    .digest("hex");
}

export function isSelfInsightSession(content: string): boolean {
  return SELF_INSIGHT_MARKERS.some((marker) => content.includes(marker));
}

function incr(map: Record<string, number>, key: string, amount = 1): void {
  map[key] = (map[key] ?? 0) + amount;
}

export function aggregateFacets(
  facets: SessionFacet[],
  sessions: SessionInfo[],
  counts: InsightsPipelineCounts,
): AggregatedStats {
  const facetsById = new Map(facets.map((facet) => [facet.session_id, facet]));
  const analyzedSessions = sessions.filter((session) => facetsById.has(session.id));

  const stats: AggregatedStats = {
    ...counts,
    totalSessions: analyzedSessions.length,
    totalMessages: analyzedSessions.reduce((sum, session) => sum + session.messageCount, 0),
    totalDurationMinutes: analyzedSessions.reduce(
      (sum, session) => sum + session.durationMinutes,
      0,
    ),
    cliBreakdown: {},
    outcomeBreakdown: {},
    sessionTypeBreakdown: {},
    goalCategories: {},
    frictionCounts: {},
    satisfactionBreakdown: {},
    projectBreakdown: {},
  };

  for (const facet of facets) {
    incr(stats.cliBreakdown, facet.cli_tool);
    incr(stats.outcomeBreakdown, facet.outcome);
    incr(stats.sessionTypeBreakdown, facet.session_type);
    incr(stats.satisfactionBreakdown, facet.user_satisfaction);
    incr(
      stats.projectBreakdown,
      facet.project_path ? path.basename(facet.project_path) : "unknown",
    );

    for (const [category, weight] of Object.entries(facet.goal_categories)) {
      incr(stats.goalCategories, category, weight);
    }
    for (const [type, count] of Object.entries(facet.friction_counts)) {
      incr(stats.frictionCounts, type, count);
    }
  }

  return stats;
}
