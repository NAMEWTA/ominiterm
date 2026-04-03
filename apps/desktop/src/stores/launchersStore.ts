import { create } from "zustand";
import type { LauncherConfigItem, LauncherStartupEvent } from "../types";
import { useNotificationStore } from "./notificationStore.ts";
import { buildStartupStatusMessage } from "../terminal/startupStatus.ts";

export interface LauncherDraftValidationErrors {
  name?: "required";
  entryCommand?: "required";
}

export interface LauncherDraftValidationResult {
  ok: boolean;
  errors: LauncherDraftValidationErrors;
}

const DEFAULT_STARTUP_TIMEOUT_MS = 120000;
const MIN_STARTUP_TIMEOUT_MS = 1000;
const MAX_STARTUP_TIMEOUT_MS = 600000;

function cloneLauncher(launcher: LauncherConfigItem): LauncherConfigItem {
  return {
    ...launcher,
    mainCommand: {
      ...launcher.mainCommand,
      args: [...launcher.mainCommand.args],
    },
    startupCommands: launcher.startupCommands.map((step) => ({ ...step })),
    runPolicy: {
      ...launcher.runPolicy,
    },
  };
}

function createDefaultLauncherDraft(
  existingLaunchers: LauncherConfigItem[],
): LauncherConfigItem {
  let suffix = 1;
  while (existingLaunchers.some((launcher) => launcher.id === `launcher-${suffix}`)) {
    suffix += 1;
  }

  return {
    id: `launcher-${suffix}`,
    name: `Launcher ${suffix}`,
    enabled: true,
    hostShell: "auto",
    mainCommand: {
      command: "",
      args: [],
    },
    startupCommands: [],
    runPolicy: {
      runOnNewSessionOnly: true,
      onFailure: "stop",
    },
  };
}

export function formatArgsForText(args: string[]): string {
  return args.join("\n");
}

export function parseArgsFromText(argsText: string): string[] {
  return argsText
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function validateDraft(
  draft: LauncherConfigItem | null,
): LauncherDraftValidationResult {
  const errors: LauncherDraftValidationErrors = {};

  const hasName =
    typeof draft?.name === "string" && draft.name.trim().length > 0;
  if (!hasName) {
    errors.name = "required";
  }

  const hasMainCommand =
    typeof draft?.mainCommand?.command === "string" &&
    draft.mainCommand.command.trim().length > 0;
  const hasStartupCommand =
    Array.isArray(draft?.startupCommands) &&
    draft.startupCommands.some(
      (step) =>
        typeof step.command === "string" && step.command.trim().length > 0,
    );
  if (!hasMainCommand && !hasStartupCommand) {
    errors.entryCommand = "required";
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

interface LaunchersStore {
  launchers: LauncherConfigItem[];
  selectedLauncherId: string | null;
  draft: LauncherConfigItem | null;
  lastStartupEvent: LauncherStartupEvent | null;
  mainCommandArgsText: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
  validationErrors: LauncherDraftValidationErrors;
  consumeStartupEvent: (event: LauncherStartupEvent) => void;
  load: () => Promise<void>;
  createDraftForNewLauncher: () => void;
  selectLauncher: (launcherId: string) => void;
  updateDraftName: (name: string) => void;
  updateDraftId: (id: string) => void;
  updateDraftEnabled: (enabled: boolean) => void;
  updateDraftHostShell: (hostShell: LauncherConfigItem["hostShell"]) => void;
  addDraftStartupCommand: () => void;
  updateDraftStartupCommandLabel: (index: number, label: string) => void;
  updateDraftStartupCommandCommand: (index: number, command: string) => void;
  updateDraftStartupCommandTimeoutMs: (index: number, timeoutMs: number) => void;
  moveDraftStartupCommand: (index: number, offset: -1 | 1) => void;
  removeDraftStartupCommand: (index: number) => void;
  updateDraftMainCommand: (command: string) => void;
  updateDraftMainCommandArgsText: (argsText: string) => void;
  saveDraft: () => Promise<boolean>;
  clearError: () => void;
}

export const useLaunchersStore = create<LaunchersStore>((set, get) => ({
  launchers: [],
  selectedLauncherId: null,
  draft: null,
  lastStartupEvent: null,
  mainCommandArgsText: "",
  loading: false,
  saving: false,
  error: null,
  validationErrors: {},

  consumeStartupEvent: (event) => {
    set({ lastStartupEvent: event });
    if (event.type === "step-failed") {
      useNotificationStore
        .getState()
        .notify("warn", buildStartupStatusMessage(event));
    }
  },

  load: async () => {
    set({ loading: true, error: null });

    try {
      if (!window.ominiterm?.launchers) {
        set({
          loading: false,
          error: "Launchers API is unavailable.",
        });
        return;
      }

      const launchers = await window.ominiterm.launchers.list();
      const currentId = get().selectedLauncherId;
      const selected =
        launchers.find((launcher) => launcher.id === currentId) ??
        launchers[0] ??
        null;

      set({
        launchers,
        selectedLauncherId: selected?.id ?? null,
        draft: selected ? cloneLauncher(selected) : null,
        mainCommandArgsText: selected
          ? formatArgsForText(selected.mainCommand.args)
          : "",
        loading: false,
        validationErrors: {},
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  createDraftForNewLauncher: () => {
    const defaultDraft = createDefaultLauncherDraft(get().launchers);
    set({
      selectedLauncherId: null,
      draft: defaultDraft,
      mainCommandArgsText: formatArgsForText(defaultDraft.mainCommand.args),
      validationErrors: {},
      error: null,
    });
  },

  selectLauncher: (launcherId) => {
    const launcher = get().launchers.find((item) => item.id === launcherId);
    if (!launcher) {
      return;
    }

    set({
      selectedLauncherId: launcher.id,
      draft: cloneLauncher(launcher),
      mainCommandArgsText: formatArgsForText(launcher.mainCommand.args),
      validationErrors: {},
      error: null,
    });
  },

  updateDraftName: (name) => {
    set((state) => {
      if (!state.draft) {
        return state;
      }

      return {
        draft: {
          ...state.draft,
          name,
        },
        error: null,
      };
    });
  },

  updateDraftId: (id) => {
    set((state) => {
      if (!state.draft) {
        return state;
      }

      return {
        draft: {
          ...state.draft,
          id,
        },
        error: null,
      };
    });
  },

  updateDraftEnabled: (enabled) => {
    set((state) => {
      if (!state.draft) {
        return state;
      }

      return {
        draft: {
          ...state.draft,
          enabled,
        },
        error: null,
      };
    });
  },

  updateDraftHostShell: (hostShell) => {
    set((state) => {
      if (!state.draft) {
        return state;
      }

      return {
        draft: {
          ...state.draft,
          hostShell,
        },
        error: null,
      };
    });
  },

  addDraftStartupCommand: () => {
    set((state) => {
      if (!state.draft) {
        return state;
      }

      const nextIndex = state.draft.startupCommands.length + 1;
      return {
        draft: {
          ...state.draft,
          startupCommands: [
            ...state.draft.startupCommands,
            {
              label: `Step ${nextIndex}`,
              command: "",
              timeoutMs: DEFAULT_STARTUP_TIMEOUT_MS,
            },
          ],
        },
        error: null,
      };
    });
  },

  updateDraftStartupCommandLabel: (index, label) => {
    set((state) => {
      if (!state.draft || index < 0 || index >= state.draft.startupCommands.length) {
        return state;
      }

      const startupCommands = state.draft.startupCommands.map((step, stepIndex) =>
        stepIndex === index ? { ...step, label } : step,
      );

      return {
        draft: {
          ...state.draft,
          startupCommands,
        },
        error: null,
      };
    });
  },

  updateDraftStartupCommandCommand: (index, command) => {
    set((state) => {
      if (!state.draft || index < 0 || index >= state.draft.startupCommands.length) {
        return state;
      }

      const startupCommands = state.draft.startupCommands.map((step, stepIndex) =>
        stepIndex === index ? { ...step, command } : step,
      );

      return {
        draft: {
          ...state.draft,
          startupCommands,
        },
        error: null,
      };
    });
  },

  updateDraftStartupCommandTimeoutMs: (index, timeoutMs) => {
    set((state) => {
      if (!state.draft || index < 0 || index >= state.draft.startupCommands.length) {
        return state;
      }

      const normalizedTimeout = Number.isFinite(timeoutMs)
        ? Math.min(
            MAX_STARTUP_TIMEOUT_MS,
            Math.max(MIN_STARTUP_TIMEOUT_MS, Math.round(timeoutMs)),
          )
        : DEFAULT_STARTUP_TIMEOUT_MS;

      const startupCommands = state.draft.startupCommands.map((step, stepIndex) =>
        stepIndex === index ? { ...step, timeoutMs: normalizedTimeout } : step,
      );

      return {
        draft: {
          ...state.draft,
          startupCommands,
        },
        error: null,
      };
    });
  },

  moveDraftStartupCommand: (index, offset) => {
    set((state) => {
      if (!state.draft) {
        return state;
      }

      const targetIndex = index + offset;
      if (
        index < 0 ||
        index >= state.draft.startupCommands.length ||
        targetIndex < 0 ||
        targetIndex >= state.draft.startupCommands.length
      ) {
        return state;
      }

      const startupCommands = [...state.draft.startupCommands];
      const [step] = startupCommands.splice(index, 1);
      startupCommands.splice(targetIndex, 0, step);

      return {
        draft: {
          ...state.draft,
          startupCommands,
        },
        error: null,
      };
    });
  },

  removeDraftStartupCommand: (index) => {
    set((state) => {
      if (!state.draft || index < 0 || index >= state.draft.startupCommands.length) {
        return state;
      }

      return {
        draft: {
          ...state.draft,
          startupCommands: state.draft.startupCommands.filter(
            (_step, stepIndex) => stepIndex !== index,
          ),
        },
        error: null,
      };
    });
  },

  updateDraftMainCommand: (command) => {
    set((state) => {
      if (!state.draft) {
        return state;
      }

      return {
        draft: {
          ...state.draft,
          mainCommand: {
            ...state.draft.mainCommand,
            command,
          },
        },
        error: null,
      };
    });
  },

  updateDraftMainCommandArgsText: (argsText) => {
    set((state) => {
      if (!state.draft) {
        return state;
      }

      return {
        mainCommandArgsText: argsText,
        draft: {
          ...state.draft,
          mainCommand: {
            ...state.draft.mainCommand,
            args: parseArgsFromText(argsText),
          },
        },
        error: null,
      };
    });
  },

  saveDraft: async () => {
    const draft = get().draft;
    const validation = validateDraft(draft);
    if (!validation.ok || !draft) {
      set({ validationErrors: validation.errors });
      return false;
    }

    const sourceId = get().selectedLauncherId;
    const normalizedDraft: LauncherConfigItem = {
      ...draft,
      id: draft.id.trim(),
      name: draft.name.trim(),
      mainCommand: {
        ...draft.mainCommand,
        command: draft.mainCommand.command.trim(),
        args: parseArgsFromText(get().mainCommandArgsText),
      },
    };

    const hasIdCollision = get().launchers.some(
      (launcher) =>
        launcher.id === normalizedDraft.id &&
        (sourceId === null || launcher.id !== sourceId),
    );
    if (hasIdCollision) {
      set({
        error: "Launcher ID already exists.",
        validationErrors: {},
      });
      return false;
    }

    set({
      saving: true,
      error: null,
      validationErrors: {},
    });

    try {
      if (!window.ominiterm?.launchers) {
        throw new Error("Launchers API is unavailable.");
      }

      let launchers = await window.ominiterm.launchers.save(normalizedDraft);

      if (sourceId && sourceId !== normalizedDraft.id) {
        launchers = await window.ominiterm.launchers.delete(sourceId);
      }

      const selected =
        launchers.find((launcher) => launcher.id === normalizedDraft.id) ??
        null;

      set({
        launchers,
        selectedLauncherId: selected?.id ?? null,
        draft: selected ? cloneLauncher(selected) : null,
        mainCommandArgsText: selected
          ? formatArgsForText(selected.mainCommand.args)
          : "",
        saving: false,
        validationErrors: {},
      });

      return true;
    } catch (error) {
      set({
        saving: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
