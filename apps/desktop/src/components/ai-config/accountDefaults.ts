import type { TerminalType } from "../../types/index";
import type { CommonAiConfig } from "../../types/ai-config";

export const DEFAULT_CLAUDE_TOOL_CONFIG = {
  env: {
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1",
  },
  includeCoAuthoredBy: false,
  skipDangerousModePermissionPrompt: true,
} as const;

export const DEFAULT_CODEX_TOML = `model_provider = "OpenAI"
model = "gpt-5.4"
review_model = "gpt-5.4"
disable_response_storage = true
network_access = "enabled"
windows_wsl_setup_acknowledged = true
model_context_window = 1000000
model_auto_compact_token_limit = 900000
sandbox_mode = "workspace-write"
model_reasoning_effort = "xhigh"

[model_providers]
[model_providers.OpenAI]
name = "OpenAI"
base_url = "https://gpt.eacase.de5.net"
wire_api = "responses"
requires_openai_auth = true

[windows]
sandbox = "elevated"
`;

export function buildDefaultCommonConfig(type: TerminalType): CommonAiConfig {
  if (type === "codex") {
    return {
      apiKey: "",
      model: "gpt-5.4",
    };
  }

  return { apiKey: "" };
}

export function buildDefaultToolConfig(type: TerminalType): Record<string, unknown> {
  if (type === "claude") {
    return {
      ...DEFAULT_CLAUDE_TOOL_CONFIG,
      env: { ...DEFAULT_CLAUDE_TOOL_CONFIG.env },
    };
  }

  if (type === "codex") {
    return {
      auth: {
        OPENAI_API_KEY: "",
      },
      config: DEFAULT_CODEX_TOML,
    };
  }

  return {};
}
