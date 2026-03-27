import type { TerminalData } from "../types/index.ts";
import type { CliCommandConfig } from "../stores/preferencesStore.ts";
import {
  getTerminalLaunchOptions,
  getTerminalPromptArgs,
} from "./cliConfig.ts";

export interface TerminalCreateRequest {
  cwd: string;
  shell?: string;
  args?: string[];
  terminalId?: string;
  configId?: string;
  theme?: "dark" | "light";
}

interface BuildRequestParams {
  terminal: TerminalData;
  worktreePath: string;
  theme: "dark" | "light";
  cliOverride?: CliCommandConfig;
}

export function buildTerminalCreateRequest({
  terminal,
  worktreePath,
  theme,
  cliOverride,
}: BuildRequestParams): TerminalCreateRequest {
  const launch = getTerminalLaunchOptions(
    terminal.type,
    terminal.sessionId,
    terminal.autoApprove,
    cliOverride,
  );

  const request: TerminalCreateRequest = {
    cwd: worktreePath,
    terminalId: terminal.id,
    configId: terminal.configId,
    theme,
  };

  if (!launch) {
    return request;
  }

  const promptArgs =
    !terminal.sessionId && terminal.initialPrompt
      ? getTerminalPromptArgs(terminal.type, terminal.initialPrompt)
      : [];

  request.shell = launch.shell;
  request.args = [...launch.args, ...promptArgs];
  return request;
}
