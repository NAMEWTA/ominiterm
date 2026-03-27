import { useEffect, useState } from "react";
import type { AiCliConfig } from "../../types/ai-config";

interface Props {
  config: AiCliConfig;
  onUpdate: (updates: Partial<AiCliConfig>) => void;
  onError?: (message: string) => void;
}

export function AdvancedJsonEditor({ config, onUpdate, onError }: Props) {
  const [jsonText, setJsonText] = useState(JSON.stringify(config, null, 2));

  useEffect(() => {
    setJsonText(JSON.stringify(config, null, 2));
  }, [config]);

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText) as Partial<AiCliConfig>;
      onUpdate(parsed);
    } catch {
      onError?.("Invalid JSON");
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={jsonText}
        onChange={(event) => setJsonText(event.target.value)}
        rows={12}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 font-mono text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
      />
      <button
        onClick={handleApply}
        type="button"
        className="rounded-lg bg-[var(--accent)] px-3 py-2 text-[12px] font-medium text-white transition-all duration-150 hover:brightness-110"
      >
        Apply JSON
      </button>
    </div>
  );
}
