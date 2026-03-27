import { useEffect, useMemo, useState } from "react";
import type { TerminalType } from "../../types/index";
import type { AiCliConfig } from "../../types/ai-config";
import { useAiConfigStore } from "../../stores/aiConfigStore";
import { getCliPreset } from "../../config/aiCliPresets";
import { AccountEditor } from "./AccountEditor";

interface Props {
  type: TerminalType;
  open: boolean;
  onClose: () => void;
  onSubmit: (config: AiCliConfig) => Promise<void>;
}

function createDraftConfig(type: TerminalType): AiCliConfig {
  const now = Date.now();
  const preset = getCliPreset(type);
  return {
    configId: "",
    type,
    name: "",
    providerName: preset.displayName,
    displayName: "",
    commonConfig: { apiKey: "" },
    toolConfig: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function NewAccountDialog({ type, open, onClose, onSubmit }: Props) {
  const generateConfigId = useAiConfigStore((state) => state.generateConfigId);
  const [config, setConfig] = useState<AiCliConfig>(() => createDraftConfig(type));
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => config.name.trim().length > 0 && config.commonConfig.apiKey.trim().length > 0,
    [config.commonConfig.apiKey, config.name],
  );

  useEffect(() => {
    if (open) {
      setConfig(createDraftConfig(type));
      setSubmitting(false);
    }
  }, [open, type]);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      const configId = await generateConfigId(type, config.name);
      const nextConfig: AiCliConfig = {
        ...config,
        configId,
        displayName: `${getCliPreset(type).displayName} - ${config.name.trim()}`,
        updatedAt: Date.now(),
      };
      await onSubmit(nextConfig);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-2xl">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
          New {type} Account
        </h2>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
          Create an account profile used to write tool-specific CLI config before launch.
        </p>

        <div className="mt-4">
          <AccountEditor
            config={config}
            onUpdate={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            type="button"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            type="button"
            disabled={!canSubmit || submitting}
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-[12px] font-medium text-white transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
