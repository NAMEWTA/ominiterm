# i18n (Chinese/English) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add runtime zh/en switching to termcanvas with a Settings modal, zero new dependencies.

**Architecture:** A Zustand `localeStore` holds `'en' | 'zh'` (persisted to localStorage, defaulting to `navigator.language`). A `useT()` hook subscribes to the store and returns a `t(key)` lookup function. All components call `t()` for UI strings. A new Settings modal (opened from a Toolbar gear icon) lets the user switch language and theme.

**Tech Stack:** React 19, TypeScript, Zustand 5, Tailwind CSS 4, Electron (no new dependencies added)

> **Note:** The project has no test framework configured, so TDD steps are replaced with type-check runs (`npm run typecheck`).

---

### Task 1: Create localeStore

**Files:**
- Create: `src/stores/localeStore.ts`

**Step 1: Create the store**

```ts
// src/stores/localeStore.ts
import { create } from "zustand";

export type Locale = "en" | "zh";

function detectLocale(): Locale {
  const saved = localStorage.getItem("termcanvas-locale") as Locale | null;
  if (saved === "en" || saved === "zh") return saved;
  return navigator.language.startsWith("zh") ? "zh" : "en";
}

interface LocaleStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleStore>((set) => ({
  locale: detectLocale(),
  setLocale: (locale) => {
    localStorage.setItem("termcanvas-locale", locale);
    set({ locale });
  },
}));
```

**Step 2: Type-check**

Run: `npm run typecheck`
Expected: No errors related to localeStore.

**Step 3: Commit**

```bash
git add src/stores/localeStore.ts
git commit -m "feat: add localeStore for i18n locale management"
```

---

### Task 2: Create translation dictionaries

**Files:**
- Create: `src/i18n/en.ts`
- Create: `src/i18n/zh.ts`

**Step 1: Create English dictionary**

```ts
// src/i18n/en.ts
export const en = {
  // Common
  cancel: "Cancel",
  save: "Save",
  dont_save: "Don't Save",

  // App – CloseDialog
  save_workspace_title: "Save workspace?",
  save_workspace_desc:
    "Save your projects, terminals, and drawings to a file so you can restore them later.",

  // Toolbar / Settings modal
  settings: "Settings",
  reset: "Reset",
  fit: "Fit",
  switch_to_light: "Switch to light",
  switch_to_dark: "Switch to dark",
  language: "Language",
  theme: "Theme",

  // Sidebar
  projects: "Projects",
  add: "+ Add",
  open: "Open",
  no_projects: "No projects",
  status_running: "Running",
  status_done: "Done",
  status_error: "Error",
  status_idle: "Starting",
  error_dir_picker: (err: unknown) =>
    `Failed to open directory picker: ${err}`,
  error_scan: (err: unknown) => `Failed to scan project: ${err}`,
  error_not_git: (path: string) => `"${path}" is not a git repository.`,
  info_added_project: (name: string, count: number) =>
    `Added "${name}" with ${count} worktree${count !== 1 ? "s" : ""}.`,

  // WorktreeContainer
  new_terminal: "New terminal",
  new_terminal_btn: "+ New Terminal",

  // ProjectContainer
  project_label: "Project",

  // DiffCard
  diff: "Diff",
  loading: "Loading...",
  no_changes: "No changes",
  binary_label: "binary",
  removed: "Removed",
  file_new: "New",
  added: "Added",
  image_changed: "Image file changed",
  binary_changed: "Binary file changed",
  file_count: (n: number) => `${n} file${n !== 1 ? "s" : ""}`,

  // TerminalTile
  terminal_api_unavailable:
    "Terminal API not available. Not running in Electron.",
  failed_create_pty: (title: string, err: unknown) =>
    `Failed to create PTY for "${title}": ${err}`,
  process_exited: (code: number) =>
    `\r\n\x1b[33m[Process exited with code ${code}]\x1b[0m\r\n`,
  terminal_exited: (title: string, code: number) =>
    `Terminal "${title}" exited with code ${code}.`,

  // DrawingPanel
  tool_select: "Select",
  tool_pen: "Pen",
  tool_text: "Text",
  tool_rect: "Rect",
  tool_arrow: "Arrow",
  layout_horizontal: "Horizontal layout",
  layout_vertical: "Vertical layout",
} as const;

export type TranslationKey = keyof typeof en;
```

**Step 2: Create Chinese dictionary**

```ts
// src/i18n/zh.ts
export const zh = {
  // Common
  cancel: "取消",
  save: "保存",
  dont_save: "不保存",

  // App – CloseDialog
  save_workspace_title: "保存工作区？",
  save_workspace_desc: "将项目、终端和绘图保存到文件，以便稍后恢复。",

  // Toolbar / Settings modal
  settings: "设置",
  reset: "重置",
  fit: "适合",
  switch_to_light: "切换到浅色",
  switch_to_dark: "切换到深色",
  language: "语言",
  theme: "主题",

  // Sidebar
  projects: "项目",
  add: "+ 添加",
  open: "打开",
  no_projects: "暂无项目",
  status_running: "运行中",
  status_done: "完成",
  status_error: "错误",
  status_idle: "启动中",
  error_dir_picker: (err: unknown) => `打开目录选择器失败：${err}`,
  error_scan: (err: unknown) => `扫描项目失败：${err}`,
  error_not_git: (path: string) => `"${path}" 不是 git 仓库。`,
  info_added_project: (name: string, count: number) =>
    `已添加 "${name}"，共 ${count} 个工作树。`,

  // WorktreeContainer
  new_terminal: "新建终端",
  new_terminal_btn: "+ 新建终端",

  // ProjectContainer
  project_label: "项目",

  // DiffCard
  diff: "变更",
  loading: "加载中...",
  no_changes: "无变更",
  binary_label: "二进制",
  removed: "已删除",
  file_new: "新增",
  added: "已添加",
  image_changed: "图片文件已修改",
  binary_changed: "二进制文件已修改",
  file_count: (n: number) => `${n} 个文件`,

  // TerminalTile
  terminal_api_unavailable: "终端 API 不可用，未在 Electron 中运行。",
  failed_create_pty: (title: string, err: unknown) =>
    `为 "${title}" 创建 PTY 失败：${err}`,
  process_exited: (code: number) =>
    `\r\n\x1b[33m[进程已退出，退出码 ${code}]\x1b[0m\r\n`,
  terminal_exited: (title: string, code: number) =>
    `终端 "${title}" 已退出，退出码 ${code}。`,

  // DrawingPanel
  tool_select: "选择",
  tool_pen: "画笔",
  tool_text: "文字",
  tool_rect: "矩形",
  tool_arrow: "箭头",
  layout_horizontal: "横向布局",
  layout_vertical: "纵向布局",
} as const;
```

**Step 3: Type-check**

Run: `npm run typecheck`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/i18n/en.ts src/i18n/zh.ts
git commit -m "feat: add en/zh translation dictionaries"
```

---

### Task 3: Create useT() hook

**Files:**
- Create: `src/i18n/useT.ts`

**Step 1: Create the hook**

```ts
// src/i18n/useT.ts
import { useLocaleStore } from "../stores/localeStore";
import { en } from "./en";
import { zh } from "./zh";

const dictionaries = { en, zh } as const;

export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return dictionaries[locale];
}
```

> Note: `t` is the dictionary object itself — call string values directly (`t.cancel`)
> and call function values as functions (`t.file_count(3)`). No `t("key")` string
> lookup needed; TypeScript gives full autocomplete on the object.

**Step 2: Type-check**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/i18n/useT.ts
git commit -m "feat: add useT hook for i18n string lookup"
```

---

### Task 4: Create SettingsModal component

**Files:**
- Create: `src/components/SettingsModal.tsx`

**Step 1: Create the component**

```tsx
// src/components/SettingsModal.tsx
import { useLocaleStore } from "../stores/localeStore";
import { useThemeStore } from "../stores/themeStore";
import { useT } from "../i18n/useT";

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const { locale, setLocale } = useLocaleStore();
  const { theme, toggleTheme } = useThemeStore();
  const t = useT();

  const toggleBtn =
    "px-3 py-1.5 rounded-md text-[13px] transition-colors duration-150";
  const activeBtn = `${toggleBtn} bg-[var(--border)] text-[var(--text-primary)]`;
  const inactiveBtn = `${toggleBtn} text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 max-w-xs w-full mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-medium text-[var(--text-primary)]">
            {t.settings}
          </h2>
          <button
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-150 p-0.5"
            onClick={onClose}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Language row */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] text-[var(--text-secondary)]">
            {t.language}
          </span>
          <div className="flex gap-1">
            <button
              className={locale === "zh" ? activeBtn : inactiveBtn}
              onClick={() => setLocale("zh")}
            >
              中文
            </button>
            <button
              className={locale === "en" ? activeBtn : inactiveBtn}
              onClick={() => setLocale("en")}
            >
              English
            </button>
          </div>
        </div>

        {/* Theme row */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[var(--text-secondary)]">
            {t.theme}
          </span>
          <div className="flex gap-1">
            <button
              className={theme === "dark" ? activeBtn : inactiveBtn}
              onClick={() => theme !== "dark" && toggleTheme()}
            >
              ☾ Dark
            </button>
            <button
              className={theme === "light" ? activeBtn : inactiveBtn}
              onClick={() => theme !== "light" && toggleTheme()}
            >
              ☀ Light
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Type-check**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/SettingsModal.tsx
git commit -m "feat: add SettingsModal with language and theme toggles"
```

---

### Task 5: Update Toolbar

**Files:**
- Modify: `src/toolbar/Toolbar.tsx`

**Step 1: Replace Toolbar content**

Remove the theme toggle button. Add a gear icon button that opens `SettingsModal`.
Add `useT()` for Reset and Fit labels. Import `useState` for modal visibility.

Replace the entire file content with:

```tsx
import { useCallback, useState } from "react";
import { useCanvasStore } from "../stores/canvasStore";
import { useProjectStore } from "../stores/projectStore";
import { SettingsModal } from "../components/SettingsModal";
import { useT } from "../i18n/useT";

const noDrag = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

const btn =
  "px-2 py-1 rounded-md text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors duration-150 active:scale-[0.97]";

export function Toolbar() {
  const { viewport, setViewport, resetViewport } = useCanvasStore();
  const { projects } = useProjectStore();
  const t = useT();
  const [showSettings, setShowSettings] = useState(false);

  const handleFitAll = useCallback(() => {
    if (projects.length === 0) return;
    const padding = 80;
    const toolbarH = 44;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of projects) {
      minX = Math.min(minX, p.position.x);
      minY = Math.min(minY, p.position.y);
      maxX = Math.max(maxX, p.position.x + (p.size.w || 620));
      maxY = Math.max(maxY, p.position.y + (p.size.h || 400));
    }
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const viewW = window.innerWidth - padding * 2;
    const viewH = window.innerHeight - toolbarH - padding * 2;
    const scale = Math.min(1, viewW / contentW, viewH / contentH);
    setViewport({
      x: -minX * scale + padding,
      y: -minY * scale + padding + toolbarH,
      scale,
    });
  }, [projects, setViewport]);

  const zoomPercent = Math.round(viewport.scale * 100);

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 h-11 flex items-center pr-4 gap-3 z-50 bg-[var(--bg)] border-b border-[var(--border)]"
        style={
          { paddingLeft: 80, WebkitAppRegion: "drag" } as React.CSSProperties
        }
      >
        {/* Branding */}
        <span
          className="text-[13px] font-medium text-[var(--text-primary)] tracking-tight"
          style={noDrag}
        >
          TermCanvas
        </span>

        <div className="flex-1" />

        {/* Settings button */}
        <button
          className={btn}
          style={noDrag}
          onClick={() => setShowSettings(true)}
          title={t.settings}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5" style={noDrag}>
          <button
            className={btn}
            onClick={() =>
              setViewport({ scale: Math.max(0.1, viewport.scale * 0.9) })
            }
          >
            −
          </button>
          <span
            className="text-[11px] text-[var(--text-secondary)] w-10 text-center tabular-nums"
            style={{ fontFamily: '"Geist Mono", monospace' }}
          >
            {zoomPercent}%
          </span>
          <button
            className={btn}
            onClick={() =>
              setViewport({ scale: Math.min(2, viewport.scale * 1.1) })
            }
          >
            +
          </button>
          <button className={btn} onClick={resetViewport}>
            {t.reset}
          </button>
          <button className={btn} onClick={handleFitAll}>
            {t.fit}
          </button>
        </div>
      </div>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </>
  );
}
```

**Step 2: Type-check**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/toolbar/Toolbar.tsx
git commit -m "feat: add settings button to Toolbar, move theme toggle to SettingsModal"
```

---

### Task 6: Update App.tsx (CloseDialog)

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add `useT` to CloseDialog**

In `CloseDialog`, add `const t = useT();` and replace hardcoded strings.

Import `useT` at top of file:
```ts
import { useT } from "./i18n/useT";
```

Replace the `CloseDialog` function:

```tsx
function CloseDialog({
  onSave,
  onDiscard,
  onCancel,
}: {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 max-w-sm w-full mx-4">
        <h2 className="text-[15px] font-medium text-[var(--text-primary)] mb-2">
          {t.save_workspace_title}
        </h2>
        <p className="text-[13px] text-[var(--text-secondary)] mb-6">
          {t.save_workspace_desc}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            className="px-3 py-1.5 rounded-md text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors duration-150"
            onClick={onCancel}
          >
            {t.cancel}
          </button>
          <button
            className="px-3 py-1.5 rounded-md text-[13px] text-[#ee0000] hover:bg-[#220000] transition-colors duration-150"
            onClick={onDiscard}
          >
            {t.dont_save}
          </button>
          <button
            className="px-3 py-1.5 rounded-md text-[13px] text-[var(--text-primary)] bg-[#0070f3] hover:bg-[#005cc5] transition-colors duration-150"
            onClick={onSave}
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Type-check**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: i18n CloseDialog strings in App.tsx"
```

---

### Task 7: Update Sidebar.tsx

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Step 1: Add `useT` import and replace all hardcoded strings**

Add import:
```ts
import { useT } from "../i18n/useT";
```

Inside `Sidebar()`, add:
```ts
const t = useT();
```

Replace the `STATUS_LABEL` record with a computed object using `t`:
```ts
const STATUS_LABEL: Record<TerminalStatus, string> = {
  running: t.status_running,
  success: t.status_done,
  error: t.status_error,
  idle: t.status_idle,
};
```

Replace notification calls in `handleAddProject`:
```ts
notify("error", t.error_dir_picker(err));
// ...
notify("warn", t.error_not_git(dirPath));
// ...
notify("info", t.info_added_project(info.name, info.worktrees.length));
```

Replace JSX strings:
- `"Projects"` → `{t.projects}`
- `"+ Add"` → `{t.add}`
- `"Open"` → `{t.open}`
- `"No projects"` → `{t.no_projects}`

**Step 2: Type-check**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: i18n Sidebar strings"
```

---

### Task 8: Update WorktreeContainer.tsx

**Files:**
- Modify: `src/containers/WorktreeContainer.tsx`

**Step 1: Add `useT` and replace strings**

Add import:
```ts
import { useT } from "../i18n/useT";
```

Inside `WorktreeContainer()`, add:
```ts
const t = useT();
```

Replace:
- `title="New terminal"` → `title={t.new_terminal}`
- `"+ New Terminal"` → `{t.new_terminal_btn}`

**Step 2: Type-check**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/containers/WorktreeContainer.tsx
git commit -m "feat: i18n WorktreeContainer strings"
```

---

### Task 9: Update ProjectContainer.tsx

**Files:**
- Modify: `src/containers/ProjectContainer.tsx`

**Step 1: Add `useT` and replace strings**

Add import:
```ts
import { useT } from "../i18n/useT";
```

Inside `ProjectContainer()`, add:
```ts
const t = useT();
```

Replace:
- `"Project"` → `{t.project_label}`

**Step 2: Type-check**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/containers/ProjectContainer.tsx
git commit -m "feat: i18n ProjectContainer strings"
```

---

### Task 10: Update DiffCard.tsx

**Files:**
- Modify: `src/components/DiffCard.tsx`

**Step 1: Add `useT` and replace strings**

Add import:
```ts
import { useT } from "../i18n/useT";
```

Inside `DiffCard()`, add:
```ts
const t = useT();
```

Replace all hardcoded UI strings:
- Header label `"Diff"` → `{t.diff}`
- `` `${fileDiffs.length} file${fileDiffs.length !== 1 ? "s" : ""}` `` → `{t.file_count(fileDiffs.length)}`
- `"Loading..."` → `{t.loading}`
- `"No changes"` → `{t.no_changes}`
- `"binary"` → `{t.binary_label}`
- `"Removed"` → `{t.removed}`
- The `"New"` / `"Added"` span (imageNew label):
  - `fd.file.imageOld ? "New" : "Added"` → `fd.file.imageOld ? t.file_new : t.added`
- `"Image file changed"` → `{t.image_changed}`
- `"Binary file changed"` → `{t.binary_changed}`

**Step 2: Type-check**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/DiffCard.tsx
git commit -m "feat: i18n DiffCard strings"
```

---

### Task 11: Update TerminalTile.tsx

**Files:**
- Modify: `src/terminal/TerminalTile.tsx`

**Step 1: Add `useT` and replace strings**

Add import:
```ts
import { useT } from "../i18n/useT";
```

Inside `TerminalTile()`, add:
```ts
const t = useT();
```

Replace:
```ts
// "Terminal API not available. Not running in Electron."
notify("error", t.terminal_api_unavailable);

// failed_create_pty
notify("error", t.failed_create_pty(terminal.title, err));

// process_exited (inside xterm.write call)
xterm.write(t.process_exited(exitCode));

// terminal_exited
notify(
  exitCode === 0 ? "info" : "warn",
  t.terminal_exited(terminal.title, exitCode),
);
```

> **Important:** `useT()` must be called at the component level (top of `TerminalTile`),
> not inside the `useEffect`. The `t` reference is captured in the effect closure.
> Since locale changes cause a full re-render (and the effect re-runs on `terminal.id`
> change), this is fine for the error/exit strings. The `terminal_api_unavailable`
> string is already in the effect so it uses the captured `t` at mount time — acceptable
> because locale rarely changes mid-session.

**Step 2: Type-check**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/terminal/TerminalTile.tsx
git commit -m "feat: i18n TerminalTile error/exit strings"
```

---

### Task 12: Update DrawingPanel.tsx

**Files:**
- Modify: `src/toolbar/DrawingPanel.tsx`

**Step 1: Add `useT` and replace strings**

Add import:
```ts
import { useT } from "../i18n/useT";
```

Inside `DrawingPanel()`, add:
```ts
const t = useT();
```

Replace the `tools` array (it must move inside the component to use `t`):

```ts
const tools: { id: DrawingTool; label: string; icon: string }[] = [
  { id: "select", label: t.tool_select, icon: "↖" },
  { id: "pen",    label: t.tool_pen,    icon: "✎" },
  { id: "text",   label: t.tool_text,   icon: "T" },
  { id: "rect",   label: t.tool_rect,   icon: "□" },
  { id: "arrow",  label: t.tool_arrow,  icon: "→" },
];
```

Replace layout toggle title:
- `vertical ? "Horizontal layout" : "Vertical layout"` →
  `vertical ? t.layout_horizontal : t.layout_vertical`

**Step 2: Type-check**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/toolbar/DrawingPanel.tsx
git commit -m "feat: i18n DrawingPanel tool labels and layout toggle"
```

---

### Task 13: Final verification

**Step 1: Full type-check**

Run: `npm run typecheck`
Expected: Zero errors.

**Step 2: Start dev server and verify visually**

Run: `npm run dev`

Manual checks:
- [ ] Open Settings modal (gear icon in Toolbar)
- [ ] Switch to 中文 → all visible UI strings change to Chinese
- [ ] Switch to English → all strings revert
- [ ] Close and reopen app → locale is remembered (localStorage)
- [ ] Theme toggle (Dark/Light) works in Settings modal
- [ ] Theme toggle no longer appears in Toolbar
- [ ] CloseDialog shows correct language when quitting
- [ ] Sidebar labels, status badges, notifications in correct language
- [ ] DiffCard labels in correct language
- [ ] DrawingPanel tool labels in correct language

**Step 3: Commit docs**

```bash
git add docs/plans/
git commit -m "docs: add i18n design and implementation plan"
```
