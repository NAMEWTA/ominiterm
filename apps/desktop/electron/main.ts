import { app, BrowserWindow, ipcMain, dialog, nativeImage, shell } from "electron";
import https from "https";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import os from "os";
import { fileURLToPath } from "url";
import { PtyManager, OutputBatcher, type PtyCreateResult } from "./pty-manager";
import { ProjectScanner } from "./project-scanner";
import {
  StatePersistence,
  OMINITERM_DIR,
  migrateLegacyOminiTermData,
} from "./state-persistence";
import { GitFileWatcher } from "./git-watcher";
import { SessionWatcher, type SessionType } from "./session-watcher";
import { sendToWindow } from "./window-events";
import { detectCli } from "./process-detector";
import {
  LauncherStartupCancelledError,
  runLauncherStartupFlow,
} from "./startup-command-sequencer";
import {
  createDefaultComposerSubmitDeps,
  submitComposerRequest,
} from "./composer-submit";
import { collectUsage, collectHeatmapData } from "./usage-collector";
import { setupAutoUpdater, stopAutoUpdater } from "./auto-updater";
import { initAuth, login, logout, getAuthUser, getDeviceId, handleAuthCallback, onAuthStateChange, isLoggedIn } from "./auth";
import { toFileUrl } from "./file-url";
import { queryCloudUsage, queryCloudHeatmap, backfillHistory, flushSyncQueue, syncRecentRecords } from "./usage-sync";
import type {
  ComposerSubmitRequest,
  LauncherStartupEvent,
  TerminalLauncherConfigSnapshot,
} from "../src/types";
import { getProjectDiff } from "./git-diff";
import { validateAgentCommand } from "./agent-command.js";
import { registerLaunchersIpc } from "./launchers-ipc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !!process.env.VITE_DEV_SERVER_URL;
if (isDev) {
  app.setPath("userData", path.join(app.getPath("appData"), "ominiterm-dev"));
}

if (process.platform === "win32") {
  // AMD drivers can fail DirectComposition and leave Electron window black.
  app.commandLine.appendSwitch("disable-direct-composition");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
  if (process.env.OMINITERM_ENABLE_GPU !== "1") {
    app.disableHardwareAcceleration();
  }
}

const skipLock = isDev || !!process.env.OMINITERM_SKIP_LOCK;
const gotLock = skipLock || app.requestSingleInstanceLock();
if (!gotLock) {
  console.error(
    "[OminiTerm] Another instance is already running. Quitting.\n" +
    "  Kill the old process first: pkill -f Electron",
  );
  app.quit();
}

migrateLegacyOminiTermData();

function perfLog(label: string, details: Record<string, unknown>) {
  if (!isDev) return;
  console.log(`[Perf] ${label}`, details);
}

let mainWindow: BrowserWindow | null = null;
let forceClose = false;
let pendingCloseFallbackTimer: ReturnType<typeof setTimeout> | null = null;
const ptyManager = new PtyManager();
const terminalCreateAbortControllers = new Map<string, AbortController>();
const outputBatcher = new OutputBatcher((ptyId, data) => {
  sendToWindow(mainWindow, "terminal:output", ptyId, data);
});
const projectScanner = new ProjectScanner();
const statePersistence = new StatePersistence();
const gitWatcher = new GitFileWatcher();
const sessionWatcher = new SessionWatcher();

class TerminalCreateCancelledError extends Error {
  constructor() {
    super("Terminal creation cancelled");
    this.name = "TerminalCreateCancelledError";
  }
}

function createTerminalCancelledError(): TerminalCreateCancelledError {
  return new TerminalCreateCancelledError();
}

function isTerminalCreateCancelledError(error: unknown): boolean {
  return (
    error instanceof TerminalCreateCancelledError ||
    error instanceof LauncherStartupCancelledError
  );
}

function createWindow() {
  forceClose = false;
  const isMac = process.platform === "darwin";
  const isWin = process.platform === "win32";

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    backgroundColor: "#101010",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
    // macOS: hidden title bar with inset traffic lights
    ...(isMac && {
      titleBarStyle: "hiddenInset" as const,
      trafficLightPosition: { x: 14, y: 14 },
    }),
    // Windows: hidden title bar with native window controls overlay
    ...(isWin && {
      titleBarStyle: "hidden" as const,
      titleBarOverlay: {
        color: "#00000000",
        symbolColor: "#888888",
        height: 44,
      },
      autoHideMenuBar: true,
    }),
    // Linux: hidden title bar (no native overlay, app handles everything)
    ...(!isMac &&
      !isWin && {
        titleBarStyle: "hidden" as const,
      }),
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isWin) {
    mainWindow.removeMenu();
  }

  // Secure webview attachment: enforce isolation, strip preload
  mainWindow.webContents.on("will-attach-webview", (_event, webPreferences) => {
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    delete webPreferences.preload;
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    rendererReady = false;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  let rendererReady = false;
  // Intercept close to ask user about saving (only after page loads)
  mainWindow.webContents.on("did-finish-load", async () => {
    rendererReady = true;
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error("[Window] did-fail-load", {
        errorCode,
        errorDescription,
        validatedURL,
      });
    },
  );

  mainWindow.webContents.on(
    "console-message",
    (_event, level, message, line, sourceId) => {
      if (level >= 2) {
        console.error("[Renderer]", { level, message, line, sourceId });
      }
    },
  );

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[Window] Renderer process gone:", details);
  });

  mainWindow.on("unresponsive", () => {
    console.error("[Window] BrowserWindow became unresponsive.");
  });

  mainWindow.on("close", (e) => {
    if (forceClose || !mainWindow) return;

    const wc = mainWindow.webContents;
    if (
      !rendererReady ||
      wc.isDestroyed() ||
      wc.isCrashed()
    ) {
      forceClose = true;
      return;
    }

    e.preventDefault();
    sendToWindow(mainWindow, "app:before-close");

    if (pendingCloseFallbackTimer) {
      clearTimeout(pendingCloseFallbackTimer);
    }

    pendingCloseFallbackTimer = setTimeout(() => {
      if (!forceClose && mainWindow && !mainWindow.isDestroyed()) {
        console.warn("[Window] Close confirmation timed out; forcing close.");
        forceClose = true;
        mainWindow.close();
        app.quit();
      }
    }, 1500);
  });
}

// ── Debug file logger for session capture investigation ──
const DEBUG_LOG = path.join(OMINITERM_DIR, "session-debug.log");
function dbg(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(DEBUG_LOG, line); } catch { /* ignore */ }
}

function setupIpc() {
  // Terminal IPC
  ipcMain.handle(
    "terminal:create",
    async (_event, options: {
      cwd: string;
      shell?: string;
      args?: string[];
      terminalId?: string;
      theme?: "dark" | "light";
      launcherId?: string;
      launcherName?: string;
      launcherConfigSnapshot?: TerminalLauncherConfigSnapshot;
      isResume: boolean;
    }): Promise<PtyCreateResult> => {
      dbg(`terminal:create shell=${options.shell ?? "(default)"} args=${JSON.stringify(options.args)} cwd=${options.cwd}`);
      const createController = options.terminalId
        ? (() => {
            terminalCreateAbortControllers.get(options.terminalId!)?.abort();
            const controller = new AbortController();
            terminalCreateAbortControllers.set(options.terminalId!, controller);
            return controller;
          })()
        : null;
      const createSignal = createController?.signal;

      const throwIfCreateCancelled = () => {
        if (createSignal?.aborted) {
          throw createTerminalCancelledError();
        }
      };

      let createdPtyId: number | null = null;
      try {
        throwIfCreateCancelled();

        const result = await ptyManager.create(options);
        createdPtyId = result.ptyId;
        throwIfCreateCancelled();

        const pid = ptyManager.getPid(result.ptyId);
        dbg(`terminal:create => ptyId=${result.ptyId} pid=${pid ?? "null"} fallback=${result.fallback ? "yes" : "no"}`);
        ptyManager.onData(result.ptyId, (data: string) => {
          ptyManager.captureOutput(result.ptyId, data);
          outputBatcher.push(result.ptyId, data);
        });
        ptyManager.onExit(result.ptyId, (exitCode: number) => {
          dbg(`terminal:exit ptyId=${result.ptyId} pid=${pid ?? "null"} exitCode=${exitCode}`);
          sendToWindow(mainWindow, "terminal:exit", result.ptyId, exitCode);
        });

        const launcherSnapshot = options.launcherConfigSnapshot;
        const shouldRunLauncherStartup =
          launcherSnapshot !== undefined && options.isResume !== true;

        const startupShell =
          result.fallback?.actualShell ??
          (launcherSnapshot?.hostShell === "auto" ? result.resolvedShell : undefined);

        if (shouldRunLauncherStartup) {
          const terminalId = options.terminalId ?? `terminal-${result.ptyId}`;
          const launcherId = options.launcherId ?? "launcher";
          const emitStartupEvent = (event: LauncherStartupEvent) => {
            sendToWindow(mainWindow, "launchers:startup-event", event);
          };

          const startupResult = await runLauncherStartupFlow({
            ptyManager,
            ptyId: result.ptyId,
            terminalId,
            launcherId,
            hostShell: launcherSnapshot.hostShell,
            actualShell: startupShell,
            startupCommands: launcherSnapshot.startupCommands,
            emit: emitStartupEvent,
            signal: createSignal,
          });

          if (!startupResult.ok) {
            result.startupFailure = {
              failedStepIndex: startupResult.failedStepIndex,
              stepLabel: startupResult.stepLabel,
              command: startupResult.command,
              ...(startupResult.exitCode !== undefined
                ? { exitCode: startupResult.exitCode }
                : {}),
              ...(startupResult.timeoutMs !== undefined
                ? { timeoutMs: startupResult.timeoutMs }
                : {}),
              ...(startupResult.stderrPreview
                ? { stderrPreview: startupResult.stderrPreview }
                : {}),
            };
          }
        }

        throwIfCreateCancelled();

        return {
          ptyId: result.ptyId,
          ...(result.fallback ? { fallback: result.fallback } : {}),
          ...(result.startupFailure ? { startupFailure: result.startupFailure } : {}),
        };
      } catch (error) {
        if (isTerminalCreateCancelledError(error)) {
          if (createdPtyId !== null) {
            await ptyManager.destroy(createdPtyId);
          }
        }
        throw error;
      } finally {
        if (
          options.terminalId &&
          createController &&
          terminalCreateAbortControllers.get(options.terminalId) === createController
        ) {
          terminalCreateAbortControllers.delete(options.terminalId);
        }
      }
    },
  );

  ipcMain.on("terminal:create-cancel", (_event, terminalId: string) => {
    if (typeof terminalId !== "string" || terminalId.trim().length === 0) {
      return;
    }
    terminalCreateAbortControllers.get(terminalId)?.abort();
  });

  ipcMain.on("terminal:input", (_event, ptyId: number, data: string) => {
    ptyManager.write(ptyId, data);
  });

  ipcMain.on(
    "terminal:resize",
    (_event, ptyId: number, cols: number, rows: number) => {
      ptyManager.resize(ptyId, cols, rows);
    },
  );

  ipcMain.on("terminal:theme-changed", (_event, ptyId: number) => {
    ptyManager.notifyThemeChanged(ptyId);
  });

  ipcMain.handle("terminal:destroy", async (_event, ptyId: number) => {
    await ptyManager.destroy(ptyId);
  });

  ipcMain.handle("terminal:get-pid", (_event, ptyId: number) => {
    const pid = ptyManager.getPid(ptyId) ?? null;
    dbg(`terminal:get-pid ptyId=${ptyId} => pid=${pid}`);
    return pid;
  });

  ipcMain.handle("terminal:detect-cli", async (_event, ptyId: number) => {
    const shellPid = ptyManager.getPid(ptyId);
    if (!shellPid) return null;
    return detectCli(shellPid);
  });

  // Session ID discovery for codex/claude
  ipcMain.handle("session:get-codex-latest", () => {
    try {
      const indexPath = path.join(
        os.homedir(),
        ".codex",
        "session_index.jsonl",
      );
      if (!fs.existsSync(indexPath)) return null;
      const lines = fs.readFileSync(indexPath, "utf-8").trim().split("\n");
      const last = lines[lines.length - 1];
      if (!last) return null;
      const entry = JSON.parse(last);
      return entry.id as string;
    } catch (err) {
      console.warn("[session:get-codex-latest] failed to read session index:", err);
      return null;
    }
  });

  ipcMain.handle("session:get-claude-by-pid", (_event, pid: number) => {
    try {
      const sessionFile = path.join(
        os.homedir(),
        ".claude",
        "sessions",
        `${pid}.json`,
      );
      const exists = fs.existsSync(sessionFile);
      dbg(`session:get-claude-by-pid pid=${pid} file=${sessionFile} exists=${exists}`);
      if (!exists) {
        // List actual session files for comparison
        const sessDir = path.join(os.homedir(), ".claude", "sessions");
        try {
          const files = fs.readdirSync(sessDir).filter(f => f.endsWith(".json"));
          dbg(`  session files in dir: ${files.join(", ")}`);
        } catch { /* ignore */ }
        return null;
      }
      const data = JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
      dbg(`  found sessionId=${data.sessionId}`);
      return data.sessionId as string;
    } catch (err) {
      dbg(`  ERROR: ${err}`);
      return null;
    }
  });

  ipcMain.handle("session:get-kimi-latest", (_event, cwd: string) => {
    try {
      // Kimi stores sessions under ~/.kimi/sessions/{cwd_hash}/{session_uuid}/
      const sessionsDir = path.join(os.homedir(), ".kimi", "sessions");
      if (!fs.existsSync(sessionsDir)) return null;
      // Find the project hash dir by checking which contains sessions for this cwd
      const hashDirs = fs.readdirSync(sessionsDir);
      for (const hashDir of hashDirs.reverse()) {
        const fullPath = path.join(sessionsDir, hashDir);
        const uuids = fs.readdirSync(fullPath);
        if (uuids.length > 0) {
          return uuids[uuids.length - 1]; // Latest session UUID
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  // Project IPC
  ipcMain.handle("project:select-directory", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("project:scan", async (_event, dirPath: string) => {
    return await projectScanner.scanAsync(dirPath);
  });

  ipcMain.handle("project:diff", async (_event, worktreePath: string) => {
    const startedAt = Date.now();
    try {
      const result = await getProjectDiff(worktreePath);
      perfLog("project:diff", {
        worktreePath,
        ms: Date.now() - startedAt,
        files: result.files.length,
        diffLength: result.diff.length,
      });
      return result;
    } catch {
      perfLog("project:diff:error", {
        worktreePath,
        ms: Date.now() - startedAt,
      });
      return { diff: "", files: [] };
    }
  });

  ipcMain.handle("project:rescan-worktrees", async (_event, dirPath: string) => {
    return await projectScanner.listWorktreesAsync(dirPath);
  });

  registerLaunchersIpc(ipcMain);

  // Git file watcher IPC (Layer 1 of DiffCard refresh)
  ipcMain.handle("git:watch", (_event, worktreePath: string) => {
    gitWatcher.watch(worktreePath, () => {
      sendToWindow(mainWindow, "git:changed", worktreePath);
    });
  });

  ipcMain.handle("git:unwatch", (_event, worktreePath: string) => {
    gitWatcher.unwatch(worktreePath);
  });

  // Session turn-completion watcher IPC
  ipcMain.handle(
    "session:watch",
    (_event, type: SessionType, sessionId: string, cwd: string) => {
      return sessionWatcher.watch(sessionId, type, cwd, () => {
        sendToWindow(mainWindow, "session:turn-complete", sessionId);
      });
    },
  );

  ipcMain.handle("session:unwatch", (_event, sessionId: string) => {
    sessionWatcher.unwatch(sessionId);
  });

  // State IPC
  ipcMain.handle("state:load", () => {
    return statePersistence.load();
  });

  ipcMain.handle("state:save", (_event, state: unknown) => {
    statePersistence.save(state);
  });

  ipcMain.handle("app:set-title", (_event, title: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(title);
    }
  });

  // Filesystem IPC
  const HIDDEN_DIRS = new Set(["node_modules", ".git", "dist", "build", "out"]);
  const IMAGE_EXTS_FS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"]);
  const MIME_MAP_FS: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
  };
  const MAX_FILE_SIZE = 512 * 1024;

  ipcMain.handle("fs:list-dir", (_event, dirPath: string) => {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const filtered = entries
        .filter((e) => !e.name.startsWith(".") && !HIDDEN_DIRS.has(e.name))
        .map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      return filtered;
    } catch {
      return [];
    }
  });

  ipcMain.handle("fs:read-file", (_event, filePath: string) => {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > MAX_FILE_SIZE) {
        const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
        return { error: "too-large", size: `${sizeMB} MB` };
      }

      const ext = path.extname(filePath).toLowerCase();
      if (IMAGE_EXTS_FS.has(ext)) {
        const buf = fs.readFileSync(filePath);
        const mime = MIME_MAP_FS[ext] ?? "image/png";
        return { type: "image", content: `data:${mime};base64,${buf.toString("base64")}` };
      }

      // Binary detection: check first 8KB for null bytes
      const fd = fs.openSync(filePath, "r");
      const probe = Buffer.alloc(8192);
      const bytesRead = fs.readSync(fd, probe, 0, 8192, 0);
      fs.closeSync(fd);
      if (probe.subarray(0, bytesRead).includes(0)) {
        return { type: "binary" };
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const type = ext === ".md" ? "markdown" : "text";
      return { type, content };
    } catch {
      return { error: "read-error" };
    }
  });

  ipcMain.handle(
    "agents:validate-command",
    async (_event, command: string) => {
      return validateAgentCommand(command);
    },
  );

  // Composer submission
  ipcMain.handle("composer:submit", async (_event, request: ComposerSubmitRequest) => {
    if (!ptyManager.getPid(request.ptyId)) {
      return {
        ok: false,
        code: "target-not-running",
        stage: "target",
        error: "Target terminal is not running.",
      };
    }

    try {
      const result = await submitComposerRequest(
        request,
        createDefaultComposerSubmitDeps(
          process.platform as "darwin" | "win32" | "linux",
          dataUrlToPngBuffer,
          (ptyId: number, data: string) => {
            ptyManager.write(ptyId, data);
          },
        ),
      );

      if (!result.ok) {
        console.error("[Composer] Submit failed:", {
          terminalId: request.terminalId,
          ptyId: request.ptyId,
          terminalType: request.terminalType,
          stage: result.stage,
          code: result.code,
          detail: result.detail ?? result.error,
          requestId: result.requestId,
        });
      }

      return result;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error("[Composer] Submit crashed:", {
        terminalId: request.terminalId,
        ptyId: request.ptyId,
        terminalType: request.terminalType,
        detail,
      });
      return {
        ok: false,
        code: "internal-error",
        stage: "submit",
        error: detail,
        detail,
      };
    }
  });

  // Usage statistics
  ipcMain.handle("usage:query", async (_event, dateStr: string) => {
    const startedAt = Date.now();
    const result = await collectUsage(dateStr);
    perfLog("usage:query", {
      dateStr,
      ms: Date.now() - startedAt,
      sessions: result.sessions,
      totalCost: result.totalCost,
    });
    return result;
  });

  ipcMain.handle("usage:heatmap", async () => {
    const startedAt = Date.now();
    const result = await collectHeatmapData();
    perfLog("usage:heatmap", {
      ms: Date.now() - startedAt,
      days: Object.keys(result).length,
    });
    return result;
  });

  ipcMain.handle("usage:query-cloud", async (_event, dateStr: string) => {
    return await queryCloudUsage(dateStr);
  });

  ipcMain.handle("usage:heatmap-cloud", async () => {
    return await queryCloudHeatmap();
  });

  ipcMain.handle("quota:fetch", async () => {
    const { fetchQuota } = await import("./quota-fetcher");
    const startedAt = Date.now();
    const result = await fetchQuota();
    perfLog("quota:fetch", {
      ms: Date.now() - startedAt,
      ok: result.ok,
      rateLimited: result.ok ? false : result.rateLimited,
    });
    return result;
  });

  // Insights
  let activeInsightsJobId: string | null = null;
  ipcMain.handle(
    "insights:generate",
    async (_event, cliTool: "claude" | "codex", jobId: string) => {
      if (activeInsightsJobId && activeInsightsJobId !== jobId) {
        return {
          ok: false as const,
          jobId,
          error: {
            code: "job_in_progress",
            message: "Another insights job is already running",
          },
        };
      }

      activeInsightsJobId = jobId;
      try {
        const { generateInsights } = await import("./insights-engine");
        return await generateInsights(cliTool, jobId, (progress) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("insights:progress", progress);
          }
        });
      } finally {
        if (activeInsightsJobId === jobId) {
          activeInsightsJobId = null;
        }
      }
    },
  );

  ipcMain.handle("insights:open-report", async (_event, filePath: string) => {
    await shell.openExternal(toFileUrl(filePath));
  });

  ipcMain.handle("insights:get-last-report", async () => {
    const reportsDir = path.join(OMINITERM_DIR, "insights-reports");
    try {
      if (!fs.existsSync(reportsDir)) return null;
      const files = fs.readdirSync(reportsDir)
        .filter((f) => f.startsWith("insights-") && f.endsWith(".html"));
      if (files.length === 0) return null;
      files.sort().reverse();
      const filePath = path.join(reportsDir, files[0]);
      if (!fs.existsSync(filePath)) return null;
      return filePath;
    } catch {
      return null;
    }
  });

  // Font management
  const fontsDir = path.join(app.getPath("userData"), "fonts");

  ipcMain.handle("font:get-path", () => fontsDir);

  ipcMain.handle("font:list-downloaded", () => {
    try {
      if (!fs.existsSync(fontsDir)) return [];
      return fs.readdirSync(fontsDir);
    } catch {
      return [];
    }
  });

  ipcMain.handle("font:check", (_event, fileName: string) => {
    return fs.existsSync(path.join(fontsDir, fileName));
  });

  ipcMain.handle(
    "font:download",
    async (_event, url: string, fileName: string) => {
      if (!fs.existsSync(fontsDir)) {
        fs.mkdirSync(fontsDir, { recursive: true });
      }
      const destPath = path.join(fontsDir, fileName);
      if (fs.existsSync(destPath)) {
        return { ok: true, path: destPath };
      }

      try {
        const tmpZip = path.join(fontsDir, `_download_${Date.now()}.zip`);

        const buf = await new Promise<Buffer>((resolve, reject) => {
          const follow = (u: string, redirects = 0) => {
            if (redirects > 5) { reject(new Error("Too many redirects")); return; }
            https.get(u, (res) => {
              if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
                follow(res.headers.location, redirects + 1);
                return;
              }
              if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
              }
              const chunks: Buffer[] = [];
              res.on("data", (chunk) => chunks.push(chunk));
              res.on("end", () => resolve(Buffer.concat(chunks)));
              res.on("error", reject);
            }).on("error", reject);
          };
          follow(url);
        });
        if (buf.length < 100) {
          return { ok: false, error: "Downloaded file is too small, likely not a valid archive" };
        }
        fs.writeFileSync(tmpZip, buf);

        // Extract target font file from zip (cross-platform, no shell unzip)
        const zip = new AdmZip(tmpZip);
        const zipEntries = zip.getEntries();
        const matchEntry = zipEntries.find((e) =>
          e.entryName.endsWith(fileName),
        );
        if (!matchEntry) {
          fs.unlinkSync(tmpZip);
          return {
            ok: false,
            error: `Font file "${fileName}" not found in archive`,
          };
        }
        fs.writeFileSync(destPath, matchEntry.getData());
        fs.unlinkSync(tmpZip);

        return { ok: true, path: destPath };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  // Auth IPC
  ipcMain.handle("auth:login", async () => {
    return login();
  });

  ipcMain.handle("auth:logout", async () => {
    await logout();
  });

  ipcMain.handle("auth:get-user", () => {
    return getAuthUser();
  });

  ipcMain.handle("auth:get-device-id", () => {
    return getDeviceId();
  });

  // Close flow
  ipcMain.on("app:close-confirmed", async () => {
    if (pendingCloseFallbackTimer) {
      clearTimeout(pendingCloseFallbackTimer);
      pendingCloseFallbackTimer = null;
    }
    outputBatcher.dispose();
    await ptyManager.destroyAll();
    gitWatcher.unwatchAll();
    sessionWatcher.unwatchAll();
    forceClose = true;
    if (mainWindow) {
      mainWindow.close();
    }
    app.quit();
  });
}

function dataUrlToPngBuffer(dataUrl: string): Buffer {
  const image = nativeImage.createFromDataURL(dataUrl);
  if (image.isEmpty()) {
    throw new Error("Invalid image data.");
  }
  return image.toPNG();
}

// Register ominiterm:// protocol for OAuth callback
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("ominiterm", process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient("ominiterm");
}

app.whenReady().then(async () => {
  // Handle webview webContents: open new windows in system browser, sanitize UA
  app.on("web-contents-created", (_event, contents) => {
    if (contents.getType() === "webview") {
      contents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
      });
      // Strip Electron/app identifiers from UA to avoid being blocked by sites
      const ua = contents.getUserAgent()
        .replace(/\s*Electron\/\S+/, "")
        .replace(/\s*ominiterm\/\S+/i, "");
      contents.setUserAgent(ua);
    }
  });

  setupIpc();
  await initAuth();
  createWindow();
  if (mainWindow) setupAutoUpdater(mainWindow);

  // Forward auth state changes to renderer, trigger backfill on login
  onAuthStateChange((user) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("auth:state-changed", user);
    }
    if (user) {
      backfillHistory().catch((err) => console.error("[Auth] Backfill error:", err));
      flushSyncQueue().catch((err) => console.error("[Auth] Queue flush error:", err));
    }
  });

  // Periodically flush the sync queue and sync recent records (every 5 minutes)
  setInterval(() => {
    if (isLoggedIn()) {
      flushSyncQueue().catch((err) => console.error("[UsageSync] Periodic flush error:", err));
      syncRecentRecords().catch((err) => console.error("[UsageSync] Periodic sync error:", err));
    }
  }, 5 * 60_000);

  // Handle ominiterm:// protocol on macOS
  app.on("open-url", async (_event, url) => {
    if (url.startsWith("ominiterm://auth/callback")) {
      await handleAuthCallback(url);
    }
  });

  app.on("second-instance", (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // Handle auth callback from argv (Windows/Linux)
    const authUrl = argv.find(arg => arg.startsWith("ominiterm://auth/callback"));
    if (authUrl) {
      handleAuthCallback(authUrl);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  stopAutoUpdater();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

