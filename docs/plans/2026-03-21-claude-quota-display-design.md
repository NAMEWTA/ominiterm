# Claude Code Quota Display — Design

## Goal

Show Claude Code's real-time 5-hour and 7-day rate limit utilization in the UsagePanel, fixed at the top (date-independent), with adaptive fetching driven by local usage activity.

## Architecture

### Data Flow

```
macOS Keychain (OAuth token)
  → electron/quota-fetcher.ts (fetch from Anthropic API)
  → IPC: quota:fetch
  → preload: window.termcanvas.quota.fetch()
  → quotaStore.ts (state + adaptive polling logic)
  → QuotaSection component (in UsagePanel)
```

### 1. Main Process — `electron/quota-fetcher.ts`

- Read OAuth token from macOS Keychain: `security find-generic-password -s "Claude Code-credentials" -w`, parse JSON to extract `accessToken`
- Call `GET https://api.anthropic.com/api/oauth/usage` with headers:
  - `Authorization: Bearer {accessToken}`
  - `anthropic-beta: oauth-2025-04-20`
- Return type:

```typescript
interface QuotaData {
  fiveHour: { utilization: number; resetsAt: string };  // 0.0 – 1.0
  sevenDay: { utilization: number; resetsAt: string };   // ISO timestamp
  fetchedAt: number; // Date.now()
}
```

- Error handling:
  - Token not found → return `null`
  - HTTP 429 → return `{ rateLimited: true }`
  - Other errors → return `null`

### 2. IPC + Preload

- IPC channel: `quota:fetch` → calls fetcher, returns `QuotaData | null | { rateLimited: true }`
- Preload: `window.termcanvas.quota.fetch()` → `ipcRenderer.invoke("quota:fetch")`
- Add to `TermCanvasAPI` type in `src/types/index.ts`

### 3. Store — `src/stores/quotaStore.ts`

```typescript
interface QuotaStore {
  quota: QuotaData | null;
  loading: boolean;
  error: 'rate_limited' | 'unavailable' | null;

  // Adaptive polling (internal)
  lastFetchAt: number;
  cooldownMs: number;        // default 600_000 (10 min)
  pendingRefresh: boolean;
  lastObservedCost: number;

  fetch: () => Promise<void>;
  onCostChanged: (newCost: number) => void;
}
```

**Adaptive polling logic — trigger-based, not interval-based:**

- `onCostChanged(newCost)`: called from UsagePanel when usageStore summary updates
  - If `newCost > lastObservedCost` (activity detected):
    - If elapsed since `lastFetchAt` > `cooldownMs` → immediate fetch
    - Else → set `pendingRefresh = true`, schedule fetch at cooldown expiry
  - If no change → do nothing (zero API calls when idle)
- `fetch()`:
  - On success → reset `cooldownMs` to 10 min
  - On 429 → double `cooldownMs` (cap at 40 min)
- Panel expand → initial fetch if `quota === null` or data older than 10 min
- Panel collapse → no activity

### 4. UI — `QuotaSection` component

**Position:** Fixed between DateNavigator and SummarySection, not affected by date navigation.

**Visual layout:**
```
CLAUDE QUOTA

5h   ████████░░  78%
      resets 2:31:00

7d   ██░░░░░░░░  12%
      resets 4d 3h
```

**Bar colors by utilization:**
- < 50%: green (#22c55e)
- 50–80%: yellow (#eab308)
- \> 80%: red (#ef4444)

**Reset countdown:** computed from `resetsAt`, updates every minute.

**State handling:**
- `quota === null && !loading` → don't render (no Claude Code token)
- `loading && !quota` → "Loading..."
- `error === 'rate_limited'` → show stale data with a small clock indicator
- Has data → normal display

**i18n keys:** `usage_quota`, `usage_quota_5h`, `usage_quota_7d`, `usage_quota_resets`

## Files to Create/Modify

| File | Action |
|------|--------|
| `electron/quota-fetcher.ts` | Create — Keychain + API fetch |
| `electron/main.ts` | Modify — add `quota:fetch` IPC handler |
| `electron/preload.ts` | Modify — expose `quota.fetch()` |
| `src/types/index.ts` | Modify — add `QuotaData` type + `quota` to `TermCanvasAPI` |
| `src/stores/quotaStore.ts` | Create — store with adaptive polling |
| `src/components/usage/QuotaSection.tsx` | Create — UI component |
| `src/components/UsagePanel.tsx` | Modify — mount QuotaSection, wire onCostChanged |
| `src/i18n/en.ts` | Modify — add quota keys |
| `src/i18n/zh.ts` | Modify — add quota keys |
