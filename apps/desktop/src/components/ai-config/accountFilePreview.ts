import type { AiCliConfig } from "../../types/ai-config";

export interface AccountPreviewFile {
  path: string;
  language: "json" | "toml" | "dotenv";
  content: string;
}

function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function buildAccountPreviewFiles(config: AiCliConfig): AccountPreviewFile[] {
  const common = config.commonConfig;

  switch (config.type) {
    case "claude": {
      const env: Record<string, string> = {
        ANTHROPIC_AUTH_TOKEN: common.apiKey ?? "",
      };

      if (common.baseUrl) {
        env.ANTHROPIC_BASE_URL = common.baseUrl;
      }
      if (common.model) {
        env.ANTHROPIC_MODEL = common.model;
      }

      return [
        {
          path: "~/.claude/settings.json",
          language: "json",
          content: stringifyJson({ env }),
        },
      ];
    }

    case "codex": {
      const authJson = {
        OPENAI_API_KEY: common.apiKey ?? "",
      };

      const tomlLines: string[] = [];
      if (common.model) {
        tomlLines.push(`model = \"${common.model}\"`);
      }
      if (common.baseUrl) {
        tomlLines.push(`base_url = \"${common.baseUrl}\"`);
      }

      return [
        {
          path: "~/.codex/auth.json",
          language: "json",
          content: stringifyJson(authJson),
        },
        {
          path: "~/.codex/config.toml",
          language: "toml",
          content: `${tomlLines.join("\n")}\n`,
        },
      ];
    }

    case "gemini": {
      const envLines = [`GEMINI_API_KEY=${common.apiKey ?? ""}`];
      if (common.baseUrl) {
        envLines.push(`GOOGLE_GEMINI_BASE_URL=${common.baseUrl}`);
      }
      if (common.model) {
        envLines.push(`GEMINI_MODEL=${common.model}`);
      }

      return [
        {
          path: "~/.gemini/.env",
          language: "dotenv",
          content: `${envLines.join("\n")}\n`,
        },
      ];
    }

    case "opencode": {
      const provider = {
        npm: "@ai-sdk/openai-compatible",
        options: {
          apiKey: common.apiKey ?? "",
          ...(common.baseUrl ? { baseURL: common.baseUrl } : {}),
        },
        ...(common.model
          ? {
              models: {
                [common.model]: {
                  name: common.model,
                },
              },
            }
          : {}),
      };

      return [
        {
          path: "~/.config/opencode/opencode.json",
          language: "json",
          content: stringifyJson({
            $schema: "https://opencode.ai/config.json",
            provider: {
              [config.configId || "preview-account"]: provider,
            },
          }),
        },
      ];
    }

    default:
      return [];
  }
}
