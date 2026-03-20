# Terminal Font Selection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users pick from 10 curated monospace fonts in Settings, with one-click download for non-bundled fonts.

**Architecture:** Font metadata lives in a static registry. Electron main process handles downloads to `userData/fonts/`. Renderer dynamically registers fonts via `FontFace` API, persists selection in `preferencesStore`, and applies it to all xterm instances in real time.

**Tech Stack:** Electron IPC, Node `https`/`fs`, FontFace API, Zustand, xterm.js `fontFamily` option.

---

### Task 1: Font Registry

**Files:**
- Create: `src/terminal/fontRegistry.ts`

**Step 1: Create the font registry file**

```typescript
export interface FontEntry {
  id: string;
  name: string;
  source: "builtin" | "google-fonts" | "github";
  /** Download URL (ignored for builtin fonts) */
  url: string;
  /** Filename stored in userData/fonts/ (ignored for builtin) */
  fileName: string;
  /** CSS font-family value to pass to xterm */
  cssFamily: string;
}

export const FONT_REGISTRY: FontEntry[] = [
  {
    id: "geist-mono",
    name: "Geist Mono",
    source: "builtin",
    url: "",
    fileName: "",
    cssFamily: '"Geist Mono"',
  },
  {
    id: "geist-pixel-square",
    name: "Geist Pixel Square",
    source: "builtin",
    url: "",
    fileName: "",
    cssFamily: '"Geist Pixel Square"',
  },
  {
    id: "jetbrains-mono",
    name: "JetBrains Mono",
    source: "google-fonts",
    url: "https://fonts.google.com/download?family=JetBrains+Mono",
    fileName: "JetBrainsMono-Regular.ttf",
    cssFamily: '"JetBrains Mono"',
  },
  {
    id: "fira-code",
    name: "Fira Code",
    source: "google-fonts",
    url: "https://fonts.google.com/download?family=Fira+Code",
    fileName: "FiraCode-Regular.ttf",
    cssFamily: '"Fira Code"',
  },
  {
    id: "source-code-pro",
    name: "Source Code Pro",
    source: "google-fonts",
    url: "https://fonts.google.com/download?family=Source+Code+Pro",
    fileName: "SourceCodePro-Regular.ttf",
    cssFamily: '"Source Code Pro"',
  },
  {
    id: "ibm-plex-mono",
    name: "IBM Plex Mono",
    source: "google-fonts",
    url: "https://fonts.google.com/download?family=IBM+Plex+Mono",
    fileName: "IBMPlexMono-Regular.ttf",
    cssFamily: '"IBM Plex Mono"',
  },
  {
    id: "inconsolata",
    name: "Inconsolata",
    source: "google-fonts",
    url: "https://fonts.google.com/download?family=Inconsolata",
    fileName: "Inconsolata-Regular.ttf",
    cssFamily: '"Inconsolata"',
  },
  {
    id: "cascadia-code",
    name: "Cascadia Code",
    source: "github",
    url: "https://github.com/microsoft/cascadia-code/releases/latest/download/CascadiaCode-2404.23.zip",
    fileName: "CascadiaCode-Regular.otf",
    cssFamily: '"Cascadia Code"',
  },
  {
    id: "hack",
    name: "Hack",
    source: "github",
    url: "https://github.com/source-foundry/Hack/releases/latest/download/Hack-v3.003-ttf.zip",
    fileName: "Hack-Regular.ttf",
    cssFamily: '"Hack"',
  },
  {
    id: "victor-mono",
    name: "Victor Mono",
    source: "github",
    url: "https://github.com/rubjo/victor-mono/releases/latest/download/VictorMonoAll.zip",
    fileName: "VictorMono-Regular.ttf",
    cssFamily: '"Victor Mono"',
  },
];

/** Build xterm fontFamily string: selected font + fallback chain */
export function buildFontFamily(fontId: string): string {
  const entry = FONT_REGISTRY.find((f) => f.id === fontId);
  const primary = entry?.cssFamily ?? '"Geist Mono"';
  return `${primary}, "Geist Mono", Menlo, monospace`;
}
```

**Step 2: Commit**

```bash
git add src/terminal/fontRegistry.ts
git commit -m "feat(fonts): add font registry with 10 curated terminal fonts"
```

---

### Task 2: Geist Pixel Square @font-face

**Files:**
- Modify: `src/index.css:14-22` (add after Geist Mono block)

**Step 1: Add Geist Pixel Square font-face declaration**

After the existing Geist Mono `@font-face` block (line 22), add:

```css
/* Geist Pixel Square */
@font-face {
  font-family: "Geist Pixel Square";
  src: url("/node_modules/geist/dist/fonts/geist-pixel/GeistPixel-Square.woff2")
    format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

**Step 2: Commit**

```bash
git add src/index.css
git commit -m "feat(fonts): register Geist Pixel Square font-face"
```

---

### Task 3: Font Download IPC — Main Process

**Files:**
- Modify: `electron/main.ts:1-27` (add import)
- Modify: `electron/main.ts:582-604` (add IPC handlers before close flow)

**Step 1: Add font download IPC handlers**

At the top of `electron/main.ts`, `fs`, `path`, and `app` are already imported. No new imports needed (use Node built-in `https` via dynamic import or `net.request` from Electron — use Electron's `net` for better proxy support).

Add the following IPC handlers before the `// Close flow` comment (line 593):

```typescript
  // Font management
  const fontsDir = path.join(app.getPath("userData"), "fonts");

  ipcMain.handle("font:get-path", () => fontsDir);

  ipcMain.handle("font:list-downloaded", () => {
    try {
      if (!fs.existsSync(fontsDir)) return [];
      return fs.readdirSync(fontsDir);
    } catch {
      return [];
    }
  });

  ipcMain.handle("font:check", (_event, fileName: string) => {
    return fs.existsSync(path.join(fontsDir, fileName));
  });

  ipcMain.handle(
    "font:download",
    async (_event, url: string, fileName: string) => {
      if (!fs.existsSync(fontsDir)) {
        fs.mkdirSync(fontsDir, { recursive: true });
      }
      const destPath = path.join(fontsDir, fileName);
      if (fs.existsSync(destPath)) {
        return { ok: true, path: destPath };
      }

      try {
        // Download zip to temp file
        const { net } = await import("electron");
        const tmpZip = path.join(fontsDir, `_download_${Date.now()}.zip`);

        await new Promise<void>((resolve, reject) => {
          const request = net.request(url);
          const chunks: Buffer[] = [];
          request.on("response", (response) => {
            // Handle redirects (GitHub releases)
            if (
              (response.statusCode === 301 || response.statusCode === 302) &&
              response.headers.location
            ) {
              const redirectUrl = Array.isArray(response.headers.location)
                ? response.headers.location[0]
                : response.headers.location;
              const redirectReq = net.request(redirectUrl);
              const rChunks: Buffer[] = [];
              redirectReq.on("response", (rRes) => {
                rRes.on("data", (chunk) => rChunks.push(chunk));
                rRes.on("end", () => {
                  fs.writeFileSync(tmpZip, Buffer.concat(rChunks));
                  resolve();
                });
                rRes.on("error", reject);
              });
              redirectReq.on("error", reject);
              redirectReq.end();
              return;
            }
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("end", () => {
              fs.writeFileSync(tmpZip, Buffer.concat(chunks));
              resolve();
            });
            response.on("error", reject);
          });
          request.on("error", reject);
          request.end();
        });

        // Extract target font file from zip
        const { execSync } = await import("child_process");
        // List zip contents to find the target file
        const zipList = execSync(`unzip -l "${tmpZip}"`, {
          encoding: "utf-8",
        });
        // Find the exact path inside the zip matching fileName
        const lines = zipList.split("\n");
        const matchLine = lines.find((l) => l.trim().endsWith(fileName));
        if (!matchLine) {
          fs.unlinkSync(tmpZip);
          return {
            ok: false,
            error: `Font file "${fileName}" not found in archive`,
          };
        }
        const innerPath = matchLine.trim().split(/\s+/).pop()!;

        execSync(
          `unzip -jo "${tmpZip}" "${innerPath}" -d "${fontsDir}"`,
          { encoding: "utf-8" },
        );
        fs.unlinkSync(tmpZip);

        return { ok: true, path: destPath };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );
```

**Step 2: Commit**

```bash
git add electron/main.ts
git commit -m "feat(fonts): add font download IPC handlers in main process"
```

---

### Task 4: Font IPC — Preload Bridge

**Files:**
- Modify: `electron/preload.ts:122-127` (add fonts namespace before `composer`)

**Step 1: Expose font APIs to renderer**

Add the `fonts` namespace before the `composer` block (after line 122, before `composer:`):

```typescript
  fonts: {
    getPath: () =>
      ipcRenderer.invoke("font:get-path") as Promise<string>,
    listDownloaded: () =>
      ipcRenderer.invoke("font:list-downloaded") as Promise<string[]>,
    check: (fileName: string) =>
      ipcRenderer.invoke("font:check", fileName) as Promise<boolean>,
    download: (url: string, fileName: string) =>
      ipcRenderer.invoke("font:download", url, fileName) as Promise<{
        ok: boolean;
        path?: string;
        error?: string;
      }>,
  },
```

**Step 2: Commit**

```bash
git add electron/preload.ts
git commit -m "feat(fonts): expose font IPC in preload bridge"
```

---

### Task 5: Preferences Store — Add Font Family

**Files:**
- Modify: `src/stores/preferencesStore.ts`

**Step 1: Add `terminalFontFamily` to the store**

Add to interface (after line 11):
```typescript
  /** Terminal font ID from fontRegistry */
  terminalFontFamily: string;
  setTerminalFontFamily: (fontId: string) => void;
```

Update `loadPreferences` return type and parsing (add after fontSize parsing, around line 31):
```typescript
      let fontFamily = "geist-mono";
      const ff = parsed.terminalFontFamily;
      if (typeof ff === "string" && ff.length > 0) fontFamily = ff;

      return { animationBlur: blur, terminalFontSize: fontSize, terminalFontFamily: fontFamily };
```

Update default return (line 38):
```typescript
  return { animationBlur: DEFAULT_BLUR, terminalFontSize: DEFAULT_FONT_SIZE, terminalFontFamily: "geist-mono" };
```

Update `savePreferences` parameter type to include `terminalFontFamily: string`.

Add to store initial state and action (inside `create`, after `setTerminalFontSize`):
```typescript
  terminalFontFamily: initialPrefs.terminalFontFamily,
  setTerminalFontFamily: (fontId) => {
    set({ terminalFontFamily: fontId });
    savePreferences({ ...get(), terminalFontFamily: fontId });
  },
```

**Step 2: Commit**

```bash
git add src/stores/preferencesStore.ts
git commit -m "feat(fonts): add terminalFontFamily to preferences store"
```

---

### Task 6: Font Loader Utility

**Files:**
- Create: `src/terminal/fontLoader.ts`

**Step 1: Create the font loader**

This module loads downloaded fonts on startup and provides a function to load a single font after download.

```typescript
import { FONT_REGISTRY, type FontEntry } from "./fontRegistry";

/** Load a single font into the document via FontFace API */
export async function loadFont(
  entry: FontEntry,
  fontsDir: string,
): Promise<boolean> {
  if (entry.source === "builtin") return true;
  try {
    const filePath = `file://${fontsDir}/${entry.fileName}`;
    const face = new FontFace(
      entry.cssFamily.replace(/"/g, ""),
      `url("${filePath}")`,
    );
    await face.load();
    document.fonts.add(face);
    return true;
  } catch {
    return false;
  }
}

/** Load all downloaded fonts on app startup */
export async function loadAllDownloadedFonts(): Promise<void> {
  const fontsDir = await window.termcanvas.fonts.getPath();
  const downloaded = await window.termcanvas.fonts.listDownloaded();
  const downloadedSet = new Set(downloaded);

  for (const entry of FONT_REGISTRY) {
    if (entry.source === "builtin") continue;
    if (downloadedSet.has(entry.fileName)) {
      await loadFont(entry, fontsDir);
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/terminal/fontLoader.ts
git commit -m "feat(fonts): add font loader utility for FontFace registration"
```

---

### Task 7: Call Font Loader on App Startup

**Files:**
- Modify: `src/App.tsx` (add import and useEffect)

**Step 1: Find and read the App.tsx startup logic**

Read `src/App.tsx` to find where existing `useEffect` calls run on mount. Add a new effect that calls `loadAllDownloadedFonts()` on startup.

Add import:
```typescript
import { loadAllDownloadedFonts } from "./terminal/fontLoader";
```

Add effect (near other mount-time effects):
```typescript
useEffect(() => {
  loadAllDownloadedFonts();
}, []);
```

**Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat(fonts): load downloaded fonts on app startup"
```

---

### Task 8: i18n Strings

**Files:**
- Modify: `src/i18n/en.ts:113-114` (add after `terminal_font_size`)
- Modify: `src/i18n/zh.ts:111-112` (add after `terminal_font_size`)

**Step 1: Add English translations**

After `terminal_font_size` line, add:
```typescript
  terminal_font: "Terminal font",
  font_builtin: "Built-in",
  font_downloaded: "Downloaded",
  font_download: "Download",
  font_downloading: "Downloading\u2026",
  font_download_failed: "Download failed",
```

**Step 2: Add Chinese translations**

After `terminal_font_size` line, add:
```typescript
  terminal_font: "终端字体",
  font_builtin: "内置",
  font_downloaded: "已下载",
  font_download: "下载",
  font_downloading: "下载中…",
  font_download_failed: "下载失败",
```

**Step 3: Commit**

```bash
git add src/i18n/en.ts src/i18n/zh.ts
git commit -m "feat(fonts): add i18n strings for font selection UI"
```

---

### Task 9: Settings UI — Font Selection Section

**Files:**
- Modify: `src/components/SettingsModal.tsx`

**Step 1: Add imports and state**

Add imports at top:
```typescript
import { FONT_REGISTRY, type FontEntry } from "../terminal/fontRegistry";
import { loadFont } from "../terminal/fontLoader";
```

Inside `SettingsModal` component, add state:
```typescript
const { terminalFontFamily, setTerminalFontFamily } = usePreferencesStore();
const [downloadedFonts, setDownloadedFonts] = useState<Set<string>>(new Set());
const [downloadingFont, setDownloadingFont] = useState<string | null>(null);

// Load downloaded font status on mount
useEffect(() => {
  window.termcanvas.fonts.listDownloaded().then((files) => {
    setDownloadedFonts(new Set(files));
  });
}, []);
```

**Step 2: Add font selection UI in General tab**

After the font size slider section (after line 238, before the animation blur section), add a new font selection section. The section should be a scrollable list with max height:

```tsx
{/* Terminal font */}
<div className="flex flex-col gap-1.5">
  <span className="text-[13px] text-[var(--text-secondary)]">
    {t.terminal_font}
  </span>
  <div className="flex flex-col gap-0.5 max-h-[240px] overflow-y-auto rounded-md border border-[var(--border)] p-1">
    {FONT_REGISTRY.map((font) => {
      const isBuiltin = font.source === "builtin";
      const isDownloaded = downloadedFonts.has(font.fileName);
      const isAvailable = isBuiltin || isDownloaded;
      const isSelected = terminalFontFamily === font.id;
      const isDownloading = downloadingFont === font.id;

      return (
        <button
          key={font.id}
          className={`flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors duration-100 ${
            isSelected
              ? "bg-[var(--accent)]/15 text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          }`}
          onClick={() => {
            if (isAvailable) setTerminalFontFamily(font.id);
          }}
          disabled={!isAvailable && !isDownloading}
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[13px]">{font.name}</span>
            {isAvailable && (
              <span
                className="text-[12px] text-[var(--text-muted)] truncate"
                style={{ fontFamily: `${font.cssFamily}, monospace` }}
              >
                AaBbCc 0123 →→ {"{}"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            {isBuiltin && (
              <span className="text-[11px] text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--surface)]">
                {t.font_builtin}
              </span>
            )}
            {!isBuiltin && isDownloaded && (
              <span className="text-[11px] text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--surface)]">
                {t.font_downloaded}
              </span>
            )}
            {!isBuiltin && !isDownloaded && !isDownloading && (
              <button
                className="text-[11px] text-[var(--accent)] hover:text-[var(--text-primary)] px-1.5 py-0.5 rounded bg-[var(--surface)] hover:bg-[var(--border)] transition-colors duration-100"
                onClick={async (e) => {
                  e.stopPropagation();
                  setDownloadingFont(font.id);
                  const result = await window.termcanvas.fonts.download(
                    font.url,
                    font.fileName,
                  );
                  if (result.ok) {
                    const fontsDir = await window.termcanvas.fonts.getPath();
                    await loadFont(font, fontsDir);
                    setDownloadedFonts((prev) => new Set([...prev, font.fileName]));
                  }
                  setDownloadingFont(null);
                }}
              >
                {t.font_download}
              </button>
            )}
            {isDownloading && (
              <span className="text-[11px] text-[var(--text-muted)] px-1.5 py-0.5">
                {t.font_downloading}
              </span>
            )}
          </div>
        </button>
      );
    })}
  </div>
</div>
```

**Step 3: Commit**

```bash
git add src/components/SettingsModal.tsx
git commit -m "feat(fonts): add font selection UI in settings modal"
```

---

### Task 10: Terminal — Apply Selected Font

**Files:**
- Modify: `src/terminal/TerminalTile.tsx:224-226` (initial font)
- Modify: `src/terminal/TerminalTile.tsx:647-657` (add font subscription)

**Step 1: Add import**

Add at top of file:
```typescript
import { buildFontFamily } from "./fontRegistry";
```

**Step 2: Update xterm initialization (line 226)**

Replace the hardcoded fontFamily:
```typescript
// Before:
fontFamily: '"Geist Mono", "SF Mono", "JetBrains Mono", Menlo, monospace',

// After:
fontFamily: buildFontFamily(usePreferencesStore.getState().terminalFontFamily),
```

**Step 3: Add font family subscription**

After the existing font size subscription effect (after line 657), add a new effect:

```typescript
// Update xterm font family when preference changes
useEffect(() => {
  const unsubscribe = usePreferencesStore.subscribe((state) => {
    const xterm = xtermRef.current;
    if (xterm) {
      const family = buildFontFamily(state.terminalFontFamily);
      if (xterm.options.fontFamily !== family) {
        xterm.options.fontFamily = family;
        fitAddonRef.current?.fit();
      }
    }
  });
  return unsubscribe;
}, []);
```

**Step 4: Commit**

```bash
git add src/terminal/TerminalTile.tsx
git commit -m "feat(fonts): apply selected font to all terminal instances"
```

---

### Task 11: Manual Testing & Verification

**Step 1: Start the dev server**

```bash
npm run dev
```

**Step 2: Verify the following**

1. Open Settings → General tab → "Terminal font" section visible
2. Geist Mono is selected by default, shows preview text
3. Geist Pixel Square shows as "Built-in", click to switch — terminals update immediately
4. Click download on JetBrains Mono → spinner → "Downloaded" badge appears → preview text renders
5. Select JetBrains Mono → all terminals switch font in real time
6. Restart app → font preference persists, downloaded font loads on startup
7. Verify the font fallback: if selected font file is deleted manually, terminals still render (fallback to Geist Mono)

**Step 3: Commit any fixes found during testing**
