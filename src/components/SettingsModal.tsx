import { useLocaleStore } from "../stores/localeStore";
import { useThemeStore } from "../stores/themeStore";
import { useT } from "../i18n/useT";

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const { locale, setLocale } = useLocaleStore();
  const { theme, toggleTheme } = useThemeStore();
  const t = useT();

  const toggleBtn =
    "px-3 py-1.5 rounded-md text-[13px] transition-colors duration-150";
  const activeBtn = `${toggleBtn} bg-[var(--border)] text-[var(--text-primary)]`;
  const inactiveBtn = `${toggleBtn} text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 max-w-xs w-full mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-medium text-[var(--text-primary)]">
            {t.settings}
          </h2>
          <button
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-150 p-0.5"
            onClick={onClose}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Language row */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] text-[var(--text-secondary)]">
            {t.language}
          </span>
          <div className="flex gap-1">
            <button
              className={locale === "zh" ? activeBtn : inactiveBtn}
              onClick={() => setLocale("zh")}
            >
              中文
            </button>
            <button
              className={locale === "en" ? activeBtn : inactiveBtn}
              onClick={() => setLocale("en")}
            >
              English
            </button>
          </div>
        </div>

        {/* Theme row */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[var(--text-secondary)]">
            {t.theme}
          </span>
          <div className="flex gap-1">
            <button
              className={theme === "dark" ? activeBtn : inactiveBtn}
              onClick={() => theme !== "dark" && toggleTheme()}
            >
              ☾ Dark
            </button>
            <button
              className={theme === "light" ? activeBtn : inactiveBtn}
              onClick={() => theme !== "light" && toggleTheme()}
            >
              ☀ Light
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
