# OminiTerm 二次开发指南

## 1. 环境准备

### 必备环境

- Node.js `24.13.0`
- pnpm `10.29.2`
- Git

### 可选环境

- Python 3.x
  仅在你需要重新生成桌面端图标时使用

## 2. 安装与启动

```bash
pnpm install
pnpm dev
```

根目录脚本定义在 `package.json` 中，当前 monorepo 统一通过 pnpm workspace 管理。

## 3. 常用命令

### 仓库根目录

```bash
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm desktop:package
```

### Desktop

```bash
pnpm --filter ominiterm dev
pnpm --filter ominiterm build
pnpm --filter ominiterm typecheck
pnpm --filter ominiterm test
```

### Hydra

```bash
pnpm --filter @ominiterm/hydra build
pnpm --filter @ominiterm/hydra typecheck
pnpm --filter @ominiterm/hydra test
```

### Eval

```bash
pnpm --filter @ominiterm/eval typecheck
pnpm --filter @ominiterm/eval test
pnpm --filter @ominiterm/eval eval -- --help
```

### Website

```bash
pnpm --filter @ominiterm/website dev
pnpm --filter @ominiterm/website build
```

## 4. 推荐开发路径

### 修改桌面端界面

优先从这些入口入手：

- `apps/desktop/src/App.tsx`
- `apps/desktop/src/components/ProjectSidebar.tsx`
- `apps/desktop/src/components/ProjectBoard.tsx`
- `apps/desktop/src/components/TerminalDetailView.tsx`
- `apps/desktop/src/components/RightRail.tsx`
- `apps/desktop/src/components/ComposerBar.tsx`

如果改的是布局、展开折叠、详情模式或右侧栏状态，也要一起看：

- `apps/desktop/src/stores/uiShellStore.ts`

### 修改项目 / worktree 同步逻辑

优先看：

- `apps/desktop/electron/project-scanner.ts`
- `apps/desktop/src/projectPaths.ts`
- `apps/desktop/src/stores/projectStore.ts`
- `apps/desktop/src/stores/projectFocus.ts`

这是当前分支里最容易引起「状态恢复不对」和「Windows 路径异常」的问题区域。

### 修改终端创建与 Agent 启动

优先看：

- `apps/desktop/electron/pty-manager.ts`
- `apps/desktop/electron/pty-launch.ts`
- `apps/desktop/electron/main.ts`
- `apps/desktop/src/terminal/TerminalTile.tsx`
- `apps/desktop/src/terminal/cliConfig.ts`

如果新增 Agent CLI，通常还要同步：

- `apps/desktop/src/types/index.ts`
- `apps/desktop/src/components/projectBoardOptions.ts`
- `apps/desktop/src/terminal/slashCommands.ts`
- 桌面端测试

### 修改 Composer

优先看：

- `apps/desktop/src/components/ComposerBar.tsx`
- `apps/desktop/src/components/composerInputBehavior.ts`
- `apps/desktop/src/components/composerTarget.ts`
- `apps/desktop/electron/composer-submit.ts`

图片、粘贴时序、不同 CLI 的差异都已经尽量收敛在这些文件里。

### 修改 CLI / Hydra

优先看：

- `apps/desktop/cli/ominiterm.ts`
- `apps/desktop/electron/api-server.ts`
- `tools/hydra/src/spawn.ts`
- `tools/hydra/src/cleanup.ts`
- `tools/hydra/src/store.ts`
- `tools/hydra/src/prompt.ts`

如果 CLI 行为变化，记得同步更新：

- `README.md`
- `README.zh-CN.md`
- `docs/tooling/cli-and-hydra.md`
- `tools/eval/README.md`（如果 eval 依赖这条链路）

### 修改评测框架

优先看：

- `tools/eval/src/cli.ts`
- `tools/eval/src/runner.ts`
- `tools/eval/src/evaluator.ts`
- `tools/eval/src/results.ts`
- `tools/eval/src/agents/`

## 5. 验证矩阵

### 文档改动

通常至少做这两步：

- 检查路径、命令、版本号、脚本名是否真实存在
- 检查交叉引用是否仍然可达

### 桌面端渲染层或共享状态

建议：

```bash
pnpm --filter ominiterm test
pnpm typecheck
```

### Hydra

建议：

```bash
pnpm --filter @ominiterm/hydra test
pnpm typecheck
```

### Eval

建议：

```bash
pnpm --filter @ominiterm/eval test
pnpm --filter @ominiterm/eval typecheck
```

### 发布前

建议：

```bash
pnpm test
pnpm build
```

如果要打桌面包：

```bash
pnpm desktop:package
```

## 6. 跨平台注意事项

### Windows

- `apps/desktop/electron/main.ts` 默认会关闭 GPU 相关能力，以规避部分 AMD 驱动黑屏问题。
- 技能链接在 Windows 上使用 `junction`，不要随手改成普通 symlink。
- worktree 路径需要经过 `projectPaths.ts` 归一化，避免 `.git/modules/...` 内部路径直接进入 UI 状态。

### macOS

- 标题栏和窗口控制区有单独的原生适配逻辑。
- 发布流程里会产出 `dmg` 和 `zip`。

### Linux

- 打包目标包含 `AppImage` 和 `deb`。

## 7. 发布与版本说明

- 当前打包配置在 `apps/desktop/electron-builder.yml`
- GitHub Release 工作流在 `.github/workflows/release.yml`
- 该工作流要求 `CHANGELOG.md` 中存在对应版本号的条目

如果你修改了版本、标签或发版脚本，必须一起核对：

- 根目录 `package.json`
- `apps/desktop/package.json`
- `CHANGELOG.md`
- `.github/workflows/release.yml`

## 8. 文档维护约定

- 这条分支已经做过文档清理，不要默认恢复旧 `docs/` 归档。
- 如果你新增了命令、包、目录或运行时文件，务必同步更新文档。
- `tools/eval/README.md` 这类子项目入口文档不能再指向已删除页面。
