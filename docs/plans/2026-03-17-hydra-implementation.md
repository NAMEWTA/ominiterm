# Hydra Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI tool (`hydra`) that lets AI agents spawn sub-agents as visible TermCanvas terminals.

**Architecture:** Hydra is a standalone TypeScript CLI in `hydra/` that shells out to `termcanvas` CLI and `git`. Three commands: `spawn`, `list`, `cleanup`. Agent records stored in `~/.hydra/agents/`. TermCanvas gets one new API endpoint (`POST /project/:id/rescan`) to trigger immediate worktree detection.

**Tech Stack:** TypeScript, Node.js, `node:child_process` (execSync), esbuild, node:test

---

### Task 1: TermCanvas rescan API

Add `POST /project/:id/rescan` to TermCanvas so Hydra can trigger immediate worktree re-detection after creating a git worktree.

**Files:**
- Modify: `electron/api-server.ts`
- Modify: `cli/termcanvas.ts`
- Modify: `src/App.tsx` (expose `syncWorktrees` via `__tcApi`)
- Test: `tests/api-rescan.test.ts`

**Step 1: Write the test**

```typescript
// tests/api-rescan.test.ts
import test from "node:test";
import assert from "node:assert/strict";

// Unit-test the rescan logic in isolation.
// We can't easily test the full HTTP path without Electron,
// so we test that the projectScanner.listWorktrees() returns
// correct data when a worktree is added.

import { ProjectScanner } from "../electron/project-scanner.ts";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function withTempRepo(fn: (repoPath: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rescan-test-"));
  try {
    execSync("git init && git commit --allow-empty -m init", {
      cwd: dir,
      stdio: "pipe",
    });
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("listWorktrees detects newly added worktree", () => {
  withTempRepo((repo) => {
    const scanner = new ProjectScanner();

    const before = scanner.listWorktrees(repo);
    assert.equal(before.length, 1);

    const wtPath = path.join(repo, ".worktrees", "test-wt");
    execSync(`git worktree add "${wtPath}" -b test-branch`, {
      cwd: repo,
      stdio: "pipe",
    });

    const after = scanner.listWorktrees(repo);
    assert.equal(after.length, 2);
    assert.ok(after.some((w) => w.path === wtPath));
  });
});
```

**Step 2: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/api-rescan.test.ts`
Expected: PASS (this tests existing `ProjectScanner` functionality)

**Step 3: Expose `syncWorktrees` in `__tcApi`**

In `src/App.tsx`, add `syncWorktrees` to the `api` object inside the `useEffect` (around line 329, before `(window as any).__tcApi = api`):

```typescript
      syncWorktrees: (projectPath: string, worktrees: any[]) => {
        useProjectStore.getState().syncWorktrees(projectPath, worktrees);
        return true;
      },
```

**Step 4: Add rescan route to API server**

In `electron/api-server.ts`, add to the `route()` method, after the `projectRemove` route (after line 82):

```typescript
    if (method === "POST" && pathname.match(/^\/project\/[^/]+\/rescan$/)) {
      const id = pathname.split("/")[2];
      return this.projectRescan(id);
    }
```

Add the implementation method (after `projectRemove`):

```typescript
  private async projectRescan(projectId: string) {
    const projects = await this.execRenderer(`window.__tcApi.getProjects()`);
    const project = projects.find((p: any) => p.id === projectId);
    if (!project)
      throw Object.assign(new Error("Project not found"), { status: 404 });

    const worktrees = this.deps.projectScanner.listWorktrees(project.path);
    await this.execRenderer(
      `window.__tcApi.syncWorktrees(${JSON.stringify(project.path)}, ${JSON.stringify(worktrees)})`,
    );
    return { ok: true, worktrees: worktrees.length };
  }
```

**Step 5: Add `rescan` subcommand to CLI**

In `cli/termcanvas.ts`, add inside the `if (group === "project")` block (after the `remove` handler, before the `else`):

```typescript
      } else if (command === "rescan" && rest[0]) {
        const result = await request("POST", `/project/${rest[0]}/rescan`);
        if (jsonFlag) console.log(JSON.stringify(result, null, 2));
        else console.log(`Rescanned. ${result.worktrees} worktree(s) found.`);
```

Also add to the help text at the bottom:

```
  project rescan <id>                         Rescan worktrees
```

**Step 6: Run all existing tests to confirm no regressions**

Run: `node --experimental-strip-types --test tests/api-rescan.test.ts tests/pty-launch.test.ts tests/session-watcher.test.ts tests/process-detector.test.ts`
Expected: All PASS

**Step 7: Commit**

```bash
git add electron/api-server.ts cli/termcanvas.ts src/App.tsx tests/api-rescan.test.ts
git commit -m "Add project rescan API for immediate worktree detection"
```

---

### Task 2: Hydra project scaffold

Set up the `hydra/` directory with package.json, tsconfig, build script, and the CLI entry point with command routing.

**Files:**
- Create: `hydra/package.json`
- Create: `hydra/tsconfig.json`
- Create: `hydra/build.ts`
- Create: `hydra/src/cli.ts`

**Step 1: Create `hydra/package.json`**

```json
{
  "name": "hydra",
  "version": "0.1.0",
  "description": "TermCanvas sub-agent spawner",
  "type": "module",
  "bin": {
    "hydra": "./dist/hydra.js"
  },
  "scripts": {
    "build": "node --experimental-strip-types build.ts",
    "test": "node --experimental-strip-types --test tests/**/*.test.ts",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "esbuild": "^0.25.0",
    "typescript": "^5.9.3"
  }
}
```

**Step 2: Create `hydra/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

**Step 3: Create `hydra/build.ts`**

```typescript
import { build } from "esbuild";

await build({
  entryPoints: ["src/cli.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/hydra.js",
  banner: { js: "#!/usr/bin/env node" },
});
```

**Step 4: Create `hydra/src/cli.ts`**

```typescript
const args = process.argv.slice(2);
const [command, ...rest] = args;

function printUsage() {
  console.log("Usage: hydra <spawn|list|cleanup> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  spawn    Spawn a sub-agent in a new TermCanvas terminal");
  console.log("  list     List all spawned agents");
  console.log("  cleanup  Clean up agent worktrees and terminals");
}

async function main() {
  switch (command) {
    case "spawn":
      const { spawn } = await import("./spawn.js");
      await spawn(rest);
      break;
    case "list":
      const { list } = await import("./list.js");
      await list(rest);
      break;
    case "cleanup":
      const { cleanup } = await import("./cleanup.js");
      await cleanup(rest);
      break;
    default:
      printUsage();
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
```

**Step 5: Install deps and verify build**

Run: `cd hydra && npm install && npm run build`
Expected: `dist/hydra.js` is created (will error on missing spawn/list/cleanup, that's fine for now)

**Step 6: Commit**

```bash
git add hydra/package.json hydra/tsconfig.json hydra/build.ts hydra/src/cli.ts
git commit -m "Scaffold hydra CLI project"
```

---

### Task 3: Store module (`~/.hydra/agents/`)

Read/write agent records to `~/.hydra/agents/{id}.json`.

**Files:**
- Create: `hydra/src/store.ts`
- Create: `hydra/tests/store.test.ts`

**Step 1: Write the test**

```typescript
// hydra/tests/store.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Override HYDRA_HOME for tests
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "hydra-store-"));
process.env.HYDRA_HOME = testDir;

const { saveAgent, loadAgent, listAgents, deleteAgent } = await import(
  "../src/store.js"
);

const record = {
  id: "hydra-1234-abcd",
  task: "fix the bug",
  type: "claude",
  repo: "/tmp/repo",
  terminalId: "tc-001",
  worktreePath: "/tmp/repo/.worktrees/hydra-1234-abcd",
  branch: "hydra/1234-abcd",
  baseBranch: "main",
  ownWorktree: true,
  createdAt: new Date().toISOString(),
};

test("saveAgent + loadAgent round-trip", () => {
  saveAgent(record);
  const loaded = loadAgent(record.id);
  assert.deepStrictEqual(loaded, record);
});

test("listAgents returns all saved agents", () => {
  const agents = listAgents();
  assert.equal(agents.length, 1);
  assert.equal(agents[0].id, record.id);
});

test("listAgents filters by repo", () => {
  assert.equal(listAgents("/tmp/repo").length, 1);
  assert.equal(listAgents("/tmp/other").length, 0);
});

test("deleteAgent removes record", () => {
  deleteAgent(record.id);
  assert.equal(loadAgent(record.id), null);
  assert.equal(listAgents().length, 0);
});

test.after(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});
```

**Step 2: Run test to verify it fails**

Run: `cd hydra && node --experimental-strip-types --test tests/store.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement store**

```typescript
// hydra/src/store.ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface AgentRecord {
  id: string;
  task: string;
  type: string;
  repo: string;
  terminalId: string;
  worktreePath: string;
  branch: string | null;
  baseBranch: string;
  ownWorktree: boolean;
  createdAt: string;
}

function agentsDir(): string {
  const home = process.env.HYDRA_HOME ?? path.join(os.homedir(), ".hydra");
  const dir = path.join(home, "agents");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function agentPath(id: string): string {
  return path.join(agentsDir(), `${id}.json`);
}

export function saveAgent(record: AgentRecord): void {
  fs.writeFileSync(agentPath(record.id), JSON.stringify(record, null, 2));
}

export function loadAgent(id: string): AgentRecord | null {
  try {
    return JSON.parse(fs.readFileSync(agentPath(id), "utf-8"));
  } catch {
    return null;
  }
}

export function listAgents(repo?: string): AgentRecord[] {
  const dir = agentsDir();
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const agents = files.map((f) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as AgentRecord;
    } catch {
      return null;
    }
  }).filter((a): a is AgentRecord => a !== null);

  if (repo) {
    const abs = path.resolve(repo);
    return agents.filter((a) => a.repo === abs);
  }
  return agents;
}

export function deleteAgent(id: string): void {
  try {
    fs.unlinkSync(agentPath(id));
  } catch {
    // already gone
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd hydra && node --experimental-strip-types --test tests/store.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add hydra/src/store.ts hydra/tests/store.test.ts
git commit -m "Add hydra agent record store"
```

---

### Task 4: TermCanvas CLI wrapper

Wrap `termcanvas` CLI calls into typed async functions. This is what `spawn` and `cleanup` use to talk to TermCanvas.

**Files:**
- Create: `hydra/src/termcanvas.ts`
- Create: `hydra/tests/termcanvas.test.ts`

**Step 1: Write the test**

```typescript
// hydra/tests/termcanvas.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { parseJsonOrDie, buildTermcanvasArgs } from "../src/termcanvas.js";

test("parseJsonOrDie parses valid JSON", () => {
  const result = parseJsonOrDie('{"id":"abc","status":"running"}');
  assert.deepStrictEqual(result, { id: "abc", status: "running" });
});

test("parseJsonOrDie throws on invalid JSON", () => {
  assert.throws(() => parseJsonOrDie("not json"), /Failed to parse/);
});

test("buildTermcanvasArgs builds correct args", () => {
  const args = buildTermcanvasArgs("terminal", "status", ["tc-001"]);
  assert.deepStrictEqual(args, ["terminal", "status", "tc-001", "--json"]);
});
```

**Step 2: Run test to verify it fails**

Run: `cd hydra && node --experimental-strip-types --test tests/termcanvas.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement termcanvas wrapper**

```typescript
// hydra/src/termcanvas.ts
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
  // Input needs special handling — text may contain quotes/special chars.
  // Use execSync with explicit args to avoid shell escaping issues.
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
  // Match by repo root: a worktree's repo path may be the project path itself
  // or a parent. Check if any project path matches or contains the repo path.
  for (const p of projects) {
    if (p.path === abs) return { id: p.id, path: p.path };
    // Also check if repo is within a project's worktree
    for (const w of p.worktrees ?? []) {
      if (w.path === abs) return { id: p.id, path: p.path };
    }
  }
  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `cd hydra && node --experimental-strip-types --test tests/termcanvas.test.ts`
Expected: All PASS (only pure function tests — the `tc()` calls require a running TermCanvas and are tested via integration)

**Step 5: Commit**

```bash
git add hydra/src/termcanvas.ts hydra/tests/termcanvas.test.ts
git commit -m "Add termcanvas CLI wrapper for hydra"
```

---

### Task 5: Spawn command

The core command. Creates worktree, creates terminal, waits for ready, sends task.

**Files:**
- Create: `hydra/src/spawn.ts`
- Create: `hydra/tests/spawn.test.ts`

**Step 1: Write the test**

Test the argument parsing and ID generation (pure functions). The full spawn flow requires TermCanvas running so it's an integration test.

```typescript
// hydra/tests/spawn.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { parseSpawnArgs, generateAgentId } from "../src/spawn.js";

test("parseSpawnArgs extracts all flags", () => {
  const result = parseSpawnArgs([
    "--task", "fix the bug",
    "--type", "claude",
    "--repo", "/tmp/repo",
    "--base-branch", "develop",
  ]);
  assert.equal(result.task, "fix the bug");
  assert.equal(result.type, "claude");
  assert.equal(result.repo, "/tmp/repo");
  assert.equal(result.baseBranch, "develop");
  assert.equal(result.worktree, undefined);
});

test("parseSpawnArgs defaults type to claude", () => {
  const result = parseSpawnArgs(["--task", "test", "--repo", "."]);
  assert.equal(result.type, "claude");
});

test("parseSpawnArgs with --worktree sets worktree and ownWorktree=false", () => {
  const result = parseSpawnArgs([
    "--task", "analyze code",
    "--repo", ".",
    "--worktree", "/tmp/existing-wt",
  ]);
  assert.equal(result.worktree, "/tmp/existing-wt");
});

test("parseSpawnArgs throws on missing --task", () => {
  assert.throws(() => parseSpawnArgs(["--repo", "."]), /--task is required/);
});

test("parseSpawnArgs throws on missing --repo", () => {
  assert.throws(() => parseSpawnArgs(["--task", "x"]), /--repo is required/);
});

test("generateAgentId returns hydra-prefixed ID", () => {
  const id = generateAgentId();
  assert.ok(id.startsWith("hydra-"));
  assert.ok(id.length > 10);
});

test("generateAgentId returns unique IDs", () => {
  const a = generateAgentId();
  const b = generateAgentId();
  assert.notEqual(a, b);
});
```

**Step 2: Run test to verify it fails**

Run: `cd hydra && node --experimental-strip-types --test tests/spawn.test.ts`
Expected: FAIL

**Step 3: Implement spawn**

```typescript
// hydra/src/spawn.ts
import { execSync } from "node:child_process";
import path from "node:path";
import {
  isTermCanvasRunning,
  findProjectByPath,
  projectRescan,
  terminalCreate,
  terminalStatus,
  terminalInput,
} from "./termcanvas.js";
import { saveAgent, type AgentRecord } from "./store.js";

export interface SpawnArgs {
  task: string;
  type: string;
  repo: string;
  worktree?: string;
  baseBranch?: string;
}

export function parseSpawnArgs(args: string[]): SpawnArgs {
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const task = get("--task");
  const repo = get("--repo");
  if (!task) throw new Error("--task is required");
  if (!repo) throw new Error("--repo is required");

  return {
    task,
    type: get("--type") ?? "claude",
    repo,
    worktree: get("--worktree"),
    baseBranch: get("--base-branch"),
  };
}

export function generateAgentId(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 6);
  return `hydra-${ts}-${rand}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function spawn(args: string[]): Promise<void> {
  const opts = parseSpawnArgs(args);
  const repoAbs = path.resolve(opts.repo);

  // 1. Validate preconditions
  if (!isTermCanvasRunning()) {
    throw new Error("TermCanvas is not running. Start TermCanvas first.");
  }

  const project = findProjectByPath(repoAbs);
  if (!project) {
    throw new Error(
      `Project not found on TermCanvas canvas. Run: termcanvas project add ${repoAbs}`,
    );
  }

  const agentId = generateAgentId();
  let worktreePath: string;
  let branch: string | null;
  let ownWorktree: boolean;

  // 2. Create workspace
  if (opts.worktree) {
    worktreePath = path.resolve(opts.worktree);
    branch = null;
    ownWorktree = false;
  } else {
    branch = `hydra/${agentId}`;
    worktreePath = path.join(repoAbs, ".worktrees", agentId);
    const baseBranch = opts.baseBranch ?? getCurrentBranch(repoAbs);
    execSync(
      `git worktree add "${worktreePath}" -b "${branch}" "${baseBranch}"`,
      { cwd: repoAbs, stdio: "pipe" },
    );
    ownWorktree = true;

    // Trigger TermCanvas to detect the new worktree
    projectRescan(project.id);
  }

  // 3. Create terminal
  const terminal = terminalCreate(worktreePath, opts.type);

  // 4. Wait for PTY ready
  const readyStatuses = new Set(["waiting", "completed", "success", "error"]);
  const timeout = 30_000;
  const start = Date.now();
  let lastStatus = "";

  while (Date.now() - start < timeout) {
    const { status } = terminalStatus(terminal.id);
    lastStatus = status;
    if (readyStatuses.has(status)) break;
    await sleep(1_000);
  }

  if (!readyStatuses.has(lastStatus)) {
    throw new Error(
      `Terminal did not become ready within ${timeout / 1000}s (status: ${lastStatus})`,
    );
  }

  // 5. Send task
  terminalInput(terminal.id, opts.task + "\n");

  // 6. Save agent record
  const baseBranch = opts.baseBranch ?? getCurrentBranch(repoAbs);
  const record: AgentRecord = {
    id: agentId,
    task: opts.task,
    type: opts.type,
    repo: repoAbs,
    terminalId: terminal.id,
    worktreePath,
    branch,
    baseBranch,
    ownWorktree,
    createdAt: new Date().toISOString(),
  };
  saveAgent(record);

  // 7. Output result
  console.log(
    JSON.stringify(
      {
        agentId: record.id,
        terminalId: record.terminalId,
        worktreePath: record.worktreePath,
        branch: record.branch,
      },
      null,
      2,
    ),
  );
}

function getCurrentBranch(repoPath: string): string {
  return execSync("git branch --show-current", {
    cwd: repoPath,
    encoding: "utf-8",
  }).trim();
}
```

**Step 4: Run test to verify it passes**

Run: `cd hydra && node --experimental-strip-types --test tests/spawn.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add hydra/src/spawn.ts hydra/tests/spawn.test.ts
git commit -m "Implement hydra spawn command"
```

---

### Task 6: List command

**Files:**
- Create: `hydra/src/list.ts`

**Step 1: Implement list**

```typescript
// hydra/src/list.ts
import path from "node:path";
import { listAgents } from "./store.js";

export async function list(args: string[]): Promise<void> {
  const repoIdx = args.indexOf("--repo");
  const repo = repoIdx >= 0 ? path.resolve(args[repoIdx + 1]) : undefined;

  const agents = listAgents(repo);

  if (agents.length === 0) {
    console.log("No agents.");
    return;
  }

  for (const a of agents) {
    const branch = a.branch ?? "(existing worktree)";
    console.log(`${a.id}  ${a.type}  ${branch}  ${a.terminalId}  ${a.task.slice(0, 60)}`);
  }
}
```

**Step 2: Verify build**

Run: `cd hydra && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add hydra/src/list.ts
git commit -m "Implement hydra list command"
```

---

### Task 7: Cleanup command

**Files:**
- Create: `hydra/src/cleanup.ts`
- Create: `hydra/tests/cleanup.test.ts`

**Step 1: Write the test**

```typescript
// hydra/tests/cleanup.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { parseCleanupArgs } from "../src/cleanup.js";

test("parseCleanupArgs with agent ID", () => {
  const result = parseCleanupArgs(["hydra-123-abcd"]);
  assert.equal(result.agentId, "hydra-123-abcd");
  assert.equal(result.all, false);
  assert.equal(result.force, false);
});

test("parseCleanupArgs with --all", () => {
  const result = parseCleanupArgs(["--all"]);
  assert.equal(result.agentId, undefined);
  assert.equal(result.all, true);
  assert.equal(result.force, false);
});

test("parseCleanupArgs with --all --force", () => {
  const result = parseCleanupArgs(["--all", "--force"]);
  assert.equal(result.all, true);
  assert.equal(result.force, true);
});

test("parseCleanupArgs throws with no args", () => {
  assert.throws(() => parseCleanupArgs([]), /agent ID or --all/);
});
```

**Step 2: Run test to verify it fails**

Run: `cd hydra && node --experimental-strip-types --test tests/cleanup.test.ts`
Expected: FAIL

**Step 3: Implement cleanup**

```typescript
// hydra/src/cleanup.ts
import { execSync } from "node:child_process";
import { loadAgent, listAgents, deleteAgent } from "./store.js";
import { isTermCanvasRunning, terminalDestroy, terminalStatus } from "./termcanvas.js";

export interface CleanupArgs {
  agentId?: string;
  all: boolean;
  force: boolean;
}

export function parseCleanupArgs(args: string[]): CleanupArgs {
  const all = args.includes("--all");
  const force = args.includes("--force");
  const agentId = args.find((a) => !a.startsWith("--"));

  if (!all && !agentId) {
    throw new Error("Provide an agent ID or --all");
  }

  return { agentId, all, force };
}

function cleanupOne(agentId: string, force: boolean): void {
  const record = loadAgent(agentId);
  if (!record) {
    console.error(`Agent ${agentId} not found.`);
    return;
  }

  // Check if still running (only when TermCanvas is available)
  if (isTermCanvasRunning()) {
    try {
      const { status } = terminalStatus(record.terminalId);
      const running = status === "running" || status === "active";
      if (running && !force) {
        console.error(
          `Agent ${agentId} is still running (status: ${status}). Use --force to clean up anyway.`,
        );
        return;
      }
    } catch {
      // Terminal may already be gone
    }

    // Destroy terminal
    try {
      terminalDestroy(record.terminalId);
    } catch {
      // Already destroyed
    }
  }

  // Remove worktree (if we created it)
  if (record.ownWorktree) {
    try {
      execSync(`git worktree remove "${record.worktreePath}" --force`, {
        cwd: record.repo,
        stdio: "pipe",
      });
    } catch {
      // Already removed
    }

    // Delete branch
    if (record.branch) {
      try {
        execSync(`git branch -D "${record.branch}"`, {
          cwd: record.repo,
          stdio: "pipe",
        });
      } catch {
        // Already deleted
      }
    }
  }

  // Delete record
  deleteAgent(agentId);
  console.log(`Cleaned up ${agentId}.`);
}

export async function cleanup(args: string[]): Promise<void> {
  const opts = parseCleanupArgs(args);

  if (opts.all) {
    const agents = listAgents();
    if (agents.length === 0) {
      console.log("No agents to clean up.");
      return;
    }
    for (const a of agents) {
      cleanupOne(a.id, opts.force);
    }
  } else if (opts.agentId) {
    cleanupOne(opts.agentId, opts.force);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd hydra && node --experimental-strip-types --test tests/cleanup.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add hydra/src/cleanup.ts hydra/tests/cleanup.test.ts
git commit -m "Implement hydra cleanup command"
```

---

### Task 8: Build, link, and end-to-end smoke test

Build the final bundle, link it globally, and do a manual end-to-end test.

**Files:**
- Modify: `hydra/package.json` (no change needed, just verify)

**Step 1: Run all hydra tests**

Run: `cd hydra && npm test`
Expected: All PASS

**Step 2: Build**

Run: `cd hydra && npm run build`
Expected: `hydra/dist/hydra.js` created

**Step 3: Link globally**

Run: `cd hydra && npm link`
Expected: `hydra` command available globally

**Step 4: Manual smoke test (requires TermCanvas running with a project on canvas)**

```bash
# Verify hydra is accessible
hydra

# Expected output:
# Usage: hydra <spawn|list|cleanup> [options]
# ...

# Spawn a sub-agent (use an actual project path on your canvas)
hydra spawn --task "List all TypeScript files and report their line counts" --type claude --repo /path/to/your/project

# Expected: JSON output with agentId, terminalId, worktreePath, branch
# Expected: New terminal appears on TermCanvas canvas

# List agents
hydra list

# Expected: Shows the spawned agent

# Check status via termcanvas
termcanvas terminal status <terminalId from spawn output>

# Clean up
hydra cleanup <agentId from spawn output>

# Expected: Terminal destroyed, worktree removed
```

**Step 5: Commit (if any fixes were needed)**

```bash
git add -A hydra/
git commit -m "Build and verify hydra CLI end-to-end"
```

---

### Task 9: Add `.worktrees` to `.gitignore`

Hydra creates worktrees under `.worktrees/` in the project root. This directory should be gitignored.

**Files:**
- Modify: `.gitignore` (in TermCanvas repo, and document for user projects)

**Step 1: Add to .gitignore**

Add this line to the project's `.gitignore`:

```
.worktrees/
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "Gitignore .worktrees/ directory used by hydra"
```
