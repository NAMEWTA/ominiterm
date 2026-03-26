const KEY_MAPPINGS = [
  ["termcanvas-preferences", "ominiterm-preferences"],
  ["termcanvas-locale", "ominiterm-locale"],
  ["termcanvas-welcome-seen", "ominiterm-welcome-seen"],
] as const;

export function migrateLegacyLocalStorage(): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  for (const [legacyKey, nextKey] of KEY_MAPPINGS) {
    const nextValue = localStorage.getItem(nextKey);
    const legacyValue = localStorage.getItem(legacyKey);
    if (nextValue === null && legacyValue !== null) {
      localStorage.setItem(nextKey, legacyValue);
      localStorage.removeItem(legacyKey);
    }
  }
}
