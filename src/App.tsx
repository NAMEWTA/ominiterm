import { useEffect } from "react";
import { Canvas } from "./canvas/Canvas";
import { Toolbar } from "./toolbar/Toolbar";
import { Sidebar } from "./components/Sidebar";
import { NotificationToast } from "./components/NotificationToast";
import { useProjectStore } from "./stores/projectStore";
import { useCanvasStore } from "./stores/canvasStore";
import { useDrawingStore } from "./stores/drawingStore";
import { serializeAllTerminals } from "./terminal/terminalRegistry";

function useWorktreeWatcher() {
  const { projects, syncWorktrees } = useProjectStore();

  useEffect(() => {
    if (!window.termcanvas) return;

    for (const p of projects) {
      window.termcanvas.project.watch(p.path);
    }

    const unsubscribe = window.termcanvas.project.onWorktreesChanged(
      (dirPath, worktrees) => {
        syncWorktrees(dirPath, worktrees);
      },
    );

    return () => {
      unsubscribe();
      for (const p of projects) {
        window.termcanvas.project.unwatch(p.path);
      }
    };
  }, [projects.length]);
}

function useStatePersistence() {
  const { setProjects } = useProjectStore();
  const { setViewport } = useCanvasStore();

  // Load state on mount
  useEffect(() => {
    if (!window.termcanvas) return;

    window.termcanvas.state.load().then((saved) => {
      if (!saved) return;
      const state = saved as {
        viewport?: { x: number; y: number; scale: number };
        projects?: unknown[];
        drawings?: unknown[];
      };

      if (state.viewport) {
        setViewport(state.viewport);
      }
      if (state.projects && Array.isArray(state.projects)) {
        setProjects(
          state.projects as ReturnType<
            typeof useProjectStore.getState
          >["projects"],
        );
      }
      if (state.drawings && Array.isArray(state.drawings)) {
        useDrawingStore.setState({
          elements: state.drawings as ReturnType<
            typeof useDrawingStore.getState
          >["elements"],
        });
      }
    });
  }, []);

  // Save state on beforeunload
  useEffect(() => {
    if (!window.termcanvas) return;

    const save = () => {
      // Snapshot scrollback from all live terminals
      const scrollbacks = serializeAllTerminals();
      const projects = useProjectStore.getState().projects.map((p) => ({
        ...p,
        worktrees: p.worktrees.map((wt) => ({
          ...wt,
          terminals: wt.terminals.map((t) => ({
            ...t,
            scrollback: scrollbacks[t.id] ?? t.scrollback ?? undefined,
            ptyId: null, // PTY sessions can't persist
          })),
        })),
      }));

      const state = {
        viewport: useCanvasStore.getState().viewport,
        projects,
        drawings: useDrawingStore.getState().elements,
      };

      window.termcanvas.state.save(state);
    };

    window.addEventListener("beforeunload", save);
    return () => window.removeEventListener("beforeunload", save);
  }, []);
}

export function App() {
  useWorktreeWatcher();
  useStatePersistence();

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0a0a] text-[#ededed]">
      <Toolbar />
      <Sidebar />
      <Canvas />
      <NotificationToast />
    </div>
  );
}
