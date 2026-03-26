function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

export function isGitInternalWorktreePath(value: string): boolean {
  const normalized = normalizeSlashes(value).toLowerCase();
  return normalized.includes("/.git/modules/") || normalized.endsWith("/.git");
}

export function normalizeStoredWorktreePath(
  projectPath: string,
  worktreePath: string,
): string {
  if (!projectPath || !worktreePath) {
    return worktreePath;
  }
  return isGitInternalWorktreePath(worktreePath) ? projectPath : worktreePath;
}

export function normalizeWorktreePathKey(
  projectPath: string,
  worktreePath: string,
): string {
  const unified = normalizeStoredWorktreePath(projectPath, worktreePath)
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");
  if (/^[a-zA-Z]:\//.test(unified)) {
    return unified.toLowerCase();
  }
  return unified;
}
