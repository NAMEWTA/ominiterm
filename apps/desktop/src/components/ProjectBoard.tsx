import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectData, TerminalType, WorktreeData } from "../types";
import { useT } from "../i18n/useT";
import { createTerminalInWorktree } from "../projectCommands";
import { TerminalTile } from "../terminal/TerminalTile";

interface Props {
  project: ProjectData | null;
  focusedWorktreeId: string | null;
  boardScrollTop: number;
  onBoardScroll: (scrollTop: number) => void;
  onOpenDetail: (terminalId: string) => void;
}

const TERMINAL_TYPES: TerminalType[] = [
  "claude",
  "codex",
  "opencode",
  "copilot",
];

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedWorktreeId, setSelectedWorktreeId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<TerminalType>("claude");

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }
    scrollRef.current.scrollTop = boardScrollTop;
  }, [boardScrollTop, project?.id]);

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
      <div className="border-b border-[var(--border)] px-6 py-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div
              className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]"
              style={{ fontFamily: '"Geist Mono", monospace' }}
            >
              {t.project_label}
            </div>
            <div className="mt-1 text-[22px] font-semibold text-[var(--text-primary)]">
              {project.name}
            </div>
            <div className="mt-1 text-[12px] text-[var(--text-muted)]">
              {project.path}
            </div>
            <div
              className="mt-2 flex gap-3 text-[11px] text-[var(--text-secondary)]"
              style={{ fontFamily: '"Geist Mono", monospace' }}
            >
              <span>
                {project.worktrees.length} {t.sidebar_worktrees}
              </span>
              <span>
                {terminals.length} {t.sidebar_terminals}
              </span>
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
              onChange={(event) => setSelectedType(event.target.value as TerminalType)}
            >
              {TERMINAL_TYPES.map((type) => (
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
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
        onScroll={(event) => onBoardScroll(event.currentTarget.scrollTop)}
      >
        {terminals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
            {t.board_empty_state}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {terminals.map(({ terminalId, worktree }) => {
              const terminal = worktree.terminals.find(
                (candidate) => candidate.id === terminalId,
              );
              if (!terminal) {
                return null;
              }
              return (
                <TerminalTile
                  key={terminal.id}
                  projectId={project.id}
                  worktreeId={worktree.id}
                  worktreeName={worktree.name}
                  worktreePath={worktree.path}
                  terminal={terminal}
                  mode="board"
                  onOpenDetail={() => onOpenDetail(terminal.id)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
