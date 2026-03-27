export type ShortcutCategory = "app" | "context";

export type EditableShortcutId =
  | "addProject"
  | "openWorkspace"
  | "toggleSidebar"
  | "toggleRightPanel"
  | "newTerminal"
  | "saveWorkspace"
  | "saveWorkspaceAs"
  | "renameTerminalTitle"
  | "closeFocused"
  | "toggleStarFocused"
  | "nextTerminal"
  | "prevTerminal";

export type ContextShortcutId =
  | "showShortcutHints"
  | "exitOrCancel"
  | "composerSend"
  | "composerNewLine"
  | "slashMenuNext"
  | "slashMenuPrev"
  | "slashMenuApply"
  | "slashMenuClose";

export type ShortcutId = EditableShortcutId | ContextShortcutId;

export interface ShortcutDefinition<TId extends ShortcutId = ShortcutId> {
  id: TId;
  labelKey: string;
  editable: boolean;
  category: ShortcutCategory;
  defaultBinding: string;
  legacyBindings: readonly string[];
  showInHints: boolean;
}

export type ShortcutMap = Partial<Record<EditableShortcutId, string>>;
export type ResolvedShortcutMap = Record<EditableShortcutId, string>;
export type ShortcutBindingsMap = Record<EditableShortcutId, readonly string[]>;

export const LEGACY_DEFAULT_SHORTCUTS: ResolvedShortcutMap = {
  addProject: "mod+o",
  openWorkspace: "mod+shift+o",
  toggleSidebar: "mod+\\",
  toggleRightPanel: "mod+/",
  newTerminal: "mod+t",
  saveWorkspace: "mod+s",
  saveWorkspaceAs: "mod+shift+s",
  renameTerminalTitle: "mod+;",
  closeFocused: "mod+d",
  toggleStarFocused: "mod+f",
  nextTerminal: "mod+]",
  prevTerminal: "mod+[",
};

export const APP_SHORTCUT_DEFINITIONS = [
  {
    id: "addProject",
    labelKey: "shortcut_add_project",
    editable: true,
    category: "app",
    defaultBinding: "mod+o",
    legacyBindings: [],
    showInHints: true,
  },
  {
    id: "openWorkspace",
    labelKey: "shortcut_open_workspace",
    editable: true,
    category: "app",
    defaultBinding: "mod+shift+o",
    legacyBindings: [],
    showInHints: true,
  },
  {
    id: "toggleSidebar",
    labelKey: "shortcut_toggle_sidebar",
    editable: true,
    category: "app",
    defaultBinding: "mod+b",
    legacyBindings: ["mod+\\"],
    showInHints: true,
  },
  {
    id: "toggleRightPanel",
    labelKey: "shortcut_toggle_right_panel",
    editable: true,
    category: "app",
    defaultBinding: "mod+shift+b",
    legacyBindings: ["mod+/"],
    showInHints: true,
  },
  {
    id: "newTerminal",
    labelKey: "shortcut_new_terminal",
    editable: true,
    category: "app",
    defaultBinding: "mod+t",
    legacyBindings: [],
    showInHints: true,
  },
  {
    id: "saveWorkspace",
    labelKey: "shortcut_save_workspace",
    editable: true,
    category: "app",
    defaultBinding: "mod+s",
    legacyBindings: [],
    showInHints: true,
  },
  {
    id: "saveWorkspaceAs",
    labelKey: "shortcut_save_workspace_as",
    editable: true,
    category: "app",
    defaultBinding: "mod+shift+s",
    legacyBindings: [],
    showInHints: true,
  },
  {
    id: "renameTerminalTitle",
    labelKey: "shortcut_rename_terminal_title",
    editable: true,
    category: "app",
    defaultBinding: "f2",
    legacyBindings: ["mod+;"],
    showInHints: true,
  },
  {
    id: "closeFocused",
    labelKey: "shortcut_close_focused",
    editable: true,
    category: "app",
    defaultBinding: "mod+d",
    legacyBindings: [],
    showInHints: true,
  },
  {
    id: "toggleStarFocused",
    labelKey: "shortcut_toggle_star_focused",
    editable: true,
    category: "app",
    defaultBinding: "mod+f",
    legacyBindings: [],
    showInHints: true,
  },
  {
    id: "nextTerminal",
    labelKey: "shortcut_next_terminal",
    editable: true,
    category: "app",
    defaultBinding: "mod+pagedown",
    legacyBindings: ["mod+]"],
    showInHints: true,
  },
  {
    id: "prevTerminal",
    labelKey: "shortcut_prev_terminal",
    editable: true,
    category: "app",
    defaultBinding: "mod+pageup",
    legacyBindings: ["mod+["],
    showInHints: true,
  },
] as const satisfies readonly ShortcutDefinition<EditableShortcutId>[];

export const CONTEXT_SHORTCUT_DEFINITIONS = [
  {
    id: "showShortcutHints",
    labelKey: "shortcut_show_shortcut_hints",
    editable: false,
    category: "context",
    defaultBinding: "?",
    legacyBindings: [],
    showInHints: false,
  },
  {
    id: "exitOrCancel",
    labelKey: "shortcut_context_escape",
    editable: false,
    category: "context",
    defaultBinding: "escape",
    legacyBindings: [],
    showInHints: false,
  },
  {
    id: "composerSend",
    labelKey: "shortcut_context_composer_send",
    editable: false,
    category: "context",
    defaultBinding: "enter",
    legacyBindings: [],
    showInHints: false,
  },
  {
    id: "composerNewLine",
    labelKey: "shortcut_context_composer_newline",
    editable: false,
    category: "context",
    defaultBinding: "shift+enter",
    legacyBindings: [],
    showInHints: false,
  },
  {
    id: "slashMenuNext",
    labelKey: "shortcut_context_slash_next",
    editable: false,
    category: "context",
    defaultBinding: "arrowdown",
    legacyBindings: [],
    showInHints: false,
  },
  {
    id: "slashMenuPrev",
    labelKey: "shortcut_context_slash_prev",
    editable: false,
    category: "context",
    defaultBinding: "arrowup",
    legacyBindings: [],
    showInHints: false,
  },
  {
    id: "slashMenuApply",
    labelKey: "shortcut_context_slash_apply",
    editable: false,
    category: "context",
    defaultBinding: "tab",
    legacyBindings: [],
    showInHints: false,
  },
  {
    id: "slashMenuClose",
    labelKey: "shortcut_context_slash_close",
    editable: false,
    category: "context",
    defaultBinding: "escape",
    legacyBindings: [],
    showInHints: false,
  },
] as const satisfies readonly ShortcutDefinition<ContextShortcutId>[];

export const DEFAULT_SHORTCUTS = Object.fromEntries(
  APP_SHORTCUT_DEFINITIONS.map((definition) => [
    definition.id,
    definition.defaultBinding,
  ]),
) as ResolvedShortcutMap;

function cloneOverrides(overrides: ShortcutMap): ShortcutMap {
  return { ...overrides };
}

export function normalizeShortcutValue(value: string): string {
  return value.trim().toLowerCase();
}

export function sanitizeShortcutOverrides(raw: Record<string, unknown>): ShortcutMap {
  const overrides: ShortcutMap = {};
  for (const definition of APP_SHORTCUT_DEFINITIONS) {
    const candidate = raw[definition.id];
    if (typeof candidate !== "string") {
      continue;
    }
    const normalized = normalizeShortcutValue(candidate);
    if (!normalized || normalized === definition.defaultBinding) {
      continue;
    }
    overrides[definition.id] = normalized;
  }
  return overrides;
}

export function migrateLegacyShortcutMap(raw: Record<string, unknown>): ShortcutMap {
  const overrides: ShortcutMap = {};
  for (const definition of APP_SHORTCUT_DEFINITIONS) {
    const candidate = raw[definition.id];
    if (typeof candidate !== "string") {
      continue;
    }
    const normalized = normalizeShortcutValue(candidate);
    if (
      !normalized ||
      normalized === LEGACY_DEFAULT_SHORTCUTS[definition.id]
    ) {
      continue;
    }
    overrides[definition.id] = normalized;
  }
  return overrides;
}

export function createResolvedShortcuts(overrides: ShortcutMap): ResolvedShortcutMap {
  const shortcuts = {} as ResolvedShortcutMap;
  for (const definition of APP_SHORTCUT_DEFINITIONS) {
    shortcuts[definition.id] =
      overrides[definition.id] ?? definition.defaultBinding;
  }
  return shortcuts;
}

export function createResolvedBindings(overrides: ShortcutMap): ShortcutBindingsMap {
  const bindings = {} as ShortcutBindingsMap;
  for (const definition of APP_SHORTCUT_DEFINITIONS) {
    const override = overrides[definition.id];
    bindings[definition.id] = override
      ? [override]
      : [definition.defaultBinding, ...definition.legacyBindings];
  }
  return bindings;
}

export function applyShortcutOverride(
  overrides: ShortcutMap,
  id: EditableShortcutId,
  value: string,
): ShortcutMap {
  const next = cloneOverrides(overrides);
  const normalized = normalizeShortcutValue(value);
  if (!normalized || normalized === DEFAULT_SHORTCUTS[id]) {
    delete next[id];
    return next;
  }
  next[id] = normalized;
  return next;
}

export function findShortcutConflict(
  id: EditableShortcutId,
  candidate: string,
  overrides: ShortcutMap,
): EditableShortcutId | null {
  const normalizedCandidate = normalizeShortcutValue(candidate);
  const nextOverrides = applyShortcutOverride(overrides, id, normalizedCandidate);
  const bindings = createResolvedBindings(nextOverrides);

  for (const definition of APP_SHORTCUT_DEFINITIONS) {
    if (definition.id === id) {
      continue;
    }
    if (bindings[definition.id].includes(normalizedCandidate)) {
      return definition.id;
    }
  }

  return null;
}

export function getHintShortcutDefinitions() {
  return APP_SHORTCUT_DEFINITIONS.filter((definition) => definition.showInHints);
}
