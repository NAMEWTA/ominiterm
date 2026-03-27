export type TerminalTypeStr =
  | "claude"
  | "codex"
  | "gemini"
  | "opencode"
  | "copilot"
  | "kimi"
  | "lazygit"
  | "shell"
  | "tmux";

export interface CommonAiConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface AiCliConfig {
  configId: string;
  type: TerminalTypeStr;
  name: string;
  providerName: string;
  displayName: string;
  description?: string;
  commonConfig: CommonAiConfig;
  toolConfig: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;
}
