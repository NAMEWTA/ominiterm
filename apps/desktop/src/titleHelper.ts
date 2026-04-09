import { useWorkspaceStore } from "./stores/workspaceStore.ts";

export function updateWindowTitle() {
  const { dirty } = useWorkspaceStore.getState();
  const title = `${dirty ? "* " : ""}OminiTerm`;
  void window.ominiterm?.app.setTitle(title);
}

