# True-Fidelity Canvas Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the document editor into a WYSIWYG canvas experience with floating bubble menu, client-side Mustache rendering, and Jony Ive-inspired visual language.

**Architecture:** Keep TinyMCE with `toolbar: false`, build a custom React `<BubbleMenu>` positioned via iframe selection rect translation. Replace server-side preview debounce with client-side Mustache template rendering for instant (<5ms) form-to-document binding. Move all banners/chrome from right panel to left panel.

**Tech Stack:** React 19, TypeScript, TinyMCE (Community), Mustache.js, Tailwind CSS 4, shadcn/ui

**Design Doc:** `docs/plans/2026-02-20-true-fidelity-canvas-design.md`

---

## Phase 1: Visual Foundation (CSS-only, zero risk)

Purely additive CSS — no component changes, no breakage possible.

### Task 1.1: Add Canvas Design Tokens to index.css

**Files:**
- Modify: `frontend/src/index.css:59-71` (shadow variables section)

**Step 1: Add new CSS custom properties**

After the existing `--shadow-up-subtle` (line 71), add:

```css
/* True-Fidelity Canvas tokens */
--canvas-desk: #F5F5F7;
--canvas-paper: #FFFFFF;
--canvas-text: #1D1D1F;
--canvas-text-secondary: #86868B;
--canvas-input-fill: #F5F5F7;
--canvas-focus-ring: rgba(36, 49, 134, 0.08);
--shadow-canvas-paper:
  0 0 0 1px rgba(0, 0, 0, 0.03),
  0 1px 3px rgba(0, 0, 0, 0.04),
  0 8px 24px rgba(0, 0, 0, 0.06),
  0 24px 48px rgba(0, 0, 0, 0.04);
```

Also add dark-mode equivalents inside the `.dark` block (after line ~110):

```css
--canvas-desk: hsl(225 14% 12%);
--canvas-paper: hsl(225 14% 14%);
--canvas-text: hsl(220 10% 90%);
--canvas-text-secondary: hsl(220 8% 55%);
--canvas-input-fill: hsl(225 14% 18%);
--canvas-focus-ring: rgba(120, 140, 230, 0.12);
--shadow-canvas-paper:
  0 0 0 1px rgba(255, 255, 255, 0.06),
  0 1px 3px rgba(0, 0, 0, 0.2),
  0 8px 24px rgba(0, 0, 0, 0.3),
  0 24px 48px rgba(0, 0, 0, 0.2);
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS (purely additive, no conflicts)

**Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(canvas): add True-Fidelity Canvas CSS design tokens"
```

---

### Task 1.2: Add .canvas-input Class

**Files:**
- Modify: `frontend/src/index.css` (after `.ive-input` block, ~line 478)

**Step 1: Add the new input class**

After the existing `.ive-input::placeholder` block (line 478), add:

```css
/* ── True-Fidelity Canvas: Filled Inputs ── */
.canvas-input {
  border: 1.5px solid transparent !important;
  border-radius: 8px !important;
  background: var(--canvas-input-fill) !important;
  padding: 10px 14px !important;
  color: var(--canvas-text) !important;
  font-size: 14px;
  transition: all 0.2s ease;
  width: 100%;
}
.canvas-input:focus,
.canvas-input:focus-visible {
  border-color: hsl(228 58% 33%) !important;
  background: var(--canvas-paper) !important;
  box-shadow: 0 0 0 3px var(--canvas-focus-ring) !important;
  outline: none !important;
}
.canvas-input::placeholder {
  color: var(--canvas-text-secondary);
}

/* Select trigger variant */
.canvas-select-trigger {
  border: 1.5px solid transparent !important;
  border-radius: 8px !important;
  background: var(--canvas-input-fill) !important;
  color: var(--canvas-text) !important;
  font-size: 14px;
  transition: all 0.2s ease;
}
.canvas-select-trigger:focus,
.canvas-select-trigger[data-state="open"] {
  border-color: hsl(228 58% 33%) !important;
  background: var(--canvas-paper) !important;
  box-shadow: 0 0 0 3px var(--canvas-focus-ring) !important;
}
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(canvas): add .canvas-input filled input style"
```

---

### Task 1.3: Add .canvas-paper and .canvas-desk Classes

**Files:**
- Modify: `frontend/src/index.css` (after the new `.canvas-input` block)

**Step 1: Add paper and desk classes**

```css
/* ── True-Fidelity Canvas: Paper & Desk ── */
.canvas-desk {
  background: var(--canvas-desk);
}

.canvas-paper {
  width: 210mm;
  min-height: 297mm;
  padding: 25mm 20mm;
  background: var(--canvas-paper);
  border-radius: 4px;
  box-shadow: var(--shadow-canvas-paper);
  margin: 2rem auto;
  color: var(--canvas-text);
  font-family: Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.15;
}

/* Responsive: narrow screens */
@media (max-width: 900px) {
  .canvas-paper {
    max-width: 100%;
    padding: 15mm 12mm;
    margin: 1rem auto;
  }
}

/* Template placeholders for unfilled fields */
.template-placeholder {
  color: var(--canvas-text-secondary);
  background: var(--canvas-input-fill);
  border-radius: 3px;
  padding: 0 4px;
  font-style: italic;
  display: inline;
}

/* Logo skeleton when company logo not uploaded */
.logo-skeleton {
  width: 120px;
  height: 48px;
  background: linear-gradient(135deg, #F5F5F7 0%, #EBEBED 100%);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dark .logo-skeleton {
  background: linear-gradient(135deg, hsl(225 14% 18%) 0%, hsl(225 14% 22%) 100%);
}
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(canvas): add .canvas-paper, .canvas-desk, .template-placeholder classes"
```

---

### Task 1.4: Add .bubble-menu Styles

**Files:**
- Modify: `frontend/src/index.css` (after canvas-paper block)

**Step 1: Add bubble menu styles**

```css
/* ── True-Fidelity Canvas: Floating Bubble Menu ── */
.bubble-menu {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px) saturate(1.8);
  -webkit-backdrop-filter: blur(20px) saturate(1.8);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 4px 6px;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.08),
    0 12px 32px rgba(0, 0, 0, 0.06);
  animation: bubble-appear 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: fixed;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 2px;
}
.dark .bubble-menu {
  background: rgba(30, 33, 48, 0.92);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.2),
    0 12px 32px rgba(0, 0, 0, 0.15);
}

@keyframes bubble-appear {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.bubble-tool {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--canvas-text);
  cursor: pointer;
  transition: background 0.15s ease;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
}
.bubble-tool:hover {
  background: rgba(0, 0, 0, 0.06);
}
.dark .bubble-tool:hover {
  background: rgba(255, 255, 255, 0.08);
}
.bubble-tool.active {
  background: rgba(36, 49, 134, 0.1);
  color: hsl(228 58% 33%);
}
.dark .bubble-tool.active {
  background: rgba(120, 140, 230, 0.15);
  color: hsl(228 70% 70%);
}

.bubble-separator {
  width: 1px;
  height: 20px;
  background: rgba(0, 0, 0, 0.1);
  margin: 0 2px;
  flex-shrink: 0;
}
.dark .bubble-separator {
  background: rgba(255, 255, 255, 0.1);
}
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(canvas): add .bubble-menu glassmorphism styles"
```

---

### Task 1.5: Add Canvas Tokens to Tailwind Config

**Files:**
- Modify: `frontend/tailwind.config.js:82-98` (boxShadow section)

**Step 1: Add canvas shadow to Tailwind**

Inside the `boxShadow` object (after `'elevated-hover'` at ~line 97), add:

```js
'canvas-paper': 'var(--shadow-canvas-paper)',
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add frontend/tailwind.config.js
git commit -m "feat(canvas): add canvas-paper shadow to Tailwind config"
```

---

## Phase 2: Paper Canvas (Right Panel)

Transform the right panel from toolbar+banners+editor into pure desk+paper.

### Task 2.1: Change Desk Background Color

**Files:**
- Modify: `frontend/src/components/generator/SplitScreenEditor.tsx:165` (right panel div)

**Step 1: Replace background class**

At line 165, change the right panel container's class from:
```
bg-[hsl(220_10%_93%)] dark:bg-[hsl(225_14%_16%)]
```
to:
```
canvas-desk
```

The `canvas-desk` class uses the `--canvas-desk` CSS variable which handles both light and dark mode.

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Verify visually**

Run: `cd frontend && npm run dev`
Navigate to the document editor. The right panel background should be warm `#F5F5F7` instead of cool gray.

**Step 4: Commit**

```bash
git add frontend/src/components/generator/SplitScreenEditor.tsx
git commit -m "feat(canvas): warm desk background #F5F5F7 for right panel"
```

---

### Task 2.2: Remove Toolbar Bar from Right Panel

**Files:**
- Modify: `frontend/src/components/generator/editor/RightEditorPanel.tsx:289-389` (toolbar section)

**Step 1: Remove the toolbar div**

The entire toolbar section (lines 289-389) renders:
- WorkflowStepper
- Local edits warning
- KI-Chat toggle
- Comment add popover
- Comment sidebar toggle

Delete lines 289-389 (the `<div className="flex items-center justify-between px-3 py-2 bg-card/80 ...">` and its entire contents).

**Important:** The comment sidebar toggle and KI-Chat toggle functionality need to remain accessible. These will be moved to the left panel in Phase 4. For now, add temporary small icon buttons at the top-right of the editor container using `position: absolute`:

```tsx
{/* Temporary floating controls — will move to left panel in Phase 4 */}
<div className="absolute top-3 right-3 z-10 flex items-center gap-1">
  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm shadow-sm"
    onClick={() => actions.setShowChatSidebar(!state.showChatSidebar)}>
    <Sparkles className="h-4 w-4" />
  </Button>
  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm shadow-sm"
    onClick={() => actions.setShowCommentSidebar(!state.showCommentSidebar)}>
    <MessagesSquare className="h-4 w-4" />
  </Button>
</div>
```

Add this right after the `<div className="flex-1 overflow-auto ...">` container opens.

**Step 2: Remove unused imports**

Remove `WorkflowStepper` import (line 30) if no longer used in this file.

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add frontend/src/components/generator/editor/RightEditorPanel.tsx
git commit -m "feat(canvas): remove static toolbar from right editor panel"
```

---

### Task 2.3: Move Banners to Left Panel

**Files:**
- Modify: `frontend/src/components/generator/editor/RightEditorPanel.tsx:401-525` (banner stack)
- Modify: `frontend/src/components/generator/panels/LeftControlPanel.tsx:134-140` (after ToneCards)

**Step 1: Remove banners from RightEditorPanel**

Remove the banner stack from RightEditorPanel (lines 401-525 area):
- `ComplianceRiskBanner` block
- `ConsistencyBanner` block
- `GapAnalysisCard` block
- `GhostwriterCard` block
- Post-export success banner
- Tone preview banner

Keep the A4 paper rendering section (lines 527-561) intact.

Remove corresponding imports that are no longer used in this file:
- `ComplianceRiskBanner` (line 31)
- `ConsistencyBanner` (line 32)
- `GapAnalysisCard` (line 33)
- `GhostwriterCard` (line 25)
- `useGhostwriterDraft` (line 28)

**Step 2: Add banners as collapsible cards in LeftControlPanel**

In `LeftControlPanel.tsx`, after the ToneCards section (line 140) and before the ScrollArea (line 142), add a new section:

```tsx
{/* AI Feature Cards */}
<div className="px-4 pb-2 space-y-2">
  <GhostwriterCard
    draftHtml={ghostwriter.draftHtml}
    isStreaming={ghostwriter.isStreaming}
    streamedText={ghostwriter.streamedText}
    isGenerating={ghostwriter.isGenerating}
    error={ghostwriter.error}
    onAccept={handleAcceptDraft}
    onDismiss={ghostwriter.dismiss}
    onRegenerate={ghostwriter.regenerate}
    className="text-sm"
  />
  <ConsistencyBanner
    employeeName={`${state.formData.vorname || ""} ${state.formData.nachname || ""}`.trim()}
    currentFormData={state.formData as unknown as Record<string, unknown>}
    countryCode={country}
    documentTypeId={state.documentTypeId ?? undefined}
    className="text-sm"
  />
  <ComplianceRiskBanner
    formData={state.formData}
    documentTypeId={state.documentTypeId}
    editorContent={state.editorContent}
    countryCode={country}
    className="text-sm"
  />
</div>
```

Add corresponding imports to LeftControlPanel.tsx:
```tsx
import { GhostwriterCard } from "../GhostwriterCard";
import { ConsistencyBanner } from "../ConsistencyBanner";
import { ComplianceRiskBanner } from "../ComplianceRiskBanner";
import { useGhostwriterDraft } from "@/hooks/useGhostwriterDraft";
import { useCountry } from "@/hooks/useCountry";
```

**Note:** The ghostwriter hook and its handlers will need to be lifted from RightEditorPanel to either LeftControlPanel or the shared WizardContext. If the hook is complex, consider adding the ghostwriter state to the WizardContext.

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS (may need to resolve import/prop threading)

**Step 4: Commit**

```bash
git add frontend/src/components/generator/editor/RightEditorPanel.tsx \
       frontend/src/components/generator/panels/LeftControlPanel.tsx
git commit -m "feat(canvas): move AI banners from right panel to left panel cards"
```

---

### Task 2.4: Apply Canvas Paper Shadow

**Files:**
- Modify: `frontend/src/components/generator/editor/RightEditorPanel.tsx:549-561` (bare paper wrapper)
- Modify: `frontend/src/components/editor/FullDocumentPreview.tsx:35-41` (paper wrapper)
- Modify: `frontend/src/components/generator/editor/StationeryCanvas.tsx:48` (paper wrapper)

**Step 1: Update bare paper wrapper in RightEditorPanel**

The fallback case (line ~549) currently renders:
```tsx
<div className="bg-white rounded-2xl shadow-[var(--shadow-elevated)]">
```

Change to:
```tsx
<div className="canvas-paper">
```

**Step 2: Update FullDocumentPreview paper wrapper**

At line 37, change:
```tsx
"mx-auto bg-white dark:bg-card rounded-2xl shadow-[var(--shadow-elevated)] overflow-hidden"
```
to:
```tsx
"mx-auto bg-[var(--canvas-paper)] rounded shadow-[var(--shadow-canvas-paper)] overflow-hidden"
```

**Step 3: Update StationeryCanvas paper wrapper**

At line 48, change:
```tsx
"bg-white rounded shadow-[0_2px_10px_rgba(0,0,0,0.15)]"
```
to:
```tsx
"bg-[var(--canvas-paper)] rounded shadow-[var(--shadow-canvas-paper)]"
```

**Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add frontend/src/components/generator/editor/RightEditorPanel.tsx \
       frontend/src/components/editor/FullDocumentPreview.tsx \
       frontend/src/components/generator/editor/StationeryCanvas.tsx
git commit -m "feat(canvas): apply 4-layer Ive paper shadow to all editor wrappers"
```

---

### Task 2.5: Hide TinyMCE Toolbar

**Files:**
- Modify: `frontend/src/components/editor/DocumentEditor.tsx:209-211` (toolbar config)

**Step 1: Set toolbar to false**

At lines 209-211, the current toolbar config is:
```typescript
toolbar: compact ? COMPACT_TOOLBAR : FULL_TOOLBAR,
toolbar_mode: "sliding",
```

Change to:
```typescript
toolbar: false,
menubar: false,
```

The `menubar` is already `false` at line 185, but explicitly setting it again near `toolbar` makes the intent clear.

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Verify visually**

Run: `cd frontend && npm run dev`
The document should render without any TinyMCE toolbar. Text is editable but formatting requires the bubble menu (Phase 3).

**Step 4: Commit**

```bash
git add frontend/src/components/editor/DocumentEditor.tsx
git commit -m "feat(canvas): hide TinyMCE toolbar for clean paper illusion"
```

---

### Task 2.6: Add Logo Skeleton Placeholder

**Files:**
- Modify: `frontend/src/components/editor/FullDocumentPreview.tsx:50-60` (logo rendering)

**Step 1: Add skeleton fallback when logo URL is missing**

Currently the logo only renders when `zones.logoUrl` is truthy (line 50). Add an else branch:

```tsx
{zones.logoUrl ? (
  <img
    src={zones.logoUrl}
    alt="Firmenlogo"
    className="object-contain"
    style={{
      width: `${zones.logoWidthCm || "5"}cm`,
      maxHeight: "2.5cm",
    }}
  />
) : (
  <div className="logo-skeleton" aria-label="Logo-Platzhalter">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
         className="text-muted-foreground/30">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  </div>
)}
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add frontend/src/components/editor/FullDocumentPreview.tsx
git commit -m "feat(canvas): add logo skeleton placeholder for missing company logos"
```

---

## Phase 3: Bubble Menu

Build the floating formatting bubble that appears on text selection.

### Task 3.1: Create BubbleMenu Component

**Files:**
- Create: `frontend/src/components/generator/editor/BubbleMenu.tsx`

**Step 1: Create the component**

```tsx
import { useState, useCallback, useEffect, useRef } from "react";
import {
  Bold, Italic, Underline, Heading1, Heading2,
  List, ListOrdered, Link, Sparkles,
} from "lucide-react";
import type { Editor as TinyMCEEditor } from "tinymce";

interface BubbleMenuProps {
  editorRef: React.MutableRefObject<TinyMCEEditor | null>;
  onAIClick: () => void;
}

interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  h1: boolean;
  h2: boolean;
  ul: boolean;
  ol: boolean;
}

export function BubbleMenu({ editorRef, onAIClick }: BubbleMenuProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [formatState, setFormatState] = useState<FormatState>({
    bold: false, italic: false, underline: false,
    h1: false, h2: false, ul: false, ol: false,
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const updatePosition = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = editor.selection;
    if (!selection || selection.isCollapsed()) {
      setPosition(null);
      return;
    }

    const selectedText = selection.getContent({ format: "text" });
    if (!selectedText || selectedText.trim().length === 0) {
      setPosition(null);
      return;
    }

    const rng = selection.getRng();
    const rect = rng.getBoundingClientRect();
    const iframe = editor.iframeElement;
    if (!iframe) return;

    const iframeRect = iframe.getBoundingClientRect();

    // Position bubble 8px above selection, centered horizontally
    const top = iframeRect.top + rect.top - 8;
    const left = iframeRect.left + rect.left + rect.width / 2;

    // Clamp to viewport
    const menuWidth = 340; // approximate
    const clampedLeft = Math.max(menuWidth / 2 + 8, Math.min(left, window.innerWidth - menuWidth / 2 - 8));
    const clampedTop = Math.max(48, top);

    setPosition({ top: clampedTop, left: clampedLeft });

    // Update format state
    setFormatState({
      bold: editor.formatter.match("bold"),
      italic: editor.formatter.match("italic"),
      underline: editor.formatter.match("underline"),
      h1: editor.formatter.match("h1"),
      h2: editor.formatter.match("h2"),
      ul: !!editor.dom.getParent(selection.getNode(), "ul"),
      ol: !!editor.dom.getParent(selection.getNode(), "ol"),
    });
  }, [editorRef]);

  // Listen for selection changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleSelectionChange = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(updatePosition, 200);
    };

    editor.on("selectionchange NodeChange mouseup keyup", handleSelectionChange);
    return () => {
      clearTimeout(debounceRef.current);
      editor.off("selectionchange NodeChange mouseup keyup", handleSelectionChange);
    };
  }, [editorRef, updatePosition]);

  // Hide on escape
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPosition(null);
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);

  const execCommand = useCallback((command: string, value?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.execCommand(command, false, value);
    // Re-check format state after command
    setTimeout(updatePosition, 50);
  }, [editorRef, updatePosition]);

  const formatBlock = useCallback((tag: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const node = editor.selection.getNode();
    const currentTag = node.nodeName.toLowerCase();
    // Toggle: if already this heading, revert to paragraph
    editor.execCommand("FormatBlock", false, currentTag === tag ? "p" : tag);
    setTimeout(updatePosition, 50);
  }, [editorRef, updatePosition]);

  if (!position) return null;

  return (
    <div
      ref={menuRef}
      className="bubble-menu"
      style={{
        top: position.top,
        left: position.left,
        transform: "translate(-50%, -100%)",
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent editor blur
    >
      {/* Text formatting */}
      <button className={`bubble-tool ${formatState.bold ? "active" : ""}`}
              onClick={() => execCommand("Bold")} title="Fett (Ctrl+B)">
        <Bold className="h-4 w-4" />
      </button>
      <button className={`bubble-tool ${formatState.italic ? "active" : ""}`}
              onClick={() => execCommand("Italic")} title="Kursiv (Ctrl+I)">
        <Italic className="h-4 w-4" />
      </button>
      <button className={`bubble-tool ${formatState.underline ? "active" : ""}`}
              onClick={() => execCommand("Underline")} title="Unterstrichen (Ctrl+U)">
        <Underline className="h-4 w-4" />
      </button>

      <div className="bubble-separator" />

      {/* Headings */}
      <button className={`bubble-tool ${formatState.h1 ? "active" : ""}`}
              onClick={() => formatBlock("h1")} title="Überschrift 1">
        <Heading1 className="h-4 w-4" />
      </button>
      <button className={`bubble-tool ${formatState.h2 ? "active" : ""}`}
              onClick={() => formatBlock("h2")} title="Überschrift 2">
        <Heading2 className="h-4 w-4" />
      </button>

      <div className="bubble-separator" />

      {/* Lists & Link */}
      <button className={`bubble-tool ${formatState.ul ? "active" : ""}`}
              onClick={() => execCommand("InsertUnorderedList")} title="Aufzählung">
        <List className="h-4 w-4" />
      </button>
      <button className={`bubble-tool ${formatState.ol ? "active" : ""}`}
              onClick={() => execCommand("InsertOrderedList")} title="Nummerierung">
        <ListOrdered className="h-4 w-4" />
      </button>
      <button className="bubble-tool"
              onClick={() => execCommand("mceLink")} title="Link einfügen">
        <Link className="h-4 w-4" />
      </button>

      <div className="bubble-separator" />

      {/* AI Refinement */}
      <button className="bubble-tool" onClick={onAIClick} title="KI-Nachbesserung">
        <Sparkles className="h-4 w-4" />
      </button>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add frontend/src/components/generator/editor/BubbleMenu.tsx
git commit -m "feat(canvas): create BubbleMenu floating formatting component"
```

---

### Task 3.2: Integrate BubbleMenu into RightEditorPanel

**Files:**
- Modify: `frontend/src/components/generator/editor/RightEditorPanel.tsx`

**Step 1: Replace old floating toolbar with BubbleMenu**

1. Add import at top:
```tsx
import { BubbleMenu } from "./BubbleMenu";
```

2. Remove the old floating position state and `handleEditorInit` selection logic (lines 100-134). Keep `editorRef` (line 101).

3. Simplify `handleEditorInit` to just store the editor ref:
```tsx
const handleEditorInit = useCallback((editor: TinyMCEEditor) => {
  editorRef.current = editor;
}, []);
```

4. Replace the old `AIToolbar` floating render (lines 565-585) with:
```tsx
<BubbleMenu
  editorRef={editorRef}
  onAIClick={() => {
    // Open AI refinement popover — reuse AIToolbar in popover mode
    setShowAIPopover(true);
  }}
/>
```

5. The existing `AIToolbar` component can remain as a `Popover` triggered by the bubble menu's sparkle button, or be integrated as a sub-component. For now, render it conditionally:
```tsx
{showAIPopover && (
  <AIToolbar
    getSelectedText={() => editorRef.current?.selection.getContent({ format: "text" }) || ""}
    replaceSelectedText={(html) => {
      editorRef.current?.selection.setContent(html);
      // Sync to context
      const newContent = editorRef.current?.getContent() || "";
      actions.setEditorContent(newContent, true);
    }}
    documentContext={state.documentTitle}
    countryCode={country}
    documentTypeId={state.documentTypeId}
    toneOfVoice={state.toneOfVoice}
  />
)}
```

**Step 2: Clean up unused imports**

Remove `floatingPos`-related code and any unused imports.

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 4: Verify visually**

Select text in the editor. The bubble menu should appear above the selection with formatting tools. Clicking Bold/Italic/Underline should toggle formatting.

**Step 5: Commit**

```bash
git add frontend/src/components/generator/editor/RightEditorPanel.tsx
git commit -m "feat(canvas): integrate BubbleMenu, replace old floating toolbar"
```

---

## Phase 4: Left Panel Redesign

### Task 4.1: Create WorkflowDots Component

**Files:**
- Create: `frontend/src/components/generator/WorkflowDots.tsx`

**Step 1: Create a compact dot-based workflow indicator**

```tsx
import { useWizardContext } from "./WizardContext";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "setup", label: "Entwurf" },
  { id: "edit", label: "Bearbeitung" },
  { id: "review", label: "Prüfung" },
  { id: "export", label: "Export" },
];

export function WorkflowDots() {
  const { state } = useWizardContext();

  // Determine current step from wizard state
  const currentStep = state.hasExported ? 3 :
    state.editorContent ? 1 :
    state.documentTypeId ? 0 : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        {STEPS.map((step, i) => (
          <div
            key={step.id}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              i < currentStep && "bg-green-500",
              i === currentStep && "bg-primary w-3 h-3",
              i > currentStep && "bg-foreground/15"
            )}
            title={step.label}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">
        {STEPS[currentStep]?.label}
      </span>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add frontend/src/components/generator/WorkflowDots.tsx
git commit -m "feat(canvas): create compact WorkflowDots step indicator"
```

---

### Task 4.2: Create ToneSegmented Component

**Files:**
- Create: `frontend/src/components/generator/ToneSegmented.tsx`

**Step 1: Create a segmented control replacing ToneCards**

```tsx
import { cn } from "@/lib/utils";

interface ToneSegmentedProps {
  value: number;
  onChange: (value: number) => void;
}

const TONES = [
  { value: 1, label: "Formal" },
  { value: 2, label: "Profess." },
  { value: 3, label: "Warm" },
  { value: 4, label: "Persönl." },
  { value: 5, label: "Empath." },
];

export function ToneSegmented({ value, onChange }: ToneSegmentedProps) {
  return (
    <div className="flex items-center rounded-lg bg-[var(--canvas-input-fill)] p-0.5 gap-0.5">
      {TONES.map((tone) => (
        <button
          key={tone.value}
          onClick={() => onChange(tone.value)}
          className={cn(
            "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
            "hover:bg-background/60",
            value === tone.value
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground"
          )}
        >
          {tone.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add frontend/src/components/generator/ToneSegmented.tsx
git commit -m "feat(canvas): create ToneSegmented compact control"
```

---

### Task 4.3: Update LeftControlPanel Header

**Files:**
- Modify: `frontend/src/components/generator/panels/LeftControlPanel.tsx:103-140`

**Step 1: Replace header with WorkflowDots + clean title**

Replace the header section (lines 103-118) with:

```tsx
<div className="p-4 pb-3 bg-background shrink-0 space-y-3">
  {/* Workflow progress */}
  <WorkflowDots />

  {/* Document title */}
  <Input
    value={state.documentTitle || ""}
    onChange={(e) => actions.setDocumentTitle(e.target.value)}
    placeholder="Dokumenttitel eingeben..."
    className="canvas-input text-lg font-semibold h-auto py-2"
  />
</div>
```

Remove the `DocumentStatusBadge` and `FileText` icon from the header — they add visual noise.

**Step 2: Replace ToneCards with ToneSegmented**

At lines 134-140, replace:
```tsx
<div className="px-4 pb-3">
  <ToneCards value={state.toneOfVoice} onChange={actions.setToneOfVoice} />
</div>
```
with:
```tsx
<div className="px-4 pb-3">
  <div className="text-[11px] font-medium text-muted-foreground/45 uppercase tracking-widest mb-1.5">
    Tonalität
  </div>
  <ToneSegmented value={state.toneOfVoice} onChange={actions.setToneOfVoice} />
</div>
```

**Step 3: Add imports**

```tsx
import { WorkflowDots } from "../WorkflowDots";
import { ToneSegmented } from "../ToneSegmented";
```

Remove unused imports: `ToneCards`, `DocumentStatusBadge`, `useDocumentStatus`, `FileText`.

**Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add frontend/src/components/generator/panels/LeftControlPanel.tsx
git commit -m "feat(canvas): redesign left panel header with WorkflowDots and ToneSegmented"
```

---

### Task 4.4: Switch Form Fields to .canvas-input

**Files:**
- Modify: `frontend/src/components/generator/panels/FormFieldsSection.tsx`

**Step 1: Update fieldClass helper**

At line 406, change:
```typescript
const baseClass = "h-8 text-sm ive-input";
```
to:
```typescript
const baseClass = "h-9 text-sm canvas-input";
```

(Height increased from `h-8` to `h-9` to accommodate the filled input padding.)

**Step 2: Replace all direct .ive-input references**

Search the file for `ive-input` and replace each instance with `canvas-input`:
- Line 569 (strasse): `className="h-8 text-sm ive-input"` → `className="h-9 text-sm canvas-input"`
- Line 593 (ort): same replacement
- Line 605 (geburtsdatum): same replacement
- Line 765 (entgeltgruppe): same replacement
- Line 839 (urlaubsgeld_pro_tag): same replacement
- Line 853 (vwl_betrag): same replacement

For `SelectTrigger` components, replace `ive-input` with `canvas-select-trigger`:
- Line 632 (vertragsart)
- Line 743 (probezeit)
- Line 779 (kuendigungsfrist)
- Line 799 (au_frist)

**Step 3: Remove "0 von 7" counter**

Remove lines 496-513 (the `Fortschrittsanzeige für Pflichtfelder` block). The progress information will be implicit via the WorkflowDots.

**Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add frontend/src/components/generator/panels/FormFieldsSection.tsx
git commit -m "feat(canvas): switch form fields to .canvas-input filled style"
```

---

### Task 4.5: Update Left Panel Fixed Width

**Files:**
- Modify: `frontend/src/components/generator/SplitScreenEditor.tsx:157-162`

**Step 1: Simplify to single width**

Change the left panel div class from:
```
w-full lg:w-[340px] xl:w-[380px] lg:min-w-[300px] lg:max-w-[420px]
```
to:
```
w-full lg:w-[360px] lg:min-w-[360px] lg:max-w-[360px]
```

Single consistent width: `360px`.

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add frontend/src/components/generator/SplitScreenEditor.tsx
git commit -m "feat(canvas): set left panel to fixed 360px width"
```

---

## Phase 5: Client-Side Template Rendering

### Task 5.1: Install Mustache

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install Mustache**

Run: `cd frontend && npm install mustache && npm install -D @types/mustache`

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: install mustache for client-side template rendering"
```

---

### Task 5.2: Create Backend Template Endpoint

**Files:**
- Modify: `backend/app/api/v1/endpoints/core/document_types.py`

**Step 1: Add template endpoint**

Add a new endpoint that returns the raw HTML template with `{{placeholders}}` for a document type:

```python
@router.get("/{document_type_id}/template")
async def get_document_type_template(
    document_type_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Return raw HTML template with {{mustache}} placeholders for client-side rendering."""
    doc_type = await db.get(DocumentType, document_type_id)
    if not doc_type:
        raise HTTPException(status_code=404, detail="Dokumenttyp nicht gefunden")

    # Build the template HTML with placeholders
    # This depends on how templates are currently stored
    # The preview endpoint builds HTML from form_data — we need the template BEFORE substitution
    template_html = doc_type.template_html  # or however the raw template is stored

    # Also return clause templates
    clause_templates = {}
    for clause in doc_type.clauses:
        clause_templates[clause.id] = clause.template_html

    return {
        "html_template": template_html,
        "clause_templates": clause_templates,
    }
```

**Note:** The exact implementation depends on how templates are stored in the database. The preview service currently renders templates server-side with Jinja2. We need to expose the raw template with `{{placeholder}}` syntax. This may require a template format conversion or dual-format storage.

**Step 2: Run backend tests**

Run: `cd backend && python -m pytest tests/ -x -q`

**Step 3: Commit**

```bash
git add backend/app/api/v1/endpoints/core/document_types.py
git commit -m "feat(canvas): add GET /document-types/{id}/template endpoint"
```

---

### Task 5.3: Create useClientRenderer Hook

**Files:**
- Create: `frontend/src/hooks/wizard/useClientRenderer.ts`

**Step 1: Create the hook**

```typescript
import { useState, useCallback, useMemo } from "react";
import Mustache from "mustache";

interface TemplateData {
  html_template: string;
  clause_templates: Record<number, string>;
}

interface DocumentClause {
  id: number;
  is_enabled: boolean;
  order_index: number;
}

const FIELD_LABELS: Record<string, string> = {
  vorname: "Vorname",
  nachname: "Nachname",
  strasse: "Straße",
  plz: "PLZ",
  ort: "Ort",
  geburtsdatum: "Geburtsdatum",
  position: "Position",
  gehalt: "Gehalt",
  eintrittsdatum: "Eintrittsdatum",
  wochenstunden: "Wochenstunden",
  urlaubstage: "Urlaubstage",
  probezeit: "Probezeit",
  kuendigungsfrist: "Kündigungsfrist",
  vertragsart: "Vertragsart",
  signatory_name: "Unterzeichner",
  document_title: "Dokumenttitel",
};

/**
 * Client-side template renderer using Mustache for instant form→document binding.
 * Replaces the 150ms debounced server preview for immediate feedback.
 */
export function useClientRenderer() {
  const [templateData, setTemplateData] = useState<TemplateData | null>(null);

  const render = useCallback((
    formData: Record<string, unknown>,
    clauses: DocumentClause[],
    dynamicFormValues: Record<string, string | number | boolean> = {},
  ): string => {
    if (!templateData) return "";

    // Build view data — format special fields for German locale
    const gehalt = formData.gehalt
      ? `${Number(formData.gehalt).toLocaleString("de-DE")} €`
      : "";
    const eintrittsdatum = formData.eintrittsdatum
      ? new Date(String(formData.eintrittsdatum)).toLocaleDateString("de-DE")
      : "";
    const geburtsdatum = formData.geburtsdatum
      ? new Date(String(formData.geburtsdatum)).toLocaleDateString("de-DE")
      : "";

    const view: Record<string, unknown> = {
      ...formData,
      ...dynamicFormValues,
      gehalt,
      eintrittsdatum,
      geburtsdatum,
    };

    // Custom Mustache escape: unfilled fields become skeleton placeholders
    const originalEscape = Mustache.escape;
    Mustache.escape = (text: string) => {
      if (text === "" || text === undefined || text === null) return "";
      return originalEscape(text);
    };

    // Render main template
    let html = Mustache.render(templateData.html_template, view);

    // Render and inject enabled clause templates, sorted by order
    const enabledClauses = clauses
      .filter((c) => c.is_enabled)
      .sort((a, b) => a.order_index - b.order_index);

    const clauseHtml = enabledClauses
      .map((c) => {
        const tmpl = templateData.clause_templates[c.id];
        return tmpl ? Mustache.render(tmpl, view) : "";
      })
      .filter(Boolean)
      .join("\n");

    // Replace {{clauses}} placeholder with rendered clauses
    html = html.replace("{{clauses}}", clauseHtml);

    // Restore escape function
    Mustache.escape = originalEscape;

    return html;
  }, [templateData]);

  // Replace unfilled placeholders with skeleton spans
  const renderWithPlaceholders = useCallback((
    formData: Record<string, unknown>,
    clauses: DocumentClause[],
    dynamicFormValues?: Record<string, string | number | boolean>,
  ): string => {
    if (!templateData) return "";

    // First render with actual values
    let html = render(formData, clauses, dynamicFormValues);

    // Then find any remaining empty {{placeholders}} and replace with skeletons
    html = html.replace(
      /\{\{(\w+)\}\}/g,
      (_, key: string) => {
        const label = FIELD_LABELS[key] || key;
        return `<span class="template-placeholder">${label}</span>`;
      }
    );

    return html;
  }, [templateData, render]);

  return {
    templateData,
    setTemplateData,
    render,
    renderWithPlaceholders,
    isReady: templateData !== null,
  };
}
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add frontend/src/hooks/wizard/useClientRenderer.ts
git commit -m "feat(canvas): create useClientRenderer hook with Mustache"
```

---

### Task 5.4: Integrate Client Renderer into useDocumentWizard

**Files:**
- Modify: `frontend/src/hooks/useDocumentWizard.ts:73-82,211-215`

**Step 1: Add client renderer to the orchestrator**

After the existing sub-hooks (around line 73), add:

```typescript
import { useClientRenderer } from "./wizard/useClientRenderer";
```

And instantiate:
```typescript
const clientRenderer = useClientRenderer();
```

**Step 2: Load template when document type changes**

After the existing `useEffect` that resets editor on type change (lines 200-203), add:

```typescript
// Fetch template for client-side rendering
useEffect(() => {
  if (!form.documentTypeId) return;

  const fetchTemplate = async () => {
    try {
      const response = await api.get(`/api/v1/document-types/${form.documentTypeId}/template`);
      clientRenderer.setTemplateData(response.data);
    } catch {
      // Fall back to server preview if template endpoint fails
      console.warn("Client template fetch failed, using server preview");
    }
  };

  fetchTemplate();
}, [form.documentTypeId]);
```

**Step 3: Replace server sync with client rendering**

Modify the sync effect (lines 211-215) from:
```typescript
useEffect(() => {
  if (preview.previewHtml && !hasLocalEdits) {
    setEditorContentState(preview.previewHtml);
  }
}, [preview.previewHtml, hasLocalEdits]);
```

To:
```typescript
// Client-side rendering: instant form→editor sync
useEffect(() => {
  if (hasLocalEdits) return;

  if (clientRenderer.isReady) {
    // Instant client-side render
    const html = clientRenderer.renderWithPlaceholders(
      form.formData as unknown as Record<string, unknown>,
      clauses.documentClauses,
      form.dynamicFormValues,
    );
    if (html) {
      setEditorContentState(html);
    }
  } else if (preview.previewHtml) {
    // Fallback to server preview
    setEditorContentState(preview.previewHtml);
  }
}, [
  form.formData, form.dynamicFormValues,
  clauses.documentClauses,
  clientRenderer.isReady, clientRenderer.renderWithPlaceholders,
  preview.previewHtml, hasLocalEdits,
]);
```

**Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add frontend/src/hooks/useDocumentWizard.ts
git commit -m "feat(canvas): integrate client-side Mustache rendering into wizard"
```

---

## Phase 6: Polish & Edge Cases

### Task 6.1: Dark Mode Parity

**Files:**
- Modify: `frontend/src/index.css` (dark mode sections)

**Step 1: Verify all canvas classes have dark mode**

Review each canvas class and ensure the `.dark` variant is defined:
- `.canvas-desk` ✓ (uses CSS var)
- `.canvas-paper` ✓ (uses CSS var)
- `.canvas-input` ✓ (uses CSS var)
- `.bubble-menu` ✓ (has `.dark .bubble-menu`)
- `.template-placeholder` — add dark variant:
  ```css
  .dark .template-placeholder {
    color: var(--canvas-text-secondary);
    background: hsl(225 14% 22%);
  }
  ```

**Step 2: Test dark mode toggle**

Run: `cd frontend && npm run dev`
Toggle dark mode. Verify paper, bubble, inputs all look correct.

**Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "fix(canvas): ensure dark mode parity for all canvas classes"
```

---

### Task 6.2: Keyboard Accessibility for Bubble Menu

**Files:**
- Modify: `frontend/src/components/generator/editor/BubbleMenu.tsx`

**Step 1: Add keyboard navigation**

Add `tabIndex={0}` to each `bubble-tool` button (already `<button>` elements, so tab-focusable by default).

Add keyboard handler to the menu container:
```tsx
onKeyDown={(e) => {
  if (e.key === "Escape") {
    setPosition(null);
    editorRef.current?.focus();
  }
}}
```

Ensure `role="toolbar"` and `aria-label="Textformatierung"` on the menu container.

**Step 2: Verify keyboard navigation**

Tab through the bubble menu tools. Each should be focusable and activatable with Enter/Space.

**Step 3: Commit**

```bash
git add frontend/src/components/generator/editor/BubbleMenu.tsx
git commit -m "fix(canvas): add keyboard accessibility to BubbleMenu"
```

---

### Task 6.3: Remove Temporary Floating Controls

**Files:**
- Modify: `frontend/src/components/generator/editor/RightEditorPanel.tsx`
- Modify: `frontend/src/components/generator/panels/LeftControlPanel.tsx`

**Step 1: Move chat/comment toggles to left panel**

In LeftControlPanel, add small toggle buttons at the bottom of the header section or in the ActionBar for:
- KI-Chat sidebar toggle
- Comment sidebar toggle

**Step 2: Remove the temporary absolute-positioned buttons from RightEditorPanel**

(The ones added in Task 2.2.)

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add frontend/src/components/generator/editor/RightEditorPanel.tsx \
       frontend/src/components/generator/panels/LeftControlPanel.tsx
git commit -m "feat(canvas): move chat/comment toggles to left panel action bar"
```

---

### Task 6.4: Final Build & Visual QA

**Step 1: Full build**

Run: `cd frontend && npm run build`
Expected: SUCCESS with zero errors

**Step 2: Visual QA checklist**

- [ ] Right panel background is warm `#F5F5F7`
- [ ] No toolbar above the document
- [ ] Paper has 4-layer shadow, floats on desk
- [ ] Text selection shows glass bubble menu
- [ ] Bold/Italic/Underline toggle correctly
- [ ] AI sparkle in bubble opens refinement
- [ ] Left panel has compact workflow dots
- [ ] Left panel has segmented tone control
- [ ] All form inputs have filled `#F5F5F7` background
- [ ] Focus state shows blue border + glow ring
- [ ] No "0 von 7" counter visible
- [ ] Missing logo shows clean skeleton, not broken image
- [ ] Banners (compliance, consistency, ghostwriter) appear in left panel
- [ ] Dark mode works for all new elements
- [ ] Form changes instantly reflect in document (<5ms)
- [ ] Keyboard navigation works on bubble menu
- [ ] Mobile responsive: tabs work, paper fills width

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(canvas): True-Fidelity Canvas complete — visual QA pass"
```

---

## Summary of Files

### New Files (5)
| File | Phase |
|------|-------|
| `frontend/src/components/generator/editor/BubbleMenu.tsx` | 3 |
| `frontend/src/components/generator/WorkflowDots.tsx` | 4 |
| `frontend/src/components/generator/ToneSegmented.tsx` | 4 |
| `frontend/src/hooks/wizard/useClientRenderer.ts` | 5 |
| Backend: template endpoint in `document_types.py` | 5 |

### Modified Files (12)
| File | Phase | Changes |
|------|-------|---------|
| `frontend/src/index.css` | 1 | +tokens, +canvas-input, +canvas-paper, +bubble-menu |
| `frontend/tailwind.config.js` | 1 | +canvas-paper shadow |
| `frontend/src/components/generator/SplitScreenEditor.tsx` | 2, 4 | bg class, panel width |
| `frontend/src/components/generator/editor/RightEditorPanel.tsx` | 2, 3 | -toolbar, -banners, +BubbleMenu |
| `frontend/src/components/editor/DocumentEditor.tsx` | 2 | toolbar: false |
| `frontend/src/components/editor/FullDocumentPreview.tsx` | 2 | shadow, logo skeleton |
| `frontend/src/components/generator/editor/StationeryCanvas.tsx` | 2 | shadow |
| `frontend/src/components/generator/panels/LeftControlPanel.tsx` | 4 | +dots, +tone, +banners |
| `frontend/src/components/generator/panels/FormFieldsSection.tsx` | 4 | .ive-input → .canvas-input |
| `frontend/src/hooks/useDocumentWizard.ts` | 5 | +client renderer |
| `backend/app/api/v1/endpoints/core/document_types.py` | 5 | +template endpoint |
| `frontend/package.json` | 5 | +mustache |
