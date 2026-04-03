# 可配置启动方式与命令组设计

日期：2026-04-03  
状态：已通过头脑风暴确认，待规格审查

## 1. 背景

当前新建终端的启动方式依赖内置列表与内置参数逻辑，用户只能对部分 Agent 命令做有限覆盖，无法满足以下诉求：

- 启动方式完全由用户定义（不依赖内置运行时真值）
- 每个启动方式可独立配置启动命令与初始化命令组
- 初始化命令组按顺序执行，并在失败时立即停止
- 配置可在设置中可视化编辑，并持久化到用户主目录固定路径

## 2. 目标与非目标

### 2.1 目标

1. 新增设置独立 Tab，提供启动方式的可视化配置能力。
2. 启动方式配置持久化到 `~/.ominiterm/launchers.json`。
3. 新建会话执行命令组，恢复会话不执行命令组。
4. 命令组严格顺序执行，任一步失败即停并提示。
5. 新建终端菜单仅基于用户配置渲染。

### 2.2 非目标

1. 不做旧 `cliCommands` 自动迁移。
2. 不做复杂条件编排（分支/并行/DAG）。
3. 不在本期支持每条命令独立失败策略（统一失败即停）。

## 3. 已确认约束

1. 失败策略：失败即停并提示。
2. 作用域：每个启动方式独立配置。
3. 启动方式来源：完全用户定义，内置运行时列表外化。
4. 存储路径：用户主目录固定路径（`~/.ominiterm/`）。
5. 执行时机：仅新建会话执行，恢复会话不执行。
6. 升级行为：不迁移旧数据，首次进入新 Tab 时从空白开始。

## 4. 方案对比与选择

### 4.1 备选方案

1. 方案 A：直接启动主命令后注入原始输入命令。
2. 方案 B：壳层编排执行器（先壳层初始化，再主命令）。
3. 方案 C：脚本文件驱动执行（渲染脚本再调用）。

### 4.2 选择结果

选择方案 B。原因：

- 最容易严格兑现“失败即停并提示”
- 启动方式间行为一致，便于维护
- 支持每个启动方式独立命令组，且可跨平台扩展

## 5. 架构设计

## 5.1 模块边界

1. Renderer（设置与新建入口）
   - 启动方式 Tab 可视化编辑
   - 新建终端时提交 `launcherId` 与会话上下文
2. Preload（桥接）
   - 暴露 `launchers:list/get/save/delete/reorder`
   - 暴露启动流水事件订阅接口
3. Electron 配置服务
   - 读写 `~/.ominiterm/launchers.json`
   - 做强校验与版本管理
4. Electron 启动编排器
   - 新建会话按顺序执行 `startupCommands`
   - 全部成功后执行 `mainCommand`
5. PTY 管理器
   - 负责 PTY 生命周期与输入输出

### 5.2 配置文件

路径：`~/.ominiterm/launchers.json`

```json
{
  "version": 1,
  "updatedAt": "2026-04-03T12:00:00.000Z",
  "launchers": [
    {
      "id": "codex",
      "name": "Codex",
      "enabled": true,
      "hostShell": "auto",
      "mainCommand": {
        "command": "codex",
        "args": []
      },
      "startupCommands": [
        {
          "label": "sync deps",
          "command": "pnpm install",
          "timeoutMs": 120000
        }
      ],
      "runPolicy": {
        "runOnNewSessionOnly": true,
        "onFailure": "stop"
      }
    }
  ]
}
```

## 6. 可视化配置设计（设置 Tab）

新增 Tab：启动方式

### 6.1 布局

1. 左侧：启动方式列表
   - 新增、删除、复制、启用/禁用、拖拽排序
2. 右侧：当前选中项详情
   - 基础信息、宿主壳层、主命令、命令组

### 6.2 字段

1. 基础信息
   - `name`
   - `id`（创建后默认锁定）
   - `enabled`
2. 宿主壳层
   - `auto | pwsh | bash | zsh | cmd`
3. 主命令
   - `command`
   - `args[]`
4. 初始化命令组（顺序即执行顺序）
   - 每项：`label`、`command`、`timeoutMs`

### 6.3 固定策略说明（只读）

1. 仅新建会话执行（`runOnNewSessionOnly=true`）
2. 失败即停（`onFailure=stop`）

## 7. 数据流与执行流

### 7.1 设置保存流

1. Renderer 编辑配置并触发保存。
2. IPC 发送配置草稿到 Electron。
3. Electron 强校验并写入 `~/.ominiterm/launchers.json`。
4. 回传最新配置给 Renderer 刷新状态。

### 7.2 新建终端流

1. 用户在新建菜单选择 `launcherId`。
2. Renderer 发送创建请求（含 `launcherId`、`isResume`）。
3. Electron 创建 PTY 并解析宿主壳层。
4. 若 `isResume=true`，跳过命令组，直接进入主命令恢复流程。
5. 若 `isResume=false`，按顺序执行 `startupCommands`。
6. 任意命令失败或超时：立即停止，回传失败事件与可读错误。
7. 全部成功后执行 `mainCommand`，终端进入可交互状态。

## 8. 壳层编排执行器

### 8.1 责任

1. 统一命令执行顺序管理。
2. 统一超时控制。
3. 统一失败判定（退出码或超时）。
4. 统一事件回传（step-start/step-success/step-failed）。

### 8.2 状态机

1. `preparing-shell`
2. `running-startup-commands`
3. `launching-main-command`
4. `ready`
5. `failed`

### 8.3 跨平台策略

1. 根据 `hostShell` 选择包装语法模板。
2. `auto` 模式按平台和可执行探测选择实际壳层。
3. 不依赖 prompt 文本判断成功，统一依赖退出码与超时。

## 9. 错误处理

失败对象建议结构：

```json
{
  "launcherId": "codex",
  "stepIndex": 1,
  "stepLabel": "sync deps",
  "command": "pnpm install",
  "exitCode": 1,
  "timeoutMs": 120000,
  "stderrPreview": "...",
  "timestamp": 1775200000000
}
```

行为约束：

1. 任一步失败后不再执行后续步骤。
2. 主命令不执行。
3. 终端内输出可读摘要，UI 同步展示结构化失败信息。

## 10. 测试设计

### 10.1 单元测试

1. 配置模型校验（字段必填、超时范围、空命令拒绝）。
2. 顺序执行与失败即停。
3. 新建执行、恢复跳过。
4. 壳层解析与命令包装。

### 10.2 集成测试

1. 设置保存后，新建菜单即时刷新。
2. `launcherId` 从 UI 到 PTY 的全链路。
3. 失败事件可被前端消费并正确呈现。

### 10.3 回归测试

1. 旧终端创建路径在开关控制下可回退。
2. Windows/macOS/Linux 壳层选择不回归。

## 11. 发布与回滚

### 11.1 发布分阶段

1. 先上线配置读写与可视化 Tab。
2. 再切换新建终端链路到编排执行器。
3. 最后清理旧内置运行时依赖。

### 11.2 回滚

1. 使用 feature flag 回退旧创建链路。
2. 回滚不删除用户 `~/.ominiterm/launchers.json` 数据。

## 12. 验收标准

1. 设置中可视化管理启动方式（增删改排）。
2. 配置落盘到 `~/.ominiterm/launchers.json`。
3. 新建会话按顺序执行命令组。
4. 任一步失败即停并给出可读错误。
5. 恢复会话不执行命令组。
6. 新建菜单仅显示用户定义且启用的启动方式。
