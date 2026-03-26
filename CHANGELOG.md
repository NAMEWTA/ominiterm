# Changelog

This changelog tracks the refactored OminiTerm monorepo line.

Historical notes from the pre-cleanup tree are still available through git history and GitHub Releases. The active working tree now keeps only the current branch snapshot plus the latest tagged baseline that the release workflow depends on.

## [Unreleased]

### Refactored

- Reorganized the repository into a pnpm monorepo with `apps/desktop`, `apps/website`, `tools/hydra`, and `tools/eval`
- Unified product naming around `OminiTerm`, including the packaged desktop app, runtime data directory, and bundled CLI names
- Reframed the desktop shell around a project sidebar, project board, terminal detail page, and right rail

### Added

- Workspace-local agent skills under `.agents/skills/` for planning, debugging, documentation, and collaboration workflows
- A dedicated `tools/eval` package for Hydra and single-agent benchmark runs
- Project path normalization so git internal worktree paths no longer leak into restored UI state
- Legacy runtime migration from `~/.termcanvas*` to `~/.ominiterm*`

### Changed

- `ominiterm` and `hydra` are now bundled from the desktop package and registered together
- The active docs set has been reset to a lightweight developer-oriented structure under `docs/`
- The right rail now focuses on worktree files and git diffs for the active terminal context

### Removed

- Obsolete historical docs, plans, and archive material from the active working tree
- Unused heatmap layout code and stale utility modules left over from the older UI structure

## [0.8.52] - 2026-03-24

### Fixed

- Removed unused heatmap layout and utility code
- Added project and worktree path normalization to avoid `.git/modules` paths surfacing in the desktop state

### Changed

- Added a shortcut to toggle the project sidebar
- Refreshed the available agent type list in the desktop shell
