import fs from "fs";
import path from "path";
import { execSync } from "child_process";

/**
 * Watches .git/HEAD and .git/index for mtime changes using Codex's
 * parent-directory fs.watch technique. Verifies mtime actually changed
 * before firing callback to avoid macOS false positives.
 */
export class GitFileWatcher {
  private watchers = new Map<string, fs.FSWatcher>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private lastMtimes = new Map<string, number>();

  watch(worktreePath: string, callback: () => void): void {
    if (this.watchers.has(worktreePath)) return;

    let gitDir: string;
    try {
      gitDir = execSync("git rev-parse --git-dir", {
        cwd: worktreePath,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      if (!path.isAbsolute(gitDir)) {
        gitDir = path.resolve(worktreePath, gitDir);
      }
    } catch {
      return;
    }

    const trackedFiles = ["HEAD", "index"];

    // Record initial mtimes
    for (const name of trackedFiles) {
      const key = `${worktreePath}:${name}`;
      try {
        this.lastMtimes.set(key, fs.statSync(path.join(gitDir, name)).mtimeMs);
      } catch {
        this.lastMtimes.set(key, 0);
      }
    }

    const debouncedCallback = () => {
      const existing = this.debounceTimers.get(worktreePath);
      if (existing) clearTimeout(existing);
      this.debounceTimers.set(
        worktreePath,
        setTimeout(() => {
          this.debounceTimers.delete(worktreePath);
          callback();
        }, 500),
      );
    };

    try {
      const watcher = fs.watch(gitDir, (event, changedFile) => {
        if (changedFile && changedFile !== "HEAD" && changedFile !== "index") {
          return;
        }

        const targetName = changedFile ?? "HEAD";
        const filePath = path.join(gitDir, targetName);
        const mtimeKey = `${worktreePath}:${targetName}`;

        let newMtime = 0;
        try {
          newMtime = fs.statSync(filePath).mtimeMs;
        } catch {
          return;
        }

        const lastMtime = this.lastMtimes.get(mtimeKey) ?? 0;
        if (event !== "rename" && newMtime === lastMtime) return;
        this.lastMtimes.set(mtimeKey, newMtime);
        debouncedCallback();
      });
      this.watchers.set(worktreePath, watcher);
    } catch {
      // gitDir doesn't exist or can't be watched
    }
  }

  unwatch(worktreePath: string): void {
    const watcher = this.watchers.get(worktreePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(worktreePath);
    }
    const timer = this.debounceTimers.get(worktreePath);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(worktreePath);
    }
    // Clean up mtime entries
    for (const key of this.lastMtimes.keys()) {
      if (key.startsWith(`${worktreePath}:`)) {
        this.lastMtimes.delete(key);
      }
    }
  }

  unwatchAll(): void {
    for (const key of [...this.watchers.keys()]) {
      this.unwatch(key);
    }
  }
}
