import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";
import { findClaudeJsonlFiles, findCodexJsonlFiles } from "./usage-collector";
import { TERMCANVAS_DIR } from "./state-persistence";
import { buildLaunchSpec, PtyResolvedLaunchSpec } from "./pty-launch";
import { buildCliInvocationArgs } from "./insights-cli";
import { generateReport } from "./insights-report";
import {
  aggregateFacets,
  buildSessionFingerprint,
  InsightsCliTool,
  InsightsError,
  InsightsGenerateResult,
  InsightsProgress,
  InsightsResult,
  isSelfInsightSession,
  SessionFacet,
  SessionInfo,
} from "./insights-shared";

interface SessionFileInfo {
  id: string;
  filePath: string;
  cliTool: InsightsCliTool;
  mtimeMs: number;
  fileSize: number;
}

interface CachedSessionMetaEntry {
  version: number;
  sourceFingerprint: string;
  session: SessionInfo;
}

interface CachedFacetEntry {
  version: number;
  analyzerCli: InsightsCliTool;
  sourceFingerprint: string;
  facet: SessionFacet;
}

interface ScanResult {
  sessions: SessionInfo[];
  totalScannedSessions: number;
}

const CACHE_VERSION = 1;
const SESSION_META_CACHE_DIR = path.join(
  TERMCANVAS_DIR,
  "insights-cache",
  "session-meta",
);
const FACET_CACHE_DIR = path.join(TERMCANVAS_DIR, "insights-cache", "facets");
const SESSION_META_CACHE_BATCH = 50;
const SESSION_LOAD_BATCH = 10;
const MAX_UNCACHED_SESSION_LOADS = 200;
const MAX_FACET_EXTRACTIONS = 50;
const FACET_EXTRACTION_BATCH = 10;
const ANALYSIS_SAMPLE_LIMIT = 50;

function cacheFileName(prefix: string, key: string): string {
  const digest = crypto.createHash("sha1").update(key).digest("hex");
  return `${prefix}-${digest}.json`;
}

function metaCachePath(file: SessionFileInfo): string {
  return path.join(
    SESSION_META_CACHE_DIR,
    cacheFileName("meta", `${file.cliTool}:${file.id}`),
  );
}

function facetCachePath(
  session: SessionInfo,
  analyzerCli: InsightsCliTool,
): string {
  return path.join(
    FACET_CACHE_DIR,
    cacheFileName("facet", `${session.cliTool}:${analyzerCli}:${session.id}`),
  );
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (block) =>
          block &&
          typeof block === "object" &&
          (block as Record<string, unknown>).type === "text",
      )
      .map((block) => (block as Record<string, unknown>).text as string)
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function discoverSessionFiles(cliTool: InsightsCliTool): SessionFileInfo[] {
  const files =
    cliTool === "claude" ? findClaudeJsonlFiles() : findCodexJsonlFiles();
  const indexed: SessionFileInfo[] = [];

  for (const filePath of files) {
    try {
      const stat = fs.statSync(filePath);
      indexed.push({
        id: path.basename(filePath, ".jsonl"),
        filePath,
        cliTool,
        mtimeMs: stat.mtimeMs,
        fileSize: stat.size,
      });
    } catch {
      // Ignore files that disappear mid-scan.
    }
  }

  indexed.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const deduped = new Map<string, SessionFileInfo>();
  for (const file of indexed) {
    const existing = deduped.get(file.id);
    if (!existing || file.mtimeMs > existing.mtimeMs) {
      deduped.set(file.id, file);
    }
  }

  return [...deduped.values()];
}

function extractClaudeSession(file: SessionFileInfo): SessionInfo | null {
  let raw: string;
  try {
    raw = fs.readFileSync(file.filePath, "utf-8");
  } catch {
    return null;
  }

  const projectsDir = path.join(os.homedir(), ".claude", "projects");
  let projectPath = "";
  const rel = path.relative(projectsDir, file.filePath);
  const topDir = rel.split(path.sep)[0];
  if (topDir && topDir.startsWith("-")) {
    const cleaned = topDir.replace(/--worktrees-.*$/, "");
    projectPath = cleaned.replace(/-/g, "/");
  }

  const timestamps: number[] = [];
  let messageCount = 0;
  const parts: string[] = [];

  for (const line of raw.split("\n")) {
    if (!line) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    const ts = obj.timestamp;
    if (typeof ts === "string") {
      const ms = new Date(ts).getTime();
      if (!Number.isNaN(ms)) timestamps.push(ms);
    }

    const msg = obj.message;
    if (!msg || typeof msg !== "object") continue;
    const record = msg as Record<string, unknown>;
    const role = record.role as string | undefined;
    if (role !== "user" && role !== "assistant") continue;

    messageCount++;
    const text = extractTextFromContent(record.content);
    if (text) parts.push(`${role}: ${text}`);
  }

  if (messageCount < 2) return null;
  const durationMinutes =
    timestamps.length >= 2
      ? (Math.max(...timestamps) - Math.min(...timestamps)) / 60_000
      : 0;
  if (durationMinutes < 1) return null;

  const contentSummary = parts.join("\n").slice(0, 4000);
  if (isSelfInsightSession(contentSummary) || isSelfInsightSession(raw.slice(0, 8000))) {
    return null;
  }

  return {
    id: file.id,
    filePath: file.filePath,
    cliTool: "claude",
    projectPath,
    messageCount,
    durationMinutes: Math.round(durationMinutes),
    contentSummary,
    mtimeMs: file.mtimeMs,
    fileSize: file.fileSize,
  };
}

function extractCodexSession(file: SessionFileInfo): SessionInfo | null {
  let raw: string;
  try {
    raw = fs.readFileSync(file.filePath, "utf-8");
  } catch {
    return null;
  }

  let projectPath = "";
  const timestamps: number[] = [];
  let messageCount = 0;
  const parts: string[] = [];

  for (const line of raw.split("\n")) {
    if (!line) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    const ts = obj.timestamp;
    if (typeof ts === "string") {
      const ms = new Date(ts).getTime();
      if (!Number.isNaN(ms)) timestamps.push(ms);
    }

    if (obj.type === "session_meta") {
      const payload = obj.payload as Record<string, unknown> | undefined;
      if (payload?.cwd) projectPath = payload.cwd as string;
      continue;
    }

    if (obj.type !== "event_msg") continue;
    const payload = obj.payload as Record<string, unknown> | undefined;
    if (!payload) continue;

    const payloadType = payload.type as string | undefined;
    let role: "user" | "assistant" | null = null;
    if (payloadType === "user_message" || payloadType === "input_text") {
      role = "user";
    } else if (
      payloadType === "assistant_message" ||
      payloadType === "message"
    ) {
      role = "assistant";
    }
    if (!role) continue;

    messageCount++;
    const text =
      (payload.text as string) ?? (payload.content as string) ?? "";
    if (text) parts.push(`${role}: ${text}`);
  }

  if (messageCount < 2) return null;
  const durationMinutes =
    timestamps.length >= 2
      ? (Math.max(...timestamps) - Math.min(...timestamps)) / 60_000
      : 0;
  if (durationMinutes < 1) return null;

  const contentSummary = parts.join("\n").slice(0, 4000);
  if (isSelfInsightSession(contentSummary) || isSelfInsightSession(raw.slice(0, 8000))) {
    return null;
  }

  return {
    id: file.id,
    filePath: file.filePath,
    cliTool: "codex",
    projectPath,
    messageCount,
    durationMinutes: Math.round(durationMinutes),
    contentSummary,
    mtimeMs: file.mtimeMs,
    fileSize: file.fileSize,
  };
}

function extractSession(file: SessionFileInfo): SessionInfo | null {
  return file.cliTool === "claude"
    ? extractClaudeSession(file)
    : extractCodexSession(file);
}

function readCachedSessionMeta(file: SessionFileInfo): SessionInfo | null {
  try {
    const raw = fs.readFileSync(metaCachePath(file), "utf-8");
    const parsed = JSON.parse(raw) as CachedSessionMetaEntry;
    if (
      parsed.version !== CACHE_VERSION ||
      parsed.sourceFingerprint !==
        buildSessionFingerprint({
          cliTool: file.cliTool,
          filePath: file.filePath,
          mtimeMs: file.mtimeMs,
          fileSize: file.fileSize,
        })
    ) {
      return null;
    }
    return parsed.session;
  } catch {
    return null;
  }
}

function writeCachedSessionMeta(session: SessionInfo): void {
  try {
    fs.mkdirSync(SESSION_META_CACHE_DIR, { recursive: true });
    const entry: CachedSessionMetaEntry = {
      version: CACHE_VERSION,
      sourceFingerprint: buildSessionFingerprint(session),
      session,
    };
    fs.writeFileSync(
      metaCachePath(session),
      JSON.stringify(entry, null, 2),
      "utf-8",
    );
  } catch {
    // Cache writes are opportunistic.
  }
}

function readCachedFacet(
  session: SessionInfo,
  analyzerCli: InsightsCliTool,
): SessionFacet | null {
  try {
    const raw = fs.readFileSync(facetCachePath(session, analyzerCli), "utf-8");
    const parsed = JSON.parse(raw) as CachedFacetEntry;
    if (
      parsed.version !== CACHE_VERSION ||
      parsed.analyzerCli !== analyzerCli ||
      parsed.sourceFingerprint !== buildSessionFingerprint(session)
    ) {
      return null;
    }
    return parsed.facet;
  } catch {
    return null;
  }
}

function writeCachedFacet(
  session: SessionInfo,
  analyzerCli: InsightsCliTool,
  facet: SessionFacet,
): void {
  try {
    fs.mkdirSync(FACET_CACHE_DIR, { recursive: true });
    const entry: CachedFacetEntry = {
      version: CACHE_VERSION,
      analyzerCli,
      sourceFingerprint: buildSessionFingerprint(session),
      facet,
    };
    fs.writeFileSync(
      facetCachePath(session, analyzerCli),
      JSON.stringify(entry, null, 2),
      "utf-8",
    );
  } catch {
    // Cache writes are opportunistic.
  }
}

async function scanSessions(
  sourceCli: InsightsCliTool,
  onProgress: (p: Omit<InsightsProgress, "jobId">) => void,
): Promise<ScanResult> {
  const files = discoverSessionFiles(sourceCli);
  const cachedSessions: SessionInfo[] = [];
  const uncachedFiles: SessionFileInfo[] = [];

  for (let i = 0; i < files.length; i += SESSION_META_CACHE_BATCH) {
    const batch = files.slice(i, i + SESSION_META_CACHE_BATCH);
    for (const file of batch) {
      const cached = readCachedSessionMeta(file);
      if (cached) {
        cachedSessions.push(cached);
      } else if (uncachedFiles.length < MAX_UNCACHED_SESSION_LOADS) {
        uncachedFiles.push(file);
      }
    }
    onProgress({
      stage: "scanning",
      current: Math.min(i + batch.length, files.length),
      total: files.length,
      message: `Scanning ${sourceCli} sessions...`,
    });
    if (i + batch.length < files.length) await yieldToEventLoop();
  }

  const loadedSessions: SessionInfo[] = [];
  for (let i = 0; i < uncachedFiles.length; i += SESSION_LOAD_BATCH) {
    const batch = uncachedFiles.slice(i, i + SESSION_LOAD_BATCH);
    for (const file of batch) {
      const session = extractSession(file);
      if (!session) continue;
      loadedSessions.push(session);
      writeCachedSessionMeta(session);
    }
    onProgress({
      stage: "scanning",
      current: files.length,
      total: files.length,
      message: `Loaded ${Math.min(i + batch.length, uncachedFiles.length)} new ${sourceCli} sessions`,
    });
    if (i + batch.length < uncachedFiles.length) await yieldToEventLoop();
  }

  const deduped = new Map<string, SessionInfo>();
  for (const session of [...cachedSessions, ...loadedSessions]) {
    const existing = deduped.get(session.id);
    if (
      !existing ||
      session.messageCount > existing.messageCount ||
      (session.messageCount === existing.messageCount &&
        session.durationMinutes > existing.durationMinutes) ||
      session.mtimeMs > existing.mtimeMs
    ) {
      deduped.set(session.id, session);
    }
  }

  const sessions = [...deduped.values()].sort((a, b) => b.mtimeMs - a.mtimeMs);
  return { sessions, totalScannedSessions: files.length };
}

async function resolveCliSpec(
  cliTool: InsightsCliTool,
): Promise<PtyResolvedLaunchSpec> {
  return buildLaunchSpec({ cwd: process.cwd(), shell: cliTool });
}

async function invokeCli(
  spec: PtyResolvedLaunchSpec,
  cliTool: InsightsCliTool,
  prompt: string,
  timeoutMs = 120_000,
): Promise<string> {
  const args = buildCliInvocationArgs(spec.args, cliTool, prompt);

  return new Promise<string>((resolve, reject) => {
    execFile(
      spec.file,
      args,
      {
        cwd: spec.cwd,
        env: spec.env,
        maxBuffer: 10 * 1024 * 1024,
        timeout: timeoutMs,
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

export async function validateCli(
  cliTool: InsightsCliTool,
): Promise<InsightsError | null> {
  let spec: PtyResolvedLaunchSpec;
  try {
    spec = await resolveCliSpec(cliTool);
  } catch {
    return {
      code: "cli_not_found",
      message: `${cliTool} CLI not found in PATH`,
    };
  }

  try {
    const timeout = cliTool === "codex" ? 60_000 : 15_000;
    const response = await invokeCli(
      spec,
      cliTool,
      "Reply with exactly: OK",
      timeout,
    );
    if (!response.includes("OK")) {
      return {
        code: "auth_failed",
        message: `${cliTool} CLI responded but did not return expected output`,
        detail: response.slice(0, 500),
      };
    }
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("auth") ||
      message.includes("401") ||
      message.includes("API key")
    ) {
      return {
        code: "auth_failed",
        message: `${cliTool} authentication failed`,
        detail: message,
      };
    }
    return {
      code: "cli_error",
      message: `${cliTool} CLI invocation failed`,
      detail: message,
    };
  }
}

function parseJsonFromResponse(
  response: string,
): Record<string, unknown> | null {
  const cleaned = response.replace(/```(?:json)?\s*/g, "");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const FACET_REQUIRED_FIELDS = [
  "session_id",
  "cli_tool",
  "underlying_goal",
  "brief_summary",
  "outcome",
  "session_type",
  "user_satisfaction",
  "project_path",
] as const;

export async function extractFacet(
  session: SessionInfo,
  cliSpec: PtyResolvedLaunchSpec,
  analyzerCli: InsightsCliTool,
): Promise<SessionFacet | InsightsError> {
  const cached = readCachedFacet(session, analyzerCli);
  if (cached) return cached;

  const prompt = [
    "Analyze this AI coding session and return a JSON object with exactly these fields:",
    `- session_id: "${session.id}"`,
    `- cli_tool: "${session.cliTool}"`,
    "- underlying_goal: string describing what the user was trying to achieve",
    "- brief_summary: 1-2 sentence summary",
    '- goal_categories: object mapping category names (e.g. "bug_fix","feature","refactor","test","docs","config") to confidence 0-1',
    '- outcome: one of "fully_achieved","mostly_achieved","partially_achieved","not_achieved","unclear"',
    '- session_type: one of "single_task","multi_task","iterative","exploratory","quick_question"',
    '- friction_counts: object mapping friction types (e.g. "misunderstanding","error","retry","confusion") to counts',
    '- user_satisfaction: one of "high","medium","low","unclear"',
    `- project_path: "${session.projectPath}"`,
    "",
    "Session transcript (truncated):",
    session.contentSummary,
    "",
    "Return ONLY a valid JSON object. No markdown fences, no explanation.",
  ].join("\n");

  let response: string;
  try {
    response = await invokeCli(cliSpec, analyzerCli, prompt);
  } catch (err) {
    return {
      code: "cli_error",
      message: `Failed to extract facet for session ${session.id}`,
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const parsed = parseJsonFromResponse(response);
  if (!parsed) {
    return {
      code: "parse_error",
      message: `No JSON object found in response for session ${session.id}`,
      detail: response.slice(0, 500),
    };
  }

  for (const field of FACET_REQUIRED_FIELDS) {
    if (!(field in parsed)) {
      return {
        code: "parse_error",
        message: `Missing required field "${field}" in facet for session ${session.id}`,
      };
    }
  }

  if (!parsed.goal_categories || typeof parsed.goal_categories !== "object") {
    parsed.goal_categories = {};
  }
  if (!parsed.friction_counts || typeof parsed.friction_counts !== "object") {
    parsed.friction_counts = {};
  }

  const facet = parsed as SessionFacet;
  writeCachedFacet(session, analyzerCli, facet);
  return facet;
}

function isInsightsError(
  value: InsightsResult | InsightsError,
): value is InsightsError {
  return "code" in value;
}

async function runInsightRounds(
  cliSpec: PtyResolvedLaunchSpec,
  analyzerCli: InsightsCliTool,
  stats: InsightsResult["stats"],
  facets: SessionFacet[],
  onProgress: (p: Omit<InsightsProgress, "jobId">) => void,
): Promise<InsightsResult | InsightsError> {
  const sampleFacets = facets.slice(0, ANALYSIS_SAMPLE_LIMIT);
  const dataCtx = [
    "Statistics:",
    JSON.stringify(stats, null, 2),
    "",
    `Recent analyzed session facets (${sampleFacets.length} of ${facets.length}):`,
    JSON.stringify(sampleFacets, null, 2),
  ].join("\n");

  const rounds: { key: keyof Omit<InsightsResult, "stats" | "atAGlance">; instruction: string }[] = [
    {
      key: "projectAreas",
      instruction:
        "Analyze the PROJECT AREAS the user works on. Identify key projects, their relative importance, and how they relate.",
    },
    {
      key: "interactionStyle",
      instruction:
        "Analyze the user's INTERACTION STYLE with AI coding assistants. How they phrase requests, iterate vs complete specs, hands-on vs delegating.",
    },
    {
      key: "whatWorks",
      instruction:
        "Analyze WHAT WORKS WELL. Which task types succeed most? What patterns lead to high satisfaction and good outcomes?",
    },
    {
      key: "frictionAnalysis",
      instruction:
        "Analyze FRICTION POINTS. What causes sessions to fail or underperform? Where does AI-human collaboration break down?",
    },
    {
      key: "suggestions",
      instruction:
        "Provide ACTIONABLE SUGGESTIONS to improve the AI coding workflow. Be specific, practical, and grounded in the data.",
    },
  ];

  let completed = 0;
  onProgress({
    stage: "analyzing",
    current: 0,
    total: rounds.length + 1,
    message: "Running analysis tasks...",
  });

  const taskResults = await Promise.all(
    rounds.map(async (round) => {
      try {
        const response = await invokeCli(
          cliSpec,
          analyzerCli,
          `${round.instruction}\n\n${dataCtx}`,
        );
        completed += 1;
        onProgress({
          stage: "analyzing",
          current: completed,
          total: rounds.length + 1,
          message: `Analyzing: ${round.key}`,
        });
        return { key: round.key, text: response.trim() } as const;
      } catch (err) {
        return {
          key: round.key,
          error: {
            code: "cli_error",
            message: `Insight round "${round.key}" failed`,
            detail: err instanceof Error ? err.message : String(err),
          } satisfies InsightsError,
        } as const;
      }
    }),
  );

  for (const result of taskResults) {
    if ("error" in result) return result.error;
  }

  const texts: Record<string, string> = {};
  for (const result of taskResults) {
    texts[result.key] = result.text;
  }

  onProgress({
    stage: "analyzing",
    current: rounds.length,
    total: rounds.length + 1,
    message: "Generating at-a-glance summary",
  });

  const summaryCtx = Object.entries(texts)
    .map(([key, value]) => `${key}:\n${value}`)
    .join("\n\n");

  try {
    const response = await invokeCli(
      cliSpec,
      analyzerCli,
      `Write a concise AT-A-GLANCE summary (3-5 bullet points) of the user's AI coding usage patterns, strengths, and areas for improvement.\n\n${summaryCtx}`,
    );
    onProgress({
      stage: "analyzing",
      current: rounds.length + 1,
      total: rounds.length + 1,
      message: "At-a-glance ready",
    });
    return {
      stats,
      projectAreas: texts.projectAreas ?? "",
      interactionStyle: texts.interactionStyle ?? "",
      whatWorks: texts.whatWorks ?? "",
      frictionAnalysis: texts.frictionAnalysis ?? "",
      suggestions: texts.suggestions ?? "",
      atAGlance: response.trim(),
    };
  } catch (err) {
    return {
      code: "cli_error",
      message: "At-a-glance round failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function generateInsights(
  cliTool: InsightsCliTool,
  jobId: string,
  onProgress: (p: InsightsProgress) => void,
): Promise<InsightsGenerateResult> {
  const emit = (progress: Omit<InsightsProgress, "jobId">) =>
    onProgress({ jobId, ...progress });

  emit({
    stage: "validating",
    current: 0,
    total: 1,
    message: `Validating ${cliTool} CLI...`,
  });
  const validationErr = await validateCli(cliTool);
  if (validationErr) return { ok: false, jobId, error: validationErr };

  let cliSpec: PtyResolvedLaunchSpec;
  try {
    cliSpec = await resolveCliSpec(cliTool);
  } catch (err) {
    return {
      ok: false,
      jobId,
      error: {
        code: "cli_not_found",
        message: `Failed to resolve ${cliTool} CLI`,
        detail: err instanceof Error ? err.message : String(err),
      },
    };
  }

  emit({
    stage: "scanning",
    current: 0,
    total: 1,
    message: `Scanning ${cliTool} sessions...`,
  });
  const { sessions, totalScannedSessions } = await scanSessions(cliTool, emit);
  if (sessions.length === 0) {
    return {
      ok: false,
      jobId,
      error: {
        code: "unknown",
        message: `No valid ${cliTool} sessions found to analyze`,
      },
    };
  }

  const facets: SessionFacet[] = [];
  const uncachedSessions: SessionInfo[] = [];
  let cachedFacetSessions = 0;
  let deferredFacetSessions = 0;
  let failedFacetSessions = 0;

  for (const session of sessions) {
    const cached = readCachedFacet(session, cliTool);
    if (cached) {
      facets.push(cached);
      cachedFacetSessions++;
      continue;
    }
    if (uncachedSessions.length < MAX_FACET_EXTRACTIONS) {
      uncachedSessions.push(session);
    } else {
      deferredFacetSessions++;
    }
  }

  emit({
    stage: "extracting_facets",
    current: 0,
    total: uncachedSessions.length,
    message:
      uncachedSessions.length > 0
        ? `Extracting new facets for ${cliTool} sessions...`
        : "Using cached facets...",
  });

  for (let i = 0; i < uncachedSessions.length; i += FACET_EXTRACTION_BATCH) {
    const batch = uncachedSessions.slice(i, i + FACET_EXTRACTION_BATCH);
    const results = await Promise.all(
      batch.map((session) => extractFacet(session, cliSpec, cliTool)),
    );
    for (const result of results) {
      if ("session_id" in result) {
        facets.push(result);
      } else {
        failedFacetSessions++;
      }
    }
    emit({
      stage: "extracting_facets",
      current: Math.min(i + batch.length, uncachedSessions.length),
      total: uncachedSessions.length,
      message: `Extracting facets: ${Math.min(i + batch.length, uncachedSessions.length)}/${uncachedSessions.length}`,
    });
    if (i + batch.length < uncachedSessions.length) await yieldToEventLoop();
  }

  if (facets.length === 0) {
    return {
      ok: false,
      jobId,
      error: {
        code: "unknown",
        message: "Failed to load or extract any session facets",
      },
    };
  }

  emit({
    stage: "aggregating",
    current: 0,
    total: 1,
    message: "Aggregating statistics...",
  });
  const stats = aggregateFacets(facets, sessions, {
    sourceCli: cliTool,
    analyzerCli: cliTool,
    totalScannedSessions,
    totalEligibleSessions: sessions.length,
    cachedFacetSessions,
    failedFacetSessions,
    deferredFacetSessions,
  });

  const insightsResult = await runInsightRounds(
    cliSpec,
    cliTool,
    stats,
    facets,
    emit,
  );
  if (isInsightsError(insightsResult)) {
    return { ok: false, jobId, error: insightsResult };
  }

  emit({
    stage: "generating_report",
    current: 0,
    total: 1,
    message: "Generating report...",
  });
  try {
    const reportPath = generateReport(insightsResult);
    return { ok: true, jobId, reportPath };
  } catch (err) {
    return {
      ok: false,
      jobId,
      error: {
        code: "unknown",
        message: "Failed to generate report",
        detail: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
