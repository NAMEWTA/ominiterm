import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

type GitHubRepo = {
  owner: string;
  repo: string;
};

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..", "..");
const desktopDir = path.resolve(testDir, "..");

function parseGitHubRepo(url: string): GitHubRepo {
  const match = url.trim().match(/github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/i);
  assert.ok(match, `Expected a GitHub repository URL, received: ${url}`);
  return {
    owner: match[1],
    repo: match[2],
  };
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function readOriginRepo(): GitHubRepo {
  const remoteUrl = execFileSync("git", ["config", "--get", "remote.origin.url"], {
    cwd: repoRoot,
    encoding: "utf-8",
  }).trim();
  return parseGitHubRepo(remoteUrl);
}

function readDesktopPackageJson(): {
  version: string;
  homepage: string;
  repository: { url: string };
  bugs: { url: string };
  scripts: { build: string };
  bin?: Record<string, string>;
} {
  return readJson(path.join(desktopDir, "package.json"));
}

function readWebsitePackageJson(): {
  version: string;
} {
  return readJson(path.join(repoRoot, "apps", "website", "package.json"));
}

function readRootPackageJson(): {
  scripts: Record<string, string>;
} {
  return readJson(path.join(repoRoot, "package.json"));
}

function readElectronBuilderPublishRepo(): GitHubRepo {
  const builderConfig = fs.readFileSync(
    path.join(desktopDir, "electron-builder.yml"),
    "utf-8",
  );
  const ownerMatch = builderConfig.match(/^\s*owner:\s*(.+)\s*$/m);
  const repoMatch = builderConfig.match(/^\s*repo:\s*(.+)\s*$/m);
  assert.ok(ownerMatch, "electron-builder.yml is missing publish.owner");
  assert.ok(repoMatch, "electron-builder.yml is missing publish.repo");
  return {
    owner: ownerMatch[1].trim(),
    repo: repoMatch[1].trim(),
  };
}

test("desktop package GitHub links match the origin remote", () => {
  const originRepo = readOriginRepo();
  const packageJson = readDesktopPackageJson();
  const expectedBaseUrl = `https://github.com/${originRepo.owner}/${originRepo.repo}`;

  assert.equal(packageJson.homepage, expectedBaseUrl);
  assert.equal(packageJson.repository.url, `${expectedBaseUrl}.git`);
  assert.equal(packageJson.bugs.url, `${expectedBaseUrl}/issues`);
});

test("electron-builder publish target matches the origin remote", () => {
  const originRepo = readOriginRepo();

  assert.deepEqual(readElectronBuilderPublishRepo(), originRepo);
});

test("repository links in docs and website match the origin remote", () => {
  const originRepo = readOriginRepo();
  const baseUrl = `https://github.com/${originRepo.owner}/${originRepo.repo}`;
  const releaseUrl = `${baseUrl}/releases`;
  const cloneUrl = `${baseUrl}.git`;

  const files = [
    path.join(repoRoot, "README.md"),
    path.join(repoRoot, "README.zh-CN.md"),
    path.join(repoRoot, "apps", "website", "index.html"),
  ];

  for (const filePath of files) {
    const contents = fs.readFileSync(filePath, "utf-8");
    assert.match(
      contents,
      new RegExp(baseUrl.replaceAll("/", "\\/")),
      `${filePath} should reference ${baseUrl}`,
    );
  }

  assert.match(
    fs.readFileSync(path.join(repoRoot, "README.md"), "utf-8"),
    new RegExp(cloneUrl.replaceAll("/", "\\/")),
  );
  assert.match(
    fs.readFileSync(path.join(repoRoot, "README.zh-CN.md"), "utf-8"),
    new RegExp(cloneUrl.replaceAll("/", "\\/")),
  );
  assert.match(
    fs.readFileSync(path.join(repoRoot, "apps", "website", "index.html"), "utf-8"),
    new RegExp(releaseUrl.replaceAll("/", "\\/")),
  );
});

test("desktop and website package versions are pinned to 0.0.1", () => {
  assert.equal(readDesktopPackageJson().version, "0.0.1");
  assert.equal(readWebsitePackageJson().version, "0.0.1");
});

test("workspace configuration no longer references hydra or eval packages", () => {
  const rootPackageJson = readRootPackageJson();
  const workspaceConfig = fs.readFileSync(
    path.join(repoRoot, "pnpm-workspace.yaml"),
    "utf-8",
  );

  assert.equal(workspaceConfig.includes('"tools/*"'), false);
  assert.equal(workspaceConfig.includes('"apps/*"'), true);

  for (const script of Object.values(rootPackageJson.scripts)) {
    assert.equal(/@ominiterm\/hydra|@ominiterm\/eval|tools\/hydra|tools\/eval/.test(script), false);
  }
});

test("desktop package and builder config no longer bundle desktop CLI or shipped skills", () => {
  const desktopPackageJson = readDesktopPackageJson();
  const builderConfig = fs.readFileSync(
    path.join(desktopDir, "electron-builder.yml"),
    "utf-8",
  );

  assert.equal("bin" in desktopPackageJson, false);
  assert.equal(/dist-cli|prepare-hydra-cli/.test(desktopPackageJson.scripts.build), false);
  assert.equal(/dist-cli|to:\s*cli|from:\s*skills|to:\s*skills/.test(builderConfig), false);
});

test("preload and renderer types expose agents.validateCommand instead of the old cli bridge", () => {
  const preloadSource = fs.readFileSync(
    path.join(repoRoot, "apps", "desktop", "electron", "preload.ts"),
    "utf-8",
  );
  const typeSource = fs.readFileSync(
    path.join(repoRoot, "apps", "desktop", "src", "types", "index.ts"),
    "utf-8",
  );

  assert.match(preloadSource, /agents:\s*\{/);
  assert.match(preloadSource, /validateCommand:\s*\(command: string\)/);
  assert.equal(/cli:\s*\{/.test(preloadSource), false);

  assert.match(typeSource, /agents:\s*\{/);
  assert.match(typeSource, /validateCommand:\s*\(command: string\)/);
  assert.equal(/cli:\s*\{/.test(typeSource), false);
});

test("tooling packages, desktop CLI bridge, and old tooling docs are removed", () => {
  const removedPaths = [
    path.join(repoRoot, "tools"),
    path.join(repoRoot, "apps", "desktop", "cli"),
    path.join(repoRoot, "apps", "desktop", "skills"),
    path.join(repoRoot, "apps", "desktop", "scripts", "prepare-hydra-cli.mjs"),
    path.join(repoRoot, "docs", "tooling", "cli-and-hydra.md"),
    path.join(repoRoot, "docs", "tooling", "eval-framework.md"),
  ];

  for (const removedPath of removedPaths) {
    assert.equal(fs.existsSync(removedPath), false, `${removedPath} should be removed`);
  }
});
