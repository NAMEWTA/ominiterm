import { useCallback, useRef } from "react";
import type { ProjectData } from "../types";
import { useProjectStore } from "../stores/projectStore";
import { WorktreeContainer } from "./WorktreeContainer";

interface Props {
  project: ProjectData;
}

export function ProjectContainer({ project }: Props) {
  const { updateProjectPosition, toggleProjectCollapse, removeProject } =
    useProjectStore();
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: project.position.x,
        origY: project.position.y,
      };

      const handleMove = (moveEvent: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = moveEvent.clientX - dragRef.current.startX;
        const dy = moveEvent.clientY - dragRef.current.startY;
        updateProjectPosition(
          project.id,
          dragRef.current.origX + dx,
          dragRef.current.origY + dy,
        );
      };

      const handleUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [project.id, project.position, updateProjectPosition],
  );

  return (
    <div
      className="absolute glass rounded-2xl min-w-[240px] glow-blue"
      style={{
        left: project.position.x,
        top: project.position.y,
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 cursor-grab active:cursor-grabbing select-none border-b border-white/[0.06]"
        onMouseDown={handleMouseDown}
        onDoubleClick={() => toggleProjectCollapse(project.id)}
      >
        <div className="drag-dots shrink-0 opacity-40" />
        <span className="type-pill bg-blue-500/20 text-blue-300">Project</span>
        <span className="text-[13px] font-medium text-zinc-200 truncate">
          {project.name}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded hover:bg-white/[0.06]"
            onClick={(e) => {
              e.stopPropagation();
              toggleProjectCollapse(project.id);
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className={`transition-transform ${project.collapsed ? "-rotate-90" : ""}`}
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
            className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-white/[0.06]"
            onClick={(e) => {
              e.stopPropagation();
              removeProject(project.id);
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M3 3L9 9M9 3L3 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Worktrees */}
      {!project.collapsed && (
        <div className="p-3 flex flex-col gap-3">
          {project.worktrees.map((worktree) => (
            <WorktreeContainer
              key={worktree.id}
              projectId={project.id}
              worktree={worktree}
            />
          ))}
        </div>
      )}
    </div>
  );
}
