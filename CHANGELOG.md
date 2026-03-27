# Changelog

This changelog tracks the active OminiTerm desktop product line.

Historical notes from removed CLI, Hydra, eval, and older branch structures remain available through git history and GitHub Releases. The current working tree only documents the active desktop and website packages.

## [1.1.0] - 2026-03-27

### Changed

- Added a dedicated account launch flow so AI CLI accounts can be created, edited, selected, and started with clearer dialogs
- Improved terminal and project command launch wiring for AI config driven startup behavior
- Refined desktop keyboard shortcut handling and workspace entry/open flows for more consistent shell behavior
- Expanded desktop coverage with new tests for account defaults, launch dialogs, file previews, terminal launch requests, and workspace open persistence

## [1.0.0] - 2026-03-27

### Breaking Changes

- Removed the legacy `ominiterm` packaged CLI and local HTTP API server
- Removed the entire `tools/hydra` orchestration and `tools/eval` evaluation toolchain
- Removed command registration flow and shipped skill distribution chain

### Changed

- Reorganized workspace to focus on maintained `apps/desktop` and `apps/website` packages
- Reworked desktop settings bridge to use a dedicated agent command validator instead of the removed desktop CLI bridge
- Updated all documentation to reflect the simplified package boundaries

### Removed

- Obsolete CLI/Hydra/Eval documentation and legacy structures
- Unused build scripts and outdated integration points

## [0.0.1] - 2026-03-27

### Changed

- Reset the active workspace baseline to `0.0.1` for the remaining desktop and website packages
- Simplified the workspace to the maintained `apps/desktop` and `apps/website` packages
- Reworked the desktop settings bridge so Agent CLI validation uses a dedicated runtime API instead of the removed desktop CLI bridge

### Removed

- Removed the legacy `ominiterm` packaged CLI, local HTTP API server, command registration flow, and shipped skill distribution chain
- Removed the obsolete `tools/hydra` and `tools/eval` packages from the active working tree
- Removed outdated CLI / Hydra / Eval documentation and aligned the docs set with the current package boundaries

## Historical Notes

### Historical `v0.0.1` tag - 2026-03-26

The repository already contains an older Git tag named `v0.0.1` from a previous release flow. That historical tag is preserved in git history and is not rewritten by the current desktop/website baseline reset.

### Historical `0.8.52` baseline - 2026-03-24

- Removed unused heatmap layout and utility code
- Added project and worktree path normalization to avoid `.git/modules` paths surfacing in the desktop state
- Added a shortcut to toggle the project sidebar
- Refreshed the available agent type list in the desktop shell
