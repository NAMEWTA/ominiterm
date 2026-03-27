import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { ProjectData, TerminalStatus } from "../types";
import { useT } from "../i18n/useT";
import { addProjectFromDialog, openWorkspaceFromDialog } from "../projectCommands";
import { useProjectStore } from "../stores/projectStore";
import { PROJECT_SIDEBAR_TAB_WIDTH } from "../stores/uiShellStore";

interface Props {
  projects: ProjectData[];
  selectedProjectId: string | null;
  width: number;
  collapsed?: boolean;
  detailTerminalId?: string | null;
  onSelectProject: (projectId: string) => void;
  onOpenTerminal: (projectId: string, terminalId: string) => void;
  onResizeWidth: (width: number) => void;
  onCollapsedChange: (collapsed: boolean) => void;
}

function countProjectTerminals(project: ProjectData) {
  return project.worktrees.reduce(
    (count, worktree) => count + worktree.terminals.length,
    0,
  );
}

function getStatusDotClass(status: TerminalStatus): string {
  switch (status) {
    case "running":
    case "active":
      return "bg-[var(--green,#4ade80)]";
    case "waiting":
    case "idle":
      return "bg-[var(--amber)]";
    case "completed":
    case "success":
      return "bg-[var(--accent)]";
    case "error":
      return "bg-[var(--red)]";
    default:
      return "bg-[var(--text-muted)]";
  }
}

function getStatusLabel(t: ReturnType<typeof useT>, status: TerminalStatus): string {
  switch (status) {
    case "running":
      return t.status_running;
    case "active":
      return t.status_active;
    case "waiting":
      return t.status_waiting;
    case "completed":
      return t.status_completed;
    case "success":
      return t.status_done;
    case "error":
      return t.status_error;
    case "idle":
    default:
      return t.status_idle;
  }
}

export function ProjectSidebar({
  projects,
  selectedProjectId,
  width,
  collapsed = false,
  detailTerminalId = null,
  onSelectProject,
  onOpenTerminal,
  onResizeWidth,
  onCollapsedChange,
}: Props) {
  const t = useT();
  const removeProject = useProjectStore((state) => state.removeProject);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedWorktrees, setExpandedWorktrees] = useState<Set<string>>(new Set());
  const items = useMemo(
    () =>
      projects.map((project) => ({
        ...project,
        terminalCount: countProjectTerminals(project),
      })),
    [projects],
  );

  useEffect(() => {
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (selectedProjectId) {
        next.add(selectedProjectId);
      }
      for (const project of projects) {
        if (!current.has(project.id)) {
          next.add(project.id);
        }
      }
      return next;
    });
  }, [projects, selectedProjectId]);

  useEffect(() => {
    setExpandedWorktrees((current) => {
      const next = new Set(current);
      for (const project of projects) {
        for (const worktree of project.worktrees) {
          if (!current.has(worktree.id)) {
            next.add(worktree.id);
          }
        }
      }
      return next;
    });
  }, [projects]);

  const startResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (collapsed) {
      return;
    }
    event.preventDefault();
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: width,
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      const state = resizeStateRef.current;
      if (!state) {
        return;
      }
      const deltaX = moveEvent.clientX - state.startX;
      onResizeWidth(state.startWidth + deltaX);
    };

    const stopResize = () => {
      resizeStateRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopResize);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopResize);
  };

  return (
    <aside className="flex h-full min-h-0 border-r border-[var(--border)] bg-[var(--sidebar)]">
      <button
        className="flex shrink-0 flex-col items-center gap-2 pt-3 transition-[width,background-color] duration-200 hover:bg-[var(--sidebar-hover)]"
        style={{ width: collapsed ? PROJECT_SIDEBAR_TAB_WIDTH : 0 }}
        onClick={() => onCollapsedChange(false)}
        title={collapsed ? `${t.open} ${t.projects}` : undefined}
        aria-label={`${t.open} ${t.projects}`}
      >
        <span
          className="whitespace-nowrap text-[9px] uppercase tracking-widest text-[var(--text-muted)]"
          style={{ writingMode: "vertical-lr", fontFamily: '"Geist Mono", monospace' }}
        >
          {t.projects}
        </span>
      </button>

      <div
        className="relative flex min-h-0 shrink-0 flex-col overflow-hidden transition-[width] duration-200"
        style={{ width: collapsed ? 0 : width }}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-3">
          <div className="min-w-0 flex-1">
            <div
              className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]"
              style={{ fontFamily: '"Geist Mono", monospace' }}
            >
              {t.projects}
            </div>
          </div>
          <button
            className="rounded-md border border-[var(--border)] px-2 py-1 text-[12px] text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            onClick={() => void addProjectFromDialog(t)}
          >
            {t.add}
          </button>
          <button
            className="rounded-md border border-[var(--border)] px-2 py-1 text-[12px] text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            onClick={() => void openWorkspaceFromDialog(t)}
            title={t.shortcut_open_workspace}
          >
            {t.open_workspace}
          </button>
          <button
            className="rounded-md px-2 py-1 text-[11px] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            onClick={() => onCollapsedChange(true)}
          >
            {t.collapse}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-[12px] text-[var(--text-muted)]">
              {t.no_projects}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {items.map((project) => {
                const selected = project.id === selectedProjectId;
                const projectExpanded = expandedProjects.has(project.id);

                return (
                  <div key={project.id} className="rounded-lg border border-[var(--border)] bg-transparent">
                    <div className="flex items-start gap-1 px-2 py-2">
                      <button
                        className="mt-0.5 rounded p-1 text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                        onClick={() => {
                          setExpandedProjects((current) => {
                            const next = new Set(current);
                            if (next.has(project.id)) {
                              next.delete(project.id);
                            } else {
                              next.add(project.id);
                            }
                            return next;
                          });
                        }}
                        aria-label="Toggle project"
                      >
                        <span className="text-[10px]">{projectExpanded ? "▾" : "▸"}</span>
                      </button>

                      <button
                        className={`min-w-0 flex-1 rounded-md px-1.5 py-1 text-left transition-colors duration-150 ${
                          selected
                            ? "bg-[color-mix(in_srgb,var(--accent)_12%,var(--sidebar))]"
                            : "hover:bg-[var(--sidebar-hover)]"
                        }`}
                        onClick={() => onSelectProject(project.id)}
                      >
                        <div className="truncate text-[12px] font-medium text-[var(--text-primary)]">
                          {project.name}
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
                          {project.path}
                        </div>
                        <div
                          className="mt-1 flex gap-2 text-[10px] text-[var(--text-secondary)]"
                          style={{ fontFamily: '"Geist Mono", monospace' }}
                        >
                          <span>
                            {project.worktrees.length} {t.sidebar_worktrees}
                          </span>
                          <span>
                            {project.terminalCount} {t.sidebar_terminals}
                          </span>
                        </div>
                      </button>

                      <button
                        className="rounded-md p-1 text-[var(--text-faint)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--red)]"
                        title={t.removed}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (!window.confirm(t.confirm_delete_projects(1))) {
                            return;
                          }
                          removeProject(project.id);
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path
                            d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>

                    {projectExpanded && (
                      <div className="pb-2">
                        {project.worktrees.map((worktree) => {
                          const worktreeExpanded = expandedWorktrees.has(worktree.id);
                          return (
                            <div key={worktree.id} className="pl-5 pr-2">
                              <div className="flex items-center gap-1">
                                <button
                                  className="rounded p-1 text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                                  onClick={() => {
                                    setExpandedWorktrees((current) => {
                                      const next = new Set(current);
                                      if (next.has(worktree.id)) {
                                        next.delete(worktree.id);
                                      } else {
                                        next.add(worktree.id);
                                      }
                                      return next;
                                    });
                                  }}
                                  aria-label="Toggle worktree"
                                >
                                  <span className="text-[10px]">{worktreeExpanded ? "▾" : "▸"}</span>
                                </button>
                                <button
                                  className="min-w-0 flex-1 rounded-md px-1.5 py-1 text-left text-[11px] text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-primary)]"
                                  onClick={() => onSelectProject(project.id)}
                                >
                                  <span className="truncate">{worktree.name}</span>
                                </button>
                              </div>

                              {worktreeExpanded && (
                                <div className="mt-0.5 pl-6">
                                  {worktree.terminals.length === 0 ? (
                                    <div className="py-1 text-[10px] text-[var(--text-faint)]">
                                      {t.board_empty_state}
                                    </div>
                                  ) : (
                                    worktree.terminals.map((terminal) => {
                                      const active = detailTerminalId === terminal.id;
                                      const terminalLabel =
                                        terminal.customTitle?.trim() || terminal.title;
                                      const statusLabel = getStatusLabel(t, terminal.status);
                                      return (
                                        <button
                                          key={terminal.id}
                                          className={`mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] transition-colors duration-150 ${
                                            active
                                              ? "bg-[color-mix(in_srgb,var(--accent)_16%,var(--sidebar))] text-[var(--text-primary)]"
                                              : "text-[var(--text-secondary)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-primary)]"
                                          }`}
                                          onClick={() => onOpenTerminal(project.id, terminal.id)}
                                          title={`${terminal.title} · ${statusLabel}`}
                                        >
                                          <span
                                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                              terminal.focused
                                                ? "bg-[var(--accent)]"
                                                : "border border-[var(--border-hover)]"
                                            }`}
                                            title={terminal.focused ? "Focused" : "Not focused"}
                                          />
                                          <span
                                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${getStatusDotClass(terminal.status)}`}
                                            title={statusLabel}
                                          />
                                          <span className="min-w-0 truncate">{terminalLabel}</span>
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!collapsed && (
          <div
            className="absolute top-0 right-[-3px] h-full w-[6px] cursor-col-resize"
            onMouseDown={startResize}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize project sidebar"
          />
        )}
      </div>
    </aside>
  );
}
