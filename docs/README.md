# OminiTerm 文档总览

当前工作树只保留仍在维护的开发文档。历史 CLI、Hydra、Eval 以及旧画布方案相关资料已经从活跃目录移除；如果需要，请优先回看 git 历史。

## 推荐阅读顺序

1. [`../README.zh-CN.md`](../README.zh-CN.md)
   先建立对当前仓库边界和子项目结构的整体认识。
2. [`architecture.md`](./architecture.md)
   理解当前包结构、桌面端分层、核心数据模型和主要运行时文件。
3. [`development.md`](./development.md)
   查看本地开发、验证命令和常见改动入口。

## 当前有效文档

- `architecture.md`
  当前系统架构、桌面端分层、核心数据模型、运行时文件和主要链路。
- `development.md`
  二次开发环境、命令、验证矩阵和跨平台注意事项。

## 根目录相关文档

- `../README.md`
- `../README.zh-CN.md`
- `../CHANGELOG.md`
- `../AGENTS.md`
- `../LICENSE`

## 维护约定

- 调整目录结构、命令、包名、运行时路径时，要同步更新文档。
- 不要默认恢复已移除的 CLI、Hydra、Eval 或历史画布文档。
- 一次性探索材料优先留在提交历史里追踪，不要随手塞回 `docs/` 根目录。
