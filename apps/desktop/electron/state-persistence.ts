import fs from "fs";
import os from "os";
import path from "path";

const isDev = !!process.env.VITE_DEV_SERVER_URL;
const PROD_OMINITERM_DIR = path.join(os.homedir(), ".ominiterm");
const DEV_OMINITERM_DIR = path.join(os.homedir(), ".ominiterm-dev");
const LEGACY_PROD_DIR = path.join(os.homedir(), ".termcanvas");
const LEGACY_DEV_DIR = path.join(os.homedir(), ".termcanvas-dev");

export const OMINITERM_DIR = isDev ? DEV_OMINITERM_DIR : PROD_OMINITERM_DIR;
const STATE_FILE = path.join(OMINITERM_DIR, "state.json");

export function migrateLegacyDirPair(fromDir: string, toDir: string): void {
  if (fs.existsSync(toDir) || !fs.existsSync(fromDir)) {
    return;
  }
  fs.renameSync(fromDir, toDir);
}

export function migrateLegacyOminiTermData(): void {
  try {
    migrateLegacyDirPair(LEGACY_PROD_DIR, PROD_OMINITERM_DIR);
    migrateLegacyDirPair(LEGACY_DEV_DIR, DEV_OMINITERM_DIR);
  } catch (err) {
    console.warn("[StatePersistence] failed to migrate legacy data:", err);
  }
}

export class StatePersistence {
  constructor() {
    if (!fs.existsSync(OMINITERM_DIR)) {
      fs.mkdirSync(OMINITERM_DIR, { recursive: true });
    }
  }

  load(): unknown | null {
    try {
      if (!fs.existsSync(STATE_FILE)) return null;
      const data = fs.readFileSync(STATE_FILE, "utf-8");
      return JSON.parse(data);
    } catch (err) {
      console.error("[StatePersistence] failed to load state:", err);
      return null;
    }
  }

  save(state: unknown) {
    const serialized =
      typeof state === "string" ? state : JSON.stringify(state, null, 2);
    const tmp = STATE_FILE + ".tmp";
    fs.writeFileSync(tmp, serialized, "utf-8");
    fs.renameSync(tmp, STATE_FILE);
  }
}

