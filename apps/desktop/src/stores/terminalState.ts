import type { TerminalData, TerminalType } from "../types/index.ts";

export function withUpdatedTerminalType(
  terminal: TerminalData,
  type: TerminalType,
): TerminalData {
  return { ...terminal, type };
}

export function normalizeTerminalCustomTitle(
  customTitle: string,
): string | undefined {
  const normalized = customTitle.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : undefined;
}

export function withUpdatedTerminalCustomTitle(
  terminal: TerminalData,
  customTitle: string,
): TerminalData {
  return {
    ...terminal,
    customTitle: normalizeTerminalCustomTitle(customTitle),
  };
}

export function withToggledTerminalStarred(
  terminal: TerminalData,
): TerminalData {
  return {
    ...terminal,
    starred: !terminal.starred,
  };
}

export function getTerminalDisplayTitle(terminal: TerminalData): string {
  return terminal.customTitle
    ? `${terminal.customTitle} · ${terminal.title}`
    : terminal.title;
}
