# 可配置启动方式与命令组实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在不迁移旧数据的前提下，将“新建终端启动方式”改为用户主目录配置驱动，并在新建会话时按顺序执行命令组（失败即停），同时提供设置页可视化配置入口。

**架构：** 新增 Electron 侧 launcher 配置服务（`~/.ominiterm/launchers.json`）与壳层命令编排执行器；Renderer 侧新增“启动方式”设置 Tab 与状态存储；终端创建链路由 `launcherId` 驱动，恢复会话跳过 startupCommands。为控制风险，保留现有 PTY 机制并通过 feature flag 支持回退。

**技术栈：** React 19 + TypeScript、Zustand、Electron IPC、node-pty、Node test runner（`node --test`）

---

## 范围检查

本规格聚焦单一子系统（启动方式配置与终端创建链路），无需再拆分独立计划。  
执行时请遵循：`@test-driven-development`、`@verification-before-completion`、`@subagent-driven-development`。

## 文件结构与职责

### 创建文件

- `apps/desktop/electron/launchers-config.ts`
  - Launcher 配置 schema、校验、文件读写（原子写入）、默认空配置初始化。
- `apps/desktop/electron/launchers-ipc.ts`
  - 启动方式 IPC handler 注册函数（避免继续膨胀 `main.ts`）。
- `apps/desktop/electron/startup-command-sequencer.ts`
  - 新建会话命令组顺序执行、退出码解析、超时与失败即停。
- `apps/desktop/src/stores/launchersStore.ts`
  - Renderer 侧启动方式状态管理（load/save/reorder/draft 校验）。
- `apps/desktop/src/components/settings/LauncherSettingsTab.tsx`
  - 设置页“启动方式”可视化配置 UI（列表 + 详情编辑）。
- `apps/desktop/src/launchers/launcherOption.ts`
  - 将 launcher 配置映射为 ProjectBoard 与 Split 菜单选项。
- `apps/desktop/tests/launchers-config.test.ts`
  - 配置文件服务与校验单元测试。
- `apps/desktop/tests/launchers-ipc.test.ts`
  - IPC 注册与调用契约测试。
- `apps/desktop/tests/startup-command-sequencer.test.ts`
  - 命令组顺序执行、失败即停、超时测试。
- `apps/desktop/tests/launchers-store.test.ts`
  - Renderer store 测试（草稿编辑、校验、保存流程）。

### 修改文件

- `apps/desktop/electron/main.ts`
  - 注入 launchers IPC 与终端创建时的 sequencer 调用。
- `apps/desktop/electron/preload.ts`
  - 暴露 `ominiterm.launchers.*` 与启动步骤事件订阅。
- `apps/desktop/electron/pty-manager.ts`
  - 补充 sequencer 所需的可测试接口（读取输出/写入等待）。
- `apps/desktop/src/types/index.ts`
  - 新增 launcher 数据类型、`OminiTermAPI.launchers` 契约、`TerminalData` 的 launcher 字段。
- `apps/desktop/src/stores/settingsModalStore.ts`
  - 新增 `"launchers"` Tab 类型。
- `apps/desktop/src/components/SettingsModal.tsx`
  - 挂载“启动方式”Tab（保留现有 General/Shortcuts/Agents）。
- `apps/desktop/src/i18n/en.ts`
  - 新增启动方式 Tab 与字段文案。
- `apps/desktop/src/i18n/zh.ts`
  - 新增启动方式 Tab 与字段文案。
- `apps/desktop/src/components/projectBoardOptions.ts`
  - 从静态 `CREATABLE_TERMINAL_TYPES` 切到 launcher 选项构建函数。
- `apps/desktop/src/components/ProjectBoard.tsx`
  - 新建终端下拉来源改为 launchersStore，处理“无可用启动方式”空状态。
- `apps/desktop/src/terminal/TerminalTile.tsx`
  - 分屏新建菜单改为 launcher 选项。
- `apps/desktop/src/projectCommands.ts`
  - `createTerminalInWorktree` 接收 launcher 参数。
- `apps/desktop/src/stores/projectStore.ts`
  - `createTerminal` 写入 `launcherId`、`launcherName`、`launcherConfigSnapshot`（用于创建请求）。
- `apps/desktop/src/terminal/terminalLaunchRequest.ts`
  - 由 launcher 快照构建创建请求（含 `launcherId`、`startupCommands`、`mainCommand`、`isResume`）。
- `apps/desktop/tests/project-board-options.test.ts`
  - 从静态列表测试更新为动态 launcher 选项测试。
- `apps/desktop/tests/terminal-launch-request.test.ts`
  - 覆盖 launcher 请求字段构建。
- `apps/desktop/package.json`
  - 将新增测试文件加入显式 `test` 脚本列表。

### 参考文档

- `docs/superpowers/specs/2026-04-03-configurable-terminal-launchers-design.md`
- `docs/development.md`
- `AGENTS.md`

## 任务清单

### 任务 1：Launcher 配置模型与文件服务（Electron）

**文件：**
- 创建：`apps/desktop/electron/launchers-config.ts`
- 测试：`apps/desktop/tests/launchers-config.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ensureLaunchersFile,
  loadLaunchersConfig,
  saveLaunchersConfig,
} from "../electron/launchers-config.ts";

test("ensureLaunchersFile creates empty config when file is missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ot-launchers-"));
  const filePath = path.join(root, "launchers.json");

  ensureLaunchersFile(filePath);
  const json = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  assert.equal(json.version, 1);
  assert.deepEqual(json.launchers, []);
});

test("saveLaunchersConfig rejects duplicate launcher ids", () => {
  const filePath = path.join(os.tmpdir(), "ot-launchers-dup.json");
  assert.throws(() =>
    saveLaunchersConfig(filePath, {
      version: 1,
      updatedAt: new Date().toISOString(),
      launchers: [
        { id: "codex", name: "Codex", enabled: true, hostShell: "auto", mainCommand: { command: "codex", args: [] }, startupCommands: [], runPolicy: { runOnNewSessionOnly: true, onFailure: "stop" } },
        { id: "codex", name: "Codex2", enabled: true, hostShell: "auto", mainCommand: { command: "codex", args: [] }, startupCommands: [], runPolicy: { runOnNewSessionOnly: true, onFailure: "stop" } },
      ],
    }),
  );
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm --filter ominiterm exec node --experimental-strip-types --test --test-concurrency=1 --test-isolation=none tests/launchers-config.test.ts`  
预期：FAIL，报错 `Cannot find module '../electron/launchers-config.ts'`。

- [ ] **步骤 3：编写最少实现代码**

```ts
export interface LauncherCommandStep {
  label: string;
  command: string;
  timeoutMs: number;
}

export interface LauncherConfigItem {
  id: string;
  name: string;
  enabled: boolean;
  hostShell: "auto" | "pwsh" | "bash" | "zsh" | "cmd";
  mainCommand: { command: string; args: string[] };
  startupCommands: LauncherCommandStep[];
  runPolicy: { runOnNewSessionOnly: true; onFailure: "stop" };
}

export interface LaunchersConfigFile {
  version: 1;
  updatedAt: string;
  launchers: LauncherConfigItem[];
}

// 提供 ensure/load/save + validate + tmp rename 原子写入
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pnpm --filter ominiterm exec node --experimental-strip-types --test --test-concurrency=1 --test-isolation=none tests/launchers-config.test.ts`  
预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add apps/desktop/electron/launchers-config.ts apps/desktop/tests/launchers-config.test.ts
git commit -m "feat(launchers): add launcher config file service"
```

### 任务 2：IPC 桥接与类型契约

**文件：**
- 创建：`apps/desktop/electron/launchers-ipc.ts`
- 修改：`apps/desktop/electron/main.ts`
- 修改：`apps/desktop/electron/preload.ts`
- 修改：`apps/desktop/src/types/index.ts`
- 测试：`apps/desktop/tests/launchers-ipc.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { registerLaunchersIpc } from "../electron/launchers-ipc.ts";

test("registerLaunchersIpc wires launchers:list and launchers:save", () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcMainMock = {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn);
    },
  };
  registerLaunchersIpc(ipcMainMock as any, {
    get: async () => null,
    list: async () => [],
    save: async () => ({ ok: true }),
  } as any);

  assert.equal(handlers.has("launchers:get"), true);
  assert.equal(handlers.has("launchers:list"), true);
  assert.equal(handlers.has("launchers:save"), true);
  assert.equal(handlers.has("launchers:delete"), true);
  assert.equal(handlers.has("launchers:reorder"), true);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm --filter ominiterm exec node --experimental-strip-types --test --test-concurrency=1 --test-isolation=none tests/launchers-ipc.test.ts`  
预期：FAIL，缺少 `registerLaunchersIpc`。

- [ ] **步骤 3：编写最少实现代码**

```ts
// electron/launchers-ipc.ts
export function registerLaunchersIpc(ipcMain: Electron.IpcMain, service: LaunchersService) {
  ipcMain.handle("launchers:get", (_e, id) => service.get(id));
  ipcMain.handle("launchers:list", () => service.list());
  ipcMain.handle("launchers:save", (_e, payload) => service.save(payload));
  ipcMain.handle("launchers:delete", (_e, id) => service.remove(id));
  ipcMain.handle("launchers:reorder", (_e, ids) => service.reorder(ids));
}
```

- [ ] **步骤 4：对接 preload 与类型声明**

```ts
// preload.ts
export type LauncherStartupEvent = {
  type: "step-start" | "step-success" | "step-failed";
  terminalId: string;
  launcherId: string;
  stepIndex: number;
  totalSteps: number;
  stepLabel: string;
  command: string;
  exitCode?: number;
  timeoutMs?: number;
  stderrPreview?: string;
  timestamp: number;
};

export type TerminalCreateResult = {
  ptyId: number;
  fallback?: { requestedShell: string; actualShell: string };
  startupFailure?: {
    terminalId: string;
    launcherId: string;
    failedStepIndex: number;
    stepLabel: string;
    command: string;
    exitCode?: number;
    timeoutMs?: number;
    stderrPreview?: string;
    timestamp: number;
  };
};

launchers: {
  get: (id) => ipcRenderer.invoke("launchers:get", id),
  list: () => ipcRenderer.invoke("launchers:list"),
  save: (payload) => ipcRenderer.invoke("launchers:save", payload),
  delete: (id) => ipcRenderer.invoke("launchers:delete", id),
  reorder: (ids) => ipcRenderer.invoke("launchers:reorder", ids),
  onStartupEvent: (cb) => {
    const listener = (_event, payload: LauncherStartupEvent) => cb(payload);
    ipcRenderer.on("launchers:startup-event", listener);
    return () => ipcRenderer.removeListener("launchers:startup-event", listener);
  },
}
```

- [ ] **步骤 5：运行测试验证通过**

运行：`pnpm --filter ominiterm exec node --experimental-strip-types --test --test-concurrency=1 --test-isolation=none tests/launchers-ipc.test.ts`  
预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add apps/desktop/electron/launchers-ipc.ts apps/desktop/electron/main.ts apps/desktop/electron/preload.ts apps/desktop/src/types/index.ts apps/desktop/tests/launchers-ipc.test.ts
git commit -m "feat(launchers): add IPC bridge and renderer contract"
```

### 任务 3：设置页可视化配置 Tab

**文件：**
- 创建：`apps/desktop/src/stores/launchersStore.ts`
- 创建：`apps/desktop/src/components/settings/LauncherSettingsTab.tsx`
- 修改：`apps/desktop/src/stores/settingsModalStore.ts`
- 修改：`apps/desktop/src/components/SettingsModal.tsx`
- 修改：`apps/desktop/src/i18n/en.ts`
- 修改：`apps/desktop/src/i18n/zh.ts`
- 测试：`apps/desktop/tests/launchers-store.test.ts`

- [ ] **步骤 1：编写失败的 store 测试**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createLaunchersDraftState } from "../src/stores/launchersStore.ts";

test("validateDraft rejects empty name and empty main command", () => {
  const state = createLaunchersDraftState();
  const result = state.validate({
    id: "custom-1",
    name: "",
    enabled: true,
    hostShell: "auto",
    mainCommand: { command: "", args: [] },
    startupCommands: [],
    runPolicy: { runOnNewSessionOnly: true, onFailure: "stop" },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.fieldErrors, ["name", "mainCommand.command"]);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm --filter ominiterm exec node --experimental-strip-types --test --test-concurrency=1 --test-isolation=none tests/launchers-store.test.ts`  
预期：FAIL。

- [ ] **步骤 3：编写最少 store 实现与 Tab 挂载**

```ts
// settingsModalStore.ts
type SettingsTab = "general" | "shortcuts" | "agents" | "launchers";

// SettingsModal.tsx
{tab === "launchers" && <LauncherSettingsTab />}
```

- [ ] **步骤 4：实现可视化编辑最小闭环**

```tsx
// LauncherSettingsTab.tsx（最小版）
// 左侧列表：新增/删除/排序
// 右侧详情：name、id、hostShell、mainCommand、startupCommands
// 底部保存按钮调用 window.ominiterm.launchers.save
```

- [ ] **步骤 5：运行测试与类型检查**

运行：
- `pnpm --filter ominiterm exec node --experimental-strip-types --test --test-concurrency=1 --test-isolation=none tests/launchers-store.test.ts`
- `pnpm --filter ominiterm typecheck`

预期：全部 PASS。

- [ ] **步骤 6：Commit**

```bash
git add apps/desktop/src/stores/launchersStore.ts apps/desktop/src/components/settings/LauncherSettingsTab.tsx apps/desktop/src/stores/settingsModalStore.ts apps/desktop/src/components/SettingsModal.tsx apps/desktop/src/i18n/en.ts apps/desktop/src/i18n/zh.ts apps/desktop/tests/launchers-store.test.ts
git commit -m "feat(settings): add visual launcher configuration tab"
```

### 任务 4：新建终端菜单改为 launcher 驱动

**文件：**
- 创建：`apps/desktop/src/launchers/launcherOption.ts`
- 修改：`apps/desktop/src/components/projectBoardOptions.ts`
- 修改：`apps/desktop/src/components/ProjectBoard.tsx`
- 修改：`apps/desktop/src/terminal/TerminalTile.tsx`
- 修改：`apps/desktop/src/projectCommands.ts`
- 修改：`apps/desktop/src/stores/projectStore.ts`
- 修改：`apps/desktop/src/types/index.ts`
- 测试：`apps/desktop/tests/project-board-options.test.ts`
- 测试：`apps/desktop/tests/terminal-launch-request.test.ts`

- [ ] **步骤 1：编写失败的选项映射测试**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildLauncherOptions } from "../src/launchers/launcherOption.ts";

test("buildLauncherOptions only returns enabled launchers in order", () => {
  const options = buildLauncherOptions([
    { id: "a", name: "A", enabled: true },
    { id: "b", name: "B", enabled: false },
    { id: "c", name: "C", enabled: true },
  ] as any);
  assert.deepEqual(options.map((o) => o.id), ["a", "c"]);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm --filter ominiterm exec node --experimental-strip-types --test --test-concurrency=1 --test-isolation=none tests/project-board-options.test.ts`  
预期：FAIL。

- [ ] **步骤 3：实现菜单动态化与 terminal launcher 字段透传**

```ts
export interface TerminalData {
  // existing fields...
  launcherId?: string;
  launcherName?: string;
  launcherConfigSnapshot?: {
    hostShell: "auto" | "pwsh" | "bash" | "zsh" | "cmd";
    mainCommand: { command: string; args: string[] };
    startupCommands: { label: string; command: string; timeoutMs: number }[];
  };
}
```

- [ ] **步骤 4：实现“无可用启动方式”空状态**

```tsx
{launcherOptions.length === 0 ? (
  <div>{t.launchers_empty_for_new_terminal}</div>
) : (
  <select>{/* launcher options */}</select>
)}
```

- [ ] **步骤 5：运行回归测试**

运行：
- `pnpm --filter ominiterm exec node --experimental-strip-types --test --test-concurrency=1 --test-isolation=none tests/project-board-options.test.ts tests/terminal-launch-request.test.ts`

预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add apps/desktop/src/launchers/launcherOption.ts apps/desktop/src/components/projectBoardOptions.ts apps/desktop/src/components/ProjectBoard.tsx apps/desktop/src/terminal/TerminalTile.tsx apps/desktop/src/projectCommands.ts apps/desktop/src/stores/projectStore.ts apps/desktop/src/types/index.ts apps/desktop/tests/project-board-options.test.ts apps/desktop/tests/terminal-launch-request.test.ts
git commit -m "feat(board): create terminals from user-defined launchers"
```

### 任务 5：新建会话命令组顺序执行（失败即停）

**文件：**
- 创建：`apps/desktop/electron/startup-command-sequencer.ts`
- 创建：`apps/desktop/src/terminal/startupStatus.ts`
- 修改：`apps/desktop/electron/pty-manager.ts`
- 修改：`apps/desktop/electron/main.ts`
- 修改：`apps/desktop/src/terminal/terminalLaunchRequest.ts`
- 修改：`apps/desktop/src/stores/launchersStore.ts`
- 修改：`apps/desktop/src/terminal/TerminalTile.tsx`
- 测试：`apps/desktop/tests/startup-command-sequencer.test.ts`
- 测试：`apps/desktop/tests/terminal-launch-request.test.ts`
- 测试：`apps/desktop/tests/launchers-store.test.ts`
- 测试：`apps/desktop/tests/terminal-startup-status.test.ts`

- [ ] **步骤 1：编写失败的 sequencer 测试**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { runStartupCommands } from "../electron/startup-command-sequencer.ts";

test("runStartupCommands stops on first non-zero exit code", async () => {
  const writes: string[] = [];
  const result = await runStartupCommands(
    {
      hostShell: "bash",
      steps: [
        { label: "ok", command: "echo ok", timeoutMs: 5000 },
        { label: "fail", command: "exit 1", timeoutMs: 5000 },
        { label: "skip", command: "echo should-not-run", timeoutMs: 5000 },
      ],
    },
    {
      write: async (data) => writes.push(data),
      waitStepResult: async (index) => ({ ok: index === 0, exitCode: index === 0 ? 0 : 1 }),
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.failedStepIndex, 1);
  assert.equal(writes.length, 2);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm --filter ominiterm exec node --experimental-strip-types --test --test-concurrency=1 --test-isolation=none tests/startup-command-sequencer.test.ts`  
预期：FAIL。

- [ ] **步骤 3：实现最少 sequencer + 请求透传字段**

```ts
export interface StartupRunRequest {
  hostShell: "auto" | "pwsh" | "bash" | "zsh" | "cmd";
  terminalId: string;
  launcherId: string;
  steps: { label: string; command: string; timeoutMs: number }[];
}

export interface SequencerDeps {
  write: (data: string) => Promise<void>;
  waitStepResult: (index: number, timeoutMs: number) => Promise<{ ok: boolean; exitCode?: number; stderrPreview?: string }>;
  emit: (event: LauncherStartupEvent) => void;
}

export async function runStartupCommands(request: StartupRunRequest, deps: SequencerDeps) {
  for (let i = 0; i < request.steps.length; i++) {
    deps.emit({ type: "step-start", terminalId: request.terminalId, launcherId: request.launcherId, stepIndex: i, totalSteps: request.steps.length, stepLabel: request.steps[i].label, command: request.steps[i].command, timestamp: Date.now() });
    await deps.write(wrapStepCommand(request.hostShell, request.steps[i]));
    const stepResult = await deps.waitStepResult(i, request.steps[i].timeoutMs);
    if (!stepResult.ok) {
      deps.emit({ type: "step-failed", terminalId: request.terminalId, launcherId: request.launcherId, stepIndex: i, totalSteps: request.steps.length, stepLabel: request.steps[i].label, command: request.steps[i].command, exitCode: stepResult.exitCode, timeoutMs: request.steps[i].timeoutMs, stderrPreview: stepResult.stderrPreview, timestamp: Date.now() });
      return { ok: false, failedStepIndex: i, stepLabel: request.steps[i].label, command: request.steps[i].command, ...stepResult };
    }
    deps.emit({ type: "step-success", terminalId: request.terminalId, launcherId: request.launcherId, stepIndex: i, totalSteps: request.steps.length, stepLabel: request.steps[i].label, command: request.steps[i].command, exitCode: stepResult.exitCode ?? 0, timestamp: Date.now() });
  }
  return { ok: true };
}
```

- [ ] **步骤 4：在 terminal:create 流程接入 sequencer**

```ts
if (!options.isResume && options.startupCommands?.length) {
  const startupResult = await runStartupCommands(..., {
    emit: (event) => sendToWindow(mainWindow, "launchers:startup-event", event),
    write: async (data) => ptyManager.write(result.ptyId, data),
    waitStepResult: async (index, timeoutMs) => ptyManager.waitForStepResult(result.ptyId, index, timeoutMs),
  });
  if (!startupResult.ok) {
    return {
      ...result,
      startupFailure: {
        terminalId: options.terminalId ?? "unknown",
        launcherId: options.launcherId ?? "unknown",
        failedStepIndex: startupResult.failedStepIndex,
        stepLabel: startupResult.stepLabel,
        command: startupResult.command,
        exitCode: startupResult.exitCode,
        timeoutMs: options.startupCommands[startupResult.failedStepIndex]?.timeoutMs,
        stderrPreview: startupResult.stderrPreview,
        timestamp: Date.now(),
      },
    };
  }
}
// startup 全成功后再写 mainCommand
```

- [ ] **步骤 5：补齐前端失败提示闭环（事件消费 + UI 提示）**

```ts
// launchers-store.test.ts
test("step-failed event triggers visible error notification for matching terminal", () => {
  const notifications: string[] = [];
  const state = createLaunchersDraftState({
    notify: (_level, message) => notifications.push(message),
  });

  state.consumeStartupEvent({
    type: "step-failed",
    terminalId: "terminal-1",
    launcherId: "codex",
    stepIndex: 1,
    totalSteps: 3,
    stepLabel: "install",
    command: "pnpm install",
    stderrPreview: "network timeout",
    timestamp: Date.now(),
  });

  assert.equal(notifications.length, 1);
  assert.match(notifications[0], /install/);
});

// launchersStore.ts
const unsubscribe = window.ominiterm.launchers.onStartupEvent((event) => {
  set({ lastStartupEvent: event });
  if (event.type === "step-failed") {
    useNotificationStore.getState().notify(
      "error",
      `启动失败（${event.stepLabel}）：${event.stderrPreview ?? "unknown error"}`,
    );
  }
});

// TerminalTile.tsx
// 若当前 terminalId 对应 event.terminalId，显示 step 状态条与失败摘要

// terminal-startup-status.test.ts
test("buildStartupStatusMessage renders failed step summary", () => {
  const text = buildStartupStatusMessage({
    type: "step-failed",
    terminalId: "terminal-1",
    launcherId: "codex",
    stepIndex: 1,
    totalSteps: 3,
    stepLabel: "install",
    command: "pnpm install",
    stderrPreview: "network timeout",
    timestamp: Date.now(),
  });
  assert.match(text, /install/);
  assert.match(text, /network timeout/);
});
```

- [ ] **步骤 6：运行测试验证通过**

运行：
- `pnpm --filter ominiterm exec node --experimental-strip-types --test --test-concurrency=1 --test-isolation=none tests/startup-command-sequencer.test.ts tests/terminal-launch-request.test.ts`
- `pnpm --filter ominiterm exec node --experimental-strip-types --test --test-concurrency=1 --test-isolation=none tests/launchers-store.test.ts`
- `pnpm --filter ominiterm exec node --experimental-strip-types --test --test-concurrency=1 --test-isolation=none tests/terminal-startup-status.test.ts`
- `pnpm --filter ominiterm exec node --experimental-strip-types --test --test-concurrency=1 --test-isolation=none tests/pty-launch.test.ts tests/pty-manager.test.ts`

预期：全部 PASS。

- [ ] **步骤 7：Commit**

```bash
git add apps/desktop/electron/startup-command-sequencer.ts apps/desktop/src/terminal/startupStatus.ts apps/desktop/electron/pty-manager.ts apps/desktop/electron/main.ts apps/desktop/src/terminal/terminalLaunchRequest.ts apps/desktop/src/stores/launchersStore.ts apps/desktop/src/terminal/TerminalTile.tsx apps/desktop/tests/startup-command-sequencer.test.ts apps/desktop/tests/terminal-launch-request.test.ts apps/desktop/tests/launchers-store.test.ts apps/desktop/tests/terminal-startup-status.test.ts
git commit -m "feat(launchers): execute startup command sequence before main command"
```

### 任务 6：发布收口与回归验证

**文件：**
- 修改：`apps/desktop/electron/main.ts`
- 修改：`apps/desktop/src/components/ProjectBoard.tsx`
- 修改：`apps/desktop/src/i18n/en.ts`
- 修改：`apps/desktop/src/i18n/zh.ts`
- 修改：`apps/desktop/package.json`

- [ ] **步骤 1：添加 feature flag 回退开关**

```ts
const launcherFlowEnabled = process.env.OMINITERM_LAUNCHER_FLOW !== "0";
if (!launcherFlowEnabled) {
  // fallback: old terminal:create path
}
```

- [ ] **步骤 2：补充“无可用启动方式”文案与跳转设置按钮**

```tsx
<button onClick={() => openSettings("launchers")}>{t.open_launchers_settings}</button>
```

- [ ] **步骤 3：把新增测试加入显式 test 脚本**

```json
"test": "node ... tests/launchers-config.test.ts tests/launchers-ipc.test.ts tests/launchers-store.test.ts tests/startup-command-sequencer.test.ts ..."
```

- [ ] **步骤 4：执行完整验证**

运行：
- `pnpm --filter ominiterm typecheck`
- `pnpm --filter ominiterm test`

预期：全部 PASS。

- [ ] **步骤 5：Commit**

```bash
git add apps/desktop/electron/main.ts apps/desktop/src/components/ProjectBoard.tsx apps/desktop/src/i18n/en.ts apps/desktop/src/i18n/zh.ts apps/desktop/package.json
git commit -m "chore(launchers): add rollout guard and finalize test matrix"
```

## 执行检查点

1. 每完成 1 个任务即运行该任务的最小测试集。
2. 每完成 2 个任务运行一次 `pnpm --filter ominiterm typecheck`。
3. 合并前必须完成 `pnpm --filter ominiterm test` 全量验证。

## 完成定义

1. 设置页出现“启动方式”Tab，支持可视化配置（增删改排）。
2. 配置持久化到 `~/.ominiterm/launchers.json`，首次为空且不迁移旧数据。
3. 新建会话按顺序执行 startupCommands，失败即停并提示。
4. 恢复会话不执行 startupCommands。
5. 新建终端菜单仅显示用户配置且启用的启动方式。
6. 相关新增测试全部纳入 `apps/desktop/package.json` 的 `test` 脚本列表。
