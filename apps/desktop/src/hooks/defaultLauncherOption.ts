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
