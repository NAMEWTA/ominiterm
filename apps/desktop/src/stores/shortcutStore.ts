import { create } from "zustand";
import { hasPrimaryModifier } from "../hooks/shortcutTarget.ts";
import {
  DEFAULT_SHORTCUTS,
  applyShortcutOverride,
  createResolvedBindings,
  createResolvedShortcuts,
  migrateLegacyShortcutMap,
  sanitizeShortcutOverrides,
  type EditableShortcutId,
  type ResolvedShortcutMap,
  type ShortcutBindingsMap,
  type ShortcutMap,
} from "../shortcuts/catalog.ts";

export type {
  EditableShortcutId,
  ResolvedShortcutMap,
  ShortcutBindingsMap,
  ShortcutMap,
} from "../shortcuts/catalog.ts";

const STORAGE_KEY = "ominiterm-shortcuts";
export const SHORTCUT_STORAGE_VERSION = 2;

export type ShortcutPlatform = "darwin" | "win32" | "linux";

function getShortcutPlatform(): ShortcutPlatform {
  if (typeof window !== "undefined" && window.ominiterm?.app.platform) {
    return window.ominiterm.app.platform;
  }
  if (typeof process !== "undefined") {
    const platform = process.platform;
    if (platform === "darwin" || platform === "win32" || platform === "linux") {
      return platform;
    }
  }
  return "darwin";
}

function hasUnsupportedPlatformModifier(
  e: Pick<KeyboardEvent, "metaKey" | "ctrlKey">,
  platform: ShortcutPlatform,
): boolean {
  return platform === "darwin"
    ? e.ctrlKey && !e.metaKey
    : e.metaKey && !e.ctrlKey;
}

function persistShortcuts(overrides: ShortcutMap) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: SHORTCUT_STORAGE_VERSION,
      overrides,
    }),
  );
}

function loadShortcuts(): ShortcutMap {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return {};
    }
    const parsed = JSON.parse(saved);
    const overrides =
      parsed &&
      typeof parsed === "object" &&
      "version" in parsed &&
      parsed.version === SHORTCUT_STORAGE_VERSION &&
      parsed.overrides &&
      typeof parsed.overrides === "object"
        ? sanitizeShortcutOverrides(parsed.overrides as Record<string, unknown>)
        : parsed && typeof parsed === "object"
          ? migrateLegacyShortcutMap(parsed as Record<string, unknown>)
          : {};
    persistShortcuts(overrides);
    return overrides;
  } catch {
    // ignore
  }
  return {};
}

function createShortcutState(overrides: ShortcutMap) {
  return {
    overrides,
    shortcuts: createResolvedShortcuts(overrides),
    bindings: createResolvedBindings(overrides),
  };
}

interface ShortcutStore {
  overrides: ShortcutMap;
  shortcuts: ResolvedShortcutMap;
  bindings: ShortcutBindingsMap;
  setShortcut: (key: EditableShortcutId, value: string) => void;
  resetAll: () => void;
}

const initialOverrides = loadShortcuts();

export const useShortcutStore = create<ShortcutStore>((set) => ({
  ...createShortcutState(initialOverrides),
  setShortcut: (key, value) =>
    set((state) => {
      const overrides = applyShortcutOverride(state.overrides, key, value);
      persistShortcuts(overrides);
      return createShortcutState(overrides);
    }),

  resetAll: () => {
    const overrides = {};
    persistShortcuts(overrides);
    return set(createShortcutState(overrides));
  },
}));

/**
 * Convert a KeyboardEvent into a shortcut string like "mod+b", "mod+]", "escape".
 */
export function eventToShortcut(e: KeyboardEvent): string {
  const platform = getShortcutPlatform();
  if (hasUnsupportedPlatformModifier(e, platform)) return "";
  const parts: string[] = [];
  if (hasPrimaryModifier(e, platform)) parts.push("mod");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");

  const key = e.key.toLowerCase();
  // Don't include modifier-only presses
  if (["control", "meta", "shift", "alt"].includes(key)) return "";
  parts.push(key);
  return parts.join("+");
}

/**
 * Check if a KeyboardEvent matches a shortcut string.
 */
export function matchesShortcut(
  e: KeyboardEvent,
  shortcut: string | readonly string[],
): boolean {
  const shortcuts = Array.isArray(shortcut) ? shortcut : [shortcut];
  return shortcuts.some((candidate) => matchesSingleShortcut(e, candidate));
}

function matchesSingleShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const platform = getShortcutPlatform();
  if (hasUnsupportedPlatformModifier(e, platform)) return false;
  const parts = shortcut.split("+");
  const needsMod = parts.includes("mod");
  const needsShift = parts.includes("shift");
  const needsAlt = parts.includes("alt");
  const key = parts.filter(
    (p) => p !== "mod" && p !== "shift" && p !== "alt",
  )[0];

  const hasMod = hasPrimaryModifier(e, platform);

  if (needsMod && !hasMod) return false;
  if (!needsMod && hasMod) return false;
  if (needsShift !== e.shiftKey) return false;
  if (needsAlt !== e.altKey) return false;
  return e.key.toLowerCase() === key;
}

/**
 * Format a shortcut string for display, e.g. "mod+b" -> "⌘ B" or "Ctrl B".
 */
export function formatShortcut(shortcut: string, isMac: boolean): string {
  return shortcut
    .split("+")
    .map((part) => {
      if (part === "mod") return isMac ? "⌘" : "Ctrl";
      if (part === "shift") return isMac ? "⇧" : "Shift";
      if (part === "alt") return isMac ? "⌥" : "Alt";
      if (part === "escape") return "Esc";
      if (part === "enter") return "Enter";
      if (part === "tab") return "Tab";
      if (part === "pageup") return "Page Up";
      if (part === "pagedown") return "Page Down";
      if (part === "arrowup") return "Arrow Up";
      if (part === "arrowdown") return "Arrow Down";
      return part.toUpperCase();
    })
    .join(" ");
}

