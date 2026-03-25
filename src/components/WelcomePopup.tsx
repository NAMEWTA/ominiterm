import { formatShortcut, useShortcutStore } from "../stores/shortcutStore";
import { useT } from "../i18n/useT";

const isMac = (window.termcanvas?.app.platform ?? "darwin") === "darwin";

export function WelcomePopup({ onClose }: { onClose: () => void }) {
  const shortcuts = useShortcutStore((state) => state.shortcuts);
  const t = useT();

  const tips = [
    `${formatShortcut(shortcuts.addProject, isMac)} · ${t.shortcut_add_project}`,
    `${formatShortcut(shortcuts.newTerminal, isMac)} · ${t.shortcut_new_terminal}`,
    `${formatShortcut(shortcuts.nextTerminal, isMac)} / ${formatShortcut(shortcuts.prevTerminal, isMac)} · ${t.shortcut_next_terminal}`,
  ];

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 px-4">
      <div className="flex max-h-[min(78vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_64px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <div
              className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]"
              style={{ fontFamily: '"Geist Mono", monospace' }}
            >
              {t.welcome_title}
            </div>
            <div className="mt-1 text-[22px] font-semibold text-[var(--text-primary)]">
              {t.welcome_heading}
            </div>
          </div>
          <button
            className="rounded-md p-1 text-[var(--text-faint)] transition-colors duration-150 hover:bg-[var(--border)] hover:text-[var(--text-primary)]"
            onClick={onClose}
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

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-[1.1fr_0.9fr]">
          <div className="border-b border-[var(--border)] p-5 md:border-b-0 md:border-r">
            <div className="mb-4 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {t.welcome_desc}
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                <div className="text-[12px] font-medium text-[var(--text-primary)]">
                  {t.welcome_board_preview}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {["main", "feature/api", "agent/codex", "review"].map((name, index) => (
                  <div
                    key={name}
                    className={`rounded-xl border p-3 ${
                      index === 1
                        ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg))]"
                        : "border-[var(--border)] bg-[var(--surface)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-[3px] rounded-full bg-amber-500/60" />
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        {name}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1 text-[11px] text-[var(--text-muted)]">
                      <div>$ npm test</div>
                      <div>waiting for output…</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col p-5">
            <div className="text-[13px] font-medium text-[var(--text-primary)]">
              {t.welcome_quick_start}
            </div>
            <div className="mt-3 space-y-3 text-[13px] text-[var(--text-secondary)]">
              <div>1. {t.welcome_step_1}</div>
              <div>2. {t.welcome_step_2}</div>
              <div>3. {t.welcome_step_3}</div>
            </div>

            <div className="mt-6 text-[13px] font-medium text-[var(--text-primary)]">
              {t.welcome_shortcuts}
            </div>
            <div
              className="mt-3 space-y-2 text-[12px] text-[var(--text-secondary)]"
              style={{ fontFamily: '"Geist Mono", monospace' }}
            >
              {tips.map((tip) => (
                <div key={tip}>{tip}</div>
              ))}
            </div>

            <div className="mt-auto pt-6 text-[12px] text-[var(--text-muted)]">
              {t.welcome_dismiss}
            </div>
            <div className="mt-3">
              <button
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-white transition-all duration-150 hover:brightness-110"
                onClick={onClose}
              >
                {t.open}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
