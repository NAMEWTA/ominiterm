import { useEffect } from "react";
import { useT } from "../../i18n/useT";
import { useLaunchersStore } from "../../stores/launchersStore";
import type { LauncherConfigItem } from "../../types";

const HOST_SHELL_OPTIONS: LauncherConfigItem["hostShell"][] = [
  "auto",
  "pwsh",
  "bash",
  "zsh",
  "cmd",
];

const MIN_STARTUP_TIMEOUT_MS = 1000;
const MAX_STARTUP_TIMEOUT_MS = 600000;

export function LauncherSettingsTab() {
  const t = useT();
  const launchers = useLaunchersStore((state) => state.launchers);
  const selectedLauncherId = useLaunchersStore((state) => state.selectedLauncherId);
  const draft = useLaunchersStore((state) => state.draft);
  const mainCommandArgsText = useLaunchersStore(
    (state) => state.mainCommandArgsText,
  );
  const loading = useLaunchersStore((state) => state.loading);
  const saving = useLaunchersStore((state) => state.saving);
  const error = useLaunchersStore((state) => state.error);
  const validationErrors = useLaunchersStore((state) => state.validationErrors);
  const load = useLaunchersStore((state) => state.load);
  const createDraftForNewLauncher = useLaunchersStore(
    (state) => state.createDraftForNewLauncher,
  );
  const selectLauncher = useLaunchersStore((state) => state.selectLauncher);
  const updateDraftName = useLaunchersStore((state) => state.updateDraftName);
  const updateDraftId = useLaunchersStore((state) => state.updateDraftId);
  const updateDraftEnabled = useLaunchersStore(
    (state) => state.updateDraftEnabled,
  );
  const updateDraftHostShell = useLaunchersStore(
    (state) => state.updateDraftHostShell,
  );
  const addDraftStartupCommand = useLaunchersStore(
    (state) => state.addDraftStartupCommand,
  );
  const updateDraftStartupCommandLabel = useLaunchersStore(
    (state) => state.updateDraftStartupCommandLabel,
  );
  const updateDraftStartupCommandCommand = useLaunchersStore(
    (state) => state.updateDraftStartupCommandCommand,
  );
  const updateDraftStartupCommandTimeoutMs = useLaunchersStore(
    (state) => state.updateDraftStartupCommandTimeoutMs,
  );
  const moveDraftStartupCommand = useLaunchersStore(
    (state) => state.moveDraftStartupCommand,
  );
  const removeDraftStartupCommand = useLaunchersStore(
    (state) => state.removeDraftStartupCommand,
  );
  const updateDraftMainCommand = useLaunchersStore(
    (state) => state.updateDraftMainCommand,
  );
  const updateDraftMainCommandArgsText = useLaunchersStore(
    (state) => state.updateDraftMainCommandArgsText,
  );
  const saveDraft = useLaunchersStore((state) => state.saveDraft);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex gap-4 min-h-[320px]">
      <div className="w-52 shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface)] p-1">
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {t.settings_launchers}
          </div>
          <button
            className="rounded-md bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => createDraftForNewLauncher()}
            disabled={loading || saving}
          >
            {t.add}
          </button>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {loading && (
            <div className="px-2 py-2 text-[12px] text-[var(--text-muted)]">
              {t.loading}
            </div>
          )}
          {!loading && launchers.length === 0 && (
            <div className="px-2 py-2 text-[12px] text-[var(--text-muted)]">
              {t.launcher_empty}
            </div>
          )}
          {!loading &&
            launchers.map((launcher) => {
              const selected = launcher.id === selectedLauncherId;
              return (
                <button
                  key={launcher.id}
                  className={`flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left transition-colors duration-100 ${
                    selected
                      ? "bg-[var(--accent)]/15 text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  }`}
                  onClick={() => selectLauncher(launcher.id)}
                >
                  <span className="text-[12px] leading-5">
                    {launcher.name || launcher.id}
                  </span>
                  <span className="text-[11px] leading-4 text-[var(--text-muted)]">
                    {launcher.id}
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {error && (
          <div className="mb-3 rounded-md border border-[var(--red)]/35 bg-[var(--red)]/10 px-3 py-2 text-[12px] text-[var(--red)]">
            {t.launcher_error_prefix(error)}
          </div>
        )}

        {!draft && !loading && (
          <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-4 text-[13px] text-[var(--text-muted)]">
            {t.launcher_no_selection}
          </div>
        )}

        {draft && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-[12px] text-[var(--text-secondary)]">
                  {t.launcher_name}
                </span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(event) => updateDraftName(event.target.value)}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                />
                {validationErrors.name && (
                  <span className="text-[11px] text-[var(--red)]">
                    {t.launcher_validation_name_required}
                  </span>
                )}
              </label>

              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-[12px] text-[var(--text-secondary)]">
                  {t.launcher_id}
                </span>
                <input
                  type="text"
                  value={draft.id}
                  onChange={(event) => updateDraftId(event.target.value)}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  style={{ fontFamily: '"Geist Mono", monospace' }}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-[12px] text-[var(--text-secondary)]">
                  {t.launcher_host_shell}
                </span>
                <select
                  value={draft.hostShell}
                  onChange={(event) =>
                    updateDraftHostShell(
                      event.target.value as LauncherConfigItem["hostShell"],
                    )
                  }
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                >
                  {HOST_SHELL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex min-w-0 items-center gap-2 pt-6 text-[13px] text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) => updateDraftEnabled(event.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span>{t.launcher_enabled}</span>
              </label>
            </div>

            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[12px] text-[var(--text-secondary)]">
                {t.launcher_main_command}
              </span>
              <input
                type="text"
                value={draft.mainCommand.command}
                onChange={(event) => updateDraftMainCommand(event.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
              <span className="text-[11px] text-[var(--text-muted)]">
                {t.launcher_main_command_optional_hint}
              </span>
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[12px] text-[var(--text-secondary)]">
                {t.launcher_main_args}
              </span>
              <textarea
                rows={4}
                value={mainCommandArgsText}
                onChange={(event) =>
                  updateDraftMainCommandArgsText(event.target.value)
                }
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[12px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                style={{ fontFamily: '"Geist Mono", monospace' }}
                placeholder={t.launcher_main_args_hint}
              />
            </label>

            <div className="flex min-w-0 flex-col gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--text-secondary)]">
                  {t.launcher_startup_commands}
                </span>
                <button
                  type="button"
                  className="rounded-md bg-[var(--surface-hover)] px-2 py-1 text-[11px] text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text-primary)]"
                  onClick={() => addDraftStartupCommand()}
                >
                  {t.launcher_add_startup_command}
                </button>
              </div>

              {draft.startupCommands.length === 0 && (
                <div className="rounded-md border border-dashed border-[var(--border)] px-2 py-2 text-[12px] text-[var(--text-muted)]">
                  {t.launcher_startup_commands_empty}
                </div>
              )}

              {validationErrors.entryCommand && (
                <div className="rounded-md border border-[var(--red)]/35 bg-[var(--red)]/10 px-2 py-2 text-[12px] text-[var(--red)]">
                  {t.launcher_validation_entry_command_required}
                </div>
              )}

              {draft.startupCommands.map((step, index) => (
                <div
                  key={`${index}-${step.label}`}
                  className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-2"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {t.launcher_startup_step(index + 1)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                        onClick={() => moveDraftStartupCommand(index, -1)}
                        disabled={index === 0}
                        title={t.launcher_move_up}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="rounded px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                        onClick={() => moveDraftStartupCommand(index, 1)}
                        disabled={index >= draft.startupCommands.length - 1}
                        title={t.launcher_move_down}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="rounded px-1.5 py-0.5 text-[11px] text-[var(--red)] hover:bg-[var(--surface-hover)]"
                        onClick={() => removeDraftStartupCommand(index)}
                      >
                        {t.launcher_remove}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_2fr_140px] gap-2">
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {t.launcher_step_label}
                      </span>
                      <input
                        type="text"
                        value={step.label}
                        onChange={(event) =>
                          updateDraftStartupCommandLabel(index, event.target.value)
                        }
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                      />
                    </label>

                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {t.launcher_step_command}
                      </span>
                      <input
                        type="text"
                        value={step.command}
                        onChange={(event) =>
                          updateDraftStartupCommandCommand(index, event.target.value)
                        }
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                        placeholder={t.launcher_step_command_placeholder}
                      />
                    </label>

                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {t.launcher_step_timeout_ms}
                      </span>
                      <input
                        type="number"
                        min={MIN_STARTUP_TIMEOUT_MS}
                        max={MAX_STARTUP_TIMEOUT_MS}
                        step={1000}
                        value={step.timeoutMs}
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10);
                          updateDraftStartupCommandTimeoutMs(index, parsed);
                        }}
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-1 flex justify-end">
              <button
                className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-[13px] text-white transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void saveDraft();
                }}
                disabled={saving}
              >
                {saving ? t.launcher_saving : t.save}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
