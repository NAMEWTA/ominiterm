# OminiTerm 架构说明

## 1. 当前系统定位

当前分支的 OminiTerm 是一个以项目为中心的桌面终端壳层，而不是旧版那种以无限画布为核心叙事的系统。活跃工作流围绕以下界面展开：

- 左侧项目侧栏
- 中间项目看板
- 单终端详情页
- 右侧文件 / diff 面板
- 底部 Composer

这条主线决定了当前二次开发时的优先级：优先维护 `Project -> Worktree -> Terminal` 这条结构链，而不是回头围绕已经清理掉的历史 UI 抽象做设计。

## 2. Monorepo 结构

### `apps/desktop`

桌面应用主包，包含：

- React 渲染层：`apps/desktop/src/`
- Electron 主进程：`apps/desktop/electron/`
- 打包的 CLI：`apps/desktop/cli/`
- 随应用分发的技能：`apps/desktop/skills/`
- 桌面端测试：`apps/desktop/tests/`

### `apps/website`

一个独立的 Vite 落地页项目，不参与桌面端运行时逻辑。

### `tools/hydra`

Hydra CLI。负责：

- 校验 OminiTerm 是否运行
- 为子 Agent 创建或复用 git worktree
- 在 OminiTerm 内创建终端
- 写入 `.hydra-task-*.md` / `.hydra-result-*.md`
- 维护 `~/.hydra/agents/*.json`

### `tools/eval`

评测框架。负责：

- 下载或读取任务集
- 运行 `single-claude`、`single-codex`、`hydra`
- 写出 `tools/eval/results/<runId>/`
- 比较不同 run 的结果

## 3. 桌面端分层

### 渲染层

主要入口：

- `apps/desktop/src/App.tsx`
- `apps/desktop/src/main.tsx`

主要职责：

- 组织项目侧栏、看板、详情页、右侧栏和 Composer
- 管理工作区自动保存和恢复
- 监听 worktree 重扫
- 同步窗口标题和关闭前保存逻辑

### 主进程

主要入口：

- `apps/desktop/electron/main.ts`

主要职责：

- 创建 BrowserWindow
- 初始化 PTY、项目扫描器、状态持久化、API Server
- 注册 IPC
- 管理 CLI 注册、技能链接、更新器、认证和用量服务

### CLI / Tooling 层

- `apps/desktop/cli/ominiterm.ts`
  调桌面端 API Server
- `tools/hydra/src/*.ts`
  通过 `ominiterm` CLI 驱动桌面端
- `tools/eval/src/*.ts`
  跑评测和结果汇总

## 4. 核心数据模型

当前渲染层最重要的结构定义在 `apps/desktop/src/types/index.ts`：

```ts
ProjectData {
  id
  name
  path
  worktrees: WorktreeData[]
}

WorktreeData {
  id
  name
  path
  terminals: TerminalData[]
}

TerminalData {
  id
  title
  type
  status
  ptyId
  focused
  customTitle?
  starred?
  sessionId?
  initialPrompt?
  autoApprove?
  parentTerminalId?
}
```

这套结构贯穿以下模块：

- `projectStore.ts`
  数据主存储、聚焦、终端增删改、worktree 同步
- `uiShellStore.ts`
  侧栏宽度、内容区模式、右侧栏状态、滚动位置
- `workspaceStore.ts`
  工作区文件路径、脏状态、自动保存节流
- `composerStore.ts`
  Composer 草稿、图片、提交态、重命名模式

## 5. 关键链路

### 项目导入与 worktree 同步

入口文件：

- `apps/desktop/src/projectCommands.ts`
- `apps/desktop/electron/project-scanner.ts`
- `apps/desktop/src/stores/projectStore.ts`

流程：

1. 用户选择目录
2. 主进程扫描 git 仓库和 worktree
3. 渲染层写入 `ProjectData`
4. `App.tsx` 中的 watcher 定时重扫并调用 `syncWorktrees`
5. `projectPaths.ts` 负责把 `.git/modules/...` 一类内部路径归一化成可用 worktree 路径

### 终端生命周期

入口文件：

- `apps/desktop/src/terminal/TerminalTile.tsx`
- `apps/desktop/electron/pty-manager.ts`
- `apps/desktop/electron/pty-launch.ts`
- `apps/desktop/src/terminal/cliConfig.ts`

流程：

1. `projectStore.createTerminal()` 先创建渲染层终端记录
2. `TerminalTile` 挂载时请求主进程创建 PTY
3. 主进程转发输出、退出事件和主题变更
4. `TerminalTile` 负责 xterm、scrollback、WebGL 和聚焦调度
5. Claude / Codex / Kimi 等会尝试自动捕获 sessionId

### Composer 提交

入口文件：

- `apps/desktop/src/components/ComposerBar.tsx`
- `apps/desktop/electron/composer-submit.ts`
- `apps/desktop/src/terminal/cliConfig.ts`

流程：

1. Composer 解析目标终端
2. 根据终端类型选择 `type` 或 `bracketed-paste` 模式
3. 如果有图片，会先落到 `<worktree>/.ominiterm/composer/<requestId>/`
4. 再把文本 / 图片路径写入 PTY
5. 最后发送回车提交

当前每种 Agent CLI 的行为差异主要都收敛在 `cliConfig.ts` 里。

### 右侧文件 / Diff 面板

入口文件：

- `apps/desktop/src/components/RightRail.tsx`
- `apps/desktop/src/components/WorktreeFilesPanel.tsx`
- `apps/desktop/src/components/WorktreeDiffPanel.tsx`

流程：

- 文件面板通过 `window.ominiterm.fs.*` 读目录和文件
- Diff 面板通过 `window.ominiterm.project.diff()` 拉取当前 worktree diff
- `git-watcher.ts` 负责监听文件变化后自动刷新

### CLI / Hydra / Eval 协作

入口文件：

- `apps/desktop/electron/api-server.ts`
- `apps/desktop/cli/ominiterm.ts`
- `tools/hydra/src/`
- `tools/eval/src/`

关系：

- 桌面端提供本地 HTTP API
- `ominiterm` CLI 是这个 API 的命令行壳
- Hydra 再通过 `ominiterm` 去创建项目内终端和 worktree
- Eval 独立运行，但可以使用 Hydra 模式进行多 Agent 评测

## 6. 运行时文件与目录

### OminiTerm

- `~/.ominiterm/state.json`
  桌面端恢复用状态快照
- `~/.ominiterm/port`
  桌面端本地 API Server 端口
- `~/.ominiterm/session-debug.log`
  会话捕获调试日志
- `~/.ominiterm/insights-cache/`
- `~/.ominiterm/insights-reports/`

开发模式下会改为 `~/.ominiterm-dev/`。

### Worktree 局部文件

- `<worktree>/.ominiterm/composer/<requestId>/image-*.png`
  Composer 中转图片文件
- `<worktree>/.hydra-task-<agentId>.md`
- `<worktree>/.hydra-result-<agentId>.md`

### Hydra

- `~/.hydra/agents/<agentId>.json`

### Eval

- `tools/eval/results/<runId>/result.json`
- `tools/eval/results/<runId>/summary.json`
- `tools/eval/results/<runId>/tasks/*.json`

## 7. 常见扩展点

### 新增终端类型

至少要同步看这些文件：

- `apps/desktop/src/types/index.ts`
- `apps/desktop/src/terminal/cliConfig.ts`
- `apps/desktop/src/components/projectBoardOptions.ts`
- `apps/desktop/src/terminal/slashCommands.ts`
- 相关测试文件

### 新增桌面端命令或能力

通常要同步：

- Electron IPC：`apps/desktop/electron/main.ts`
- 预加载暴露：`apps/desktop/electron/preload.ts`
- 渲染层调用：`apps/desktop/src/...`
- 如果需要 CLI，补 `apps/desktop/cli/ominiterm.ts`

### 调整 Hydra 行为

主要入口：

- `tools/hydra/src/spawn.ts`
- `tools/hydra/src/cleanup.ts`
- `tools/hydra/src/store.ts`
- `tools/hydra/src/prompt.ts`
- `apps/desktop/skills/skills/hydra/SKILL.md`

## 8. 当前分支的边界提醒

- 不要默认把已经清理掉的历史文档、归档记录和旧 UI 抽象重新引入工作树。
- 代码里仍有 auth、usage、quota、insights、updater 等服务，但当前主界面叙事不是围绕它们展开。
- 如果你要做大改动，优先沿用现在的板式项目壳结构，而不是回退到旧版「无限画布」的组织方式。
