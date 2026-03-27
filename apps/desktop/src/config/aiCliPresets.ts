import type { TerminalType } from "../types/index";

export interface CliFieldPreset {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "password" | "url";
  required: boolean;
  hint?: string;
}

export interface CliPreset {
  type: TerminalType;
  displayName: string;
  commonFields: CliFieldPreset[];
  docUrl?: string;
}

export const CLI_PRESETS: Record<TerminalType, CliPreset> = {
  claude: {
    type: "claude",
    displayName: "Claude (Anthropic)",
    commonFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "sk-ant-...",
        type: "password",
        required: true,
        hint: "Get from https://console.anthropic.com/apikeys",
      },
      {
        key: "baseUrl",
        label: "Base URL (optional)",
        placeholder: "https://api.anthropic.com",
        type: "url",
        required: false,
      },
      {
        key: "model",
        label: "Model",
        placeholder: "claude-3-sonnet-20250219",
        type: "text",
        required: true,
      },
    ],
    docUrl: "https://console.anthropic.com/docs",
  },

  codex: {
    type: "codex",
    displayName: "OpenAI Codex",
    commonFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "sk-...",
        type: "password",
        required: true,
      },
      {
        key: "baseUrl",
        label: "Base URL (optional)",
        placeholder: "https://api.openai.com/v1",
        type: "url",
        required: false,
      },
      {
        key: "model",
        label: "Model",
        placeholder: "gpt-4",
        type: "text",
        required: true,
      },
    ],
  },

  gemini: {
    type: "gemini",
    displayName: "Google Gemini",
    commonFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "AIza...",
        type: "password",
        required: true,
      },
      {
        key: "model",
        label: "Model (optional)",
        placeholder: "gemini-2.0-flash",
        type: "text",
        required: false,
      },
    ],
  },

  opencode: {
    type: "opencode",
    displayName: "OpenCode",
    commonFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "opencode-...",
        type: "password",
        required: true,
      },
      {
        key: "baseUrl",
        label: "Base URL (optional)",
        placeholder: "https://api.opencode.com",
        type: "url",
        required: false,
      },
    ],
  },

  copilot: {
    type: "copilot",
    displayName: "GitHub Copilot",
    commonFields: [
      {
        key: "apiKey",
        label: "Token",
        placeholder: "github_pat_...",
        type: "password",
        required: true,
      },
    ],
  },

  kimi: {
    type: "kimi",
    displayName: "Kimi (Moonshot)",
    commonFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "sk-...",
        type: "password",
        required: true,
      },
      {
        key: "model",
        label: "Model (optional)",
        placeholder: "moonshot-v1-8k",
        type: "text",
        required: false,
      },
    ],
  },

  lazygit: {
    type: "lazygit",
    displayName: "Lazygit",
    commonFields: [],
  },

  shell: {
    type: "shell",
    displayName: "Shell",
    commonFields: [],
  },

  tmux: {
    type: "tmux",
    displayName: "Tmux",
    commonFields: [],
  },
};

export function getCliPreset(type: TerminalType): CliPreset {
  return CLI_PRESETS[type] || { type, displayName: type, commonFields: [] };
}

export function getConfigurableCliTypes(): TerminalType[] {
  return ["claude", "codex", "gemini", "opencode", "copilot", "kimi"] as TerminalType[];
}
