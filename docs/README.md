# OminiTerm 文档总览

当前 `pure-term` 分支已经不再维护大批历史设计方案和归档文档，`docs/` 目录只保留当前还在服务开发的有效文档。需要查旧方案、旧问题复盘或旧界面说明时，请优先回看 git 历史，而不是在工作树里寻找已经被清理掉的文件。

## 推荐阅读顺序

1. [`../README.zh-CN.md`](../README.zh-CN.md)
   先建立对当前分支边界和子项目结构的整体认识。
2. [`architecture.md`](./architecture.md)
   再理解系统结构、数据模型和主流程。
3. [`development.md`](./development.md)
   然后看本地开发、验证和常见改动入口。
4. [`tooling/cli-and-hydra.md`](./tooling/cli-and-hydra.md)
   如果你要接 CLI、Hydra 或自动化协作链路，读这一篇。
5. [`tooling/eval-framework.md`](./tooling/eval-framework.md)
   如果你要接评测、基准对比或实验数据落盘，读这一篇。

## 当前有效文档

- `architecture.md`
  当前系统架构、桌面端分层、核心数据模型、运行时文件和主要链路。
- `development.md`
  二次开发环境、命令、验证矩阵、扩展入口和跨平台注意事项。
- `tooling/cli-and-hydra.md`
  `ominiterm` CLI、Hydra、桌面端 API Server 的关系和典型工作流。
- `tooling/eval-framework.md`
  评测工具的模式、命令、结果目录和实现入口。

## 根目录相关文档

- `../README.md`
- `../README.zh-CN.md`
- `../CHANGELOG.md`
- `../AGENTS.md`
- `../LICENSE`

## 维护约定

- 调整目录结构、命令、包名、运行时路径时，要同步更新这里的文档。
- 更新 CLI 或 Hydra 行为时，同时更新 `docs/tooling/` 下的对应说明。
- 如果只是补充一次性的设计探索，不要默认塞回 `docs/` 根目录；除非用户明确要求长期维护，否则优先放在提交历史里追踪。
