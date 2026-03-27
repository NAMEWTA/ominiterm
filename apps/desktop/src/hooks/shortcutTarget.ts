function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName?.toLowerCase();
  return (
    tag === "textarea" ||
    tag === "input" ||
    tag === "select" ||
    element.isContentEditable
  );
}

function isXtermHelperTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const className =
    typeof element.className === "string" ? element.className : "";
  return className.split(/\s+/).includes("xterm-helper-textarea");
}

function isPrintableKey(key: string): boolean {
  return key.length === 1;
}

export function hasPrimaryModifier(
  e: Pick<KeyboardEvent, "metaKey" | "ctrlKey">,
  platform: string = (
    typeof window !== "undefined" ? window.ominiterm?.app.platform : undefined
  ) ?? "darwin",
): boolean {
  return platform === "darwin" ? e.metaKey : e.ctrlKey;
}

export function shouldIgnoreShortcutTarget(
  e: Pick<KeyboardEvent, "key" | "target" | "metaKey" | "ctrlKey">,
): boolean {
  if (!isEditableTarget(e.target)) {
    return false;
  }
  if (hasPrimaryModifier(e)) {
    return false;
  }
  if (isXtermHelperTarget(e.target) && !isPrintableKey(e.key)) {
    return false;
  }
  return true;
}

