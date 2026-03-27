import fs from "fs";
import path from "path";
import { homedir } from "os";
import type { AiCliConfig } from "./ai-config-types.ts";

type JsonObject = Record<string, unknown>;

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isObject(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "string");
}

function getHomePath(): string {
  const testHome = process.env.OMINITERM_AI_CONFIG_HOME;
  if (typeof testHome === "string" && testHome.trim().length > 0) {
    return testHome.trim();
  }
  return homedir();
}

function readJsonObjectIfExists(filePath: string): JsonObject {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readFileBufferIfExists(filePath: string): Buffer | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath);
}

function writeAtomic(filePath: string, content: string | Buffer): void {
  const dir = path.dirname(filePath);
  ensureDir(dir);

  const fileName = path.basename(filePath);
  const tmpPath = path.join(
    dir,
    `${fileName}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`,
  );

  fs.writeFileSync(tmpPath, content);

  if (process.platform === "win32" && fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }

  fs.renameSync(tmpPath, filePath);
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  writeAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeTextAtomic(filePath: string, value: string): void {
  writeAtomic(filePath, value);
}

function escapeTomlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function upsertTopLevelTomlString(
  tomlText: string,
  key: string,
  value: string | undefined,
): string {
  const lines = tomlText.length > 0 ? tomlText.split("\n") : [];
  const keyMatcher = new RegExp(`^\\s*${key}\\s*=`);
  const headerMatcher = /^\s*\[[^\]]+\]\s*$/;

  let inSection = false;
  let foundIndex = -1;
  let firstSectionIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (headerMatcher.test(line)) {
      inSection = true;
      if (firstSectionIndex === -1) {
        firstSectionIndex = i;
      }
      continue;
    }

    if (!inSection && keyMatcher.test(line)) {
      foundIndex = i;
      break;
    }
  }

  if (value === undefined) {
    if (foundIndex >= 0) {
      lines.splice(foundIndex, 1);
    }
    return lines.join("\n");
  }

  const assignment = `${key} = "${escapeTomlString(value)}"`;

  if (foundIndex >= 0) {
    lines[foundIndex] = assignment;
    return lines.join("\n");
  }

  if (firstSectionIndex >= 0) {
    lines.splice(firstSectionIndex, 0, assignment);
  } else {
    lines.push(assignment);
  }

  return lines.join("\n");
}

function upsertSectionTomlString(
  tomlText: string,
  sectionName: string,
  key: string,
  value: string | undefined,
): string {
  const lines = tomlText.length > 0 ? tomlText.split("\n") : [];
  const header = `[${sectionName}]`;
  const headerMatcher = /^\s*\[[^\]]+\]\s*$/;
  const keyMatcher = new RegExp(`^\\s*${key}\\s*=`);

  let sectionStart = -1;
  let sectionEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === header) {
      sectionStart = i;
      break;
    }
  }

  if (sectionStart >= 0) {
    for (let i = sectionStart + 1; i < lines.length; i++) {
      if (headerMatcher.test(lines[i])) {
        sectionEnd = i;
        break;
      }
    }

    let keyIndex = -1;
    for (let i = sectionStart + 1; i < sectionEnd; i++) {
      if (keyMatcher.test(lines[i])) {
        keyIndex = i;
        break;
      }
    }

    if (value === undefined) {
      if (keyIndex >= 0) {
        lines.splice(keyIndex, 1);
      }
      return lines.join("\n");
    }

    const assignment = `${key} = "${escapeTomlString(value)}"`;
    if (keyIndex >= 0) {
      lines[keyIndex] = assignment;
    } else {
      lines.splice(sectionEnd, 0, assignment);
    }
    return lines.join("\n");
  }

  if (value === undefined) {
    return lines.join("\n");
  }

  const nextLines = [...lines];
  if (nextLines.length > 0 && nextLines[nextLines.length - 1].trim().length > 0) {
    nextLines.push("");
  }
  nextLines.push(header);
  nextLines.push(`${key} = "${escapeTomlString(value)}"`);
  return nextLines.join("\n");
}

function mergeCodexTomlFromCommonConfig(
  existingTomlText: string,
  baseUrl: string | undefined,
  model: string | undefined,
): string {
  let nextToml = upsertTopLevelTomlString(existingTomlText, "model", model);

  const providerMatch = nextToml.match(/^\s*model_provider\s*=\s*"([^"]+)"\s*$/m);
  const providerKey = providerMatch?.[1]?.trim();

  if (providerKey) {
    const sectionName = `model_providers.${providerKey}`;
    const hasSection = nextToml.includes(`[${sectionName}]`);
    if (hasSection) {
      nextToml = upsertSectionTomlString(nextToml, sectionName, "base_url", baseUrl);
      nextToml = upsertTopLevelTomlString(nextToml, "base_url", undefined);
      return nextToml;
    }
  }

  return upsertTopLevelTomlString(nextToml, "base_url", baseUrl);
}

function setPrivatePermissionsIfUnix(dirPath: string, filePath: string): void {
  if (process.platform === "win32") {
    return;
  }

  try {
    fs.chmodSync(dirPath, 0o700);
  } catch {
    // Best-effort permission hardening on Unix.
  }

  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Best-effort permission hardening on Unix.
  }
}

function serializeEnv(env: JsonObject): string {
  return Object.entries(env)
    .filter(([, value]) => typeof value === "string")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function normalizeOpenCodeModels(rawModels: unknown, fallbackModel?: string): JsonObject {
  const models: JsonObject = {};

  if (isObject(rawModels)) {
    for (const [modelId, modelValue] of Object.entries(rawModels)) {
      if (isObject(modelValue) && typeof modelValue.name === "string") {
        models[modelId] = modelValue;
        continue;
      }

      if (typeof modelValue === "string" && modelValue.trim().length > 0) {
        models[modelId] = { name: modelValue };
      }
    }
  }

  if (fallbackModel && !models[fallbackModel]) {
    models[fallbackModel] = { name: fallbackModel };
  }

  return models;
}

function normalizeOpenCodeProviderSettings(config: AiCliConfig): JsonObject {
  const toolConfig = isObject(config.toolConfig) ? config.toolConfig : {};
  const providerRoot = isObject(toolConfig.provider) ? toolConfig.provider : toolConfig;

  const normalized: JsonObject = {
    npm:
      typeof providerRoot.npm === "string" && providerRoot.npm.trim().length > 0
        ? providerRoot.npm
        : "@ai-sdk/openai-compatible",
    options: {},
  };

  if (typeof providerRoot.name === "string" && providerRoot.name.trim().length > 0) {
    normalized.name = providerRoot.name;
  }

  const rawOptions = isObject(providerRoot.options) ? providerRoot.options : {};
  const normalizedOptions: JsonObject = {};

  if (isStringRecord(rawOptions.headers)) {
    normalizedOptions.headers = rawOptions.headers;
  }

  for (const [key, value] of Object.entries(rawOptions)) {
    if (key === "apiKey" || key === "baseURL" || key === "headers") {
      continue;
    }
    normalizedOptions[key] = value;
  }

  normalizedOptions.apiKey = config.commonConfig.apiKey;

  if (config.commonConfig.baseUrl) {
    normalizedOptions.baseURL = config.commonConfig.baseUrl;
  } else if (typeof rawOptions.baseURL === "string" && rawOptions.baseURL.trim().length > 0) {
    normalizedOptions.baseURL = rawOptions.baseURL;
  }

  normalized.options = normalizedOptions;

  const normalizedModels = normalizeOpenCodeModels(
    providerRoot.models,
    config.commonConfig.model,
  );
  if (Object.keys(normalizedModels).length > 0) {
    normalized.models = normalizedModels;
  }

  return normalized;
}

export class AiConfigWriter {
  /**
   * Resolve config directory for a tool, e.g. ~/.claude or ~/.codex
   */
  static getConfigDirForType(type: string): string {
    const homePath = getHomePath();

    switch (type) {
      case "claude":
        return path.join(homePath, ".claude");
      case "codex":
        return path.join(homePath, ".codex");
      case "gemini":
        return path.join(homePath, ".gemini");
      case "opencode":
        return path.join(homePath, ".config", "opencode");
      default:
        return path.join(homePath, `.${type}`);
    }
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
    const configFile = path.join(configDir, "settings.json");
    const baseSettings = isObject(config.toolConfig) ? { ...config.toolConfig } : {};
    const env = isObject(baseSettings.env) ? { ...baseSettings.env } : {};

    env.ANTHROPIC_AUTH_TOKEN = config.commonConfig.apiKey;
    if (config.commonConfig.baseUrl) {
      env.ANTHROPIC_BASE_URL = config.commonConfig.baseUrl;
    }
    if (config.commonConfig.model) {
      env.ANTHROPIC_MODEL = config.commonConfig.model;
    }

    const claudeSettings: JsonObject = {
      ...baseSettings,
      env,
    };

    writeJsonAtomic(configFile, claudeSettings);
    console.log(`[AiConfigWriter] Claude config written: ${configFile}`);
  }

  private static writeCodexConfig(configDir: string, config: AiCliConfig): void {
    const authPath = path.join(configDir, "auth.json");
    const configPath = path.join(configDir, "config.toml");

    const toolConfig = isObject(config.toolConfig) ? config.toolConfig : {};
    const auth = isObject(toolConfig.auth) ? { ...toolConfig.auth } : {};
    delete auth.api_key;
    auth.OPENAI_API_KEY = config.commonConfig.apiKey;

    let tomlContent = typeof toolConfig.config === "string" ? toolConfig.config : "";

    if (!tomlContent.trim()) {
      const existingToml = fs.existsSync(configPath)
        ? fs.readFileSync(configPath, "utf-8")
        : "";
      tomlContent = mergeCodexTomlFromCommonConfig(
        existingToml,
        config.commonConfig.baseUrl,
        config.commonConfig.model,
      );
    }

    if (tomlContent.length > 0 && !tomlContent.endsWith("\n")) {
      tomlContent += "\n";
    }

    const oldAuth = readFileBufferIfExists(authPath);

    writeJsonAtomic(authPath, auth);

    if (process.env.OMINITERM_AI_CONFIG_FAIL_AFTER_CODEX_AUTH_FOR_TEST === "1") {
      if (oldAuth) {
        writeAtomic(authPath, oldAuth);
      } else if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { force: true });
      }
      throw new Error("Injected Codex config failure for testing");
    }

    try {
      writeTextAtomic(configPath, tomlContent);
    } catch (error) {
      if (oldAuth) {
        writeAtomic(authPath, oldAuth);
      } else if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { force: true });
      }
      throw error;
    }

    console.log(`[AiConfigWriter] Codex config written: ${configPath}`);
  }

  private static writeGeminiConfig(configDir: string, config: AiCliConfig): void {
    const envFile = path.join(configDir, ".env");
    const settingsFile = path.join(configDir, "settings.json");
    const toolConfig = isObject(config.toolConfig) ? config.toolConfig : {};
    const env = isObject(toolConfig.env) ? { ...toolConfig.env } : {};

    env.GEMINI_API_KEY = config.commonConfig.apiKey;
    if (config.commonConfig.baseUrl) {
      env.GOOGLE_GEMINI_BASE_URL = config.commonConfig.baseUrl;
    }
    if (config.commonConfig.model) {
      env.GEMINI_MODEL = config.commonConfig.model;
    }

    writeTextAtomic(envFile, `${serializeEnv(env)}\n`);
    setPrivatePermissionsIfUnix(configDir, envFile);

    const configPayload = isObject(toolConfig.config)
      ? toolConfig.config
      : isObject(toolConfig.settings)
      ? toolConfig.settings
      : null;

    if (configPayload) {
      const existing = readJsonObjectIfExists(settingsFile);
      const merged = {
        ...existing,
        ...configPayload,
      };
      writeJsonAtomic(settingsFile, merged);
    };

    console.log(`[AiConfigWriter] Gemini config written: ${envFile}`);
  }

  private static writeOpencodeConfig(configDir: string, config: AiCliConfig): void {
    const configFile = path.join(configDir, "opencode.json");
    const existingConfig = readJsonObjectIfExists(configFile);
    const existingProviders = isObject(existingConfig.provider)
      ? { ...existingConfig.provider }
      : {};
    const providerRecord = normalizeOpenCodeProviderSettings(config);

    const merged = {
      $schema:
        typeof existingConfig.$schema === "string"
          ? existingConfig.$schema
          : "https://opencode.ai/config.json",
      ...existingConfig,
      provider: {
        ...existingProviders,
        [config.configId]: providerRecord,
      },
    };

    writeJsonAtomic(configFile, merged);
    console.log(`[AiConfigWriter] OpenCode config written: ${configFile}`);
  }
}
