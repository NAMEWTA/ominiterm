# Welcome Popup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a first-time welcome popup styled as a simulated terminal tile, shown once on first launch.

**Architecture:** A standalone `WelcomePopup` component rendered in `App.tsx`, gated by a localStorage flag. It replicates the TerminalTile visual chrome (title bar with badge, Geist Mono font, dark bg) but renders static HTML content instead of xterm. Shortcuts are read from `shortcutStore` to stay in sync with user config.

**Tech Stack:** React, Tailwind CSS, Zustand (shortcutStore), i18n (useT)

---

### Task 1: Add i18n strings

**Files:**
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/zh.ts`

**Step 1: Add English translations**

Add before the closing `} as const;` in `src/i18n/en.ts`:

```typescript
  // Welcome popup
  welcome_title: "termcanvas",
  welcome_heading: "Welcome to TermCanvas!",
  welcome_desc: "Manage terminals on an infinite canvas.",
  welcome_quick_start: "Quick Start:",
  welcome_step_1: "Click \"Add Project\" to add a project",
  welcome_step_2: "Open terminals in your worktrees",
  welcome_step_3: "Pan & zoom the canvas freely",
  welcome_shortcuts: "Key Shortcuts:",
  welcome_github: "GitHub:",
  welcome_dismiss: "Press Enter or click anywhere to start.",
```

**Step 2: Add Chinese translations**

Add before the closing `} as const;` in `src/i18n/zh.ts`:

```typescript
  // Welcome popup
  welcome_title: "termcanvas",
  welcome_heading: "欢迎使用 TermCanvas！",
  welcome_desc: "在无限画布上管理终端。",
  welcome_quick_start: "快速开始：",
  welcome_step_1: "点击「Add Project」添加项目",
  welcome_step_2: "在工作树中打开终端",
  welcome_step_3: "自由平移和缩放画布",
  welcome_shortcuts: "快捷键：",
  welcome_github: "GitHub:",
  welcome_dismiss: "按 Enter 或点击任意位置开始。",
```

**Step 3: Commit**

```bash
git add src/i18n/en.ts src/i18n/zh.ts
git commit -m "feat(welcome): add i18n strings for welcome popup"
```

---

### Task 2: Create WelcomePopup component

**Files:**
- Create: `src/components/WelcomePopup.tsx`

**Step 1: Create the component**

```tsx
import { useEffect, useRef } from "react";
import { useT } from "../i18n/useT";
import { useShortcutStore, formatShortcut } from "../stores/shortcutStore";

const platform = window.termcanvas?.app.platform ?? "darwin";

interface Props {
  onClose: () => void;
}

export function WelcomePopup({ onClose }: Props) {
  const t = useT();
  const shortcuts = useShortcutStore((s) => s.shortcuts);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const shortcutItems = [
    { key: shortcuts.addProject, desc: t.shortcut_add_project },
    { key: shortcuts.newTerminal, desc: t.shortcut_new_terminal },
    { key: shortcuts.toggleSidebar, desc: t.shortcut_toggle_sidebar },
    { key: shortcuts.clearFocus, desc: t.shortcut_clear_focus },
  ];

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div
        className="rounded-md bg-[var(--bg)] overflow-hidden flex flex-col border border-[var(--border)] w-[480px] mx-4 shadow-2xl"
        style={{ fontFamily: '"Geist Mono", monospace' }}
      >
        {/* Title bar — matches TerminalTile chrome */}
        <div className="flex items-center gap-2 px-3 py-2 select-none shrink-0">
          <div className="w-[3px] h-3 rounded-full bg-amber-500/60 shrink-0" />
          <span
            className="text-[11px] font-medium"
            style={{ color: "#50e3c2" }}
          >
            welcome
          </span>
          <span className="text-[11px] text-[var(--text-muted)] truncate flex-1">
            {t.welcome_title}
          </span>
          <button
            className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors duration-150 p-1 rounded-md hover:bg-[var(--border)]"
            onClick={onClose}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M2 2L8 8M8 2L2 8"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Terminal-style content */}
        <div className="px-4 pb-5 pt-1 text-[13px] text-[var(--text-primary)] leading-relaxed">
          <div className="text-[var(--text-muted)] mb-3">
            $ cat welcome.txt
          </div>

          {/* Product intro */}
          <div className="mb-4">
            <div className="font-medium">{t.welcome_heading}</div>
            <div className="text-[var(--text-secondary)]">
              {t.welcome_desc}
            </div>
          </div>

          {/* Quick start */}
          <div className="mb-4">
            <div className="text-[var(--cyan)] mb-1">{t.welcome_quick_start}</div>
            <div className="text-[var(--text-secondary)] space-y-0.5 pl-2">
              <div>1. {t.welcome_step_1}</div>
              <div>2. {t.welcome_step_2}</div>
              <div>3. {t.welcome_step_3}</div>
            </div>
          </div>

          {/* Shortcuts */}
          <div className="mb-4">
            <div className="text-[var(--cyan)] mb-1">{t.welcome_shortcuts}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pl-2">
              {shortcutItems.map((item) => (
                <div key={item.key} className="flex gap-2">
                  <span className="text-[var(--accent)] shrink-0">
                    {formatShortcut(item.key, platform)}
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {item.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* GitHub link */}
          <div className="mb-4 text-[var(--text-secondary)]">
            {t.welcome_github}{" "}
            <span className="text-[var(--accent)]">
              github.com/blueberrycongee/termcanvas
            </span>
          </div>

          {/* Dismiss hint */}
          <div className="text-[var(--text-muted)] text-[12px]">
            {t.welcome_dismiss}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/WelcomePopup.tsx
git commit -m "feat(welcome): add WelcomePopup component"
```

---

### Task 3: Mount WelcomePopup in App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add import and state**

Add import at the top of `App.tsx` with the other component imports:

```typescript
import { WelcomePopup } from "./components/WelcomePopup";
```

**Step 2: Add welcome state to App component**

Inside `export function App()`, after the existing hooks and before the `return`, add:

```typescript
  const [showWelcome, setShowWelcome] = useState(() => {
    return !localStorage.getItem("termcanvas-welcome-seen");
  });
```

**Step 3: Add WelcomePopup to the JSX**

Inside the return div, after `{showCloseDialog && <CloseDialog ... />}`, add:

```tsx
      {showWelcome && (
        <WelcomePopup
          onClose={() => {
            localStorage.setItem("termcanvas-welcome-seen", "1");
            setShowWelcome(false);
          }}
        />
      )}
```

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(welcome): mount WelcomePopup on first launch"
```

---

### Task 4: Manual test and verify

**Step 1: Clear localStorage flag to simulate first run**

Open the app, open DevTools console, run:
```javascript
localStorage.removeItem("termcanvas-welcome-seen");
location.reload();
```

**Step 2: Verify popup appears**

- Welcome popup should appear centered with terminal-tile styling
- Title bar shows amber dot, cyan "welcome" badge, "termcanvas" title, ✕ button
- Content shows all 4 sections (intro, quick start, shortcuts, GitHub)
- Shortcuts should reflect actual user configuration

**Step 3: Verify dismiss behavior**

- Pressing Enter closes the popup
- Pressing ESC closes the popup
- Clicking backdrop closes the popup
- Clicking ✕ closes the popup
- After closing, reload the page — popup should NOT appear again

**Step 4: Verify i18n**

- Switch language to Chinese in settings, clear the flag, reload — popup should show in Chinese

**Step 5: Verify light theme**

- Switch to light theme — colors should adapt via CSS variables
