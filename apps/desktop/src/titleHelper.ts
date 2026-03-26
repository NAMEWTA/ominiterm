import { useWorkspaceStore } from "./stores/workspaceStore.ts";

export function getWorkspaceBaseName(workspacePath: string | null) {
  return workspacePath
    ? workspacePath
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.(ominiterm|termcanvas)$/, "") ?? null
    : null;
}

export function updateWindowTitle() {
  const { workspacePath, dirty } = useWorkspaceStore.getState();
  const name = getWorkspaceBaseName(workspacePath) ?? "Untitled";
  const title = `${dirty ? "* " : ""}${name} — OminiTerm`;
  void window.ominiterm?.workspace.setTitle(title);
}

