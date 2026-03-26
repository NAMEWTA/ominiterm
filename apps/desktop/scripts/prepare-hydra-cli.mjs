import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const sourcePath = path.resolve(desktopRoot, "../../tools/hydra/dist/hydra.js");
const targetDir = path.resolve(desktopRoot, "dist-cli");
const targetPath = path.resolve(targetDir, "hydra.js");

if (!fs.existsSync(sourcePath)) {
  throw new Error(
    `Missing Hydra build artifact at ${sourcePath}. Run "pnpm --filter @ominiterm/hydra build" first.`,
  );
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(sourcePath, targetPath);

try {
  fs.chmodSync(targetPath, 0o755);
} catch {
  // best-effort for generated artifacts
}

const basePath = targetPath.replace(/\.js$/, "");

if (process.platform === "win32") {
  try {
    fs.unlinkSync(basePath);
  } catch {
    // no stale unix launcher
  }
  fs.writeFileSync(
    `${basePath}.cmd`,
    `@echo off\r\nnode "%~dp0\\\\hydra.js" %*\r\n`,
    "utf-8",
  );
} else {
  try {
    fs.lstatSync(basePath);
  } catch {
    fs.symlinkSync(path.basename(targetPath), basePath);
  }
}
