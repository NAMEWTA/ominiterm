# Welcome Popup Design

## Overview

First-time welcome popup styled as a simulated terminal tile, consistent with termcanvas's visual identity.

## Visual Structure

Modal overlay with a content area mimicking TerminalTile's appearance:

```
┌─────────────────────────────────────────────┐
│ ● welcome   termcanvas                   ✕  │
├─────────────────────────────────────────────┤
│                                             │
│  $ cat welcome.txt                          │
│                                             │
│  Welcome to TermCanvas!                     │
│  Manage terminals on an infinite canvas.    │
│                                             │
│  Quick Start:                               │
│  1. Click "Add Project" to add a project    │
│  2. Open terminals in your worktrees        │
│  3. Pan & zoom the canvas freely            │
│                                             │
│  Key Shortcuts:                             │
│  ⌘+N  Add project    ⌘+,  Settings         │
│  ⌘+S  Save workspace Space+drag  Pan       │
│                                             │
│  GitHub: github.com/blueberrycongee/termcanvas│
│                                             │
│  Press Enter or click anywhere to start.    │
│                                             │
└─────────────────────────────────────────────┘
```

## Design Details

### Title Bar
- Amber dot indicator (same as user-created terminals)
- `welcome` badge in cyan (#50e3c2) — distinct from existing terminal types
- Title text: "termcanvas"
- Close (✕) button only (no minimize)

### Content Area
- Background: `bg-[var(--bg)]` (matches terminal tiles)
- Font: Geist Mono throughout
- `$ cat welcome.txt` header line to establish terminal feel
- Content sections: product intro, quick start steps, key shortcuts, GitHub link
- Footer prompt: "Press Enter or click anywhere to start."

### Shortcuts Display
- Read from shortcutStore (user's actual configured shortcuts), not hardcoded
- Show 4 most useful shortcuts in a 2-column layout

### Behavior
- **First-run detection**: localStorage key `termcanvas-welcome-seen`
- **Close triggers**: Enter key, ESC key, ✕ button, backdrop click
- **z-index**: `z-[200]` (same level as SettingsModal)
- **Backdrop**: `bg-black/60`, fixed inset-0

### Sizing
- Fixed width: ~480px
- Height: auto (content-driven)
- Centered on screen

### i18n
- All text strings added to en.ts and zh.ts translation files

## Implementation

### New Files
- `src/components/WelcomePopup.tsx` — the popup component

### Modified Files
- `src/App.tsx` — mount WelcomePopup with localStorage check
- `src/i18n/en.ts` — English translations
- `src/i18n/zh.ts` — Chinese translations
