import fs from "fs";
import path from "path";
import os from "os";

// ── Pricing (per million tokens) ───────────────────────────────────────

const PRICING: Record<string, { input: number; output: number; cache_read: number; cache_create: number }> = {
  "claude-opus-4-6":   { input: 5.00, output: 25.00, cache_read: 0.50, cache_create: 6.25 },
  "claude-sonnet-4-6": { input: 3.00, output: 15.00, cache_read: 0.30, cache_create: 3.75 },
  "claude-haiku-4-5":  { input: 0.80, output:  4.00, cache_read: 0.08, cache_create: 1.00 },
  default:             { input: 5.00, output: 25.00, cache_read: 0.50, cache_create: 6.25 },
};

// ── Types ──────────────────────────────────────────────────────────────

export interface UsageRecord {
  ts: string;         // UTC ISO string (no Z)
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
  projectPath: string; // cwd of the session, for project matching
}

export interface UsageBucket {
  label: string;      // e.g. "10:00-12:00"
  hourStart: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
  cost: number;
  calls: number;
}

export interface ProjectUsage {
  path: string;
  name: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
  cost: number;
  calls: number;
}

export interface ModelUsage {
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
  cost: number;
  calls: number;
}

export interface UsageSummary {
  date: string;               // YYYY-MM-DD
  sessions: number;
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCacheCreate: number;
  totalCost: number;
  buckets: UsageBucket[];     // 2-hour buckets
  projects: ProjectUsage[];
  models: ModelUsage[];
}

// ── Helpers ────────────────────────────────────────────────────────────

function computeCost(model: string, input: number, output: number, cacheRead: number, cacheCreate: number): number {
  const p = PRICING[model] ?? PRICING.default;
  return (input / 1e6) * p.input
       + (output / 1e6) * p.output
       + (cacheRead / 1e6) * p.cache_read
       + (cacheCreate / 1e6) * p.cache_create;
}

/** Convert a target date (YYYY-MM-DD, local) to UTC start/end strings for filtering. */
function dateToUtcRange(dateStr: string, tzOffsetHours: number): { utcStart: string; utcEnd: string } {
  const d = new Date(`${dateStr}T00:00:00`);
  const startMs = d.getTime() - tzOffsetHours * 3600_000;
  const endMs = startMs + 86400_000;
  const fmt = (ms: number) => new Date(ms).toISOString().replace("Z", "").split(".")[0];
  return { utcStart: fmt(startMs), utcEnd: fmt(endMs) };
}

/** Convert UTC timestamp string to local hour given timezone offset. */
function utcToLocalHour(tsClean: string, tzOffsetHours: number): number {
  const utcMs = new Date(tsClean + "Z").getTime();
  const localMs = utcMs + tzOffsetHours * 3600_000;
  return new Date(localMs).getUTCHours();
}

// ── JSONL file discovery ───────────────────────────────────────────────

function findClaudeJsonlFiles(): string[] {
  const claudeDir = path.join(os.homedir(), ".claude");
  const projectsDir = path.join(claudeDir, "projects");
  const files: string[] = [];

  if (fs.existsSync(projectsDir)) {
    try {
      const dirs = fs.readdirSync(projectsDir);
      for (const d of dirs) {
        const p = path.join(projectsDir, d);
        try {
          if (fs.statSync(p).isDirectory()) {
            const jsonls = fs.readdirSync(p).filter((f) => f.endsWith(".jsonl"));
            for (const f of jsonls) files.push(path.join(p, f));
          }
        } catch { /* skip inaccessible */ }
      }
    } catch { /* skip */ }
  }

  // Also check ~/.claude root
  try {
    const rootJsonls = fs.readdirSync(claudeDir).filter((f) => f.endsWith(".jsonl"));
    for (const f of rootJsonls) files.push(path.join(claudeDir, f));
  } catch { /* skip */ }

  return files;
}

function findCodexJsonlFiles(): string[] {
  const codexDir = path.join(os.homedir(), ".codex");
  const files: string[] = [];

  // Active sessions: ~/.codex/sessions/YYYY/MM/DD/*.jsonl
  const sessionsDir = path.join(codexDir, "sessions");
  if (fs.existsSync(sessionsDir)) {
    try {
      const years = fs.readdirSync(sessionsDir);
      for (const y of years) {
        const yDir = path.join(sessionsDir, y);
        try {
          const months = fs.readdirSync(yDir);
          for (const m of months) {
            const mDir = path.join(yDir, m);
            try {
              const days = fs.readdirSync(mDir);
              for (const d of days) {
                const dDir = path.join(mDir, d);
                try {
                  const jsonls = fs.readdirSync(dDir).filter((f) => f.endsWith(".jsonl"));
                  for (const f of jsonls) files.push(path.join(dDir, f));
                } catch { /* skip */ }
              }
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  // Archived sessions: ~/.codex/archived_sessions/*.jsonl
  const archivedDir = path.join(codexDir, "archived_sessions");
  if (fs.existsSync(archivedDir)) {
    try {
      const jsonls = fs.readdirSync(archivedDir).filter((f) => f.endsWith(".jsonl"));
      for (const f of jsonls) files.push(path.join(archivedDir, f));
    } catch { /* skip */ }
  }

  return files;
}

// ── Claude JSONL parsing ───────────────────────────────────────────────

function parseClaudeSession(
  filePath: string,
  utcStart: string,
  utcEnd: string,
): { records: UsageRecord[]; projectPath: string } {
  const records: UsageRecord[] = [];
  let projectPath = "";

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return { records, projectPath };
  }

  // Try to extract project path from the directory name
  // e.g. ~/.claude/projects/-Users-zzzz-termcanvas/xxx.jsonl
  const dirName = path.basename(path.dirname(filePath));
  if (dirName.startsWith("-")) {
    projectPath = dirName.replace(/-/g, "/");
  }

  for (const line of content.split("\n")) {
    if (!line) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line);
    } catch { continue; }

    const ts = obj.timestamp;
    if (typeof ts !== "string" || !ts) continue;

    const msg = obj.message;
    if (!msg || typeof msg !== "object") continue;
    const usage = (msg as Record<string, unknown>).usage;
    if (!usage || typeof usage !== "object") continue;

    const tsClean = ts.replace("Z", "").split("+")[0];
    if (tsClean < utcStart || tsClean >= utcEnd) continue;

    const u = usage as Record<string, number>;
    const model = ((msg as Record<string, unknown>).model as string) ?? "unknown";

    records.push({
      ts: tsClean,
      model,
      input: u.input_tokens ?? 0,
      output: u.output_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
      cacheCreate: u.cache_creation_input_tokens ?? 0,
      projectPath,
    });
  }

  return { records, projectPath };
}

// ── Codex JSONL parsing ────────────────────────────────────────────────

function parseCodexSession(
  filePath: string,
  utcStart: string,
  utcEnd: string,
): { records: UsageRecord[]; projectPath: string } {
  const records: UsageRecord[] = [];
  let projectPath = "";

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return { records, projectPath };
  }

  for (const line of content.split("\n")) {
    if (!line) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line);
    } catch { continue; }

    // Extract cwd from session_meta
    if (obj.type === "session_meta") {
      const payload = obj.payload as Record<string, unknown> | undefined;
      if (payload?.cwd) projectPath = payload.cwd as string;
      continue;
    }

    // Look for token_count events
    if (obj.type !== "event_msg") continue;
    const payload = obj.payload as Record<string, unknown> | undefined;
    if (!payload || payload.type !== "token_count") continue;

    const ts = obj.timestamp;
    if (typeof ts !== "string" || !ts) continue;
    const tsClean = ts.replace("Z", "").split("+")[0];
    if (tsClean < utcStart || tsClean >= utcEnd) continue;

    const info = payload.info as Record<string, unknown> | null;
    if (!info) continue;

    // Use last_token_usage for per-call incremental data
    const lastUsage = info.last_token_usage as Record<string, number> | undefined;
    if (!lastUsage) continue;

    records.push({
      ts: tsClean,
      model: "codex",  // Codex sessions don't expose model in each entry
      input: lastUsage.input_tokens ?? 0,
      output: lastUsage.output_tokens ?? 0,
      cacheRead: lastUsage.cached_input_tokens ?? 0,
      cacheCreate: 0,  // Codex doesn't track cache creation separately
      projectPath,
    });
  }

  return { records, projectPath };
}

// ── Main API ───────────────────────────────────────────────────────────

/**
 * Collect usage data for a given date (local timezone).
 * @param dateStr YYYY-MM-DD in local timezone
 * @param tzOffsetHours Timezone offset from UTC (e.g. 8 for BJT)
 * @param intervalHours Bucket interval in hours (default 2)
 */
export function collectUsage(
  dateStr: string,
  tzOffsetHours = 8,
  intervalHours = 2,
): UsageSummary {
  const { utcStart, utcEnd } = dateToUtcRange(dateStr, tzOffsetHours);

  // Collect all records
  const allRecords: UsageRecord[] = [];
  const sessionPaths = new Set<string>();

  // Claude sessions
  const claudeFiles = findClaudeJsonlFiles();
  for (const f of claudeFiles) {
    // Quick filter: skip files not modified around the target date
    try {
      const mtime = fs.statSync(f).mtimeMs;
      const mtimeDate = new Date(mtime).toISOString().split("T")[0];
      if (mtimeDate < dateStr) continue;
    } catch { continue; }

    const { records, projectPath } = parseClaudeSession(f, utcStart, utcEnd);
    if (records.length > 0) {
      allRecords.push(...records);
      sessionPaths.add(f);
    }
  }

  // Codex sessions
  const codexFiles = findCodexJsonlFiles();
  for (const f of codexFiles) {
    try {
      const mtime = fs.statSync(f).mtimeMs;
      const mtimeDate = new Date(mtime).toISOString().split("T")[0];
      if (mtimeDate < dateStr) continue;
    } catch { continue; }

    const { records } = parseCodexSession(f, utcStart, utcEnd);
    if (records.length > 0) {
      allRecords.push(...records);
      sessionPaths.add(f);
    }
  }

  // ── Aggregate ──

  // Totals
  let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheCreate = 0, totalCost = 0;

  // Time buckets
  const bucketCount = 24 / intervalHours;
  const buckets: UsageBucket[] = Array.from({ length: bucketCount }, (_, i) => {
    const h = i * intervalHours;
    return {
      label: `${String(h).padStart(2, "0")}:00-${String(h + intervalHours).padStart(2, "0")}:00`,
      hourStart: h,
      input: 0, output: 0, cacheRead: 0, cacheCreate: 0, cost: 0, calls: 0,
    };
  });

  // Per-project
  const projectMap = new Map<string, ProjectUsage>();
  // Per-model
  const modelMap = new Map<string, ModelUsage>();

  for (const r of allRecords) {
    const cost = computeCost(r.model, r.input, r.output, r.cacheRead, r.cacheCreate);

    totalInput += r.input;
    totalOutput += r.output;
    totalCacheRead += r.cacheRead;
    totalCacheCreate += r.cacheCreate;
    totalCost += cost;

    // Bucket
    const localHour = utcToLocalHour(r.ts, tzOffsetHours);
    const bucketIdx = Math.floor(localHour / intervalHours);
    if (bucketIdx >= 0 && bucketIdx < bucketCount) {
      const b = buckets[bucketIdx];
      b.input += r.input;
      b.output += r.output;
      b.cacheRead += r.cacheRead;
      b.cacheCreate += r.cacheCreate;
      b.cost += cost;
      b.calls++;
    }

    // Project
    const pKey = r.projectPath || "unknown";
    if (!projectMap.has(pKey)) {
      const name = pKey === "unknown" ? "Other" : path.basename(pKey);
      projectMap.set(pKey, { path: pKey, name, input: 0, output: 0, cacheRead: 0, cacheCreate: 0, cost: 0, calls: 0 });
    }
    const proj = projectMap.get(pKey)!;
    proj.input += r.input;
    proj.output += r.output;
    proj.cacheRead += r.cacheRead;
    proj.cacheCreate += r.cacheCreate;
    proj.cost += cost;
    proj.calls++;

    // Model
    if (!modelMap.has(r.model)) {
      modelMap.set(r.model, { model: r.model, input: 0, output: 0, cacheRead: 0, cacheCreate: 0, cost: 0, calls: 0 });
    }
    const mod = modelMap.get(r.model)!;
    mod.input += r.input;
    mod.output += r.output;
    mod.cacheRead += r.cacheRead;
    mod.cacheCreate += r.cacheCreate;
    mod.cost += cost;
    mod.calls++;
  }

  // Sort projects by cost desc
  const projects = [...projectMap.values()].sort((a, b) => b.cost - a.cost);
  const models = [...modelMap.values()].sort((a, b) => b.cost - a.cost);

  return {
    date: dateStr,
    sessions: sessionPaths.size,
    totalInput,
    totalOutput,
    totalCacheRead,
    totalCacheCreate,
    totalCost,
    buckets,
    projects,
    models,
  };
}
