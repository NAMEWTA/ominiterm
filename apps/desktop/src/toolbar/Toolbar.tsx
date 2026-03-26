import { useState } from "react";
import { useThemeStore } from "../stores/themeStore";
import { useUpdaterStore } from "../stores/updaterStore";
import { useSettingsModalStore } from "../stores/settingsModalStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useUiShellStore } from "../stores/uiShellStore";
import { SettingsModal } from "../components/SettingsModal";
import { UpdateModal } from "../components/UpdateModal";
import { useT } from "../i18n/useT";
import { getWorkspaceBaseName } from "../titleHelper";

const noDrag = { WebkitAppRegion: "no-drag" } as React.CSSProperties;
const platform = window.ominiterm?.app.platform ?? "darwin";
const isMac = platform === "darwin";
const isWin = platform === "win32";

const btn =
  "px-2 py-1 rounded-lg text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] transition-colors duration-150 active:scale-[0.97]";
const controlGroup =
  "relative z-10 flex items-center gap-0.5 rounded-xl border border-[color-mix(in_srgb,var(--border)_92%,transparent)] bg-[color-mix(in_srgb,var(--surface)_74%,transparent)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

export function Toolbar({ onShowTutorial }: { onShowTutorial: () => void }) {
  const { theme, toggleTheme } = useThemeStore();
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const dirty = useWorkspaceStore((state) => state.dirty);
  const rightRailCollapsed = useUiShellStore((state) => state.rightRailCollapsed);
  const setRightRailCollapsed = useUiShellStore(
    (state) => state.setRightRailCollapsed,
  );
  const updateStatus = useUpdaterStore((state) => state.status);
  const showSettings = useSettingsModalStore((state) => state.open);
  const openSettings = useSettingsModalStore((state) => state.openSettings);
  const closeSettings = useSettingsModalStore((state) => state.closeSettings);
  const [showUpdate, setShowUpdate] = useState(false);
  const t = useT();

  const workspaceName =
    getWorkspaceBaseName(workspacePath) ?? t.toolbar_untitled_workspace;

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-50 flex h-11 items-center gap-3 overflow-hidden border-b border-[var(--border)]"
        style={
          {
            paddingLeft: 16,
            paddingRight: isWin ? 140 : 16,
            WebkitAppRegion: "drag",
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--bg) 95%, var(--surface) 5%) 0%, color-mix(in srgb, var(--bg) 98%, var(--surface) 2%) 100%)",
          } as React.CSSProperties
        }
      >
        {isMac && <div aria-hidden="true" className="w-[72px] shrink-0" />}

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-28">
          <div className="flex min-w-0 max-w-[min(44vw,420px)] items-center gap-2 rounded-full px-3 py-1">
            {dirty && (
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background:
                    "color-mix(in srgb, var(--text-secondary) 82%, transparent)",
                }}
              />
            )}
            <span
              className="min-w-0 truncate text-[12px] font-medium tracking-[0.01em] text-[var(--text-secondary)]"
              style={{
                textShadow:
                  "0 1px 0 color-mix(in srgb, var(--bg) 70%, transparent)",
              }}
            >
              {workspaceName}
            </span>
          </div>
        </div>

        <div className="flex-1" />

        <div className={controlGroup} style={noDrag}>
          <button className={btn} onClick={onShowTutorial} title={t.tutorial}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle
                cx="7"
                cy="7"
                r="5.5"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M5 5.5a2 2 0 0 1 3.9.5c0 1-1.4 1.2-1.4 2"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="7" cy="10" r="0.6" fill="currentColor" />
            </svg>
          </button>

          <button
            className={btn}
            onClick={() => setRightRailCollapsed(!rightRailCollapsed)}
            title={t.shortcut_toggle_right_panel}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect
                x="1.5"
                y="3"
                width="3"
                height="8"
                rx="0.5"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <rect
                x="5.5"
                y="5"
                width="3"
                height="6"
                rx="0.5"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <rect
                x="9.5"
                y="1"
                width="3"
                height="10"
                rx="0.5"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </button>

          <button
            className={btn}
            onClick={toggleTheme}
            title={theme === "dark" ? t.switch_to_light : t.switch_to_dark}
          >
            {theme === "dark" ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle
                  cx="7"
                  cy="7"
                  r="2.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M12.5 8.5a5.5 5.5 0 0 1-7-7 5.5 5.5 0 1 0 7 7Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>

          {updateStatus !== "idle" && (
            <button
              className={`${btn} relative`}
              onClick={() => setShowUpdate(true)}
              title={
                updateStatus === "downloading"
                  ? t.update_downloading
                  : updateStatus === "ready"
                    ? t.update_ready
                    : updateStatus === "error"
                      ? t.update_error
                      : t.update_checking
              }
            >
              {updateStatus === "downloading" ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="animate-bounce"
                >
                  <path
                    d="M7 2v8M4 7.5L7 10.5 10 7.5"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3 12h8"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
              ) : updateStatus === "ready" ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M7 12V4M4 6.5L7 3.5 10 6.5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M3 2h8"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-green-500" />
                </>
              ) : updateStatus === "error" ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M7 2L1.5 12h11L7 2Z"
                    stroke="var(--amber)"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7 6v3"
                    stroke="var(--amber)"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                  <circle cx="7" cy="10.5" r="0.6" fill="var(--amber)" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="animate-spin"
                >
                  <path
                    d="M7 1.5A5.5 5.5 0 1 1 1.5 7"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          )}

          <button className={btn} onClick={() => openSettings()} title={t.settings}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M5.7 1h2.6l.4 1.7a4.5 4.5 0 0 1 1.1.6l1.7-.5 1.3 2.2-1.3 1.2a4.5 4.5 0 0 1 0 1.2l1.3 1.2-1.3 2.3-1.7-.6a4.5 4.5 0 0 1-1.1.7L8.3 13H5.7l-.4-1.7a4.5 4.5 0 0 1-1.1-.7l-1.7.6-1.3-2.3 1.3-1.2a4.5 4.5 0 0 1 0-1.2L1.2 5.3l1.3-2.2 1.7.5a4.5 4.5 0 0 1 1.1-.6L5.7 1Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <circle
                cx="7"
                cy="7"
                r="1.8"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </button>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={closeSettings} />}
      {showUpdate && <UpdateModal onClose={() => setShowUpdate(false)} />}
    </>
  );
}

