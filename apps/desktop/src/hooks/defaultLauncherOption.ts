import {
  createLauncherOptions,
  type LauncherOption,
} from "../launchers/launcherOption.ts";
import type { LauncherConfigItem } from "../types/index.ts";

export function getShortcutDefaultLauncherOption(
  launchers: LauncherConfigItem[],
): LauncherOption | null {
  return createLauncherOptions(launchers)[0] ?? null;
}

export function resolveShortcutLauncherOption(
  launchers: LauncherConfigItem[],
  loading: boolean,
): LauncherOption | null | undefined {
  if (loading) {
    return undefined;
  }
  return getShortcutDefaultLauncherOption(launchers);
}
