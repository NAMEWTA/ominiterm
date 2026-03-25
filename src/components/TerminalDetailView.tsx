import type { ProjectData, WorktreeData, TerminalData } from "../types";
import { TerminalTile } from "../terminal/TerminalTile";

interface Props {
  project: ProjectData;
  worktree: WorktreeData;
  terminal: TerminalData;
  onBack: () => void;
}

export function TerminalDetailView({
  project,
  worktree,
  terminal,
  onBack,
}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg)]">
      <div className="min-h-0 flex-1 px-6 py-5">
        <TerminalTile
          projectId={project.id}
          worktreeId={worktree.id}
          worktreeName={worktree.name}
          worktreePath={worktree.path}
          terminal={terminal}
          mode="detail"
          className="h-full"
          onBack={onBack}
        />
      </div>
    </div>
  );
}
