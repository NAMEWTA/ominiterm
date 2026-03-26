import test from "node:test";
import assert from "node:assert/strict";

import { useUiShellStore } from "../src/stores/uiShellStore.ts";

test("project sidebar supports drawer collapse toggle", () => {
  useUiShellStore.setState({
    selectedProjectId: null,
    projectSidebarWidth: 248,
    contentMode: "projectBoard",
    detailTerminalId: null,
    rightRailCollapsed: true,
    rightRailTab: "usage",
    boardScrollByProject: {},
    projectSidebarCollapsed: false,
  } as unknown as ReturnType<typeof useUiShellStore.getState>);

  const state = useUiShellStore.getState() as any;
  state.toggleProjectSidebarCollapsed();
  assert.equal(useUiShellStore.getState().projectSidebarCollapsed, true);

  state.toggleProjectSidebarCollapsed();
  assert.equal(useUiShellStore.getState().projectSidebarCollapsed, false);
});
