import { useMemo } from "react";
import type { ProjectData } from "../types";
import { useT } from "../i18n/useT";
import { addProjectFromDialog } from "../projectCommands";

interface Props {
  projects: ProjectData[];
  selectedProjectId: string | null;
  hidden?: boolean;
  onSelectProject: (projectId: string) => void;
}

function countProjectTerminals(project: ProjectData) {
  return project.worktrees.reduce(
    (count, worktree) => count + worktree.terminals.length,
    0,
  );
}

export function ProjectSidebar({
  projects,
  selectedProjectId,
  hidden = false,
  onSelectProject,
}: Props) {
  const t = useT();
  const items = useMemo(
    () =>
      projects.map((project) => ({
        ...project,
        terminalCount: countProjectTerminals(project),
      })),
    [projects],
  );

  return (
    <aside
      className={`border-r border-[var(--border)] bg-[var(--sidebar)] transition-[width,opacity] duration-200 ${
        hidden ? "w-0 opacity-0 overflow-hidden" : "w-[248px] opacity-100"
      }`}
    >
      <div className="flex h-full min-h-0 flex-col">
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
                return (
                  <button
                    key={project.id}
                    className={`rounded-xl border px-3 py-3 text-left transition-colors duration-150 ${
                      selected
                        ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--sidebar))]"
                        : "border-[var(--border)] bg-transparent hover:bg-[var(--sidebar-hover)]"
                    }`}
                    onClick={() => onSelectProject(project.id)}
                  >
                    <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                      {project.name}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-[var(--text-muted)]">
                      {project.path}
                    </div>
                    <div
                      className="mt-2 flex gap-3 text-[10px] text-[var(--text-secondary)]"
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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
