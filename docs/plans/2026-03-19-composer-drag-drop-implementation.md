# Composer Drag & Drop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add drag-and-drop file support to the Composer bar — images go through the existing attachment pipeline, non-image files insert their absolute path into the draft text.

**Architecture:** Drop zone is the Composer outer `div.rounded-xl` container. A `isDragOver` state controls a visual highlight. The drop handler splits files into images (reuse `addImages`) and non-images (insert paths into draft). Electron's `File.path` provides absolute paths.

**Tech Stack:** React, Zustand, Electron (renderer), Tailwind CSS

---

### Task 1: Add i18n keys for drop hint

**Files:**
- Modify: `src/i18n/en.ts` (~line 147)
- Modify: `src/i18n/zh.ts` (~line 145)

**Step 1: Add English translation**

In `src/i18n/en.ts`, after `composer_note_text_only`, add:

```ts
  composer_drop_hint: "Drop files here",
```

**Step 2: Add Chinese translation**

In `src/i18n/zh.ts`, after `composer_note_text_only`, add:

```ts
  composer_drop_hint: "拖放文件到此处",
```

**Step 3: Commit**

```bash
git add src/i18n/en.ts src/i18n/zh.ts
git commit -m "feat(composer): add i18n keys for drag-and-drop hint"
```

---

### Task 2: Add drag-and-drop handling to ComposerBar

**Files:**
- Modify: `src/components/ComposerBar.tsx`

**Step 1: Add `isDragOver` state**

At the top of the `ComposerBar` component (after the existing state declarations around line 150), add:

```ts
const [isDragOver, setIsDragOver] = useState(false);
const dragCounterRef = useRef(0);
```

`dragCounterRef` tracks enter/leave balance to handle nested elements correctly (dragenter fires on children too).

**Step 2: Add the drop handler function**

After `handleImagePaste` (around line 279), add a `handleDrop` callback:

```ts
const handleDrop = useCallback(
  async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;

    const imageFiles: File[] = [];
    const nonImagePaths: string[] = [];

    for (const file of files) {
      if (file.type.startsWith("image/")) {
        imageFiles.push(file);
      } else {
        // Electron enriches dropped File objects with an absolute `path` property
        const filePath = (file as File & { path?: string }).path;
        if (filePath) {
          nonImagePaths.push(filePath);
        }
      }
    }

    // Handle images — reuse the same validation as clipboard paste
    if (imageFiles.length > 0) {
      if (!targetTerminal || !targetAdapter) {
        const message = t.composer_missing_target;
        setError(message);
        notify("warn", message);
        return;
      }
      if (!targetAdapter.supportsImages) {
        const message = t.composer_images_unsupported(targetTerminal.title);
        setError(message);
        notify("warn", message);
        return;
      }
      try {
        const droppedImages = await Promise.all(
          imageFiles.map(async (file, index) => ({
            id: `img-${Date.now()}-${index}`,
            name: file.name || `dropped-image-${index + 1}.png`,
            dataUrl: await fileToDataUrl(file),
          })),
        );
        addImages(droppedImages);
      } catch (dropError) {
        const detail =
          dropError instanceof Error ? dropError.message : String(dropError);
        const message = t.composer_image_read_failed(
          targetTerminal.title,
          `${detail} [image-read-failed]`,
        );
        setError(message);
        notify("error", message);
        return;
      }
    }

    // Handle non-image files — insert paths into draft
    if (nonImagePaths.length > 0) {
      const pathText = nonImagePaths.join(" ");
      const textarea = textareaRef.current;
      if (textarea) {
        const { selectionStart, selectionEnd } = textarea;
        const currentDraft = useComposerStore.getState().draft;
        const before = currentDraft.slice(0, selectionStart);
        const after = currentDraft.slice(selectionEnd);
        const needsLeadingSpace = before.length > 0 && !before.endsWith(" ") && !before.endsWith("\n");
        const insertion = (needsLeadingSpace ? " " : "") + pathText;
        setDraft(before + insertion + after);
      } else {
        const currentDraft = useComposerStore.getState().draft;
        const needsSpace = currentDraft.length > 0 && !currentDraft.endsWith(" ") && !currentDraft.endsWith("\n");
        setDraft(currentDraft + (needsSpace ? " " : "") + pathText);
      }
    }
  },
  [addImages, notify, setDraft, setError, t, targetAdapter, targetTerminal],
);
```

**Step 3: Add drag event handlers on the outer div**

Replace the outer container div (line ~394):

```tsx
{/* Before */}
<div className="pointer-events-auto w-full max-w-4xl rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_48px_rgba(0,0,0,0.24)]">

{/* After */}
<div
  className={`pointer-events-auto w-full max-w-4xl rounded-xl border bg-[var(--surface)] shadow-[0_18px_48px_rgba(0,0,0,0.24)] transition-colors duration-150 ${
    isDragOver
      ? "border-[var(--accent)] bg-[var(--accent)]/5"
      : "border-[var(--border)]"
  }`}
  onDragEnter={(e) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragOver(true);
  }}
  onDragOver={(e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }}
  onDragLeave={(e) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  }}
  onDrop={handleDrop}
>
```

**Step 4: Add drop hint overlay**

Inside the outer div, after the header section and before the image attachments section, add:

```tsx
{isDragOver && (
  <div className="flex items-center justify-center py-3 text-[12px] font-medium text-[var(--accent)]">
    {t.composer_drop_hint}
  </div>
)}
```

**Step 5: Build and verify**

Run: `npm run build` (or the project's build command)
Expected: No TypeScript errors

**Step 6: Commit**

```bash
git add src/components/ComposerBar.tsx
git commit -m "feat(composer): add drag-and-drop support for files and images"
```
