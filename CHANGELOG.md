# Changelog

All notable changes to TermCanvas will be documented in this file.

## [0.7.19] - 2026-03-18

### Fixed
- Terminal scroll position no longer drifts upward during streaming output when user has scrolled up to read earlier content
- Replaced ResizeObserver-driven fitAddon.fit() with React state-driven fitting to prevent xterm resize/reflow from nudging viewport position

## [0.7.18] - 2026-03-18

### Added
- Auto-update: the app now checks for updates automatically and prompts to install
- Changelog displayed in update dialog with markdown rendering
- Gold border on user-created terminals to distinguish from agent-spawned ones
- Cmd+Arrow keys in Composer forward to CLI for history/cursor navigation
- Empty Enter in Composer passes through to CLI for confirming prompts

### Fixed
- Composer now uses bracketed paste for Claude Code, eliminating clipboard race conditions
- Re-entrancy guard in Composer prevents double submission
- Delay between bracketed paste and Enter key so CLI processes input before submission

### Changed
- All AI CLI terminals (Claude, Codex, Kimi, Gemini, OpenCode) migrated from clipboard paste to bracketed paste
