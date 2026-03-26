import test from "node:test";
import assert from "node:assert/strict";
import { ProjectScanner } from "../electron/project-scanner.ts";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

async function withTempRepo(
  fn: (repoPath: string) => void | Promise<void>,
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rescan-test-"));
  try {
    execSync("git init", { cwd: dir, stdio: "pipe" });
    execSync("git config user.email test@example.com", {
      cwd: dir,
      stdio: "pipe",
    });
    execSync("git config user.name test", {
      cwd: dir,
      stdio: "pipe",
    });
    execSync("git commit --allow-empty -m init", {
      cwd: dir,
      stdio: "pipe",
    });
    await fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function withTempSubmoduleRepo(
  fn: (submodulePath: string, featurePath: string) => void | Promise<void>,
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rescan-submodule-"));
  const parentRepo = path.join(root, "parent");
  const childRemote = path.join(root, "child-remote");
  fs.mkdirSync(parentRepo, { recursive: true });
  fs.mkdirSync(childRemote, { recursive: true });

  try {
    execSync("git init", { cwd: childRemote, stdio: "pipe" });
    execSync("git config user.email test@example.com", {
      cwd: childRemote,
      stdio: "pipe",
    });
    execSync("git config user.name test", {
      cwd: childRemote,
      stdio: "pipe",
    });
    fs.writeFileSync(path.join(childRemote, "README.md"), "hello\n", "utf-8");
    execSync("git add README.md", { cwd: childRemote, stdio: "pipe" });
    execSync("git commit -m init", { cwd: childRemote, stdio: "pipe" });

    execSync("git init", { cwd: parentRepo, stdio: "pipe" });
    execSync("git config user.email test@example.com", {
      cwd: parentRepo,
      stdio: "pipe",
    });
    execSync("git config user.name test", {
      cwd: parentRepo,
      stdio: "pipe",
    });
    execSync(
      `git -c protocol.file.allow=always submodule add "${normalizePath(childRemote)}" child`,
      {
        cwd: parentRepo,
        stdio: "pipe",
      },
    );
    execSync('git commit -am "add submodule"', {
      cwd: parentRepo,
      stdio: "pipe",
    });

    const submodulePath = path.join(parentRepo, "child");
    const featurePath = path.join(
      parentRepo,
      ".worktrees",
      "child",
      "feature",
    );
    execSync(`git worktree add "${featurePath}" -b feature`, {
      cwd: submodulePath,
      stdio: "pipe",
    });

    await fn(submodulePath, featurePath);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("listWorktreesAsync detects newly added worktree", async () => {
  await withTempRepo(async (repo) => {
    const scanner = new ProjectScanner();
    const before = await scanner.listWorktreesAsync(repo);
    assert.equal(before.length, 1);

    const wtPath = path.join(repo, ".worktrees", "test-wt");
    execSync(`git worktree add "${wtPath}" -b test-branch`, {
      cwd: repo,
      stdio: "pipe",
    });

    const after = await scanner.listWorktreesAsync(repo);
    assert.equal(after.length, 2);
    const realWtPath = fs.realpathSync(wtPath);
    assert.ok(
      after.some((w) => normalizePath(w.path) === normalizePath(realWtPath)),
    );
  });
});

test("scanAsync returns null for non-git directory", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rescan-non-git-"));
  try {
    const scanner = new ProjectScanner();
    const result = await scanner.scanAsync(dir);
    assert.equal(result, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("scanAsync preserves scan semantics for git repos", async () => {
  await withTempRepo(async (repo) => {
    const scanner = new ProjectScanner();
    const syncResult = scanner.scan(repo);
    const asyncResult = await scanner.scanAsync(repo);
    assert.deepEqual(asyncResult, syncResult);
  });
});

test("scanAsync normalizes a submodule main worktree back to the real project root", async () => {
  await withTempSubmoduleRepo(async (submodulePath, featurePath) => {
    const scanner = new ProjectScanner();
    const result = await scanner.scanAsync(submodulePath);

    assert.ok(result);
    assert.equal(normalizePath(result.path), normalizePath(submodulePath));
    assert.equal(result.worktrees.length, 2);
    assert.deepEqual(
      result.worktrees.map((worktree) => ({
        branch: worktree.branch,
        path: normalizePath(worktree.path),
      })),
      [
        { branch: "master", path: normalizePath(submodulePath) },
        { branch: "feature", path: normalizePath(featurePath) },
      ],
    );
  });
});

test("normalizeWorktreePaths applies resolveWorktreeRoot to each worktree", () => {
  const scanner = new ProjectScanner() as any;
  const projectPath = "C:/repo/cde-base";
  const originalResolveWorktreeRoot = scanner.resolveWorktreeRoot;
  scanner.resolveWorktreeRoot = (candidate: string) =>
    candidate === "C:/repo/.git/modules/cde-base" ? projectPath : candidate;

  const normalized = scanner.normalizeWorktreePaths([
    {
      path: "C:/repo/.git/modules/cde-base",
      branch: "dev",
      isMain: true,
    },
    {
      path: "C:/repo/.worktree/cde-base/feature-branch",
      branch: "feature-branch",
      isMain: false,
    },
  ]);

  scanner.resolveWorktreeRoot = originalResolveWorktreeRoot;

  assert.equal(normalized[0].path, projectPath);
  assert.equal(normalized[1].path, "C:/repo/.worktree/cde-base/feature-branch");
});
