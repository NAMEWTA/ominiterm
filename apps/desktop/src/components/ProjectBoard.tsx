import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { ProjectData, TerminalType, WorktreeData, SplitDirection } from "../types";
import { useT } from "../i18n/useT";
import { createTerminalInWorktree } from "../projectCommands";
import { TerminalTile } from "../terminal/TerminalTile";
import { SplitPane } from "./SplitPane";
import { useSplitLayoutStore } from "../stores/splitLayoutStore";
import {
  CREATABLE_TERMINAL_TYPES,
  DEFAULT_CREATABLE_TERMINAL_TYPE,
} from "./projectBoardOptions";
import { generateId, createTerminal } from "../stores/projectStore";
import { useProjectStore } from "../stores/projectStore";

interface Props {
  project: ProjectData | null;
  focusedWorktreeId: string | null;
  boardScrollTop: number;
  onBoardScroll: (scrollTop: number) => void;
  onOpenDetail: (terminalId: string) => void;
}

interface BoardTerminalItem {
  terminalId: string;
  worktree: WorktreeData;
}

function flattenProjectTerminals(project: ProjectData): BoardTerminalItem[] {
  return project.worktrees.flatMap((worktree) =>
    worktree.terminals.map((terminal) => ({
      terminalId: terminal.id,
      worktree,
    })),
  );
}

export function ProjectBoard({
  project,
  focusedWorktreeId,
  boardScrollTop,
  onBoardScroll,
  onOpenDetail,
}: Props) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedWorktreeId, setSelectedWorktreeId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<TerminalType>(
    DEFAULT_CREATABLE_TERMINAL_TYPE,
  );

  const { getLayout, syncWithTerminals, splitPane, updateRatio } = useSplitLayoutStore();
  const { addTerminal: addTerminalToProject } = useProjectStore();

  useEffect(() => {
    if (!project) {
      setSelectedWorktreeId(null);
      return;
    }
    const nextWorktreeId =
      (focusedWorktreeId &&
        project.worktrees.some((worktree) => worktree.id === focusedWorktreeId)
        ? focusedWorktreeId
        : null) ??
      project.worktrees[0]?.id ??
      null;
    setSelectedWorktreeId(nextWorktreeId);
  }, [focusedWorktreeId, project]);

  const terminals = useMemo(
    () => (project ? flattenProjectTerminals(project) : []),
    [project],
  );

  // Create a map for quick terminal lookup
  const terminalMap = useMemo(() => {
    const map = new Map<string, BoardTerminalItem>();
    for (const item of terminals) {
      map.set(item.terminalId, item);
    }
    return map;
  }, [terminals]);

  // Sync layout with terminals when they change
  useEffect(() => {
    if (!project) return;
    const terminalIds = terminals.map((t) => t.terminalId);
    syncWithTerminals(project.id, terminalIds);
  }, [project?.id, terminals, syncWithTerminals]);

  const layout = project ? getLayout(project.id) : { root: null };

  // Handle ratio update from divider drag
  const handleUpdateRatio = useCallback(
    (path: number[], ratio: number) => {
      if (!project) return;
      updateRatio(project.id, path, ratio);
    },
    [project, updateRatio],
  );

  // Handle split operation
  const handleSplit = useCallback(
    (terminalId: string, direction: SplitDirection, type: TerminalType) => {
      if (!project) return;
      
      // Find the worktree for this terminal
      const item = terminalMap.get(terminalId);
      if (!item) return;
      
      // Create a new terminal with the selected type
      const newTerminal = createTerminal(type);
      
      // Add the new terminal to the project store
      addTerminalToProject(project.id, item.worktree.id, newTerminal);
      
      // Split the layout at the specified terminal
      splitPane(project.id, terminalId, direction, newTerminal.id);
    },
    [project, terminalMap, addTerminalToProject, splitPane],
  );

  // Render a terminal by ID
  const renderTerminal = useCallback(
    (terminalId: string) => {
      const item = terminalMap.get(terminalId);
      if (!item) return null;
      
      const terminal = item.worktree.terminals.find((t) => t.id === terminalId);
      if (!terminal) return null;
      
      return (
        <TerminalTile
          key={terminal.id}
          projectId={project!.id}
          worktreeId={item.worktree.id}
          worktreeName={item.worktree.name}
          worktreePath={item.worktree.path}
          terminal={terminal}
          mode="board"
          onOpenDetail={() => onOpenDetail(terminal.id)}
          onSplitHorizontal={(type) => handleSplit(terminal.id, "horizontal", type)}
          onSplitVertical={(type) => handleSplit(terminal.id, "vertical", type)}
        />
      );
    },
    [project, terminalMap, onOpenDetail, handleSplit],
  );

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-[18px] font-medium text-[var(--text-primary)]">
            {t.canvas_empty_title}
          </div>
          <div className="mt-2 text-[13px] text-[var(--text-muted)]">
            {t.canvas_empty_click} {t.canvas_empty_action} {t.canvas_empty_suffix}
          </div>
        </div>
      </div>
    );
  }

  const selectedWorktree =
    project.worktrees.find((worktree) => worktree.id === selectedWorktreeId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[var(--border)] px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <div
                className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]"
                style={{ fontFamily: '"Geist Mono", monospace' }}
              >
                {t.project_label}
              </div>
              <div className="text-[16px] font-semibold text-[var(--text-primary)]">
                {project.name}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none"
              value={selectedWorktreeId ?? ""}
              onChange={(event) => setSelectedWorktreeId(event.target.value)}
            >
              {project.worktrees.map((worktree) => (
                <option key={worktree.id} value={worktree.id}>
                  {worktree.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none"
              value={selectedType}
              onChange={(event) => {
                setSelectedType(event.target.value as TerminalType);
              }}
            >
              {CREATABLE_TERMINAL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <button
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-[12px] font-medium text-white transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!selectedWorktree}
              onClick={() => {
                if (!selectedWorktree) {
                  return;
                }

                createTerminalInWorktree(
                  project.id,
                  selectedWorktree.id,
                  selectedType,
                );
              }}
            >
              {t.new_terminal}
            </button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-hidden p-1"
      >
        {terminals.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-lg border border-dashed border-[var(--border)] px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
              {t.board_empty_state}
            </div>
          </div>
        ) : layout.root ? (
          <div className="h-full w-full">
            <SplitPane
              node={layout.root}
              onUpdateRatio={handleUpdateRatio}
              renderTerminal={renderTerminal}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
