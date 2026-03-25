import { useEffect, useMemo } from "react";
import { useT } from "../i18n/useT";
import { findTerminalById, useProjectStore } from "../stores/projectStore";
import {
  COLLAPSED_TAB_WIDTH,
  RIGHT_RAIL_WIDTH,
  useUiShellStore,
} from "../stores/uiShellStore";
import { useUsageStore } from "../stores/usageStore";
import { useAuthStore } from "../stores/authStore";
import { QuotaSection } from "./usage/QuotaSection";
import { SparklineChart } from "./usage/SparklineChart";
import { TokenHeatmap } from "./usage/TokenHeatmap";
import { DateNavigator } from "./usage/DateNavigator";
import { InsightsButton } from "./usage/InsightsButton";
import { LoginButton } from "./LoginButton";
import { WorktreeFilesPanel } from "./WorktreeFilesPanel";
import { WorktreeDiffPanel } from "./WorktreeDiffPanel";

function UsageRailContent() {
  const t = useT();
  const { summary, loading, date, cachedDates, fetch, fetchHeatmap } =
    useUsageStore();
  const { init } = useAuthStore();

  useEffect(() => {
    void init();
    void fetch();
  }, [fetch, init]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DateNavigator
        date={date}
        cachedDates={cachedDates}
        onDateChange={(nextDate) => void fetch(nextDate)}
        onCollapse={() => useUiShellStore.getState().setRightRailCollapsed(true)}
      />
      <QuotaSection />
      <div className="mx-3 h-px bg-[var(--border)]" />
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-1.5">
        <InsightsButton compact />
        <div className="ml-auto">
          <LoginButton />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && !summary ? (
          <div className="px-3 py-4 text-[11px] text-[var(--text-faint)]">
            {t.loading}
          </div>
        ) : summary ? (
          <>
            <div className="px-3 pt-3 pb-2">
              <div
                className="text-[24px] font-semibold text-[var(--text-primary)] tabular-nums"
                style={{ fontFamily: '"Geist Mono", monospace' }}
              >
                ${summary.totalCost.toFixed(summary.totalCost >= 1 ? 2 : 3)}
              </div>
              <div
                className="mt-1 flex gap-3 text-[11px] text-[var(--text-muted)]"
                style={{ fontFamily: '"Geist Mono", monospace' }}
              >
                <span>
                  {t.usage_sessions}: {summary.sessions}
                </span>
                <span>
                  {t.usage_output}: {summary.totalOutput}
                </span>
              </div>
            </div>
            <div className="mx-3 h-px bg-[var(--border)]" />
            <div className="px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t.usage_timeline}
              </div>
              <div className="mt-2">
                <SparklineChart
                  buckets={summary.buckets}
                  animate
                  date={summary.date}
                />
              </div>
            </div>
            <div className="mx-3 h-px bg-[var(--border)]" />
            <TokenHeatmap
              animate
              onVisible={() => void fetchHeatmap()}
            />
          </>
        ) : (
          <div className="px-3 py-4 text-[11px] text-[var(--text-faint)]">
            {t.usage_no_data}
          </div>
        )}
      </div>
    </div>
  );
}

export function RightRail() {
  const t = useT();
  const { projects } = useProjectStore();
  const {
    contentMode,
    detailTerminalId,
    rightRailCollapsed,
    rightRailTab,
    setRightRailCollapsed,
    setRightRailTab,
  } = useUiShellStore();

  const focusedTerminalId = useMemo(() => {
    for (const project of projects) {
      for (const worktree of project.worktrees) {
        const focused = worktree.terminals.find((terminal) => terminal.focused);
        if (focused) {
          return focused.id;
        }
      }
    }
    return null;
  }, [projects]);

  const contextLocation = useMemo(() => {
    const terminalId =
      contentMode === "terminalDetail" ? detailTerminalId : focusedTerminalId;
    return terminalId ? findTerminalById(projects, terminalId) : null;
  }, [contentMode, detailTerminalId, focusedTerminalId, projects]);

  const tabButton = (tab: "usage" | "files" | "diff", label: string) => (
    <button
      key={tab}
      className={`rounded-md px-2 py-1 text-[11px] transition-colors duration-150 ${
        rightRailTab === tab
          ? "bg-[var(--accent)] text-white"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      }`}
      onClick={() => setRightRailTab(tab)}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 border-l border-[var(--border)] bg-[var(--sidebar)]">
      <button
        className="flex shrink-0 flex-col items-center gap-2 pt-3 transition-[width,background-color] duration-200 hover:bg-[var(--sidebar-hover)]"
        style={{ width: rightRailCollapsed ? COLLAPSED_TAB_WIDTH : 0 }}
        onClick={() => setRightRailCollapsed(false)}
      >
        <span
          className="whitespace-nowrap text-[9px] uppercase tracking-widest text-[var(--text-muted)]"
          style={{ writingMode: "vertical-lr", fontFamily: '"Geist Mono", monospace' }}
        >
          {t.right_rail_label}
        </span>
      </button>

      <div
        className="flex min-h-0 shrink-0 flex-col overflow-hidden transition-[width] duration-200"
        style={{ width: rightRailCollapsed ? 0 : RIGHT_RAIL_WIDTH }}
      >
        <div className="flex items-center gap-1 border-b border-[var(--border)] px-3 py-2">
          <div className="flex gap-1">
            {tabButton("usage", t.usage_title)}
            {tabButton("files", t.files)}
            {tabButton("diff", t.diff)}
          </div>
          <button
            className="ml-auto rounded-md px-2 py-1 text-[11px] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            onClick={() => setRightRailCollapsed(true)}
          >
            {t.collapse}
          </button>
        </div>

        <div className="min-h-0 flex-1">
          {rightRailTab === "usage" ? (
            <UsageRailContent />
          ) : rightRailTab === "files" ? (
            <WorktreeFilesPanel worktreePath={contextLocation?.worktree.path ?? null} />
          ) : (
            <WorktreeDiffPanel worktreePath={contextLocation?.worktree.path ?? null} />
          )}
        </div>
      </div>
    </div>
  );
}
