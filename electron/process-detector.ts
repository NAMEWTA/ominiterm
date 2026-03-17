import { execFile } from "child_process";

export interface DetectedCli {
  pid: number;
  cliType: string;
  args: string;
}

// CLI names we recognise. Order matters: first match wins.
const CLI_PATTERNS: [RegExp, string][] = [
  [/\bclaude\b/, "claude"],
  [/\bcodex\b/, "codex"],
  [/\bkimi\b/, "kimi"],
  [/\bgemini\b/, "gemini"],
  [/\bopencode\b/, "opencode"],
  [/\blazygit\b/, "lazygit"],
  [/\btmux\b/, "tmux"],
];

// Wrappers that delegate to another binary — check subsequent args for the real CLI
const WRAPPER_NAMES = new Set(["node", "bun", "npx", "bunx"]);

function matchCli(args: string): string | null {
  // Extract the process name (first token)
  const firstToken = args.split(/\s+/)[0];
  const baseName = firstToken.split("/").pop() ?? "";

  // If the process is a wrapper (node, bun, npx, bunx), match against the full args string
  // to catch patterns like `node /usr/local/bin/claude` or `npx codex`
  if (WRAPPER_NAMES.has(baseName)) {
    // Skip the wrapper name and match the rest
    const rest = args.slice(firstToken.length);
    for (const [pattern, cliType] of CLI_PATTERNS) {
      if (pattern.test(rest)) return cliType;
    }
    return null;
  }

  // Direct execution: match just the base process name
  for (const [pattern, cliType] of CLI_PATTERNS) {
    if (pattern.test(baseName)) return cliType;
  }
  return null;
}

/**
 * Parse `ps -eo pid,ppid,args` output and find CLI processes
 * that are direct children of the given shell PIDs.
 */
export function parsePsOutput(psOutput: string, shellPids: number[]): DetectedCli[] {
  const parentSet = new Set(shellPids);
  const results: DetectedCli[] = [];

  const lines = psOutput.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("PID")) continue;

    // Format: "  PID  PPID ARGS..."
    const match = trimmed.match(/^(\d+)\s+(\d+)\s+(.+)$/);
    if (!match) continue;

    const pid = parseInt(match[1], 10);
    const ppid = parseInt(match[2], 10);
    const args = match[3];

    if (!parentSet.has(ppid)) continue;

    const cliType = matchCli(args);
    if (cliType) {
      results.push({ pid, cliType, args });
    }
  }

  return results;
}

/**
 * Detect a CLI tool running as a direct child of the given shell PID.
 * Returns the CLI type and optional session name (for tmux).
 */
export async function detectCli(
  shellPid: number,
): Promise<{ cliType: string; sessionName?: string } | null> {
  const psOutput = await new Promise<string>((resolve, reject) => {
    execFile("ps", ["-eo", "pid,ppid,args"], (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });

  const results = parsePsOutput(psOutput, [shellPid]);
  if (results.length === 0) return null;

  const first = results[0];

  if (first.cliType === "tmux") {
    // Get the tmux session name
    try {
      const sessionName = await new Promise<string>((resolve, reject) => {
        execFile("tmux", ["display-message", "-p", "#S"], (err, stdout) => {
          if (err) return reject(err);
          resolve(stdout.trim());
        });
      });
      return { cliType: "tmux", sessionName };
    } catch {
      return { cliType: "tmux" };
    }
  }

  return { cliType: first.cliType };
}
