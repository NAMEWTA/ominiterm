# Insights V2 — Cross-CLI Unified Report with Engagement Features

> Design doc for the next iteration of TermCanvas insights.
> Date: 2026-03-22

## Goals

1. **Unified report**: One report covers both Claude Code and Codex sessions. User only chooses which CLI to use as the analyzer.
2. **Full coverage**: No artificial caps on facet extraction. Analyze every eligible session within the time window.
3. **Time decay**: Recent sessions get full analysis; older sessions get progressively less AI analysis.
4. **Engaging content**: Add a "Your Coding Story" section with data-driven achievements and AI-generated narrative moments.
5. **Auto language**: Report language matches the user's primary conversation language, detected from session message samples.
6. **Re-generate UX**: Users can re-generate reports at any time without UI dead-ends.

## Pipeline Architecture

```
User clicks "Generate Insights" → selects analyzer CLI (claude/codex)
  │
  ▼  SCAN (code, ~seconds)
  Scan both ~/.claude/projects/ AND ~/.codex/sessions/ + archived_sessions/
  Each SessionFileInfo carries cliTool: "claude" | "codex"
  │
  ▼  FILTER (code, kill garbage only)
  Remove: <2 messages, <1 min, originator=codex_exec, file-history-snapshot, self-insight
  │
  ▼  EXTRACT METRICS (code, all eligible sessions, cached)
  Parse JSONL → SessionInfo with full SessionMetrics
  Cache in session-meta/ by fingerprint [cliTool, filePath, mtimeMs, fileSize]
  │
  ▼  TIME DECAY TIER ASSIGNMENT (code)
  0-14 days:  facetTier = "full"
  14-30 days: facetTier = "sample_50"
  30-60 days: facetTier = "sample_25"
  60-90 days: facetTier = "metrics_only"
  90+ days:   skip entirely

  For sample tiers, sort by importance score:
    importance = (messageCount * 2) + (durationMinutes) + (linesAdded / 10) + (gitCommits * 20)
  Take the top N% of each tier.
  │
  ▼  EXTRACT FACETS (AI via chosen CLI, all non-metrics_only sessions, cached)
  No hard cap. Adaptive batching:
    ≤ 100 sessions → batch 10
    100-500        → batch 15
    500+           → batch 20
  All facets cached permanently. Supports interrupt + resume.
  │
  ▼  AGGREGATE (code)
  Metrics: from ALL eligible sessions (not just facet-backed)
  Facets: from all sessions that have facets
  New: group stats by cliTool for cross-tool comparison
  New: compute daily breakdown for time-trend charts
  New: compute achievement triggers
  │
  ▼  AI SYNTHESIS (7+1+1 rounds via chosen CLI)
  Each round gets section-specific data slice (not the same blob).
  Each prompt includes 5-10 sampled user messages for language detection.
  │
  ▼  HTML REPORT (code-driven template)
  Generate self-contained HTML, open in browser.
```

## Time Decay Tiers

| Age          | Metrics | Facet Extraction | Rationale                          |
|-------------|---------|------------------|------------------------------------|
| 0-14 days   | Full    | Full             | Core analysis window               |
| 14-30 days  | Full    | Top 50% by importance | Still relevant, reduce volume |
| 30-60 days  | Full    | Top 25% by importance | Background context only       |
| 60-90 days  | Full    | None             | Stats only, no AI cost             |
| 90+ days    | Skip    | Skip             | Too old to matter                  |

Importance score for sampling: `(messageCount * 2) + durationMinutes + (linesAdded / 10) + (gitCommits * 20)`

## Report Structure

```
Header
  - Time range, tools covered, session counts, analysis coverage

Stats Grid (8 cards)
  - Sessions, Hours, Input Tokens, Output Tokens
  - Lines Added, Files Touched, Avg Assist Response, Analysis Sections

At a Glance
  - 3-4 sentence executive summary

Coverage Panel
  - Three-stage counts: scanned files, eligible sessions, facet-backed sessions
  - Per-tier breakdown, failures, deferrals

Time Trends (NEW)
  - 14-day daily activity chart (sessions, tokens, code output per day)
  - 24-hour message heatmap (from ALL sessions, not just facet-backed)

Tool Comparison (NEW)
  - CC vs Codex side-by-side: session count, success rate, token efficiency
  - Task type distribution per tool
  - Cross-tool workflow detection (same project, same day, tool switches)

Distribution Charts
  - Outcome Mix, Project Areas, Top Tools, Languages
  - Friction Signals, Response Times, Feature Usage

Deep Analysis (6 sections, each with its own data slice)
  - Project Areas
  - Interaction Style
  - What Works
  - Where Things Go Wrong
  - Actionable Suggestions (with copyable prompts)
  - On the Horizon

Your Coding Story (NEW — concentrated fun section at end)
  - Achievement Wall (code-driven, see below)
  - Memorable Moments (AI-generated, 2-3 narrative stories)

Footer
```

## Achievement System (Code-Driven)

Achievements are detected from aggregated metrics. Only triggered achievements are shown.

| Achievement      | Trigger Condition                            |
|-----------------|----------------------------------------------|
| Speed Demon     | Single day with > 30 sessions                |
| Night Owl       | > 50% messages between 22:00-06:00           |
| Early Bird      | > 40% messages between 06:00-10:00           |
| Shipping Machine| Single day with > 1000 lines or > 5 commits  |
| Marathon Runner | Any single session > 2 hours                 |
| Polyglot        | ≥ 5 programming languages used               |
| Tool Switcher   | Same project, same day, CC↔Codex switch ≥ 3  |
| Streak          | ≥ 5 consecutive active days                  |
| Token Whale     | Total tokens > 10M in the analysis window    |
| Zero Friction   | Any day with 0 tool failures                 |

Achievement rendering: card grid with icon, title, stat, and date/context.

## Memorable Moments (AI-Generated)

A dedicated AI synthesis round ("codingStory") generates 2-3 vivid narrative moments:
- One positive/impressive moment
- One funny/failure moment
- One cross-tool collaboration moment (if applicable)

The prompt requires:
- Specific dates, files, actions — not vague summaries
- Narrative style with scene-setting, not statistics
- Each moment reveals something real about the user's workflow

## Language Detection

In every AI synthesis prompt, include:
```
Detect the primary language of the sampled user messages below.
Generate ALL text output in that same language.
If the user writes in Chinese, output Chinese. If English, output English.

Sampled user messages:
{5-10 randomly selected user message snippets from sessions}
```

## Section-Specific Data Slicing

Each AI synthesis round receives DIFFERENT data:

| Round            | Stats Subset                           | Facet Filter                        |
|-----------------|----------------------------------------|-------------------------------------|
| projectAreas    | projectAreaBreakdown, goalCategories   | All facets, project_area field      |
| interactionStyle| response times, interruptions, feature usage | Diverse sample across types   |
| whatWorks       | outcomeBreakdown, toolBreakdown        | outcome = fully/mostly_achieved     |
| frictionAnalysis| frictionCounts, toolErrorBreakdown     | sessions with frictions > 0         |
| suggestions     | Full stats summary                     | Mix of successful + friction        |
| onTheHorizon    | Full stats + success patterns          | Top-performing sessions             |
| codingStory     | Daily breakdown, achievement data      | Full facets for narrative mining     |
| atAGlance       | Results from above 7 rounds            | N/A                                 |

## HTML Report Aesthetic Guidelines

The report should follow these design principles:

- Dark theme with warm accent colors (amber/gold for highlights, mint for success, rose for friction)
- Typography: serif for headings (editorial feel), sans-serif for body, monospace for stats
- Cards with subtle glassmorphism (backdrop-filter, translucent backgrounds)
- Achievement cards: use gradient borders and subtle glow effects for triggered achievements
- Memorable Moments: blockquote style with left accent border, slightly larger font
- Time trend charts: rendered as CSS/HTML (no external charting lib), clean minimal style
- Tool comparison: side-by-side columns with subtle color coding (one color per tool)
- All interactive elements (copy buttons, collapsible sections) use vanilla JS
- Report must be fully self-contained (no external resources)
- Responsive: works on mobile down to 360px width

## Filtering Rules (Garbage Only)

Sessions are ONLY filtered if they match these criteria:
- messageCount < 2
- durationMinutes < 1
- Codex session with originator = "codex_exec" and source = "exec" (self-insight CLI calls)
- Claude session type = "file-history-snapshot"
- Content matches isSelfInsightSession markers

NO other filtering. Do not filter by session size, token count, or any quality heuristic.
