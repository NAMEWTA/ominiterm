import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PORT_FILE = path.join(os.homedir(), ".termcanvas", "port");

export function isTermCanvasRunning(): boolean {
  try {
    fs.readFileSync(PORT_FILE, "utf-8");
    return true;
  } catch {
    return false;
  }
}

export function parseJsonOrDie(stdout: string): any {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`Failed to parse TermCanvas response: ${stdout.slice(0, 200)}`);
  }
}

export function buildTermcanvasArgs(
  group: string,
  command: string,
  args: string[],
): string[] {
  return [group, command, ...args, "--json"];
}

function tc(group: string, command: string, args: string[] = []): any {
  const fullArgs = buildTermcanvasArgs(group, command, args);
  const stdout = execSync(`termcanvas ${fullArgs.join(" ")}`, {
    encoding: "utf-8",
    timeout: 10_000,
  });
  return parseJsonOrDie(stdout);
}

export function projectList(): any[] {
  return tc("project", "list");
}

export function projectRescan(projectId: string): void {
  tc("project", "rescan", [projectId]);
}

export function terminalCreate(worktreePath: string, type: string): { id: string; type: string; title: string } {
  return tc("terminal", "create", ["--worktree", worktreePath, "--type", type]);
}

export function terminalStatus(terminalId: string): { id: string; status: string; ptyId: number | null } {
  return tc("terminal", "status", [terminalId]);
}

export function terminalInput(terminalId: string, text: string): void {
  const stdout = execSync(
    `termcanvas terminal input ${terminalId} ${JSON.stringify(text)} --json`,
    { encoding: "utf-8", timeout: 5_000 },
  );
  parseJsonOrDie(stdout);
}

export function terminalDestroy(terminalId: string): void {
  tc("terminal", "destroy", [terminalId]);
}

export function findProjectByPath(repoPath: string): { id: string; path: string } | null {
  const abs = path.resolve(repoPath);
  const projects = projectList();
  for (const p of projects) {
    if (p.path === abs) return { id: p.id, path: p.path };
    for (const w of p.worktrees ?? []) {
      if (w.path === abs) return { id: p.id, path: p.path };
    }
  }
  return null;
}
