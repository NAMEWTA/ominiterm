import { useState, useEffect, useCallback } from "react";
import { marked } from "marked";
import type { UpdateEventInfo } from "../types";

export function UpdateModal() {
  const [updateInfo, setUpdateEventInfo] = useState<UpdateEventInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const cleanups: (() => void)[] = [];

    cleanups.push(
      window.termcanvas.updater.onUpdateAvailable((info) => {
        setUpdateEventInfo(info);
        setDownloadProgress(0);
      }),
    );

    cleanups.push(
      window.termcanvas.updater.onDownloadProgress((progress) => {
        setDownloadProgress(progress.percent);
      }),
    );

    cleanups.push(
      window.termcanvas.updater.onUpdateDownloaded((info) => {
        setUpdateEventInfo(info);
        setDownloaded(true);
        setDownloadProgress(null);
      }),
    );

    return () => cleanups.forEach((fn) => fn());
  }, []);

  const handleInstall = useCallback(() => {
    window.termcanvas.updater.install();
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (!updateInfo || dismissed) return null;

  const notes = typeof updateInfo.releaseNotes === "string"
    ? updateInfo.releaseNotes
    : "";

  const changelogHtml = notes
    ? marked.parse(notes, { async: false }) as string
    : "";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="w-[480px] max-h-[80vh] flex flex-col rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
              Update Available
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
              v{updateInfo.version}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Changelog */}
        {changelogHtml && (
          <div className="flex-1 min-h-0 overflow-auto px-5 py-4">
            <div
              className="prose prose-sm prose-invert max-w-none text-[13px] text-[var(--text-secondary)] [&_h1]:text-[15px] [&_h2]:text-[14px] [&_h3]:text-[13px] [&_h1]:text-[var(--text-primary)] [&_h2]:text-[var(--text-primary)] [&_h3]:text-[var(--text-primary)] [&_a]:text-[var(--accent)] [&_code]:text-[var(--accent)] [&_code]:bg-[var(--bg)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_ul]:pl-4 [&_li]:my-0.5"
              dangerouslySetInnerHTML={{ __html: changelogHtml }}
            />
          </div>
        )}

        {/* Progress bar */}
        {downloadProgress !== null && (
          <div className="px-5 py-2">
            <div className="h-1.5 rounded-full bg-[var(--bg)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Downloading... {Math.round(downloadProgress)}%
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--border)]">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Later
          </button>
          {downloaded ? (
            <button
              onClick={handleInstall}
              className="px-4 py-1.5 text-[12px] font-medium text-white bg-[var(--accent)] rounded-lg hover:bg-[#005cc5] transition-colors"
            >
              Restart & Update
            </button>
          ) : (
            <span className="text-[12px] text-[var(--text-muted)]">
              Downloading...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
