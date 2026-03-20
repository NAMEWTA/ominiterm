# Claude Code Quota Display — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show Claude Code's real-time 5-hour and 7-day rate limit utilization in the UsagePanel, with adaptive fetch driven by local usage activity.

**Architecture:** New `quota-fetcher.ts` in main process reads OAuth token from macOS Keychain and calls Anthropic's usage API. A new `quotaStore.ts` manages state and adaptive polling (triggered by local cost changes, not fixed intervals). A `QuotaSection` component renders in UsagePanel above the date-dependent content.

**Tech Stack:** Electron IPC, Zustand, React, macOS `security` CLI, Anthropic OAuth API

---

### Task 1: Types and API contract

**Files:**
- Modify: `src/types/index.ts:263` (after `usage` block, before `app`)

**Step 1: Add QuotaData type and extend TermCanvasAPI**

In `src/types/index.ts`, add `QuotaData` interface before `TermCanvasAPI`, and add `quota` to `TermCanvasAPI`:

```typescript
// After UsageSummary interface (around line 166), add:
export interface QuotaData {
  fiveHour: { utilization: number; resetsAt: string };
  sevenDay: { utilization: number; resetsAt: string };
  fetchedAt: number;
}

export type QuotaFetchResult =
  | { ok: true; data: QuotaData }
  | { ok: false; rateLimited: boolean };
```

In `TermCanvasAPI`, after the `usage` block (line 263) and before `app` (line 264), add:

```typescript
  quota: {
    fetch: () => Promise<QuotaFetchResult>;
  };
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(quota): add QuotaData type and API contract"
```

---

### Task 2: Main process quota fetcher

**Files:**
- Create: `electron/quota-fetcher.ts`

**Step 1: Create quota-fetcher.ts**

```typescript
import { execSync } from "child_process";
import https from "https";

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

function getOAuthToken(): string | null {
  try {
    const raw = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w',
      { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    const parsed = JSON.parse(raw);
    // Token may be nested: { default: { ... accessToken } } or flat { accessToken }
    const creds = parsed.default ?? parsed;
    return creds.accessToken ?? creds.access_token ?? null;
  } catch {
    return null;
  }
}

function fetchUsageApi(token: string): Promise<QuotaFetchResult> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/api/oauth/usage",
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "anthropic-beta": "oauth-2025-04-20",
        },
        timeout: 10000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => (body += chunk.toString()));
        res.on("end", () => {
          if (res.statusCode === 429) {
            resolve({ ok: false, rateLimited: true });
            return;
          }
          if (res.statusCode !== 200) {
            resolve({ ok: false, rateLimited: false });
            return;
          }
          try {
            const json: QuotaApiResponse = JSON.parse(body);
            resolve({
              ok: true,
              data: {
                fiveHour: {
                  utilization: json.five_hour.utilization,
                  resetsAt: json.five_hour.resets_at,
                },
                sevenDay: {
                  utilization: json.seven_day.utilization,
                  resetsAt: json.seven_day.resets_at,
                },
                fetchedAt: Date.now(),
              },
            });
          } catch {
            resolve({ ok: false, rateLimited: false });
          }
        });
      },
    );
    req.on("error", () => resolve({ ok: false, rateLimited: false }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, rateLimited: false });
    });
    req.end();
  });
}

export async function fetchQuota(): Promise<QuotaFetchResult> {
  const token = getOAuthToken();
  if (!token) return { ok: false, rateLimited: false };
  return fetchUsageApi(token);
}
```

**Step 2: Commit**

```bash
git add electron/quota-fetcher.ts
git commit -m "feat(quota): add main process quota fetcher with Keychain + API"
```

---

### Task 3: IPC handler and preload bridge

**Files:**
- Modify: `electron/main.ts:639` (after `usage:heatmap` handler)
- Modify: `electron/preload.ts:155` (after `usage` block)

**Step 1: Add IPC handler in main.ts**

After line 639 (`ipcMain.handle("usage:heatmap", ...)`), add:

```typescript
  ipcMain.handle("quota:fetch", async () => {
    const { fetchQuota } = await import("./quota-fetcher");
    return fetchQuota();
  });
```

Use dynamic import like the existing `insights:generate` handler pattern.

**Step 2: Add preload bridge**

In `electron/preload.ts`, after the `usage` block (line 155, after the closing `},`), add:

```typescript
  quota: {
    fetch: () => ipcRenderer.invoke("quota:fetch"),
  },
```

**Step 3: Commit**

```bash
git add electron/main.ts electron/preload.ts
git commit -m "feat(quota): wire IPC handler and preload bridge"
```

---

### Task 4: Quota store with adaptive polling

**Files:**
- Create: `src/stores/quotaStore.ts`

**Step 1: Create the store**

```typescript
import { create } from "zustand";
import type { QuotaData } from "../types";

const MIN_COOLDOWN = 10 * 60_000;  // 10 minutes
const MAX_COOLDOWN = 40 * 60_000;  // 40 minutes

interface QuotaStore {
  quota: QuotaData | null;
  loading: boolean;
  error: "rate_limited" | "unavailable" | null;

  // Adaptive polling internals
  lastFetchAt: number;
  cooldownMs: number;
  pendingRefresh: boolean;
  lastObservedCost: number;
  _cooldownTimer: ReturnType<typeof setTimeout> | null;

  fetch: () => Promise<void>;
  onCostChanged: (newCost: number) => void;
}

export const useQuotaStore = create<QuotaStore>((set, get) => ({
  quota: null,
  loading: false,
  error: null,
  lastFetchAt: 0,
  cooldownMs: MIN_COOLDOWN,
  pendingRefresh: false,
  lastObservedCost: 0,
  _cooldownTimer: null,

  fetch: async () => {
    if (get().loading) return;
    if (!window.termcanvas?.quota) return;

    set({ loading: true });

    try {
      const result = await window.termcanvas.quota.fetch();
      if (result.ok) {
        set({
          quota: result.data,
          loading: false,
          error: null,
          lastFetchAt: Date.now(),
          cooldownMs: MIN_COOLDOWN,
          pendingRefresh: false,
        });
      } else if (result.rateLimited) {
        set((s) => ({
          loading: false,
          error: "rate_limited",
          lastFetchAt: Date.now(),
          cooldownMs: Math.min(s.cooldownMs * 2, MAX_COOLDOWN),
          pendingRefresh: false,
        }));
      } else {
        set({
          loading: false,
          error: "unavailable",
          pendingRefresh: false,
        });
      }
    } catch {
      set({ loading: false, error: "unavailable", pendingRefresh: false });
    }
  },

  onCostChanged: (newCost: number) => {
    const state = get();
    if (newCost <= state.lastObservedCost) {
      set({ lastObservedCost: newCost });
      return;
    }

    // Cost increased — activity detected
    set({ lastObservedCost: newCost });

    const elapsed = Date.now() - state.lastFetchAt;
    if (elapsed >= state.cooldownMs) {
      // Cooldown expired, fetch now
      get().fetch();
    } else if (!state.pendingRefresh) {
      // Schedule fetch at cooldown expiry
      set({ pendingRefresh: true });
      const remaining = state.cooldownMs - elapsed;
      if (state._cooldownTimer) clearTimeout(state._cooldownTimer);
      const timer = setTimeout(() => {
        set({ _cooldownTimer: null });
        get().fetch();
      }, remaining);
      set({ _cooldownTimer: timer });
    }
  },
}));
```

**Step 2: Commit**

```bash
git add src/stores/quotaStore.ts
git commit -m "feat(quota): add quotaStore with trigger-based adaptive polling"
```

---

### Task 5: i18n keys

**Files:**
- Modify: `src/i18n/en.ts:251` (after `usage_heatmap_error`)
- Modify: `src/i18n/zh.ts:249` (after `usage_heatmap_error`)

**Step 1: Add English keys**

After line 251 (`usage_heatmap_error: "Failed to load heatmap",`), add:

```typescript
  usage_quota: "Claude Quota",
  usage_quota_5h: "5h",
  usage_quota_7d: "7d",
  usage_quota_resets: "resets",
```

**Step 2: Add Chinese keys**

After line 249 (`usage_heatmap_error: "热力图加载失败",`), add:

```typescript
  usage_quota: "Claude 额度",
  usage_quota_5h: "5h",
  usage_quota_7d: "7d",
  usage_quota_resets: "重置",
```

**Step 3: Commit**

```bash
git add src/i18n/en.ts src/i18n/zh.ts
git commit -m "feat(quota): add i18n keys for quota section"
```

---

### Task 6: QuotaSection component

**Files:**
- Create: `src/components/usage/QuotaSection.tsx`

**Step 1: Create the component**

```tsx
import { useState, useEffect, useRef } from "react";
import { useQuotaStore } from "../../stores/quotaStore";
import { useT } from "../../i18n/useT";

function formatCountdown(resetsAt: string): string {
  const diff = new Date(resetsAt).getTime() - Date.now();
  if (diff <= 0) return "now";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}d ${rh}h`;
  }
  return `${h}:${String(m).padStart(2, "0")}:${String(Math.floor((diff % 60_000) / 1000)).padStart(2, "0")}`;
}

function barColor(utilization: number): string {
  if (utilization > 0.8) return "#ef4444";
  if (utilization > 0.5) return "#eab308";
  return "#22c55e";
}

function QuotaBar({ utilization }: { utilization: number }) {
  const pct = Math.max(0, Math.min(100, utilization * 100));
  return (
    <div className="h-1.5 rounded-full bg-[var(--border)] flex-1 min-w-0 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          backgroundColor: barColor(utilization),
          transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </div>
  );
}

export function QuotaSection() {
  const { quota, loading, error } = useQuotaStore();
  const t = useT();
  const [, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  // Update countdown every 30 seconds
  useEffect(() => {
    if (!quota) return;
    intervalRef.current = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [quota]);

  // Don't render if no token / never loaded
  if (!quota && !loading) return null;

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
          {t.usage_quota}
        </span>
        {error === "rate_limited" && (
          <span className="text-[10px] text-[var(--text-faint)]" title="Rate limited, showing cached data">
            &#9203;
          </span>
        )}
      </div>

      {loading && !quota ? (
        <div className="mt-2 text-[10px] text-[var(--text-faint)]">{t.loading}</div>
      ) : quota ? (
        <div className="mt-2 flex flex-col gap-2">
          {/* 5-hour */}
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] text-[var(--text-muted)] w-6 shrink-0 tabular-nums"
                style={{ fontFamily: '"Geist Mono", monospace' }}
              >
                {t.usage_quota_5h}
              </span>
              <QuotaBar utilization={quota.fiveHour.utilization} />
              <span
                className="text-[10px] text-[var(--text-muted)] shrink-0 w-8 text-right tabular-nums"
                style={{ fontFamily: '"Geist Mono", monospace' }}
              >
                {Math.round(quota.fiveHour.utilization * 100)}%
              </span>
            </div>
            <div
              className="text-[9px] text-[var(--text-faint)] mt-0.5 tabular-nums"
              style={{ fontFamily: '"Geist Mono", monospace', paddingLeft: 32 }}
            >
              {t.usage_quota_resets} {formatCountdown(quota.fiveHour.resetsAt)}
            </div>
          </div>

          {/* 7-day */}
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] text-[var(--text-muted)] w-6 shrink-0 tabular-nums"
                style={{ fontFamily: '"Geist Mono", monospace' }}
              >
                {t.usage_quota_7d}
              </span>
              <QuotaBar utilization={quota.sevenDay.utilization} />
              <span
                className="text-[10px] text-[var(--text-muted)] shrink-0 w-8 text-right tabular-nums"
                style={{ fontFamily: '"Geist Mono", monospace' }}
              >
                {Math.round(quota.sevenDay.utilization * 100)}%
              </span>
            </div>
            <div
              className="text-[9px] text-[var(--text-faint)] mt-0.5 tabular-nums"
              style={{ fontFamily: '"Geist Mono", monospace', paddingLeft: 32 }}
            >
              {t.usage_quota_resets} {formatCountdown(quota.sevenDay.resetsAt)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/usage/QuotaSection.tsx
git commit -m "feat(quota): add QuotaSection component with bars and countdown"
```

---

### Task 7: Wire into UsagePanel

**Files:**
- Modify: `src/components/UsagePanel.tsx`

**Step 1: Add imports**

At the top of `UsagePanel.tsx`, add:

```typescript
import { QuotaSection } from "./usage/QuotaSection";
import { useQuotaStore } from "../stores/quotaStore";
```

**Step 2: Wire quota store in the UsagePanel component**

Inside `UsagePanel()` function, after `const t = useT();` (line 514), add:

```typescript
  const quotaFetch = useQuotaStore((s) => s.fetch);
  const quotaOnCostChanged = useQuotaStore((s) => s.onCostChanged);
```

**Step 3: Initial quota fetch on panel expand**

In the existing `useEffect` that handles polling (lines 529-535), add quota initial fetch. Modify the effect to:

```typescript
  useEffect(() => {
    if (collapsed) return;
    fetchUsage();
    fetchHeatmap();
    quotaFetch();
    const interval = setInterval(() => fetchUsage(), 60_000);
    return () => clearInterval(interval);
  }, [collapsed]);
```

**Step 4: Bridge cost changes to quotaStore**

After the polling `useEffect`, add a new effect:

```typescript
  useEffect(() => {
    if (summary) {
      quotaOnCostChanged(summary.totalCost);
    }
  }, [summary?.totalCost]);
```

**Step 5: Render QuotaSection**

In the JSX, place QuotaSection between the header `DateNavigator` and the scrollable content `<div className="flex-1 min-h-0 overflow-y-auto">`. The QuotaSection should be outside the scroll container so it stays fixed:

Replace the expanded panel section (starting around line 569) so the structure becomes:

```tsx
        {/* Header with date navigation */}
        <DateNavigator
          date={date}
          cachedDates={cachedDates}
          onDateChange={handleDateChange}
          onCollapse={() => setCollapsed(true)}
        />

        {/* Quota — fixed, not affected by date or scroll */}
        <QuotaSection />
        <div className="mx-3 h-px bg-[var(--border)]" />

        {/* Content — scrollable, date-dependent */}
        <div className="flex-1 min-h-0 overflow-y-auto">
```

**Step 6: Commit**

```bash
git add src/components/UsagePanel.tsx
git commit -m "feat(quota): integrate QuotaSection into UsagePanel with adaptive polling bridge"
```

---

### Task 8: Build verification

**Step 1: Run the TypeScript build**

```bash
npm run build
```

Expected: no type errors.

**Step 2: Manual test**

Launch the app. Open the right panel. If you have Claude Code installed and authenticated:
- QuotaSection should appear at the top showing 5h and 7d bars
- Countdown should tick
- Use a Claude terminal to trigger cost increase → quota should refresh after cooldown

If no Claude Code token, QuotaSection should be hidden (not rendered).

**Step 3: Commit any fixes if needed**
