import { useEffect, useState } from "react";
import { useT } from "../i18n/useT";
import { formatShortcut, useShortcutStore } from "../stores/shortcutStore";
import { shouldIgnoreShortcutTarget } from "../hooks/shortcutTarget";
import {
  COLLAPSED_TAB_WIDTH,
  RIGHT_RAIL_WIDTH,
  useUiShellStore,
} from "../stores/uiShellStore";

const platform = window.termcanvas?.app.platform ?? "darwin";
const isMac = platform === "darwin";

export function ShortcutHints() {
  const t = useT();
  const shortcuts = useShortcutStore((state) => state.shortcuts);
  const rightRailCollapsed = useUiShellStore((state) => state.rightRailCollapsed);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "?" &&
        !event.repeat &&
        !shouldIgnoreShortcutTarget(event)
      ) {
        setVisible(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "?") {
        setVisible(false);
      }
    };
    const onBlur = () => setVisible(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const hints = [
    { key: shortcuts.addProject, desc: t.shortcut_add_project },
    { key: shortcuts.toggleRightPanel, desc: t.shortcut_toggle_right_panel },
    { key: shortcuts.newTerminal, desc: t.shortcut_new_terminal },
    { key: shortcuts.renameTerminalTitle, desc: t.shortcut_rename_terminal_title },
    { key: shortcuts.closeFocused, desc: t.shortcut_close_focused },
    { key: shortcuts.toggleStarFocused, desc: t.shortcut_toggle_star_focused },
    { key: shortcuts.nextTerminal, desc: t.shortcut_next_terminal },
    { key: shortcuts.prevTerminal, desc: t.shortcut_prev_terminal },
    { key: shortcuts.saveWorkspace, desc: t.shortcut_save_workspace },
    { key: shortcuts.saveWorkspaceAs, desc: t.shortcut_save_workspace_as },
  ];

  const rightOffset =
    (rightRailCollapsed ? COLLAPSED_TAB_WIDTH : RIGHT_RAIL_WIDTH) + 16;

  return (
    <div
      className="pointer-events-none fixed z-50 flex flex-col gap-1.5 select-none transition-opacity duration-150"
      style={{
        top: 52,
        right: platform === "win32" ? rightOffset + 132 : rightOffset,
        opacity: visible ? 1 : 0,
      }}
    >
      {hints.map((hint) => (
        <div
          key={hint.key}
          className="flex items-center gap-2.5 text-[15px]"
          style={{ fontFamily: '"Geist Mono", monospace' }}
        >
          <span className="text-[var(--text-secondary)]">
            {formatShortcut(hint.key, isMac)}
          </span>
          <span className="text-[var(--text-secondary)] opacity-60">
            {hint.desc}
          </span>
        </div>
      ))}
    </div>
  );
}
