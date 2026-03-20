# Terminal Font Selection Design

## Overview

Add a font selection feature in Settings that lets users choose from 10 curated monospace fonts for their terminal. Fonts not already bundled can be downloaded with one click.

## Font List

| Font | Source | Notes |
|------|--------|-------|
| Geist Mono | builtin (npm `geist`) | Current default |
| Geist Pixel Square | builtin (npm `geist`) | Pixel-style variant from Vercel |
| JetBrains Mono | Google Fonts | Developer favorite, ligatures |
| Fira Code | Google Fonts | Pioneer of coding ligatures |
| Source Code Pro | Google Fonts | Adobe, classic and clean |
| IBM Plex Mono | Google Fonts | IBM design language |
| Inconsolata | Google Fonts | Lightweight, elegant |
| Cascadia Code | GitHub Release | Microsoft, Windows Terminal default |
| Hack | GitHub Release | Designed for source code |
| Victor Mono | GitHub Release | Italic cursive style, unique |

## Data Model

### Font Registry (`src/terminal/fontRegistry.ts`)

```typescript
interface FontEntry {
  id: string;                              // "jetbrains-mono"
  name: string;                            // "JetBrains Mono"
  source: "builtin" | "google-fonts" | "github";
  url: string;                             // download URL
  fileName: string;                        // "JetBrains-Mono.woff2"
  cssFamily: string;                       // CSS font-family value
}
```

### Preferences Store

New field in `preferencesStore`:
- `terminalFontFamily: string` — font ID, default `"geist-mono"`

## Font Storage

- Downloaded fonts stored in: `app.getPath('userData')/fonts/`
- Download state determined by file existence check (no extra persistence needed)
- Builtin fonts (Geist Mono, Geist Pixel Square) served from `node_modules/geist/`

## Electron IPC

New IPC handlers in main process:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `font:download` | renderer → main | Download woff2 to `userData/fonts/`, return local path |
| `font:check` | renderer → main | Check if a font file exists locally |
| `font:list-downloaded` | renderer → main | Return list of downloaded font filenames |
| `font:get-path` | renderer → main | Return absolute path of `userData/fonts/` |

Preload script exposes these via `window.termcanvas.fonts.*`.

## Font Registration

### On App Startup

1. Scan `userData/fonts/` for downloaded font files
2. For each file, create `FontFace` object and add to `document.fonts`
3. Builtin fonts already registered via CSS `@font-face` in `index.css`
4. Add `@font-face` for Geist Pixel Square in `index.css` (currently not registered)

### On Download Complete

1. Download finishes → main process returns local file path
2. Renderer creates `FontFace` with `file://` URL → `document.fonts.add()`
3. Font becomes immediately available for selection

## Terminal Application

### Font Family Resolution

Selected font → Geist Mono → Menlo → monospace (fallback chain)

### Real-time Switching

- `TerminalTile.tsx` reads `terminalFontFamily` from preferences store
- Subscribe to store changes: on fontFamily change → update `xterm.options.fontFamily` + `fitAddon.fit()`
- Same pattern as existing font size subscription

## Settings UI

In Settings Modal > General tab, below font size slider:

- Section titled "终端字体" / "Terminal Font"
- Radio list of all 10 fonts
- Each row: radio + font name + status badge (内置/已下载/下载按钮)
- Downloaded/builtin fonts show preview text rendered in that font: `AaBbCc 0123 →→ {}`
- Undownloaded fonts show download button with spinner during download
- Selecting a downloaded/builtin font immediately applies to all terminals

## Scope Exclusions

- No font deletion management
- No custom font import
- No per-terminal font override
- No font weight/style selection
- UI fonts remain Geist Sans (unchanged)
