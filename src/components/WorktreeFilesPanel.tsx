import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useT } from "../i18n/useT";

interface DirEntry {
  name: string;
  isDirectory: boolean;
}

type FileContent =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "text"; content: string }
  | { status: "markdown"; content: string }
  | { status: "image"; content: string }
  | { status: "binary" }
  | { status: "error"; message: string };

interface Props {
  worktreePath: string | null;
}

function joinPath(base: string, name: string) {
  if (base.endsWith("/") || base.endsWith("\\")) {
    return `${base}${name}`;
  }
  const separator = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  return `${base}${separator}${name}`;
}

export function WorktreeFilesPanel({ worktreePath }: Props) {
  const t = useT();
  const [entries, setEntries] = useState<Map<string, DirEntry[]>>(new Map());
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [fileContent, setFileContent] = useState<FileContent>({ status: "idle" });

  useEffect(() => {
    if (!worktreePath) {
      setEntries(new Map());
      setExpandedDirs(new Set());
      setSelectedFilePath(null);
      setSelectedFileName("");
      setFileContent({ status: "idle" });
      return;
    }

    let cancelled = false;
    void window.termcanvas.fs.listDir(worktreePath).then((items) => {
      if (cancelled) {
        return;
      }
      setEntries(new Map([[worktreePath, items]]));
      setExpandedDirs(new Set());
      setSelectedFilePath(null);
      setSelectedFileName("");
      setFileContent({ status: "idle" });
    });

    return () => {
      cancelled = true;
    };
  }, [worktreePath]);

  const loadFile = useCallback(
    async (filePath: string, fileName: string) => {
      setSelectedFilePath(filePath);
      setSelectedFileName(fileName);
      setFileContent({ status: "loading" });
      const result = await window.termcanvas.fs.readFile(filePath);
      if ("error" in result) {
        if (result.error === "too-large") {
          setFileContent({
            status: "error",
            message: t.file_too_large(result.size ?? ""),
          });
          return;
        }
        setFileContent({ status: "error", message: t.file_read_error });
        return;
      }
      if (result.type === "image") {
        setFileContent({ status: "image", content: result.content });
      } else if (result.type === "binary") {
        setFileContent({ status: "binary" });
      } else if (result.type === "markdown") {
        setFileContent({ status: "markdown", content: result.content });
      } else {
        setFileContent({ status: "text", content: result.content });
      }
    },
    [t],
  );

  const toggleDir = useCallback(
    async (dirPath: string) => {
      setExpandedDirs((current) => {
        const next = new Set(current);
        if (next.has(dirPath)) {
          next.delete(dirPath);
        } else {
          next.add(dirPath);
        }
        return next;
      });

      if (!entries.has(dirPath)) {
        const items = await window.termcanvas.fs.listDir(dirPath);
        setEntries((current) => new Map(current).set(dirPath, items));
      }
    },
    [entries],
  );

  const renderEntries = useCallback(
    (dirPath: string, depth: number): ReactNode => {
      const items = entries.get(dirPath);
      if (!items) {
        return null;
      }
      if (items.length === 0) {
        return (
          <div
            className="py-1 text-[11px] text-[var(--text-muted)]"
            style={{ paddingLeft: depth * 16 + 12 }}
          >
            {t.file_empty_dir}
          </div>
        );
      }

      return items.map((entry) => {
        const fullPath = joinPath(dirPath, entry.name);
        const expanded = expandedDirs.has(fullPath);
        const selected = selectedFilePath === fullPath;
        return (
          <div key={fullPath}>
            <button
              className={`flex w-full items-center gap-2 py-1.5 pr-3 text-left text-[12px] transition-colors duration-100 ${
                selected
                  ? "bg-[var(--accent)]/12 text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              }`}
              style={{ paddingLeft: depth * 16 + 12 }}
              onClick={() =>
                entry.isDirectory
                  ? void toggleDir(fullPath)
                  : void loadFile(fullPath, entry.name)
              }
            >
              <span className="w-3 shrink-0 text-[var(--text-faint)]">
                {entry.isDirectory ? (expanded ? "▾" : "▸") : "·"}
              </span>
              <span className="truncate">{entry.name}</span>
            </button>
            {entry.isDirectory && expanded && renderEntries(fullPath, depth + 1)}
          </div>
        );
      });
    },
    [entries, expandedDirs, loadFile, selectedFilePath, t, toggleDir],
  );

  const content = useMemo(() => {
    if (fileContent.status === "loading") {
      return <div className="text-[11px] text-[var(--text-muted)]">{t.loading}</div>;
    }
    if (fileContent.status === "error") {
      return <div className="text-[11px] text-[var(--red)]">{fileContent.message}</div>;
    }
    if (fileContent.status === "binary") {
      return <div className="text-[11px] text-[var(--text-muted)]">{t.file_binary}</div>;
    }
    if (fileContent.status === "image") {
      return (
        <img
          src={fileContent.content}
          alt={selectedFileName}
          className="max-h-full w-full rounded-lg border border-[var(--border)] object-contain"
        />
      );
    }
    if (fileContent.status === "text" || fileContent.status === "markdown") {
      return (
        <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {fileContent.content}
        </pre>
      );
    }
    return <div className="text-[11px] text-[var(--text-faint)]">{t.files}</div>;
  }, [fileContent, selectedFileName, t]);

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
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {t.files}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 max-h-[45%] overflow-y-auto border-b border-[var(--border)] py-1">
          {renderEntries(worktreePath, 0)}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">{content}</div>
      </div>
    </div>
  );
}
