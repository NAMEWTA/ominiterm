import { app, net } from "electron";
import {
  createWriteStream,
  mkdirSync,
  rmSync,
  readdirSync,
  existsSync,
  createReadStream,
  writeFileSync,
} from "fs";
import { join, resolve } from "path";
import { createHash } from "crypto";
import { spawn, execFile } from "child_process";
import type { BrowserWindow } from "electron";
import { sendToWindow } from "./window-events";

const GITHUB_OWNER = "blueberrycongee";
const GITHUB_REPO = "termcanvas";

interface ReleaseFile {
  url: string;
  sha512: string;
  size: number;
}

interface ReleaseInfo {
  version: string;
  files: ReleaseFile[];
  releaseDate: string;
}

interface PendingUpdate {
  version: string;
  appPath: string;
  releaseNotes: string;
  releaseDate: string;
}

/**
 * Parse the latest-mac.yml produced by electron-builder.
 *
 * Format:
 *   version: X.Y.Z
 *   files:
 *     - url: Name.zip
 *       sha512: base64hash
 *       size: 12345
 *   releaseDate: 'ISO-string'
 */
function parseLatestYml(content: string): ReleaseInfo {
  const version = content.match(/^version:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const releaseDate =
    content.match(/^releaseDate:\s*'?(.+?)'?$/m)?.[1]?.trim() ?? "";

  const files: ReleaseFile[] = [];
  const parts = content.split(/\n\s+-\s+url:\s*/);
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    const url = block.split("\n")[0].trim();
    const sha512 = block.match(/sha512:\s*(.+)/)?.[1]?.trim() ?? "";
    const size = parseInt(block.match(/size:\s*(\d+)/)?.[1] ?? "0", 10);
    files.push({ url, sha512, size });
  }

  return { version, files, releaseDate };
}

/** Returns true if version `a` is newer than `b` (simple semver comparison). */
function isNewerVersion(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

/** Fetch text from a URL using Electron's net module (follows redirects). */
function fetchText(url: string, userAgent?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = net.request(url);
    if (userAgent) request.setHeader("User-Agent", userAgent);

    let data = "";
    request.on("response", (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} from ${url}`));
        return;
      }
      response.on("data", (chunk) => {
        data += chunk.toString();
      });
      response.on("end", () => resolve(data));
      response.on("error", reject);
    });
    request.on("error", reject);
    request.end();
  });
}

/** Download a file with progress reporting. */
function downloadFile(
  url: string,
  destPath: string,
  expectedSize: number,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = net.request(url);
    const stream = createWriteStream(destPath);
    let received = 0;
    let settled = false;

    const fail = (err: Error): void => {
      if (settled) return;
      settled = true;
      stream.destroy();
      reject(err);
    };

    request.on("response", (response) => {
      if (response.statusCode !== 200) {
        fail(new Error(`HTTP ${response.statusCode} downloading update`));
        return;
      }
      response.on("data", (chunk) => {
        stream.write(chunk);
        received += chunk.length;
        if (expectedSize > 0) {
          onProgress(Math.min(100, (received / expectedSize) * 100));
        }
      });
      response.on("end", () => {
        stream.end(() => {
          settled = true;
          resolve();
        });
      });
      response.on("error", fail);
    });
    request.on("error", fail);
    request.end();
  });
}

/** Compute SHA-512 hash of a file, returned as base64 (streaming). */
function computeSha512(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha512");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("base64")));
    stream.on("error", reject);
  });
}

/** Extract a ZIP file using macOS ditto (preserves attributes, handles unicode). */
function extractZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirSync(destDir, { recursive: true });
    execFile("ditto", ["-xk", zipPath, destDir], (err) => {
      if (err) reject(new Error(`Failed to extract update: ${err.message}`));
      else resolve();
    });
  });
}

function getStagingDir(): string {
  return join(app.getPath("userData"), "pending-update");
}

function getAppBundlePath(): string {
  // app.getAppPath() → /path/to/App.app/Contents/Resources/app.asar
  return resolve(app.getAppPath(), "../../..");
}

/**
 * Custom macOS updater that bypasses Squirrel.Mac's code signature
 * verification. Downloads the ZIP from GitHub releases, verifies SHA-512,
 * extracts, and replaces the .app bundle via a detached shell script.
 */
export class MacCustomUpdater {
  private window: BrowserWindow;
  private pendingUpdate: PendingUpdate | null = null;
  private downloading = false;

  constructor(window: BrowserWindow) {
    this.window = window;
    this.cleanStagingDir();
  }

  async checkForUpdates(): Promise<void> {
    if (this.downloading || this.pendingUpdate) return;

    try {
      const ymlUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/latest-mac.yml`;
      const yml = await fetchText(ymlUrl);
      const release = parseLatestYml(yml);

      if (!release.version) return;
      if (!isNewerVersion(release.version, app.getVersion())) return;

      // Fetch release notes from GitHub API (optional, best-effort)
      let releaseNotes = "";
      try {
        const ua = `TermCanvas/${app.getVersion()}`;
        const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/v${release.version}`;
        const json = await fetchText(apiUrl, ua);
        const data = JSON.parse(json) as { body?: string };
        releaseNotes = data.body ?? "";
      } catch {
        // Non-critical — proceed without release notes
      }

      sendToWindow(this.window, "updater:update-available", {
        version: release.version,
        releaseNotes,
        releaseDate: release.releaseDate,
      });

      await this.downloadUpdate(release, releaseNotes);
    } catch (error) {
      sendToWindow(this.window, "updater:error", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  quitAndInstall(): void {
    if (!this.pendingUpdate) return;

    const currentAppPath = getAppBundlePath();
    const { appPath: newAppPath } = this.pendingUpdate;
    const stagingDir = getStagingDir();
    const pid = process.pid;

    // Detached shell script: wait for app exit → replace → relaunch
    const script = [
      "#!/bin/bash",
      `while kill -0 ${pid} 2>/dev/null; do sleep 0.5; done`,
      `rm -rf "${currentAppPath}"`,
      `mv "${newAppPath}" "${currentAppPath}"`,
      `xattr -cr "${currentAppPath}"`,
      `rm -rf "${stagingDir}"`,
      `open "${currentAppPath}"`,
    ].join("\n");

    const scriptPath = join(stagingDir, "install.sh");
    writeFileSync(scriptPath, script, { mode: 0o755 });

    const child = spawn("bash", [scriptPath], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    app.quit();
  }

  private async downloadUpdate(
    release: ReleaseInfo,
    releaseNotes: string,
  ): Promise<void> {
    this.downloading = true;
    try {
      // Pick the ZIP matching the current architecture
      const isArm64 = process.arch === "arm64";
      const zipFile = release.files.find(
        (f) =>
          f.url.endsWith(".zip") &&
          (isArm64 ? f.url.includes("arm64") : !f.url.includes("arm64")),
      );

      if (!zipFile) {
        throw new Error("No matching ZIP found for this architecture");
      }

      const downloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${release.version}/${zipFile.url}`;
      const stagingDir = getStagingDir();
      const zipPath = join(stagingDir, zipFile.url);

      // Clean and recreate staging directory
      if (existsSync(stagingDir)) {
        rmSync(stagingDir, { recursive: true, force: true });
      }
      mkdirSync(stagingDir, { recursive: true });

      // Download
      await downloadFile(downloadUrl, zipPath, zipFile.size, (percent) => {
        sendToWindow(this.window, "updater:download-progress", { percent });
      });

      // Verify SHA-512
      const hash = await computeSha512(zipPath);
      if (hash !== zipFile.sha512) {
        rmSync(stagingDir, { recursive: true, force: true });
        throw new Error("SHA-512 verification failed — update is corrupted");
      }

      // Extract
      const extractDir = join(stagingDir, "extracted");
      await extractZip(zipPath, extractDir);

      // Locate the .app bundle inside the extracted directory
      const appName = readdirSync(extractDir).find((f) => f.endsWith(".app"));
      if (!appName) {
        throw new Error("No .app bundle found in update package");
      }

      // Remove ZIP to save disk space
      rmSync(zipPath, { force: true });

      this.pendingUpdate = {
        version: release.version,
        appPath: join(extractDir, appName),
        releaseNotes,
        releaseDate: release.releaseDate,
      };

      sendToWindow(this.window, "updater:update-downloaded", {
        version: release.version,
        releaseNotes,
        releaseDate: release.releaseDate,
      });
    } catch (error) {
      sendToWindow(this.window, "updater:error", {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.downloading = false;
    }
  }

  /** Remove leftover staging directory from a previous failed update. */
  private cleanStagingDir(): void {
    const dir = getStagingDir();
    if (existsSync(dir)) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
