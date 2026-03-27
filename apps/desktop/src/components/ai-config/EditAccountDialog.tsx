import { useEffect, useMemo, useState } from "react";
import type { AiCliConfig } from "../../types/ai-config";
import { AccountEditor } from "./AccountEditor";
import { AdvancedJsonEditor } from "./AdvancedJsonEditor";
import { buildAccountPreviewFiles } from "./accountFilePreview";
import { getCliPreset } from "../../config/aiCliPresets";

interface Props {
  open: boolean;
  config: AiCliConfig | null;
  onClose: () => void;
  onSubmit: (configId: string, updates: Partial<AiCliConfig>) => Promise<void>;
}

export function EditAccountDialog({ open, config, onClose, onSubmit }: Props) {
  const [draft, setDraft] = useState<AiCliConfig | null>(config);
  const [submitting, setSubmitting] = useState(false);
  const [editMode, setEditMode] = useState<"form" | "json">("form");
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(config);
      setSubmitting(false);
      setEditMode("form");
      setJsonError(null);
    }
  }, [open, config]);

  const preset = useMemo(
    () => (draft ? getCliPreset(draft.type) : null),
    [draft],
  );

  const missingRequiredFields = useMemo(() => {
    if (!draft || !preset) {
      return [];
    }

    return preset.commonFields.filter((field) => {
      if (!field.required) {
        return false;
      }
      const value = draft.commonConfig[field.key as keyof typeof draft.commonConfig];
      return !(typeof value === "string" && value.trim().length > 0);
    });
  }, [draft, preset]);

  const canSubmit = useMemo(() => {
    if (!draft) {
      return false;
    }
    return draft.name.trim().length > 0 && missingRequiredFields.length === 0;
  }, [draft, missingRequiredFields.length]);

  const previewFiles = useMemo(() => {
    if (!draft) {
      return [];
    }
    return buildAccountPreviewFiles(draft);
  }, [draft]);

  const handleSubmit = async () => {
    if (!draft || submitting || !canSubmit) {
      return;
    }

    setSubmitting(true);
    try {
      const updates: Partial<AiCliConfig> = {
        ...draft,
        updatedAt: Date.now(),
      };
      await onSubmit(draft.configId, updates);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !draft) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-5xl rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-2xl">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Edit {draft.type} Account</h2>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
          Update account details used to write tool-specific CLI config before launch.
        </p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="text-[11px] text-[var(--text-muted)]">
            Required fields: Name + {(preset?.commonFields ?? [])
              .filter((field) => field.required)
              .map((field) => field.label)
              .join(", ")}
          </div>
          <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
            <button
              type="button"
              onClick={() => setEditMode("form")}
              className={`rounded-md px-2 py-1 text-[11px] ${editMode === "form" ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)]"}`}
            >
              Form
            </button>
            <button
              type="button"
              onClick={() => setEditMode("json")}
              className={`rounded-md px-2 py-1 text-[11px] ${editMode === "json" ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)]"}`}
            >
              JSON
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            {editMode === "form" ? (
              <AccountEditor
                config={draft}
                onUpdate={(updates) => setDraft((prev) => (prev ? { ...prev, ...updates } : prev))}
              />
            ) : (
              <>
                <AdvancedJsonEditor
                  config={draft}
                  onUpdate={(updates) => {
                    setJsonError(null);
                    setDraft((prev) => (prev ? { ...prev, ...updates } : prev));
                  }}
                  onError={(message) => setJsonError(message)}
                />
                {jsonError ? (
                  <div className="mt-2 text-[11px] text-[var(--danger,#ef4444)]">{jsonError}</div>
                ) : null}
              </>
            )}
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-2 text-[12px] font-semibold text-[var(--text-primary)]">Live Config Preview</div>
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
          </div>
        </div>

        {missingRequiredFields.length > 0 ? (
          <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">
            Missing required fields: {missingRequiredFields.map((field) => field.label).join(", ")}
          </div>
        ) : null}

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
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
