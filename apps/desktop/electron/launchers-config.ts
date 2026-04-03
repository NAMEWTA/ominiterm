import fs from "fs";
import path from "path";
import type {
  LauncherCommandStep,
  LauncherConfigItem,
} from "../src/types/index.ts";

const SUPPORTED_VERSION = 1 as const;
const HOST_SHELL_VALUES = new Set(["auto", "pwsh", "bash", "zsh", "cmd"]);
const RUN_POLICY_ON_FAILURE = "stop" as const;
const RUN_POLICY_RUN_ON_NEW_SESSION_ONLY = true as const;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 600000;
const ISO_UTC_STRING_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export type { LauncherCommandStep, LauncherConfigItem };

export interface LaunchersConfigFile {
  version: 1;
  updatedAt: string;
  launchers: LauncherConfigItem[];
}

export function ensureLaunchersFile(filePath: string): void {
  ensureDir(path.dirname(filePath));
  if (fs.existsSync(filePath)) {
    return;
  }
  writeLaunchersConfigAtomically(filePath, createEmptyConfig());
}

export function loadLaunchersConfig(filePath: string): LaunchersConfigFile {
  ensureLaunchersFile(filePath);

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    throw new Error(
      `[LaunchersConfig] failed to parse config file: ${String(error)}`,
    );
  }

  validateLaunchersConfig(raw);
  return raw;
}

export function saveLaunchersConfig(
  filePath: string,
  config: LaunchersConfigFile,
): void {
  validateLaunchersConfig(config);
  ensureDir(path.dirname(filePath));
  writeLaunchersConfigAtomically(filePath, config);
}

function createEmptyConfig(): LaunchersConfigFile {
  return {
    version: SUPPORTED_VERSION,
    updatedAt: new Date().toISOString(),
    launchers: [],
  };
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeLaunchersConfigAtomically(
  filePath: string,
  config: LaunchersConfigFile,
): void {
  const tmpFilePath = `${filePath}.tmp`;
  fs.writeFileSync(tmpFilePath, JSON.stringify(config, null, 2), "utf-8");
  fs.renameSync(tmpFilePath, filePath);
}

function validateLaunchersConfig(value: unknown): asserts value is LaunchersConfigFile {
  assertObject(value, "config");

  if (value.version !== SUPPORTED_VERSION) {
    throw new Error("config.version must be 1");
  }

  assertIsoDateString(value.updatedAt, "config.updatedAt");

  if (!Array.isArray(value.launchers)) {
    throw new Error("config.launchers must be an array");
  }

  const idSet = new Set<string>();
  for (let index = 0; index < value.launchers.length; index += 1) {
    const launcher = value.launchers[index];
    const prefix = `config.launchers[${index}]`;
    assertObject(launcher, prefix);

    const id = assertNonEmptyString(launcher.id, `${prefix}.id`);
    if (idSet.has(id)) {
      throw new Error(`duplicate launcher id: ${id}`);
    }
    idSet.add(id);

    assertNonEmptyString(launcher.name, `${prefix}.name`);
    assertBoolean(launcher.enabled, `${prefix}.enabled`);

    if (
      typeof launcher.hostShell !== "string" ||
      !HOST_SHELL_VALUES.has(launcher.hostShell)
    ) {
      throw new Error(`${prefix}.hostShell is invalid`);
    }

    assertObject(launcher.mainCommand, `${prefix}.mainCommand`);
    assertNonEmptyString(
      launcher.mainCommand.command,
      `${prefix}.mainCommand.command`,
    );
    assertStringArray(launcher.mainCommand.args, `${prefix}.mainCommand.args`);

    if (!Array.isArray(launcher.startupCommands)) {
      throw new Error(`${prefix}.startupCommands must be an array`);
    }

    for (let stepIndex = 0; stepIndex < launcher.startupCommands.length; stepIndex += 1) {
      const step = launcher.startupCommands[stepIndex];
      const stepPrefix = `${prefix}.startupCommands[${stepIndex}]`;
      assertObject(step, stepPrefix);
      assertNonEmptyString(step.label, `${stepPrefix}.label`);
      assertNonEmptyString(step.command, `${stepPrefix}.command`);

      if (
        typeof step.timeoutMs !== "number" ||
        !Number.isInteger(step.timeoutMs) ||
        step.timeoutMs < MIN_TIMEOUT_MS ||
        step.timeoutMs > MAX_TIMEOUT_MS
      ) {
        throw new Error(
          `${stepPrefix}.timeoutMs must be an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}`,
        );
      }
    }

    assertObject(launcher.runPolicy, `${prefix}.runPolicy`);
    if (
      launcher.runPolicy.runOnNewSessionOnly !==
      RUN_POLICY_RUN_ON_NEW_SESSION_ONLY
    ) {
      throw new Error(
        `${prefix}.runPolicy.runOnNewSessionOnly must be true`,
      );
    }
    if (launcher.runPolicy.onFailure !== RUN_POLICY_ON_FAILURE) {
      throw new Error(`${prefix}.runPolicy.onFailure must be stop`);
    }
  }
}

function assertObject(
  value: unknown,
  fieldName: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
}

function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return value;
}

function assertStringArray(
  value: unknown,
  fieldName: string,
): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${fieldName} must be a string array`);
  }
}

function assertBoolean(value: unknown, fieldName: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be boolean`);
  }
}

function assertIsoDateString(value: unknown, fieldName: string): void {
  if (typeof value !== "string" || !ISO_UTC_STRING_PATTERN.test(value)) {
    throw new Error(`${fieldName} must be an ISO date string`);
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error(`${fieldName} must be an ISO date string`);
  }
}