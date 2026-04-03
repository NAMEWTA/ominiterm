import type { LauncherStartupEvent } from "../types";

function stepPrefix(event: LauncherStartupEvent): string {
  return `${event.stepIndex + 1}/${event.totalSteps} ${event.stepLabel}`;
}

export function buildStartupStatusMessage(event: LauncherStartupEvent): string {
  const prefix = stepPrefix(event);

  if (event.type === "step-start") {
    return `Starting ${prefix}`;
  }

  if (event.type === "step-success") {
    return `Finished ${prefix}`;
  }

  const reason =
    event.timeoutMs !== undefined
      ? `timed out after ${event.timeoutMs}ms`
      : event.exitCode !== undefined
        ? `exit code ${event.exitCode}`
        : "failed";

  const detail = event.stderrPreview?.trim();
  if (detail) {
    return `${prefix} failed (${reason}): ${detail}`;
  }

  return `${prefix} failed (${reason})`;
}
