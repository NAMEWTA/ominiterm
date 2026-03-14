import { useCallback } from "react";
import type { WorktreeData } from "../types";
import { useProjectStore, createTerminal } from "../stores/projectStore";
import { TerminalTile } from "../terminal/TerminalTile";
import { useResize } from "../hooks/useResize";

interface Props {
  projectId: string;
  worktree: WorktreeData;
}

export function WorktreeContainer({ projectId, worktree }: Props) {
  const { toggleWorktreeCollapse, addTerminal, updateWorktreeSize } =
    useProjectStore();

  const handleNewTerminal = useCallback(() => {
    const terminal = createTerminal("shell");
    addTerminal(projectId, worktree.id, terminal);
  }, [projectId, worktree.id, addTerminal]);

  const handleResize = useResize(
    worktree.size.w,
    worktree.size.h,
    useCallback(
      (w: number, h: number) =>
        updateWorktreeSize(projectId, worktree.id, w, h),
      [projectId, worktree.id, updateWorktreeSize],
    ),
  );

  return (
    <div
      className="relative glass-subtle rounded-xl glow-green"
      style={{
        width: worktree.size.w > 0 ? worktree.size.w : undefined,
        minWidth: 200,
        height: worktree.size.h > 0 ? worktree.size.h : undefined,
      }}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-2 select-none border-b border-white/[0.04]">
        <span className="type-pill bg-green-500/15 text-green-400">WT</span>
        <span className="text-xs text-zinc-300 truncate font-medium">
          {worktree.name}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded hover:bg-white/[0.06]"
            onClick={() => toggleWorktreeCollapse(projectId, worktree.id)}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 12 12"
              fill="none"
              className={`transition-transform ${worktree.collapsed ? "-rotate-90" : ""}`}
            >
              <path
                d="M3 4.5L6 7.5L9 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className="text-zinc-500 hover:text-green-400 transition-colors p-1 rounded hover:bg-white/[0.06]"
            onClick={handleNewTerminal}
            title="New terminal"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 2V10M2 6H10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Terminals */}
      {!worktree.collapsed && (
        <div className="p-2.5 flex flex-col gap-2 overflow-auto">
          {worktree.terminals.map((terminal) => (
            <TerminalTile
              key={terminal.id}
              projectId={projectId}
              worktreeId={worktree.id}
              worktreePath={worktree.path}
              terminal={terminal}
            />
          ))}
          {worktree.terminals.length === 0 && (
            <button
              className="w-full py-8 rounded-lg border border-dashed border-white/[0.06] text-zinc-600 text-xs hover:border-white/[0.12] hover:text-zinc-400 transition-all"
              onClick={handleNewTerminal}
            >
              + New Terminal
            </button>
          )}
        </div>
      )}

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize opacity-0 hover:opacity-100 transition-opacity"
        onMouseDown={handleResize}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className="text-zinc-600"
        >
          <path
            d="M11 11L6 11M11 11L11 6"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
