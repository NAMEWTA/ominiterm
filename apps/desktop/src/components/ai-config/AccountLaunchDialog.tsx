import { useMemo } from "react";
import type { TerminalType } from "../../types/index";
import { useAiConfigStore } from "../../stores/aiConfigStore";
import { buildAccountPreviewFiles } from "./accountFilePreview";

interface Props {
  open: boolean;
  type: TerminalType;
  value: string | null;
  onChange: (configId: string | null) => void;
  onClose: () => void;
  onCreate: () => void;
  onCreateWithoutAccount: () => void;
  onNewAccount: () => void;
  onEditAccount: () => void;
  onDeleteAccount: () => void;
  onSetDefaultAccount: () => void;
  onUseSystemDefault: () => void;
}

export function AccountLaunchDialog({
  open,
  type,
  value,
  onChange,
  onClose,
  onCreate,
  onCreateWithoutAccount,
  onNewAccount,
  onEditAccount,
  onDeleteAccount,
  onSetDefaultAccount,
  onUseSystemDefault,
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
  const defaultConfig = useMemo(
    () => configs.find((cfg) => cfg.isDefault) ?? null,
    [configs],
  );

  const previewFiles = useMemo(() => {
    if (!selected) {
      return [];
    }
    return buildAccountPreviewFiles(selected);
  }, [selected]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-5xl rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-2xl">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Select Account Before Launch</h2>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
          Choose an account, adjust settings if needed, then create terminal. You can also launch without account config.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-2 text-[12px] text-[var(--text-secondary)]">
              {configs.length} account{configs.length === 1 ? "" : "s"}
              {defaultConfig ? ` · default: ${defaultConfig.name || defaultConfig.displayName}` : ""}
            </div>

            <select
              value={value ?? ""}
              onChange={(event) => onChange(event.target.value || null)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none"
            >
              <option value="">Select account...</option>
              {configs.map((cfg) => (
                <option key={cfg.configId} value={cfg.configId}>
                  {(cfg.displayName || cfg.name || cfg.configId) + (cfg.isDefault ? " (default)" : "")}
                </option>
              ))}
            </select>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onUseSystemDefault}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px] text-[var(--text-secondary)]"
              >
                Use System Default
              </button>
              <button
                type="button"
                onClick={onNewAccount}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px] text-[var(--text-secondary)]"
              >
                + New Account
              </button>
              <button
                type="button"
                onClick={onEditAccount}
                disabled={!selected}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px] text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Edit Account
              </button>
              <button
                type="button"
                onClick={onSetDefaultAccount}
                disabled={!selected || !!selected?.isDefault}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px] text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Set Default
              </button>
              <button
                type="button"
                onClick={onDeleteAccount}
                disabled={!selected}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px] text-[var(--text-secondary)] hover:text-[var(--danger,#ef4444)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete Account
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-2 text-[12px] font-semibold text-[var(--text-primary)]">Live Config Preview</div>
            {selected ? (
              <div className="space-y-3">
                {previewFiles.map((file) => (
                  <div key={file.path} className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-2">
                    <div className="mb-1 text-[11px] text-[var(--text-secondary)]">{file.path}</div>
                    <pre className="max-h-44 overflow-auto rounded bg-black/10 p-2 font-mono text-[11px] text-[var(--text-primary)]">
                      {file.content}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[12px] text-[var(--text-muted)]">Select an account to preview files.</div>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            type="button"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-secondary)]"
          >
            Cancel
          </button>
          <button
            onClick={onCreateWithoutAccount}
            type="button"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-secondary)]"
          >
            Create Without Account
          </button>
          <button
            onClick={() => {
              if (selected) {
                onCreate();
                return;
              }
              onCreateWithoutAccount();
            }}
            type="button"
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-[12px] font-medium text-white"
          >
            {selected ? "Create Terminal" : "Create Terminal (No Account)"}
          </button>
        </div>
      </div>
    </div>
  );
}
