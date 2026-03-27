import { useMemo } from "react";
import type { TerminalType } from "../../types/index";
import { useAiConfigStore } from "../../stores/aiConfigStore";

interface Props {
  type: TerminalType;
  value: string | null;
  onChange: (configId: string | null) => void;
  onNewAccount: () => void;
  onDeleteAccount: () => void;
  onSetDefaultAccount?: () => void;
}

export function AccountSelector({
  type,
  value,
  onChange,
  onNewAccount,
  onDeleteAccount,
  onSetDefaultAccount,
}: Props) {
  const configsMap = useAiConfigStore((state) => state.configs);
  const configs = useMemo(
    () => Object.values(configsMap).filter((cfg) => cfg.type === type),
    [configsMap, type],
  );
  const selected = useMemo(
    () => configs.find((cfg) => cfg.configId === value) ?? null,
    [configs, value],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="text-[11px] text-[var(--text-muted)]">
        {configs.length} account{configs.length === 1 ? "" : "s"}
        {selected ? ` · ${selected.name || selected.displayName}` : ""}
      </div>

      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none"
      >
        <option value="">Select account...</option>
        {configs.map((cfg) => (
          <option key={cfg.configId} value={cfg.configId}>
            {(cfg.displayName || cfg.name || cfg.configId) + (cfg.isDefault ? " (default)" : "")}
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

      <button
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onSetDefaultAccount}
        disabled={!value || selected?.isDefault}
        type="button"
      >
        Set Default
      </button>

      <button
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--danger,#ef4444)] disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onDeleteAccount}
        disabled={!value}
        type="button"
      >
        Delete Account
      </button>
    </div>
  );
}
