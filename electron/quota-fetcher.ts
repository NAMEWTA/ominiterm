import { execSync } from "child_process";

export interface QuotaApiResponse {
  five_hour: { utilization: number; resets_at: string };
  seven_day: { utilization: number; resets_at: string };
}

export interface QuotaData {
  fiveHour: { utilization: number; resetsAt: string };
  sevenDay: { utilization: number; resetsAt: string };
  fetchedAt: number;
}

export type QuotaFetchResult =
  | { ok: true; data: QuotaData }
  | { ok: false; rateLimited: boolean };

const KEYCHAIN_TIMEOUT_MS = 5000;
const API_TIMEOUT_MS = 15000;

function getOAuthToken(): string | null {
  try {
    const raw = execSync(
      '/usr/bin/security find-generic-password -s "Claude Code-credentials" -w',
      { encoding: "utf-8", timeout: KEYCHAIN_TIMEOUT_MS, stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    const parsed = JSON.parse(raw);
    // Token may be nested under various keys: { claudeAiOauth: { accessToken } },
    // { default: { accessToken } }, or flat { accessToken }
    const creds = parsed.claudeAiOauth ?? parsed.default ?? parsed;
    return creds.accessToken ?? creds.access_token ?? null;
  } catch {
    return null;
  }
}

function fetchUsageApi(token: string): QuotaFetchResult {
  try {
    const result = execSync(
      `curl -s -w "\\n%{http_code}" -H "Authorization: Bearer ${token}" -H "anthropic-beta: oauth-2025-04-20" "https://api.anthropic.com/api/oauth/usage"`,
      { encoding: "utf-8", timeout: API_TIMEOUT_MS, stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    const lines = result.split("\n");
    const statusCode = parseInt(lines[lines.length - 1], 10);
    const body = lines.slice(0, -1).join("\n");

    if (statusCode === 429) return { ok: false, rateLimited: true };
    if (statusCode !== 200) return { ok: false, rateLimited: false };

    const json: QuotaApiResponse = JSON.parse(body);
    return {
      ok: true,
      data: {
        fiveHour: {
          utilization: json.five_hour.utilization / 100,
          resetsAt: json.five_hour.resets_at,
        },
        sevenDay: {
          utilization: json.seven_day.utilization / 100,
          resetsAt: json.seven_day.resets_at,
        },
        fetchedAt: Date.now(),
      },
    };
  } catch {
    return { ok: false, rateLimited: false };
  }
}

export async function fetchQuota(): Promise<QuotaFetchResult> {
  const token = getOAuthToken();
  if (!token) return { ok: false, rateLimited: false };
  return fetchUsageApi(token);
}
