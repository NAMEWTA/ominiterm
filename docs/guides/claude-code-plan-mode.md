# Claude Code Plan Mode 实现分析

## 概述

Plan Mode 是 Claude Code CLI 中的一种特殊工作模式，其核心思路是通过 **system prompt 硬约束 + 工具可用性控制**，将 Claude 锁定在只读模式下进行方案规划，直到用户审批后才进入执行阶段。

---

## 1. 进入与退出

### 进入 Plan Mode

Plan Mode 的进入**不依赖工具调用**（不存在 `EnterPlanMode` 工具），而是通过用户请求或对话初始化触发，由系统注入 system reminder 来激活。

### 退出 Plan Mode

退出通过 `ExitPlanMode` 工具完成，其输出结构如下：

```ts
interface ExitPlanModeOutput {
  plan: string | null;              // 方案内容
  isAgent: boolean;
  filePath: string;                 // 方案文件保存路径
  hasTaskTool: boolean;             // 是否有 Agent 工具可用
  awaitingLeaderApproval: boolean;  // 团队模式审批标志
  requestId: string;                // 审批请求 ID
  isUltraplan: boolean;             // 是否来自远程 session
  allowedPrompts?: Array<{          // 语义化权限预声明
    tool: string;
    prompt: string;
  }>;
}
```

`allowedPrompts` 字段实现了一个语义化权限系统——退出 Plan Mode 时可以预声明执行阶段需要的权限（如 `{ tool: "Bash", prompt: "run tests" }`），减少后续的权限弹窗。

---

## 2. 系统提示词

Plan Mode 激活时，系统注入的核心 system reminder：

> Plan mode is active. The user indicated that they do not want you to execute yet -- you **MUST NOT** make any edits (with the exception of the plan file mentioned below), run any non-readonly tools (including changing configs or making commits), or otherwise make any changes to the system. This supercedes any other instructions you have received.

后续轮次使用精简版 reminder 以节省 token：

> Plan mode still active (see full instructions earlier in conversation). Read-only except plan file. Follow 5-phase workflow. End turns with AskUserQuestion (for clarifications) or ExitPlanMode (for plan approval).

Sub-agent 的 Plan Mode 提示词也施加了相同的只读约束，要求使用 `AskUserQuestion` 与用户澄清需求。

---

## 3. 工具可用性控制

Plan Mode 下的工具白名单/黑名单：

| 禁用 | 允许 |
|------|------|
| Write | Read |
| Edit | Glob |
| Bash | Grep |
| Config | WebSearch / WebFetch |
| Agent | AskUserQuestion |
| | ExitPlanMode |

**唯一的写入例外**：Plan 文件本身（由 `planFilePath` 指定）可以被编辑，用于迭代更新方案内容。

---

## 4. 工作流：5 阶段结构

### Phase 1: 理解 (Explore)

并行启动 K 个 Explore Agent（使用 Haiku 模型），只读探索代码库，搜索现有模式、函数和代码路径。Agent 数量由用户 tier 决定：

- 企业版 / Max 套餐：最多 3 个
- 默认：1 个

决策依据：
- 孤立文件、用户已指定路径、小改动 → 1 个 Agent
- 需要广泛探索 → K 个 Agent 并行

### Phase 2: 设计 (Plan)

启动 Plan Agent（继承父级模型），基于 Phase 1 的探索上下文进行架构设计，提供文件名和代码路径追踪。

### Phase 3: 审查 (Review)

对设计方案进行审查。

### Phase 4: 最终方案

输出最终方案。根据内部变体设置，方案结尾有不同格式：

| 变体 | 行为 |
|------|------|
| `trim` | 以单条验证命令结尾 |
| `cut` | 好方案通常不超过 40 行，避免冗余散文 |
| `cap` | 包含端到端测试的验证部分 |
| 默认 | 标准验证部分 |

### Phase 5: 调用 ExitPlanMode

提交方案供用户审批。**必须**通过 `ExitPlanMode` 工具提交，不能用文本直接询问用户是否同意。

---

## 5. Agent 类型

Plan Mode 内部使用两种特化 Agent：

### Explore Agent

- **类型标识**：`agentType: "Explore"`
- **模型**：Haiku（快速、低成本）
- **用途**：快速代码库探索
- **可用工具**：Read, Glob, Grep, WebSearch, WebFetch
- **禁用工具**：Write, Edit, Bash, Config, Agent

### Plan Agent

- **类型标识**：`agentType: "Plan"`
- **模型**：继承父级（通常为 Opus 或 Sonnet）
- **用途**：软件架构设计和方案编写
- **可用工具**：与 Explore Agent 相同，仅限只读操作
- **禁用工具**：与 Explore Agent 相同

---

## 6. 状态管理

### 环境变量

| 变量名 | 用途 |
|--------|------|
| `CLAUDE_CODE_PLAN_MODE_REQUIRED` | 强制进入 Plan Mode |
| `CLAUDE_CODE_PLAN_MODE_INTERVIEW_PHASE` | 迭代面试阶段标志 |
| `CLAUDE_CODE_PLAN_V2_AGENT_COUNT` | Agent 数量（默认 1，最大 10） |
| `CLAUDE_CODE_PLAN_V2_EXPLORE_AGENT_COUNT` | Explore Agent 数量（默认 3，最大 10） |

### Feature Flags（`tengu_` 前缀）

| 标志 | 用途 |
|------|------|
| `tengu_plan_mode_interview_phase` | 是否处于面试阶段 |
| `tengu_amber_flint` | 实验性 Agent 团队功能 |
| `tengu_pewter_ledger` | 方案变体控制（trim / cut / cap） |

### 内部状态函数

- 根据用户 tier 决定 Agent 数量（企业版 / Max: 3, 默认: 1）
- Explore Agent 数量固定为 3
- 检查是否处于面试阶段
- 获取当前方案变体

---

## 7. 特殊变体

### Interview Phase（迭代模式）

不走标准 5 阶段流程，而是采用循环式 pair-planning：

```
探索代码 → 更新方案文件 → 询问用户 → 重复
```

直到方案完整后退出。适合需求不明确、需要反复澄清的场景。

### Ultraplan（远程规划）

方案已由远程 session 预先写入文件，当前 session 唯一允许的操作就是直接调用 `ExitPlanMode`，无需任何探索或编写。

### Team Mode（团队模式）

支持多 Agent 协作场景：
- `awaitingLeaderApproval` 标志表示方案等待主 Agent 审批
- `leadAgentId` 用于追踪主 Agent
- 非主 Agent 提交的方案需要主 Agent 审批后才能执行

---

## 8. 数据流总结

```
用户请求 / 快捷键触发
    │
    ▼
系统注入 Plan Mode system reminder
    │
    ▼
工具白名单切换（禁用 Write / Edit / Bash / Config / Agent）
    │
    ▼
Phase 1: 并行 Explore Agent 只读探索代码库
    │
    ▼
Phase 2-3: Plan Agent 设计方案 + 审查
    │
    ▼
Phase 4: 方案写入 planFilePath
    │
    ▼
Phase 5: ExitPlanMode(plan, allowedPrompts)
    │
    ▼
用户审批 → 恢复正常工具集 → 按方案执行
```

### 关键设计决策

1. **不对称的进出机制**：进入无需工具调用（系统注入），退出必须工具调用（结构化数据）
2. **方案文件是唯一写入口**：所有只读约束中的唯一例外，用于持久化方案内容
3. **分层模型策略**：探索用 Haiku（快、便宜），设计用继承模型（强、贵）
4. **语义化权限预声明**：`allowedPrompts` 在规划阶段就预判执行阶段的权限需求，优化用户体验
5. **变体系统**：通过 feature flag 控制方案输出的详略程度，适应不同场景需求
