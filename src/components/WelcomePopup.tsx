import { useEffect, useRef } from "react";
import { useT } from "../i18n/useT";
import { useShortcutStore, formatShortcut } from "../stores/shortcutStore";

const isMac = (window.termcanvas?.app.platform ?? "darwin") === "darwin";

interface Props {
  onClose: () => void;
}

export function WelcomePopup({ onClose }: Props) {
  const t = useT();
  const shortcuts = useShortcutStore((s) => s.shortcuts);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const shortcutItems = [
    { key: shortcuts.addProject, desc: t.shortcut_add_project },
    { key: shortcuts.newTerminal, desc: t.shortcut_new_terminal },
    { key: shortcuts.toggleSidebar, desc: t.shortcut_toggle_sidebar },
    { key: shortcuts.clearFocus, desc: t.shortcut_clear_focus },
  ];

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div
        className="rounded-md bg-[var(--bg)] overflow-hidden flex flex-col border border-[var(--border)] w-[480px] mx-4 shadow-2xl"
        style={{ fontFamily: '"Geist Mono", monospace' }}
      >
        {/* Title bar — matches TerminalTile chrome */}
        <div className="flex items-center gap-2 px-3 py-2 select-none shrink-0">
          <div className="w-[3px] h-3 rounded-full bg-amber-500/60 shrink-0" />
          <span
            className="text-[11px] font-medium"
            style={{ color: "#50e3c2" }}
          >
            welcome
          </span>
          <span className="text-[11px] text-[var(--text-muted)] truncate flex-1">
            {t.welcome_title}
          </span>
          <button
            className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors duration-150 p-1 rounded-md hover:bg-[var(--border)]"
            onClick={onClose}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M2 2L8 8M8 2L2 8"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Terminal-style content */}
        <div className="px-4 pb-5 pt-1 text-[13px] text-[var(--text-primary)] leading-relaxed">
          <div className="text-[var(--text-muted)] mb-3">
            $ cat welcome.txt
          </div>

          {/* Product intro */}
          <div className="mb-4">
            <div className="font-medium">{t.welcome_heading}</div>
            <div className="text-[var(--text-secondary)]">
              {t.welcome_desc}
            </div>
          </div>

          {/* Quick start */}
          <div className="mb-4">
            <div className="text-[var(--cyan)] mb-1">{t.welcome_quick_start}</div>
            <div className="text-[var(--text-secondary)] space-y-0.5 pl-2">
              <div>1. {t.welcome_step_1}</div>
              <div>2. {t.welcome_step_2}</div>
              <div>3. {t.welcome_step_3}</div>
            </div>
          </div>

          {/* Shortcuts */}
          <div className="mb-4">
            <div className="text-[var(--cyan)] mb-1">{t.welcome_shortcuts}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pl-2">
              {shortcutItems.map((item) => (
                <div key={item.key} className="flex gap-2">
                  <span className="text-[var(--accent)] shrink-0">
                    {formatShortcut(item.key, isMac)}
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {item.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* GitHub link */}
          <div className="mb-4 text-[var(--text-secondary)]">
            {t.welcome_github}{" "}
            <span className="text-[var(--accent)]">
              github.com/blueberrycongee/termcanvas
            </span>
          </div>

          {/* Dismiss hint */}
          <div className="text-[var(--text-muted)] text-[12px]">
            {t.welcome_dismiss}
          </div>
        </div>
      </div>
    </div>
  );
}
