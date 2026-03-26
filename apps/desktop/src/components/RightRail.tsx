import { useMemo } from "react";
import { useT } from "../i18n/useT";
import { findTerminalById, useProjectStore } from "../stores/projectStore";
import {
  COLLAPSED_TAB_WIDTH,
  RIGHT_RAIL_WIDTH,
  useUiShellStore,
} from "../stores/uiShellStore";
import { WorktreeFilesPanel } from "./WorktreeFilesPanel";
import { WorktreeDiffPanel } from "./WorktreeDiffPanel";

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

  const tabButton = (tab: "files" | "diff", label: string) => (
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
          {rightRailTab === "files" ? (
            <WorktreeFilesPanel worktreePath={contextLocation?.worktree.path ?? null} />
          ) : (
            <WorktreeDiffPanel worktreePath={contextLocation?.worktree.path ?? null} />
          )}
        </div>
      </div>
    </div>
  );
}
