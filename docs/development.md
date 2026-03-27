# OminiTerm 二次开发指南

## 1. 环境准备

### 必备环境

- Node.js `24.13.0`
- pnpm `10.29.2`
- Git

### 可选环境

- Python 3.x
  仅在需要重新生成桌面端图标时使用

## 2. 安装与启动

```bash
pnpm install
pnpm dev
```

当前工作树通过 pnpm workspace 管理，但有效包只剩桌面端与网站。

## 3. 常用命令

### 仓库根目录

```bash
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm desktop:package
pnpm website:build
```

### Desktop

```bash
pnpm --filter ominiterm dev
pnpm --filter ominiterm build
pnpm --filter ominiterm typecheck
pnpm --filter ominiterm test
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

### 修改项目 / worktree 同步逻辑

优先看：

- `apps/desktop/electron/project-scanner.ts`
- `apps/desktop/src/projectPaths.ts`
- `apps/desktop/src/stores/projectStore.ts`
- `apps/desktop/src/stores/projectFocus.ts`

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

### 修改网站

优先看：

- `apps/website/index.html`

## 5. 验证矩阵

### 文档改动

至少做这两步：

- 检查路径、命令、版本号、脚本名是否真实存在
- 检查交叉引用是否仍然可达

### 桌面端渲染层或共享状态

建议：

```bash
pnpm --filter ominiterm test
pnpm --filter ominiterm typecheck
```

### 网站改动

建议：

```bash
pnpm --filter @ominiterm/website build
```

### 发布前

建议：

```bash
pnpm test
pnpm typecheck
pnpm build
```

如果要打桌面包：

```bash
pnpm desktop:package
```

## 6. 跨平台注意事项

### Windows

- `apps/desktop/electron/main.ts` 默认会关闭 GPU 相关能力，以规避部分 AMD 驱动黑屏问题。
- worktree 路径需要经过 `projectPaths.ts` 归一化，避免 `.git/modules/...` 内部路径直接进入 UI 状态。

### macOS

- 标题栏和窗口控制区有单独的原生适配逻辑。
- 打包流程会产出 `dmg` 和 `zip`。

### Linux

- 打包目标包含 `AppImage` 和 `deb`。

## 7. 发布与版本说明

- 当前打包配置在 `apps/desktop/electron-builder.yml`
- GitHub Release 工作流在 `.github/workflows/release.yml`
- 当前基线版本为 `0.0.1`
- 工作流仍要求 `CHANGELOG.md` 中存在对应版本号条目

如果修改版本或发版脚本，至少一起核对：

- `apps/desktop/package.json`
- `apps/website/package.json`
- `CHANGELOG.md`
- `.github/workflows/release.yml`

## 8. 文档维护约定

- 当前分支已经清理过 CLI、Hydra、Eval 和历史画布文档，不要默认把它们搬回工作树。
- 如果新增了命令、包、目录或运行时文件，务必同步更新文档。
