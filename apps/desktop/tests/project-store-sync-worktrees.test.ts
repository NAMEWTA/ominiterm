import test from "node:test";
import assert from "node:assert/strict";

import { useProjectStore } from "../src/stores/projectStore.ts";
import { migrateProjects } from "../src/projectStateMigration.ts";
import type { ProjectData } from "../src/types/index.ts";

function createProject(): ProjectData {
  return {
    id: "project-1",
    name: "Project One",
    path: "/tmp/project-1",
    position: { x: 0, y: 0 },
    collapsed: false,
    zIndex: 1,
    worktrees: [
      {
        id: "worktree-main",
        name: "main",
        path: "/tmp/project-1",
        position: { x: 10, y: 20 },
        collapsed: false,
        terminals: [
          {
            id: "terminal-1",
            title: "Terminal 1",
            type: "shell",
            minimized: false,
            focused: false,
            ptyId: null,
            status: "idle",
            span: { cols: 1, rows: 1 },
          },
        ],
      },
    ],
  };
}

function resetStore(projects: ProjectData[]) {
  useProjectStore.setState({
    projects,
    focusedProjectId: null,
    focusedWorktreeId: null,
  });
}

test("syncWorktrees no-op keeps references and does not notify subscribers", () => {
  const project = createProject();
  resetStore([project]);

  const beforeProjects = useProjectStore.getState().projects;
  const beforeProject = beforeProjects[0];
  const beforeWorktree = beforeProject.worktrees[0];

  let notifications = 0;
  const unsubscribe = useProjectStore.subscribe(() => {
    notifications += 1;
  });

  useProjectStore.getState().syncWorktrees("/tmp/project-1", [
    { path: "/tmp/project-1", branch: "main", isMain: true },
  ]);
  unsubscribe();

  const afterProjects = useProjectStore.getState().projects;
  assert.equal(notifications, 0);
  assert.strictEqual(afterProjects, beforeProjects);
  assert.strictEqual(afterProjects[0], beforeProject);
  assert.strictEqual(afterProjects[0].worktrees[0], beforeWorktree);
});

test("syncWorktrees still updates renamed branches", () => {
  resetStore([createProject()]);

  useProjectStore.getState().syncWorktrees("/tmp/project-1", [
    { path: "/tmp/project-1", branch: "feature/new-name", isMain: true },
  ]);

  const state = useProjectStore.getState();
  assert.equal(state.projects.length, 1);
  assert.equal(state.projects[0].worktrees.length, 1);
  assert.equal(state.projects[0].worktrees[0].name, "feature/new-name");
  assert.equal(state.projects[0].worktrees[0].path, "/tmp/project-1");
});

test("syncWorktrees still adds and removes worktrees", () => {
  resetStore([createProject()]);

  useProjectStore.getState().syncWorktrees("/tmp/project-1", [
    { path: "/tmp/project-1", branch: "main", isMain: true },
    { path: "/tmp/project-1-feature", branch: "feature", isMain: false },
  ]);

  let state = useProjectStore.getState();
  assert.equal(state.projects[0].worktrees.length, 2);
  const feature = state.projects[0].worktrees.find(
    (worktree) => worktree.path === "/tmp/project-1-feature",
  );
  assert.ok(feature);
  assert.deepEqual(feature!.terminals, []);

  useProjectStore.getState().syncWorktrees("/tmp/project-1", [
    { path: "/tmp/project-1-feature", branch: "feature", isMain: true },
  ]);

  state = useProjectStore.getState();
  assert.equal(state.projects[0].worktrees.length, 1);
  assert.equal(state.projects[0].worktrees[0].path, "/tmp/project-1-feature");
  assert.equal(state.projects[0].worktrees[0].name, "feature");
});

test("syncWorktrees matches Windows paths across slash styles", () => {
  const project = createProject();
  project.path = "C:\\repo";
  project.worktrees[0].path = "C:\\repo\\worktree-main";
  project.worktrees[0].terminals = [
    {
      id: "terminal-1",
      title: "Terminal 1",
      type: "shell",
      minimized: false,
      focused: false,
      ptyId: null,
      status: "idle",
      span: { cols: 1, rows: 1 },
    },
  ];

  resetStore([project]);

  useProjectStore.getState().syncWorktrees("C:\\repo", [
    { path: "C:/repo/worktree-main", branch: "main", isMain: true },
  ]);

  const state = useProjectStore.getState();
  assert.equal(state.projects[0].worktrees.length, 1);
  assert.equal(state.projects[0].worktrees[0].terminals.length, 1);
  assert.equal(state.projects[0].worktrees[0].terminals[0].id, "terminal-1");
});

test("syncWorktrees merges a stale git/modules main worktree path into the project root", () => {
  const project = createProject();
  project.path = "C:/repo/cde-base";
  project.worktrees[0].name = "dev";
  project.worktrees[0].path = "C:/repo/.git/modules/cde-base";

  resetStore([project]);

  const beforeWorktree = useProjectStore.getState().projects[0].worktrees[0];

  useProjectStore.getState().syncWorktrees("C:/repo/cde-base", [
    { path: "C:/repo/cde-base", branch: "dev", isMain: true },
    {
      path: "C:/repo/.worktree/cde-base/feature-dataset-market-backend",
      branch: "feature/dataset-market-backend",
      isMain: false,
    },
  ]);

  const state = useProjectStore.getState();
  const mainWorktree = state.projects[0].worktrees.find(
    (worktree) => worktree.name === "dev",
  );
  assert.ok(mainWorktree);
  assert.equal(mainWorktree.path, "C:/repo/cde-base");
  assert.equal(mainWorktree.terminals.length, 1);
  assert.equal(mainWorktree.terminals[0].id, "terminal-1");
  assert.equal(mainWorktree.id, beforeWorktree.id);
});

test("syncWorktrees repairs corrupted duplicate worktrees after a bad rescan", () => {
  resetStore([
    {
      id: "project-1",
      name: "cde-base",
      path: "C:/repo/cde-base",
      worktrees: [
        {
          id: "dup-worktree",
          name: "dev",
          path: "C:/repo/.worktree/cde-base/feature-dataset-market-backend",
          terminals: [
            {
              id: "terminal-dup",
              title: "Terminal",
              type: "shell",
              focused: true,
              ptyId: null,
              status: "idle",
            },
          ],
        },
        {
          id: "dup-worktree",
          name: "feature/dataset-market-backend",
          path: "C:/repo/.worktree/cde-base/feature-dataset-market-backend",
          terminals: [
            {
              id: "terminal-dup",
              title: "Terminal",
              type: "shell",
              focused: true,
              ptyId: null,
              status: "idle",
            },
          ],
        },
      ],
    },
  ]);

  useProjectStore.getState().syncWorktrees("C:/repo/cde-base", [
    { path: "C:/repo/cde-base", branch: "dev", isMain: true },
    {
      path: "C:/repo/.worktree/cde-base/feature-dataset-market-backend",
      branch: "feature/dataset-market-backend",
      isMain: false,
    },
  ]);

  const state = useProjectStore.getState();
  const [mainWorktree, featureWorktree] = state.projects[0].worktrees;

  assert.equal(state.projects[0].worktrees.length, 2);
  assert.equal(mainWorktree.name, "dev");
  assert.equal(mainWorktree.path, "C:/repo/cde-base");
  assert.equal(mainWorktree.terminals.length, 1);
  assert.equal(mainWorktree.terminals[0].id, "terminal-dup");
  assert.equal(featureWorktree.name, "feature/dataset-market-backend");
  assert.equal(
    featureWorktree.path,
    "C:/repo/.worktree/cde-base/feature-dataset-market-backend",
  );
  assert.equal(featureWorktree.terminals.length, 0);
  assert.notEqual(mainWorktree.id, featureWorktree.id);
});

test("migrateProjects normalizes a restored git/modules main worktree path", () => {
  const launcherConfigSnapshot = {
    hostShell: "pwsh" as const,
    startupCommands: [
      {
        label: "Prepare",
        command: "echo prepare",
        timeoutMs: 3000,
      },
    ],
  };

  const [project] = migrateProjects([
    {
      id: "project-1",
      name: "cde-base",
      path: "C:/repo/cde-base",
      worktrees: [
        {
          id: "worktree-main",
          name: "dev",
          path: "C:/repo/.git/modules/cde-base",
          terminals: [
            {
              id: "terminal-1",
              title: "Terminal 1",
              type: "shell",
              focused: false,
              ptyId: 123,
              status: "running",
              launcherId: "custom-launcher",
              launcherName: "Custom Launcher",
              launcherConfigSnapshot,
            },
          ],
        },
      ],
    },
  ]);

  const migratedTerminal = project.worktrees[0].terminals[0];

  assert.equal(project.worktrees[0].path, "C:/repo/cde-base");
  assert.equal(migratedTerminal.ptyId, null);
  assert.equal(migratedTerminal.status, "idle");
  assert.equal(migratedTerminal.launcherId, "custom-launcher");
  assert.equal(migratedTerminal.launcherName, "Custom Launcher");
  assert.deepEqual(migratedTerminal.launcherConfigSnapshot, launcherConfigSnapshot);
  assert.notEqual(migratedTerminal.launcherConfigSnapshot, launcherConfigSnapshot);
  assert.notEqual(
    migratedTerminal.launcherConfigSnapshot?.startupCommands,
    launcherConfigSnapshot.startupCommands,
  );
});

test("removeTerminal keeps an empty focused worktree expanded after deleting its last terminal", () => {
  const project = createProject();
  project.worktrees[0].terminals[0].focused = true;

  useProjectStore.setState({
    projects: [project],
    focusedProjectId: project.id,
    focusedWorktreeId: project.worktrees[0].id,
  });

  useProjectStore
    .getState()
    .removeTerminal(project.id, project.worktrees[0].id, "terminal-1");

  const state = useProjectStore.getState();
  const worktree = state.projects[0].worktrees[0];

  assert.equal(worktree.terminals.length, 0);
  assert.equal(state.focusedProjectId, project.id);
  assert.equal(state.focusedWorktreeId, project.worktrees[0].id);
});
