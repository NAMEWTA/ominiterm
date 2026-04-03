import path from "path";
import {
  loadLaunchersConfig,
  saveLaunchersConfig,
  type LauncherConfigItem,
} from "./launchers-config.ts";
import { OMINITERM_DIR } from "./state-persistence.ts";

interface IpcMainLike {
  handle: (
    channel: string,
    listener: (_event: unknown, ...args: unknown[]) => unknown,
  ) => void;
}

export interface LaunchersService {
  get: (id: string) => LauncherConfigItem | null | Promise<LauncherConfigItem | null>;
  list: () => LauncherConfigItem[] | Promise<LauncherConfigItem[]>;
  save: (launcher: LauncherConfigItem) => LauncherConfigItem[] | Promise<LauncherConfigItem[]>;
  remove: (id: string) => LauncherConfigItem[] | Promise<LauncherConfigItem[]>;
  reorder: (ids: string[]) => LauncherConfigItem[] | Promise<LauncherConfigItem[]>;
}

const DEFAULT_LAUNCHERS_FILE_PATH = path.join(OMINITERM_DIR, "launchers.json");

function loadLaunchers(filePath: string): LauncherConfigItem[] {
  return loadLaunchersConfig(filePath).launchers;
}

function saveLaunchers(
  filePath: string,
  launchers: LauncherConfigItem[],
): LauncherConfigItem[] {
  const current = loadLaunchersConfig(filePath);
  const nextConfig = {
    ...current,
    updatedAt: new Date().toISOString(),
    launchers,
  };
  saveLaunchersConfig(filePath, nextConfig);
  return nextConfig.launchers;
}

function reorderLaunchers(
  launchers: LauncherConfigItem[],
  orderedIds: string[],
): LauncherConfigItem[] {
  if (orderedIds.length !== launchers.length) {
    throw new Error("launchers:reorder ids length mismatch");
  }

  const launchersById = new Map(
    launchers.map((launcher) => [launcher.id, launcher]),
  );

  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new Error("launchers:reorder ids contain duplicates");
  }

  const reordered: LauncherConfigItem[] = [];
  for (const id of orderedIds) {
    const launcher = launchersById.get(id);
    if (!launcher) {
      throw new Error(`launchers:reorder unknown launcher id: ${id}`);
    }
    reordered.push(launcher);
  }

  return reordered;
}

export function createLaunchersService(
  filePath = DEFAULT_LAUNCHERS_FILE_PATH,
): LaunchersService {
  return {
    get: (id: string) => {
      const launchers = loadLaunchers(filePath);
      return launchers.find((launcher) => launcher.id === id) ?? null;
    },
    list: () => {
      return loadLaunchers(filePath);
    },
    save: (launcher: LauncherConfigItem) => {
      const current = loadLaunchers(filePath);
      const existingIndex = current.findIndex((item) => item.id === launcher.id);
      const next = [...current];
      if (existingIndex === -1) {
        next.push(launcher);
      } else {
        next[existingIndex] = launcher;
      }
      return saveLaunchers(filePath, next);
    },
    remove: (id: string) => {
      const current = loadLaunchers(filePath);
      return saveLaunchers(
        filePath,
        current.filter((launcher) => launcher.id !== id),
      );
    },
    reorder: (ids: string[]) => {
      const current = loadLaunchers(filePath);
      return saveLaunchers(filePath, reorderLaunchers(current, ids));
    },
  };
}

export function registerLaunchersIpc(
  ipcMain: IpcMainLike,
  service: LaunchersService = createLaunchersService(),
): void {
  ipcMain.handle("launchers:get", (_event, id) => service.get(String(id)));
  ipcMain.handle("launchers:list", () => service.list());
  ipcMain.handle("launchers:save", (_event, payload) =>
    service.save(payload as LauncherConfigItem),
  );
  ipcMain.handle("launchers:delete", (_event, id) =>
    service.remove(String(id)),
  );
  ipcMain.handle("launchers:reorder", (_event, ids) =>
    service.reorder(ids as string[]),
  );
}
