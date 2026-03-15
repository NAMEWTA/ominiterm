# CLI API Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a local HTTP API server to TermCanvas and a CLI binary so external tools (OpenClaw) can programmatically control the canvas.

**Architecture:** HTTP server runs in Electron main process using Node.js native `http`. Renderer exposes store operations on `window.__tcApi` which the server calls via `executeJavaScript()`. CLI is a standalone Node.js script that reads the port file and makes HTTP requests.

**Tech Stack:** Node.js `http` module, Electron IPC, esbuild for CLI compilation

---

### Task 1: Single instance lock + port file infrastructure

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/state-persistence.ts` (reuse STATE_DIR constant)

**Step 1: Add single instance lock to main.ts**

At the top of `electron/main.ts`, before `createWindow` is defined, add:

```ts
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}
```

And in `app.whenReady()`, add second-instance handler to focus existing window:

```ts
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
```

**Step 2: Export TERMCANVAS_DIR from state-persistence.ts**

Change the private `STATE_DIR` to an exported constant:

```ts
export const TERMCANVAS_DIR = path.join(os.homedir(), ".termcanvas");
```

Update internal usages to use `TERMCANVAS_DIR`.

**Step 3: Add port file helpers to main.ts**

```ts
import { TERMCANVAS_DIR } from "./state-persistence";

const PORT_FILE = path.join(TERMCANVAS_DIR, "port");

function writePortFile(port: number) {
  fs.writeFileSync(PORT_FILE, String(port), "utf-8");
}

function cleanupPortFile() {
  try { fs.unlinkSync(PORT_FILE); } catch {}
}
```

Call `cleanupPortFile()` in the close handler and `app.on("will-quit")`.

**Step 4: Commit**

```
git commit -m "Add single instance lock and port file infrastructure"
```

---

### Task 2: Output ring buffer in PtyManager

**Files:**
- Modify: `electron/pty-manager.ts`

**Step 1: Add ring buffer to PtyManager**

Add a `Map<number, string[]>` to store recent output lines per PTY. Add methods:

```ts
private outputBuffers = new Map<number, string[]>();
private readonly MAX_OUTPUT_LINES = 1000;

// Call this inside onData to capture output
captureOutput(id: number, data: string) {
  let buffer = this.outputBuffers.get(id);
  if (!buffer) {
    buffer = [];
    this.outputBuffers.set(id, buffer);
  }
  // Split by newlines but keep partial lines
  const lines = data.split("\n");
  for (const line of lines) {
    buffer.push(line);
  }
  // Trim to max
  if (buffer.length > this.MAX_OUTPUT_LINES) {
    buffer.splice(0, buffer.length - this.MAX_OUTPUT_LINES);
  }
}

getOutput(id: number, lineCount: number = 50): string[] {
  const buffer = this.outputBuffers.get(id) ?? [];
  return buffer.slice(-lineCount);
}
```

**Step 2: Wire captureOutput into main.ts**

In `setupIpc`, inside the `terminal:create` handler, after the existing `ptyManager.onData` call, add:

```ts
ptyManager.onData(ptyId, (data: string) => {
  mainWindow?.webContents.send("terminal:output", ptyId, data);
  ptyManager.captureOutput(ptyId, data);  // <-- add this
});
```

Wait — `onData` is called once and registers a callback. We need to modify the existing callback, not add a second one. Change the callback to:

```ts
ptyManager.onData(ptyId, (data: string) => {
  ptyManager.captureOutput(ptyId, data);
  mainWindow?.webContents.send("terminal:output", ptyId, data);
});
```

**Step 3: Clean up buffer on destroy**

In PtyManager's `destroy()` method, add:
```ts
this.outputBuffers.delete(id);
```

Same in `onExit` callback.

**Step 4: Commit**

```
git commit -m "Add output ring buffer to PtyManager"
```

---

### Task 3: Renderer API bridge

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/stores/projectStore.ts` (import createTerminal)

The API server needs to read and mutate renderer state. We expose functions on `window.__tcApi` that the main process calls via `webContents.executeJavaScript()`.

**Step 1: Add API bridge in App.tsx**

Add a `useEffect` in the `App` component that registers global API functions:

```ts
useEffect(() => {
  const api = {
    getProjects: () => {
      const { projects } = useProjectStore.getState();
      return JSON.parse(JSON.stringify(projects.map(p => ({
        id: p.id,
        name: p.name,
        path: p.path,
        collapsed: p.collapsed,
        worktrees: p.worktrees.map(w => ({
          id: w.id,
          name: w.name,
          path: w.path,
          terminals: w.terminals.map(t => ({
            id: t.id,
            title: t.title,
            type: t.type,
            status: t.status,
            ptyId: t.ptyId,
            span: t.span,
          })),
        })),
      }))));
    },

    addProject: (projectData: any) => {
      useProjectStore.getState().addProject(projectData);
      return true;
    },

    removeProject: (projectId: string) => {
      useProjectStore.getState().removeProject(projectId);
      return true;
    },

    addTerminal: (projectId: string, worktreeId: string, type: string) => {
      const terminal = createTerminal(type as any);
      useProjectStore.getState().addTerminal(projectId, worktreeId, terminal);
      return JSON.parse(JSON.stringify(terminal));
    },

    removeTerminal: (projectId: string, worktreeId: string, terminalId: string) => {
      useProjectStore.getState().removeTerminal(projectId, worktreeId, terminalId);
      return true;
    },

    getTerminal: (terminalId: string) => {
      const { projects } = useProjectStore.getState();
      for (const p of projects) {
        for (const w of p.worktrees) {
          const t = w.terminals.find(t => t.id === terminalId);
          if (t) return JSON.parse(JSON.stringify({
            ...t,
            projectId: p.id,
            worktreeId: w.id,
            worktreePath: w.path,
          }));
        }
      }
      return null;
    },
  };

  (window as any).__tcApi = api;
  return () => { delete (window as any).__tcApi; };
}, []);
```

Import `createTerminal` from `../stores/projectStore` if not already imported in App.tsx.

**Step 2: Commit**

```
git commit -m "Add renderer API bridge for HTTP server state access"
```

---

### Task 4: HTTP API server

**Files:**
- Create: `electron/api-server.ts`
- Modify: `electron/main.ts` (integrate server)

This is the core task. The server handles all HTTP endpoints.

**Step 1: Create api-server.ts**

```ts
import http from "http";
import type { BrowserWindow } from "electron";
import type { PtyManager } from "./pty-manager";
import type { ProjectScanner } from "./project-scanner";

interface ApiServerDeps {
  getWindow: () => BrowserWindow | null;
  ptyManager: PtyManager;
  projectScanner: ProjectScanner;
}

export class ApiServer {
  private server: http.Server | null = null;
  private deps: ApiServerDeps;

  constructor(deps: ApiServerDeps) {
    this.deps = deps;
  }

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));
      this.server.listen(0, "127.0.0.1", () => {
        const addr = this.server!.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        resolve(port);
      });
      this.server.on("error", reject);
    });
  }

  stop() {
    this.server?.close();
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const method = req.method ?? "GET";
    const pathname = url.pathname;

    res.setHeader("Content-Type", "application/json");

    try {
      const body = method === "POST" || method === "DELETE"
        ? await this.readBody(req)
        : null;

      const result = await this.route(method, pathname, url, body);
      res.writeHead(200);
      res.end(JSON.stringify(result));
    } catch (err: any) {
      const status = err.status ?? 500;
      res.writeHead(status);
      res.end(JSON.stringify({ error: err.message ?? "Internal error" }));
    }
  }

  private async route(method: string, pathname: string, url: URL, body: any): Promise<any> {
    // Project endpoints
    if (method === "POST" && pathname === "/project/add") {
      return this.projectAdd(body);
    }
    if (method === "GET" && pathname === "/project/list") {
      return this.projectList();
    }
    if (method === "DELETE" && pathname.match(/^\/project\/[^/]+$/)) {
      const id = pathname.split("/")[2];
      return this.projectRemove(id);
    }

    // Terminal endpoints
    if (method === "POST" && pathname === "/terminal/create") {
      return this.terminalCreate(body);
    }
    if (method === "GET" && pathname === "/terminal/list") {
      const worktree = url.searchParams.get("worktree");
      return this.terminalList(worktree);
    }
    if (method === "POST" && pathname.match(/^\/terminal\/[^/]+\/input$/)) {
      const id = pathname.split("/")[2];
      return this.terminalInput(id, body);
    }
    if (method === "GET" && pathname.match(/^\/terminal\/[^/]+\/status$/)) {
      const id = pathname.split("/")[2];
      return this.terminalStatus(id);
    }
    if (method === "GET" && pathname.match(/^\/terminal\/[^/]+\/output$/)) {
      const id = pathname.split("/")[2];
      const lines = parseInt(url.searchParams.get("lines") ?? "50", 10);
      return this.terminalOutput(id, lines);
    }
    if (method === "DELETE" && pathname.match(/^\/terminal\/[^/]+$/)) {
      const id = pathname.split("/")[2];
      return this.terminalDestroy(id);
    }

    // State
    if (method === "GET" && pathname === "/state") {
      return this.getState();
    }

    throw Object.assign(new Error("Not found"), { status: 404 });
  }

  // --- Helpers ---

  private async execRenderer(code: string): Promise<any> {
    const win = this.deps.getWindow();
    if (!win) throw Object.assign(new Error("No active window"), { status: 503 });
    return win.webContents.executeJavaScript(code);
  }

  private readBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => {
        try { resolve(data ? JSON.parse(data) : {}); }
        catch { reject(Object.assign(new Error("Invalid JSON"), { status: 400 })); }
      });
      req.on("error", reject);
    });
  }

  // --- Project endpoints ---

  private async projectAdd(body: any) {
    const { path: dirPath } = body;
    if (!dirPath) throw Object.assign(new Error("path is required"), { status: 400 });

    const scanned = this.deps.projectScanner.scan(dirPath);
    if (!scanned) throw Object.assign(new Error("Not a git repository"), { status: 400 });

    // Build project data matching ProjectData interface
    const projectData = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: scanned.name,
      path: scanned.path,
      position: { x: 0, y: 0 },
      collapsed: false,
      zIndex: 0,
      worktrees: scanned.worktrees.map((wt: any, i: number) => ({
        id: `${Date.now()}-wt-${i}`,
        name: wt.branch,
        path: wt.path,
        position: { x: 0, y: i * 400 },
        collapsed: false,
        terminals: [],
      })),
    };

    await this.execRenderer(
      `window.__tcApi.addProject(${JSON.stringify(projectData)})`
    );

    return { id: projectData.id, name: projectData.name, worktrees: projectData.worktrees.length };
  }

  private async projectList() {
    return this.execRenderer(`window.__tcApi.getProjects()`);
  }

  private async projectRemove(id: string) {
    await this.execRenderer(`window.__tcApi.removeProject(${JSON.stringify(id)})`);
    return { ok: true };
  }

  // --- Terminal endpoints ---

  private async terminalCreate(body: any) {
    const { worktree, type = "shell" } = body;
    if (!worktree) throw Object.assign(new Error("worktree path is required"), { status: 400 });

    // Find project and worktree by path
    const projects = await this.execRenderer(`window.__tcApi.getProjects()`);
    let projectId: string | null = null;
    let worktreeId: string | null = null;

    for (const p of projects) {
      for (const w of p.worktrees) {
        if (w.path === worktree) {
          projectId = p.id;
          worktreeId = w.id;
          break;
        }
      }
      if (projectId) break;
    }

    if (!projectId || !worktreeId) {
      throw Object.assign(new Error("Worktree not found on canvas"), { status: 404 });
    }

    const terminal = await this.execRenderer(
      `window.__tcApi.addTerminal(${JSON.stringify(projectId)}, ${JSON.stringify(worktreeId)}, ${JSON.stringify(type)})`
    );

    return { id: terminal.id, type: terminal.type, title: terminal.title };
  }

  private async terminalList(worktreePath: string | null) {
    const projects = await this.execRenderer(`window.__tcApi.getProjects()`);
    const terminals: any[] = [];

    for (const p of projects) {
      for (const w of p.worktrees) {
        if (worktreePath && w.path !== worktreePath) continue;
        for (const t of w.terminals) {
          terminals.push({
            id: t.id,
            title: t.title,
            type: t.type,
            status: t.status,
            ptyId: t.ptyId,
            worktree: w.path,
            project: p.name,
          });
        }
      }
    }

    return terminals;
  }

  private async terminalInput(terminalId: string, body: any) {
    const { text } = body;
    if (!text) throw Object.assign(new Error("text is required"), { status: 400 });

    const terminal = await this.execRenderer(
      `window.__tcApi.getTerminal(${JSON.stringify(terminalId)})`
    );
    if (!terminal) throw Object.assign(new Error("Terminal not found"), { status: 404 });
    if (!terminal.ptyId) throw Object.assign(new Error("Terminal has no active PTY"), { status: 409 });

    this.deps.ptyManager.write(terminal.ptyId, text);
    return { ok: true };
  }

  private async terminalStatus(terminalId: string) {
    const terminal = await this.execRenderer(
      `window.__tcApi.getTerminal(${JSON.stringify(terminalId)})`
    );
    if (!terminal) throw Object.assign(new Error("Terminal not found"), { status: 404 });
    return { id: terminal.id, status: terminal.status, ptyId: terminal.ptyId };
  }

  private async terminalOutput(terminalId: string, lines: number) {
    const terminal = await this.execRenderer(
      `window.__tcApi.getTerminal(${JSON.stringify(terminalId)})`
    );
    if (!terminal) throw Object.assign(new Error("Terminal not found"), { status: 404 });
    if (!terminal.ptyId) return { id: terminalId, lines: [] };

    const output = this.deps.ptyManager.getOutput(terminal.ptyId, lines);
    return { id: terminalId, lines: output };
  }

  private async terminalDestroy(terminalId: string) {
    const terminal = await this.execRenderer(
      `window.__tcApi.getTerminal(${JSON.stringify(terminalId)})`
    );
    if (!terminal) throw Object.assign(new Error("Terminal not found"), { status: 404 });

    // Kill PTY first if active
    if (terminal.ptyId) {
      this.deps.ptyManager.destroy(terminal.ptyId);
    }

    // Remove from store
    await this.execRenderer(
      `window.__tcApi.removeTerminal(${JSON.stringify(terminal.projectId)}, ${JSON.stringify(terminal.worktreeId)}, ${JSON.stringify(terminalId)})`
    );

    return { ok: true };
  }

  // --- State ---

  private async getState() {
    return this.execRenderer(`window.__tcApi.getProjects()`);
  }
}
```

**Step 2: Integrate into main.ts**

Import `ApiServer` and start it after window creation:

```ts
import { ApiServer } from "./api-server";

// After createWindow(), in app.whenReady():
const apiServer = new ApiServer({
  getWindow: () => mainWindow,
  ptyManager,
  projectScanner,
});

// Start after window is ready to ensure renderer is loaded
mainWindow!.webContents.on("did-finish-load", async () => {
  const port = await apiServer.start();
  writePortFile(port);
  console.log(`[TermCanvas API] Listening on http://127.0.0.1:${port}`);
});
```

Add cleanup:
```ts
// In the existing close/quit handlers:
apiServer.stop();
cleanupPortFile();
```

**Step 3: Commit**

```
git commit -m "Add local HTTP API server with project and terminal endpoints"
```

---

### Task 5: CLI binary

**Files:**
- Create: `cli/termcanvas.ts`
- Modify: `vite.config.ts` (add CLI build plugin)
- Modify: `package.json` (add bin entry)

**Step 1: Create the CLI script**

`cli/termcanvas.ts` — single file, zero dependencies, uses Node.js `http` and `fs`:

```ts
#!/usr/bin/env node

import http from "http";
import fs from "fs";
import path from "path";
import os from "os";

const PORT_FILE = path.join(os.homedir(), ".termcanvas", "port");

function getPort(): number {
  try {
    return parseInt(fs.readFileSync(PORT_FILE, "utf-8").trim(), 10);
  } catch {
    console.error("TermCanvas is not running (no port file found).");
    process.exit(1);
  }
}

function request(method: string, path: string, body?: any): Promise<any> {
  const port = getPort();
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      { hostname: "127.0.0.1", port, path, method, headers: {
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      }},
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(body);
            if (res.statusCode && res.statusCode >= 400) {
              reject(json);
            } else {
              resolve(json);
            }
          } catch {
            reject(new Error(body));
          }
        });
      }
    );
    req.on("error", (err) => {
      console.error("Failed to connect to TermCanvas:", err.message);
      process.exit(1);
    });
    if (data) req.write(data);
    req.end();
  });
}

function formatJson(data: any) {
  return JSON.stringify(data, null, 2);
}

const args = process.argv.slice(2);
const jsonFlag = args.includes("--json");
const filteredArgs = args.filter(a => a !== "--json");
const [group, command, ...rest] = filteredArgs;

async function main() {
  try {
    if (group === "project") {
      if (command === "add" && rest[0]) {
        const result = await request("POST", "/project/add", { path: rest[0] });
        if (jsonFlag) { console.log(formatJson(result)); }
        else { console.log(`Added "${result.name}" with ${result.worktrees} worktree(s). ID: ${result.id}`); }

      } else if (command === "list") {
        const projects = await request("GET", "/project/list");
        if (jsonFlag) { console.log(formatJson(projects)); }
        else {
          if (projects.length === 0) { console.log("No projects."); return; }
          for (const p of projects) {
            console.log(`${p.id}  ${p.name}  ${p.path}  (${p.worktrees.length} worktrees)`);
          }
        }

      } else if (command === "remove" && rest[0]) {
        await request("DELETE", `/project/${rest[0]}`);
        console.log("Removed.");

      } else {
        console.log("Usage: termcanvas project <add|list|remove> [args]");
      }

    } else if (group === "terminal") {
      if (command === "create") {
        const wtIdx = rest.indexOf("--worktree");
        const typeIdx = rest.indexOf("--type");
        const worktree = wtIdx >= 0 ? rest[wtIdx + 1] : undefined;
        const type = typeIdx >= 0 ? rest[typeIdx + 1] : "shell";
        if (!worktree) { console.error("--worktree is required"); process.exit(1); }
        const result = await request("POST", "/terminal/create", { worktree, type });
        if (jsonFlag) { console.log(formatJson(result)); }
        else { console.log(`Created ${result.type} terminal "${result.title}". ID: ${result.id}`); }

      } else if (command === "list") {
        const wtIdx = rest.indexOf("--worktree");
        const worktree = wtIdx >= 0 ? rest[wtIdx + 1] : undefined;
        const query = worktree ? `?worktree=${encodeURIComponent(worktree)}` : "";
        const terminals = await request("GET", `/terminal/list${query}`);
        if (jsonFlag) { console.log(formatJson(terminals)); }
        else {
          if (terminals.length === 0) { console.log("No terminals."); return; }
          for (const t of terminals) {
            console.log(`${t.id}  ${t.type}  ${t.status}  ${t.title}  (${t.project}/${t.worktree})`);
          }
        }

      } else if (command === "input" && rest[0] && rest[1]) {
        await request("POST", `/terminal/${rest[0]}/input`, { text: rest[1] });
        console.log("Sent.");

      } else if (command === "status" && rest[0]) {
        const result = await request("GET", `/terminal/${rest[0]}/status`);
        if (jsonFlag) { console.log(formatJson(result)); }
        else { console.log(result.status); }

      } else if (command === "output" && rest[0]) {
        const linesIdx = rest.indexOf("--lines");
        const lines = linesIdx >= 0 ? rest[linesIdx + 1] : "50";
        const result = await request("GET", `/terminal/${rest[0]}/output?lines=${lines}`);
        if (jsonFlag) { console.log(formatJson(result)); }
        else { console.log(result.lines.join("\n")); }

      } else if (command === "destroy" && rest[0]) {
        await request("DELETE", `/terminal/${rest[0]}`);
        console.log("Destroyed.");

      } else {
        console.log("Usage: termcanvas terminal <create|list|input|status|output|destroy> [args]");
      }

    } else if (group === "state") {
      const state = await request("GET", "/state");
      console.log(formatJson(state));

    } else {
      console.log("Usage: termcanvas <project|terminal|state> <command> [args]");
      console.log("");
      console.log("Commands:");
      console.log("  project add <path>              Add a project");
      console.log("  project list                    List projects");
      console.log("  project remove <id>             Remove a project");
      console.log("  terminal create --worktree <p> --type <t>  Create terminal");
      console.log("  terminal list [--worktree <p>]  List terminals");
      console.log("  terminal input <id> <text>      Send input");
      console.log("  terminal status <id>            Get status");
      console.log("  terminal output <id> [--lines N] Read output");
      console.log("  terminal destroy <id>           Destroy terminal");
      console.log("  state                           Full canvas state");
    }
  } catch (err: any) {
    console.error(err.error ?? err.message ?? err);
    process.exit(1);
  }
}

main();
```

**Step 2: Add CLI build plugin to vite.config.ts**

Similar to the existing `buildPreload` plugin:

```ts
function buildCli(): Plugin {
  const opts = {
    entryPoints: ["cli/termcanvas.ts"],
    outfile: "dist-cli/termcanvas.js",
    format: "esm" as const,
    platform: "node" as const,
    bundle: true,
    banner: { js: "#!/usr/bin/env node" },
  };
  return {
    name: "build-cli",
    async buildStart() {
      if (this.meta.watchMode) {
        const ctx = await esbuildCtx(opts);
        await ctx.watch();
      } else {
        await esbuild(opts);
      }
    },
  };
}
```

Add to the `plugins` array in `defineConfig`.

**Step 3: Add bin entry to package.json**

```json
"bin": {
  "termcanvas": "./dist-cli/termcanvas.js"
}
```

**Step 4: Commit**

```
git commit -m "Add termcanvas CLI binary"
```

---

### Task 6: Build verification and smoke test

**Step 1: Build**

```bash
npm run build
```

Fix any TypeScript errors.

**Step 2: Test the API server**

Start the dev app:
```bash
npm run dev
```

Wait for it to launch, then verify:
```bash
cat ~/.termcanvas/port
# Should show a port number

curl http://127.0.0.1:$(cat ~/.termcanvas/port)/state
# Should return JSON of projects

curl http://127.0.0.1:$(cat ~/.termcanvas/port)/project/list
# Should return project array
```

**Step 3: Test the CLI**

```bash
node dist-cli/termcanvas.js state
node dist-cli/termcanvas.js project list
node dist-cli/termcanvas.js terminal list
```

**Step 4: Final commit if any fixes needed**
