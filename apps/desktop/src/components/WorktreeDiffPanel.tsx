import { useEffect, useMemo, useState } from "react";
import { useT } from "../i18n/useT";

interface FileInfo {
  name: string;
  additions: number;
  deletions: number;
  binary: boolean;
  isImage: boolean;
  imageOld: string | null;
  imageNew: string | null;
}

interface FileDiff {
  file: FileInfo;
  hunks: string[];
}

interface Props {
  worktreePath: string | null;
}

function parseDiff(raw: string, files: FileInfo[]): FileDiff[] {
  const fileMap = new Map(files.map((file) => [file.name, file]));
  const sections = raw.split(/^diff --git /m).filter(Boolean);
  const result: FileDiff[] = [];

  for (const section of sections) {
    const lines = section.split("\n");
    const header = lines[0] ?? "";
    const match = header.match(/b\/(.+)$/);
    const name = match?.[1] ?? "";
    const file = fileMap.get(name) ?? {
      name,
      additions: 0,
      deletions: 0,
      binary: false,
      isImage: false,
      imageOld: null,
      imageNew: null,
    };
    result.push({
      file,
      hunks: [lines.slice(1).join("\n")],
    });
  }

  for (const file of files) {
    if (file.binary && !result.find((entry) => entry.file.name === file.name)) {
      result.push({ file, hunks: [] });
    }
  }

  return result;
}

export function WorktreeDiffPanel({ worktreePath }: Props) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [fileDiffs, setFileDiffs] = useState<FileDiff[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!worktreePath) {
      setFileDiffs([]);
      setExpandedFiles(new Set());
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchDiff = async () => {
      setLoading(true);
      const result = await window.ominiterm.project.diff(worktreePath);
      if (cancelled) {
        return;
      }
      setFileDiffs(parseDiff(result.diff, result.files));
      setLoading(false);
    };

    void fetchDiff();
    void window.ominiterm.git.watch(worktreePath);
    const removeGitChanged = window.ominiterm.git.onChanged((changedPath) => {
      if (changedPath === worktreePath) {
        void fetchDiff();
      }
    });
    const handleFocus = () => void fetchDiff();
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      void window.ominiterm.git.unwatch(worktreePath);
      removeGitChanged();
      window.removeEventListener("focus", handleFocus);
    };
  }, [worktreePath]);

  const summary = useMemo(() => {
    return fileDiffs.reduce(
      (acc, fileDiff) => ({
        additions: acc.additions + fileDiff.file.additions,
        deletions: acc.deletions + fileDiff.file.deletions,
      }),
      { additions: 0, deletions: 0 },
    );
  }, [fileDiffs]);

  if (!worktreePath) {
    return (
      <div className="px-3 py-4 text-[11px] text-[var(--text-faint)]">
        {t.right_rail_no_terminal}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[var(--border)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {t.diff}
          </span>
          <span className="text-[11px] text-[var(--text-secondary)]">
            +{summary.additions} / -{summary.deletions}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-3 py-4 text-[11px] text-[var(--text-muted)]">
            {t.loading}
          </div>
        ) : fileDiffs.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-[var(--text-faint)]">
            {t.no_changes}
          </div>
        ) : (
          fileDiffs.map((fileDiff) => {
            const expanded = expandedFiles.has(fileDiff.file.name);
            return (
              <div key={fileDiff.file.name} className="border-b border-[var(--border)]">
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors duration-100 hover:bg-[var(--surface-hover)]"
                  onClick={() =>
                    setExpandedFiles((current) => {
                      const next = new Set(current);
                      if (next.has(fileDiff.file.name)) {
                        next.delete(fileDiff.file.name);
                      } else {
                        next.add(fileDiff.file.name);
                      }
                      return next;
                    })
                  }
                >
                  <span className="w-3 shrink-0 text-[var(--text-faint)]">
                    {expanded ? "▾" : "▸"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">
                    {fileDiff.file.name}
                  </span>
                  <span className="shrink-0 text-[var(--cyan)]">
                    +{fileDiff.file.additions}
                  </span>
                  <span className="shrink-0 text-[var(--red)]">
                    -{fileDiff.file.deletions}
                  </span>
                </button>
                {expanded && (
                  <div className="bg-[var(--bg)] px-3 py-2 text-[11px]">
                    {fileDiff.file.binary ? (
                      <div className="text-[var(--text-muted)]">
                        {t.binary_changed}
                      </div>
                    ) : fileDiff.file.isImage ? (
                      <div className="flex flex-col gap-2">
                        {fileDiff.file.imageOld && (
                          <img
                            src={fileDiff.file.imageOld}
                            alt="old"
                            className="max-h-40 rounded border border-[var(--border)] object-contain"
                          />
                        )}
                        {fileDiff.file.imageNew && (
                          <img
                            src={fileDiff.file.imageNew}
                            alt="new"
                            className="max-h-40 rounded border border-[var(--border)] object-contain"
                          />
                        )}
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap break-words leading-relaxed text-[var(--text-secondary)]">
                        {fileDiff.hunks.join("\n")}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

