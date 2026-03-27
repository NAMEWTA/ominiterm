import type { TerminalType } from "../../types/index";
import { useAiConfigStore } from "../../stores/aiConfigStore";

interface Props {
  type: TerminalType;
  value: string | null;
  onChange: (configId: string | null) => void;
  onNewAccount: () => void;
}

export function AccountSelector({ type, value, onChange, onNewAccount }: Props) {
  const configs = useAiConfigStore((state) => state.getConfigsByType(type));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none"
      >
        <option value="">Select account...</option>
        {configs.map((cfg) => (
          <option key={cfg.configId} value={cfg.configId}>
            {cfg.displayName || cfg.name || cfg.configId}
          </option>
        ))}
      </select>

      <button
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text-primary)]"
        onClick={onNewAccount}
        type="button"
      >
        + New Account
      </button>
    </div>
  );
}
