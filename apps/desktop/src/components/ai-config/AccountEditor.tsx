import type { AiCliConfig } from "../../types/ai-config";
import { getCliPreset } from "../../config/aiCliPresets";

interface Props {
  config: AiCliConfig;
  onUpdate: (updates: Partial<AiCliConfig>) => void;
}

export function AccountEditor({ config, onUpdate }: Props) {
  const preset = getCliPreset(config.type);

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">Name</label>
        <input
          value={config.name}
          onChange={(event) => {
            const name = event.target.value;
            onUpdate({
              name,
              displayName: name.trim() ? `${preset.displayName} - ${name.trim()}` : "",
            });
          }}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          placeholder="Work / Personal"
        />
      </div>

      {preset.commonFields.map((field) => (
        <div key={field.key}>
          <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">
            {field.label}
            {field.required ? " *" : ""}
          </label>
          <input
            type={field.type}
            placeholder={field.placeholder}
            value={config.commonConfig[field.key as keyof typeof config.commonConfig] ?? ""}
            onChange={(event) =>
              onUpdate({
                commonConfig: {
                  ...config.commonConfig,
                  [field.key]: event.target.value,
                },
              })
            }
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          {field.hint ? (
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">{field.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
