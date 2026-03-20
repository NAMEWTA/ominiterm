# CLI Agent Settings — Phase 1 Design

## Problem

When TermCanvas launches agent terminals (Claude, Codex, etc.), it resolves the
executable by searching PATH. If the Electron app starts with an incomplete
environment (e.g. nvm not loaded, or launched from Finder instead of a shell),
the CLI binary is not found and the user sees a raw
`Executable not found: claude` error with no way to fix it from inside the app.

## Principles

- Zero-config happy path: if `claude` is on PATH, it just works — no setup required.
- No silent fallback or PATH guessing.
- When resolution fails, show an actionable error pointing to Settings.
- Users can explicitly override the command for any agent in Settings.

## Design

### 1. Data model — preferencesStore.ts

```typescript
interface CliCommandConfig {
  command: string;  // absolute path or bare command name
  args: string[];   // extra args prepended to launch args
}

// New field in PreferencesStore:
cliCommands: Partial<Record<TerminalType, CliCommandConfig>>;
setCli: (type: TerminalType, config: CliCommandConfig | null) => void;
```

Only agents the user has **explicitly overridden** appear in the map.
Unset entries fall back to the default command from `cliConfig.ts`.

Persisted in the same `termcanvas-preferences` localStorage key.

### 2. Terminal launch — cliConfig.ts

`getTerminalLaunchOptions()` gains an optional `cliOverride` parameter:

```typescript
getTerminalLaunchOptions(
  type, sessionId, autoApprove,
  cliOverride?: CliCommandConfig,
)
```

- `cliOverride.command` replaces the hardcoded `shell` value.
- `cliOverride.args` is prepended to the arg list.
- Caller (`TerminalTile.tsx`) reads `cliCommands[type]` from the preferences
  store and passes it through.

### 3. IPC — cli.validateCommand

**preload.ts** adds:

```typescript
cli.validateCommand(command: string, args?: string[])
  → Promise<{ ok: true; resolvedPath: string; version?: string }
           | { ok: false; error: string }>
```

**main.ts** handler:
1. Uses the same `resolveExecutable` + shell env from `pty-launch.ts`.
2. If resolved, runs `execFile(resolved, ["--version"])` to capture version.
3. Returns structured result.

### 4. Error messages — pty-launch.ts + renderer

`buildLaunchSpec` throws a structured error (`PtyLaunchError`) with:
- `code`: `"executable-not-found"`
- `command`: the command that failed
- Human-readable message

Renderer catches this and displays an inline error panel in the terminal area:
- Text: "Claude CLI is not configured or cannot be launched."
- Button: "Open Settings" → navigates to Settings > Agents tab.

### 5. Settings UI — SettingsModal.tsx

New tab: **Agents** (third tab after General / Shortcuts).

Shows 5 agents: claude, codex, kimi, gemini, opencode.

Each row:
```
[Agent name]  [auto-detect status]  [command input]  [Validate button]
```

- On tab open: auto-detect each agent via `cli.validateCommand(defaultShell)`.
- Input placeholder shows detected path (greyed out).
- User types a custom command → clicks Validate → shows result.
- Clear input = revert to default.
- Status display: "Found (v1.x.x)" green / "Not found" grey / "Invalid: reason" red.

### 6. i18n

~10 new keys in `en.ts` / `zh.ts`:
- `settings_agents`, `settings_agents_desc`
- `agent_status_found`, `agent_status_not_found`, `agent_status_invalid`
- `agent_command_placeholder`, `agent_validate`, `agent_default_hint`
- `cli_launch_error`, `cli_launch_error_action`

## Not in scope (Phase 2)

- File picker for choosing executables
- Extra args UI (data structure reserved)
- Hydra setup wizard
- `checkAgentReadiness` concept
