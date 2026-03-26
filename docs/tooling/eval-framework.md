# Hydra Eval 评测框架

## 1. 工具定位

`tools/eval` 是当前仓库里的独立评测包，用来比较：

- 单 Agent 模式：`single-claude`
- 单 Agent 模式：`single-codex`
- 多 Agent 模式：`hydra`

它的目标不是驱动桌面 UI，而是为基准任务跑出可比对的补丁、耗时、Token、成本和通过率结果。

## 2. 入口与模式

主入口：

- `tools/eval/src/cli.ts`

当前命令：

- `run`
- `compare`
- `list`
- `report`
- `download`
- `tasks`

当前模式：

- `single-claude`
- `single-codex`
- `hydra`

## 3. 常用命令

### 查看帮助

```bash
pnpm --filter @ominiterm/eval eval --help
```

### 跑一次评测

```bash
pnpm --filter @ominiterm/eval eval run --mode single-claude --max-tasks 5
pnpm --filter @ominiterm/eval eval run --mode hydra --max-tasks 5
```

### 对比两次 run

```bash
pnpm --filter @ominiterm/eval eval compare run-a run-b
```

### 查看已有 run

```bash
pnpm --filter @ominiterm/eval eval list
pnpm --filter @ominiterm/eval eval report <runId>
```

### 下载任务集

```bash
pnpm --filter @ominiterm/eval eval download --min-files 3 --max-tasks 20
```

### 查看任务元信息

```bash
pnpm --filter @ominiterm/eval eval tasks <file>
```

## 4. 结果落盘位置

结果默认写到：

- `tools/eval/results/<runId>/result.json`
- `tools/eval/results/<runId>/summary.json`
- `tools/eval/results/<runId>/tasks/*.json`

其中：

- `result.json`
  完整 run 结果
- `summary.json`
  摘要和配置
- `tasks/*.json`
  每个任务的单独结果，方便抽样排查

## 5. 执行链路

主要实现入口：

- `tools/eval/src/runner.ts`
- `tools/eval/src/evaluator.ts`
- `tools/eval/src/results.ts`
- `tools/eval/src/agents/single.ts`
- `tools/eval/src/agents/hydra.ts`

主流程：

1. 读取任务集
2. 根据 `mode` 选择 runner
3. 为每个任务准备隔离工作目录
4. 运行代理，生成 patch
5. 保存每个任务的耗时、Token、成本和错误信息
6. 汇总成 run 级结果
7. 可选地接入 SWE-bench Docker 评测

## 6. 配置重点

当前核心配置定义在 `tools/eval/src/types.ts`：

- `mode`
- `models`
- `sub_agent_types`
- `prompt_version`
- `benchmark`
- `timeout_per_task_s`
- `max_workers`
- `run_swebench_eval`

默认模型配置：

- Claude：`sonnet`
- Hydra orchestrator：`sonnet`
- Codex：如果不显式传入，则走本地 Codex 默认配置

## 7. SWE-bench 相关

当前工具支持：

- 自动下载任务筛选结果
- 生成 predictions
- 可选调用 SWE-bench Docker 评测

如果开启 `--swebench-eval`，runner 会在完成补丁生成后继续跑 Docker 评测，并把结果回写到任务结果中。

## 8. 二次开发入口

### 新增 agent 模式

通常要一起改：

- `tools/eval/src/types.ts`
- `tools/eval/src/cli.ts`
- `tools/eval/src/runner.ts`
- `tools/eval/src/agents/`
- 对应测试

### 调整结果结构

改这里：

- `tools/eval/src/types.ts`
- `tools/eval/src/results.ts`
- `tools/eval/src/compare.ts`

### 调整任务源或下载规则

改这里：

- `tools/eval/src/dataset.ts`
- `tools/eval/scripts/*.py`

## 9. 维护提醒

- `tools/eval/README.md` 应始终指向本文，不要再引用已删除的旧文档路径。
- 如果你新增命令或输出目录，记得同时更新根目录和 `docs/` 下的说明。
