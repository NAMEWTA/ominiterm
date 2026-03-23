# CLAUDE.md

## Project Overview
- Electron terminal app, primary stack: TypeScript. Use TypeScript for all new code unless otherwise specified.

## Terminal / xterm Guidelines
- When debugging scroll, paste, or terminal rendering issues, check xterm's built-in mechanisms first before adding custom workarounds.
- Prefer removing custom scroll/paste code in favor of xterm's native behavior.

## GitHub Issues
- When creating issues, describe only the observed behavior and symptoms. Do not include code snippets, file paths, or implementation details in the issue body.

## Release Process
- Before any release (version bump + publish), always verify CHANGELOG has an entry for the new version.
- The Release workflow is triggered by pushing a tag, not by pushing to main. After committing the version bump, create and push a tag: `git tag v<version> && git push origin v<version>`.
- Run the build and check for CI prerequisites before pushing.
- Ensure old processes are killed before verifying a new version.
