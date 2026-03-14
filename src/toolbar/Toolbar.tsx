import { useCallback } from "react";
import { useCanvasStore } from "../stores/canvasStore";
import { useProjectStore, generateId } from "../stores/projectStore";
import { useNotificationStore } from "../stores/notificationStore";

function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.termcanvas;
}

export function Toolbar() {
  const { viewport, setViewport, resetViewport } = useCanvasStore();
  const { addProject } = useProjectStore();
  const { notify } = useNotificationStore();

  const handleAddProject = useCallback(async () => {
    if (!isElectron()) {
      notify("error", "Not running in Electron. Cannot access native APIs.");
      return;
    }

    let dirPath: string | null;
    try {
      dirPath = await window.termcanvas.project.selectDirectory();
    } catch (err) {
      notify("error", `Failed to open directory picker: ${err}`);
      return;
    }

    if (!dirPath) return;

    let info: Awaited<ReturnType<typeof window.termcanvas.project.scan>>;
    try {
      info = await window.termcanvas.project.scan(dirPath);
    } catch (err) {
      notify("error", `Failed to scan project: ${err}`);
      return;
    }

    if (!info) {
      notify("warn", `"${dirPath}" is not a git repository.`);
      return;
    }

    addProject({
      id: generateId(),
      name: info.name,
      path: info.path,
      position: { x: 100 - viewport.x, y: 100 - viewport.y },
      collapsed: false,
      worktrees: info.worktrees.map((wt) => ({
        id: generateId(),
        name: wt.branch,
        path: wt.path,
        position: { x: 0, y: 0 },
        collapsed: false,
        terminals: [],
      })),
    });

    notify(
      "info",
      `Added project "${info.name}" with ${info.worktrees.length} worktree(s).`,
    );
  }, [addProject, viewport, notify]);

  const zoomPercent = Math.round(viewport.scale * 100);

  return (
    <div className="fixed top-0 left-0 right-0 h-11 glass-toolbar flex items-center px-4 gap-4 z-50">
      {/* App branding */}
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-blue-400 to-violet-500" />
        <span className="text-[13px] font-semibold tracking-tight text-zinc-200">
          TermCanvas
        </span>
      </div>

      <div className="h-4 w-px bg-white/[0.06]" />

      {/* Actions */}
      <button className="btn-glass" onClick={handleAddProject}>
        + Add Project
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg border border-white/[0.06] px-1">
        <button
          className="text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 text-xs"
          onClick={() =>
            setViewport({ scale: Math.max(0.1, viewport.scale * 0.9) })
          }
        >
          −
        </button>
        <span className="text-[11px] text-zinc-500 w-10 text-center tabular-nums font-mono">
          {zoomPercent}%
        </span>
        <button
          className="text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 text-xs"
          onClick={() =>
            setViewport({ scale: Math.min(2, viewport.scale * 1.1) })
          }
        >
          +
        </button>
        <div className="h-3 w-px bg-white/[0.06]" />
        <button
          className="text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 text-[11px]"
          onClick={resetViewport}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
