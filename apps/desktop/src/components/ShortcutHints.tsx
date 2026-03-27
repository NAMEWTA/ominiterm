import { useEffect, useState } from "react";
import { useT } from "../i18n/useT";
import { formatShortcut, useShortcutStore } from "../stores/shortcutStore";
import { shouldIgnoreShortcutTarget } from "../hooks/shortcutTarget";
import {
  getHintShortcutDefinitions,
} from "../shortcuts/catalog";
import {
  registerWindowKeydownListener,
  registerWindowKeyupListener,
} from "../shortcuts/listeners";
import {
  COLLAPSED_TAB_WIDTH,
  RIGHT_RAIL_WIDTH,
  useUiShellStore,
} from "../stores/uiShellStore";

const platform = window.ominiterm?.app.platform ?? "darwin";
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

    const disposeKeyDown = registerWindowKeydownListener(window, onKeyDown);
    const disposeKeyUp = registerWindowKeyupListener(window, onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      disposeKeyDown();
      disposeKeyUp();
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const hints = getHintShortcutDefinitions().map((definition) => ({
    id: definition.id,
    key: shortcuts[definition.id],
    desc: (t as unknown as Record<string, string>)[definition.labelKey],
  }));

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
          key={hint.id}
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

