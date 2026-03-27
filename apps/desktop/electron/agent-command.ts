import { execFile as execFileCallback } from "child_process";

import {
  buildLaunchSpec,
  type PtyResolvedLaunchSpec,
} from "./pty-launch.ts";

export type AgentCommandValidationResult =
  | { ok: true; resolvedPath: string; version: string | null }
  | { ok: false; error: string };

type ExecFileCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;

interface ExecFileOptions {
  encoding: "utf-8";
  timeout: number;
  env: Record<string, string>;
}

export interface AgentCommandValidationDeps {
  cwd: string;
  resolveLaunchSpec: (
    command: string,
  ) => Promise<PtyResolvedLaunchSpec>;
  execFile: (
    file: string,
    args: string[],
    options: ExecFileOptions,
    callback: ExecFileCallback,
  ) => void;
}

const defaultDeps: AgentCommandValidationDeps = {
  cwd: process.cwd(),
  resolveLaunchSpec: (command) =>
    buildLaunchSpec({
      cwd: process.cwd(),
      shell: command,
    }),
  execFile: (file, args, options, callback) => {
    execFileCallback(file, args, options, callback);
  },
};

export async function validateAgentCommand(
  command: string,
  overrides: Partial<AgentCommandValidationDeps> = {},
): Promise<AgentCommandValidationResult> {
  const deps = { ...defaultDeps, ...overrides };
  const resolveLaunchSpec = overrides.resolveLaunchSpec
    ?? ((nextCommand: string) =>
      buildLaunchSpec({
        cwd: deps.cwd,
        shell: nextCommand,
      }));

  try {
    const spec = await resolveLaunchSpec(command);
    const version = await new Promise<string | null>((resolve) => {
      deps.execFile(
        spec.file,
        ["--version"],
        { encoding: "utf-8", timeout: 5000, env: spec.env },
        (error, stdout) => {
          if (error) {
            resolve(null);
            return;
          }

          const line = stdout.trim().split("\n")[0];
          resolve(line || null);
        },
      );
    });

    return {
      ok: true,
      resolvedPath: spec.file,
      version,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
