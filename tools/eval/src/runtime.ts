export function getPythonCommand(): string {
  const override =
    process.env.OMINITERM_PYTHON ??
    process.env.PYTHON_EXECUTABLE ??
    process.env.PYTHON;

  if (override && override.trim()) {
    return override.trim();
  }

  return process.platform === "win32" ? "python" : "python3";
}

export interface CommandSpec {
  command: string;
  args: string[];
}

function parseCommandArgs(envName: string): string[] {
  const raw = process.env[envName];
  if (!raw || !raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === "string")) {
      return parsed;
    }
  } catch {
    // Fall back to treating the raw value as a single argument.
  }

  return [raw];
}

function getCommandSpec(
  commandEnvName: string,
  argsEnvName: string,
  fallbackCommand: string,
): CommandSpec {
  const command = process.env[commandEnvName]?.trim() || fallbackCommand;
  return {
    command,
    args: parseCommandArgs(argsEnvName),
  };
}

export function getPythonCommandSpec(): CommandSpec {
  return getCommandSpec(
    "OMINITERM_PYTHON_CMD",
    "OMINITERM_PYTHON_ARGS",
    getPythonCommand(),
  );
}

export function getCodexCommandSpec(): CommandSpec {
  return getCommandSpec("OMINITERM_CODEX_CMD", "OMINITERM_CODEX_ARGS", "codex");
}

export function getClaudeCommandSpec(): CommandSpec {
  return getCommandSpec("OMINITERM_CLAUDE_CMD", "OMINITERM_CLAUDE_ARGS", "claude");
}
