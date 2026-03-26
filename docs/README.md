# OminiTerm 文档总览

本文档用于汇总仓库内的内部资料、设计记录和工具说明，方便在 `docs/` 下集中查阅。

## 文档结构

- `guides/`
  - 面向使用方式和协作流程的说明文档
- `notes/`
  - 面向实现细节、兼容性和交互节奏的技术备注
- `research/`
  - 设计研究和方案探索文档
- `plans/`
  - 历史设计方案与实施计划
- `reviews/`
  - 设计评审、兼容性分析和结构回顾
- `bugs/`
  - 已记录的问题分析和故障复盘
- `tooling/`
  - 子工具、评测框架和构建辅助说明
- `hydra/`
  - Hydra 任务与结果归档

## 推荐入口

### 使用说明

- [Claude Code 键位说明](./guides/claude-code-keybindings.md)
- [Claude Code Plan Mode 说明](./guides/claude-code-plan-mode.md)

### 技术备注

- [Composer 提交时序说明](./notes/composer-submit-timing.md)
- [Windows 兼容性备注](./notes/windows-compat-notes.md)

### 研究资料

- [Composer 交互设计研究](./research/composer-interaction-design.md)
- [Composer 快捷键系统研究](./research/composer-shortcut-system.md)

### 工具说明

- [Hydra Eval 评测框架](./tooling/eval-framework.md)

## 仓库级入口文件

以下文件继续保留在仓库根目录，作为项目对外或协作入口，不迁入 `docs/`：

- `README.md`
- `README.zh-CN.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `LICENSE`
- `AGENTS.md`

## 说明

- `plans/`、`reviews/`、`bugs/` 和 `hydra/` 中保留历史资料与归档记录，不做内容重写。
- `apps/desktop/skills/` 与 `.agents/skills/` 属于运行时或代理技能资源，不纳入本目录的文档搬迁范围。
