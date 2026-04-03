import {
  createLauncherOptions,
  type LauncherOption,
} from "../launchers/launcherOption.ts";
import type { LauncherConfigItem } from "../types";

export type ProjectBoardLauncherOption = LauncherOption;

export function getProjectBoardLauncherOptions(
  launchers: LauncherConfigItem[],
): ProjectBoardLauncherOption[] {
  return createLauncherOptions(launchers);
}
