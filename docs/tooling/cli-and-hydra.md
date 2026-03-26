# OminiTerm CLI 与 Hydra 说明

## 1. 关系总览

当前分支中，这三层关系非常清晰：

1. 桌面端启动后在本地起一个 HTTP API Server
2. `ominiterm` CLI 通过 `~/.ominiterm/port` 找到这个 API Server 并发请求
3. Hydra 再通过 `ominiterm` CLI 驱动桌面端创建终端、关联 worktree 和管理子 Agent

所以：

- 没有运行中的 OminiTerm，`ominiterm` 和 Hydra 都无法正常工作
- `ominiterm` 是桌面端控制入口
- Hydra 是建立在 `ominiterm` 之上的子 Agent 编排工具

## 2. `ominiterm` CLI

入口文件：

- `apps/desktop/cli/ominiterm.ts`

当前命令分组：

- `project`
- `terminal`
- `diff`
- `state`

### 项目命令

```bash
ominiterm project add <path>
ominiterm project list
ominiterm project remove <id>
ominiterm project rescan <id>
```

### 终端命令

```bash
ominiterm terminal create --worktree <path> --type <type>
ominiterm terminal list [--worktree <path>]
ominiterm terminal status <id>
ominiterm terminal input <id> <text>
ominiterm terminal output <id> [--lines N]
ominiterm terminal destroy <id>
ominiterm terminal set-title <id> <title>
```

### 其他命令

```bash
ominiterm diff <worktree-path> [--summary]
ominiterm state
```

### `--json`

所有命令都支持 `--json`，方便 Hydra 或脚本化调用。

## 3. 桌面端 API Server

入口文件：

- `apps/desktop/electron/api-server.ts`

它的职责是：

- 把 CLI 命令翻译成对渲染层状态和主进程 PTY 的操作
- 暴露项目、终端、diff 和状态接口
- 作为桌面端与 CLI / Hydra 的桥梁

当前主要路由包括：

- `/project/add`
- `/project/list`
- `/project/:id/rescan`
- `/terminal/create`
- `/terminal/list`
- `/terminal/:id/status`
- `/terminal/:id/output`
- `/terminal/:id/custom-title`
- `/diff/<worktreePath>`
- `/state`

## 4. Hydra 工作流

入口文件：

- `tools/hydra/src/cli.ts`
- `tools/hydra/src/spawn.ts`
- `tools/hydra/src/cleanup.ts`
- `tools/hydra/src/store.ts`
- `tools/hydra/src/prompt.ts`

当前支持命令：

```bash
hydra spawn ...
hydra list
hydra cleanup ...
hydra init
```

### `spawn`

典型命令：

```bash
hydra spawn --task "fix the login flow" --type codex --repo .
hydra spawn --task "review this branch" --type claude --repo . --worktree .worktrees/review
```

行为：

1. 检查 OminiTerm 是否运行
2. 检查目标仓库是否已经在 OminiTerm 项目列表中
3. 如未传 `--worktree`，则创建新分支和新 worktree
4. 在 worktree 根目录写入 `.hydra-task-<agentId>.md`
5. 通过 `ominiterm terminal create` 在桌面端创建对应终端
6. 记录 `~/.hydra/agents/<agentId>.json`

### `cleanup`

典型命令：

```bash
hydra cleanup <agentId>
hydra cleanup --all
hydra cleanup <agentId> --force
```

行为：

- 销毁桌面端终端
- 如果是 Hydra 自己创建的 worktree，则移除 worktree 和分支
- 删除 `~/.hydra/agents/<agentId>.json`

### `init`

作用：

- 向项目的 `AGENTS.md` / `CLAUDE.md` 等协作文档注入 Hydra 使用说明

## 5. Hydra 生成的文件

### 仓库内

- `.hydra-task-<agentId>.md`
  子 Agent 的任务说明
- `.hydra-result-<agentId>.md`
  子 Agent 的执行结果摘要

### 用户目录

- `~/.hydra/agents/<agentId>.json`
  Agent 元数据，包括 repo、terminalId、worktreePath、branch、baseBranch 等

## 6. 二次开发常见改动点

### 给 Hydra 增加新 agent 类型

通常要一起改：

- `tools/hydra/src/spawn.ts`
- `apps/desktop/src/types/index.ts`
- `apps/desktop/src/terminal/cliConfig.ts`
- 文档和技能说明

### 调整 Hydra 的任务文件格式

改这里：

- `tools/hydra/src/prompt.ts`

注意：

- 不要只改 prompt，还要确认父代理读取结果文件的方式是否仍兼容

### 调整 CLI 参数或返回 JSON

改这里：

- `apps/desktop/cli/ominiterm.ts`
- `apps/desktop/electron/api-server.ts`
- Hydra 或外部脚本的消费逻辑

## 7. 当前分支的使用约定

- Hydra 是面向「拆任务并行执行」的，不适合处理高确定性的单点小修。
- 父代理不能只 `spawn` 不跟进，必须结合终端状态和 `.hydra-result-*` 文件一起判断任务是否完成。
- `--auto-approve` 只在父会话已经处于相同权限等级时再传递，不要默认滥用。
