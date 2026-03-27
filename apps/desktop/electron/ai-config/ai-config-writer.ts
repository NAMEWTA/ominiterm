import fs from "fs";
import path from "path";
import { homedir } from "os";
import type { AiCliConfig } from "./ai-config-types.ts";

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export class AiConfigWriter {
  /**
   * Resolve config directory for a tool, e.g. ~/.claude or ~/.codex
   */
  static getConfigDirForType(type: string): string {
    return path.join(homedir(), `.${type}`);
  }

  /**
   * Write selected account config into tool-specific location.
   */
  static writeConfigToTool(type: string, config: AiCliConfig): void {
    const configDir = this.getConfigDirForType(type);
    ensureDir(configDir);

    switch (type) {
      case "claude":
        this.writeClaudeConfig(configDir, config);
        break;
      case "codex":
        this.writeCodexConfig(configDir, config);
        break;
      case "gemini":
        this.writeGeminiConfig(configDir, config);
        break;
      case "opencode":
        this.writeOpencodeConfig(configDir, config);
        break;
      default:
        console.warn(`[AiConfigWriter] Unsupported tool type: ${type}`);
    }
  }

  private static writeClaudeConfig(configDir: string, config: AiCliConfig): void {
    const configFile = path.join(configDir, "config.json");
    const claudeConfig = {
      apiKey: config.commonConfig.apiKey,
      baseUrl: config.commonConfig.baseUrl,
      model: config.commonConfig.model,
      ...config.toolConfig,
    };
    fs.writeFileSync(configFile, JSON.stringify(claudeConfig, null, 2), "utf-8");
    console.log(`[AiConfigWriter] Claude config written: ${configFile}`);
  }

  private static writeCodexConfig(configDir: string, config: AiCliConfig): void {
    const configFile = path.join(configDir, ".codex");
    const content = `api_key = "${config.commonConfig.apiKey}"
baseUrl = "${config.commonConfig.baseUrl || ""}"
model = "${config.commonConfig.model || ""}"
`;
    fs.writeFileSync(configFile, content, "utf-8");
    console.log(`[AiConfigWriter] Codex config written: ${configFile}`);
  }

  private static writeGeminiConfig(configDir: string, config: AiCliConfig): void {
    const configFile = path.join(configDir, "config.json");
    const geminiConfig = {
      api_key: config.commonConfig.apiKey,
      model: config.commonConfig.model,
      ...config.toolConfig,
    };
    fs.writeFileSync(configFile, JSON.stringify(geminiConfig, null, 2), "utf-8");
    console.log(`[AiConfigWriter] Gemini config written: ${configFile}`);
  }

  private static writeOpencodeConfig(configDir: string, config: AiCliConfig): void {
    const configFile = path.join(configDir, "config.json");
    const opencodeConfig = {
      apiKey: config.commonConfig.apiKey,
      baseUrl: config.commonConfig.baseUrl,
      model: config.commonConfig.model,
      ...config.toolConfig,
    };
    fs.writeFileSync(configFile, JSON.stringify(opencodeConfig, null, 2), "utf-8");
    console.log(`[AiConfigWriter] OpenCode config written: ${configFile}`);
  }
}
