import { execFile, execFileSync, execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

interface WorktreeInfo {
  path: string;
  branch: string;
  isMain: boolean;
}

interface ProjectInfo {
  name: string;
  path: string;
  worktrees: WorktreeInfo[];
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function looksLikeGitInternalPath(value: string): boolean {
  const normalized = normalizeSlashes(value).toLowerCase();
  return normalized.includes("/.git/modules/") || normalized.endsWith("/.git");
}

function parseWorktreesOutput(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> & { prunable?: boolean } = {};

  // Ensure the final record is flushed even if output doesn't end with '\n'
  for (const line of (output.endsWith("\n") ? output : `${output}\n`).split("\n")) {
    if (line.startsWith("worktree ")) {
      current.path = line.slice("worktree ".length);
    } else if (line.startsWith("branch ")) {
      const ref = line.slice("branch ".length);
      current.branch = ref.replace("refs/heads/", "");
    } else if (line === "bare") {
      current.branch = "(bare)";
    } else if (line.startsWith("prunable")) {
      current.prunable = true;
    } else if (line === "") {
      if (current.path && !current.prunable && existsSync(current.path)) {
        worktrees.push({
          path: current.path,
          branch: current.branch ?? "(detached)",
          isMain: worktrees.length === 0,
        });
      }
      current = {};
    }
  }

  return worktrees;
}

function runGitAsync(dirPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      { cwd: dirPath, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

export class ProjectScanner {
  private resolveProjectRoot(dirPath: string): string {
    try {
      const topLevel = execFileSync("git", ["-C", dirPath, "rev-parse", "--show-toplevel"], {
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
      }).trim();
      return topLevel || dirPath;
    } catch {
      return dirPath;
    }
  }

  private resolveWorktreeRoot(pathCandidate: string): string {
    if (!looksLikeGitInternalPath(pathCandidate)) {
      return pathCandidate;
    }

    try {
      const output = execFileSync(
        "git",
        ["--git-dir", pathCandidate, "worktree", "list", "--porcelain"],
        {
          encoding: "utf-8",
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      for (const line of output.split("\n")) {
        if (!line.startsWith("worktree ")) {
          continue;
        }
        const worktreePath = line.slice("worktree ".length).trim();
        if (!worktreePath || !existsSync(worktreePath)) {
          continue;
        }
        if (!looksLikeGitInternalPath(worktreePath)) {
          return worktreePath;
        }
      }
    } catch {
      // keep fallback path
    }

    try {
      const topLevel = execFileSync("git", ["-C", pathCandidate, "rev-parse", "--show-toplevel"], {
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
      }).trim();
      if (topLevel && existsSync(topLevel)) {
        return topLevel;
      }
    } catch {
      // keep fallback path
    }

    const parentDir = path.dirname(pathCandidate);
    if (existsSync(parentDir) && !looksLikeGitInternalPath(parentDir)) {
      return parentDir;
    }

    return pathCandidate;
  }

  private normalizeWorktreePaths(worktrees: WorktreeInfo[]): WorktreeInfo[] {
    return worktrees.map((worktree) => ({
      ...worktree,
      path: this.resolveWorktreeRoot(worktree.path),
    }));
  }

  scan(dirPath: string): ProjectInfo | null {
    const projectPath = this.resolveProjectRoot(dirPath);
    try {
      execSync("git rev-parse --git-dir", { cwd: projectPath, stdio: "pipe" });
    } catch {
      return null;
    }

    const name = path.basename(projectPath);
    const worktrees = this.normalizeWorktreePaths(this.listWorktrees(projectPath));

    return { name, path: projectPath, worktrees };
  }

  async scanAsync(dirPath: string): Promise<ProjectInfo | null> {
    const projectPath = this.resolveProjectRoot(dirPath);
    try {
      await runGitAsync(projectPath, ["rev-parse", "--git-dir"]);
    } catch {
      return null;
    }

    const name = path.basename(projectPath);
    const worktrees = this.normalizeWorktreePaths(
      await this.listWorktreesAsync(projectPath),
    );

    return { name, path: projectPath, worktrees };
  }

  listWorktrees(dirPath: string): WorktreeInfo[] {
    try {
      const output = execFileSync(
        "git",
        ["worktree", "list", "--porcelain"],
        {
          cwd: dirPath,
          encoding: "utf-8",
          maxBuffer: 10 * 1024 * 1024,
        },
      );

      return parseWorktreesOutput(output);
    } catch {
      return [
        {
          path: dirPath,
          branch: this.getCurrentBranch(dirPath),
          isMain: true,
        },
      ];
    }
  }

  async listWorktreesAsync(dirPath: string): Promise<WorktreeInfo[]> {
    try {
      const output = await runGitAsync(dirPath, [
        "worktree",
        "list",
        "--porcelain",
      ]);
      return parseWorktreesOutput(output);
    } catch {
      return [
        {
          path: dirPath,
          branch: await this.getCurrentBranchAsync(dirPath),
          isMain: true,
        },
      ];
    }
  }

  private getCurrentBranch(dirPath: string): string {
    try {
      return execFileSync("git", ["branch", "--show-current"], {
        cwd: dirPath,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
      }).trim();
    } catch {
      return "(unknown)";
    }
  }

  private async getCurrentBranchAsync(dirPath: string): Promise<string> {
    try {
      return (await runGitAsync(dirPath, ["branch", "--show-current"])).trim();
    } catch {
      return "(unknown)";
    }
  }
}
