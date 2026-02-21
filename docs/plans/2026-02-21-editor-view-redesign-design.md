# Editor View Redesign — 3-Pane Architecture + Floating Action Panel

**Date**: 2026-02-21
**Approach**: A — Evolutionary Polish (refine existing structure + new Floating Action Panel)
**Scope**: All 3 panes (Sidebar, LeftControlPanel, Canvas) + new EditorActionPanel component

---

## Context

The editor view (SplitScreenEditor) already has the right structural foundation from recent canvas commits (d851976, 11cf80b, c45ab75): hidden TinyMCE toolbar, BubbleMenu, canvas-paper shadows, canvas-input styling, WorkflowDots, ToneSegmented. The gap is **visual consistency** across all three panes and **missing functional features** (export options, deadline tracking, approval trigger) that currently don't exist in the editor view.

### Backend APIs (existing, no new endpoints needed for MVP)
- `POST /documents/approvals/request` — approval workflow trigger
- `GET /admin/attachments` — attachment list
- `POST /user/deadlines` — create deadline entry
- `pipeline_stage` field on GeneratedDocument — "versendet" / "ruecklauf" stages
- Export flow: `exportDocument(format)` in WizardContext

---

## Pane 1: Sidebar (240px Navigation)

**Philosophy**: The sidebar should recede — infrastructure, not content.

### Changes (CSS-only, no structural changes to Layout.tsx/Sidebar.tsx)
| Element | Current | Target |
|---------|---------|--------|
| Background | `bg-white` with `glass-sidebar` | `bg-warm-50/80` with subtle backdrop blur |
| Nav items hover | Mixed | `hover:bg-warm-100 rounded-lg transition-colors duration-150` |
| Active item | Bold/color accent | `bg-white shadow-soft-xs text-primary-600 font-medium rounded-lg` pill |
| Item padding | Varies | `py-1.5 px-3` uniform, `gap-1` between items |
| Section dividers | Hard lines or none | `border-warm-100 my-2` breathing room |
| Logo area | Current | `p-4 border-b border-warm-100` separator |

---

## Pane 2: LeftControlPanel (360px Formular)

**Philosophy**: Pure data input — clean, grouped, rhythmic. No action buttons (those move to Floating Panel).

### 2a. Input Consistency
Migrate ALL inputs to `canvas-input` style. Kill the dual `ive-input` bottom-line style.
```css
.canvas-input {
  background: var(--canvas-input-fill);    /* #F5F5F7 */
  border: 1.5px solid transparent;
  border-radius: 8px;
  padding: 10px 14px;
  transition: border-color 150ms, box-shadow 150ms;
}
.canvas-input:focus {
  border-color: hsl(228 58% 33%);          /* primary */
  box-shadow: 0 0 0 3px rgba(36, 49, 134, 0.08);
}
```

### 2b. Section Grouping
Group related fields in subtle containers:
```
bg-warm-50/50 rounded-xl p-3 space-y-3
```
Section headers use existing `.ive-section-header` (11px uppercase tracking-wide).

Field groups:
- **Stammdaten**: Vorname, Nachname, Personalnummer
- **Vertragsdaten**: Gehalt, Wochenstunden, Urlaubstage, Kuendigungsfrist
- **Weitere Angaben**: Dynamic fields per document type

### 2c. Field Layout
Two-column grid for short fields:
```html
<div class="grid grid-cols-2 gap-3">
  <Input label="Vorname" />
  <Input label="Nachname" />
</div>
```
Full-width for long inputs (Adresse, Freitextfelder).

### 2d. Vertical Rhythm
- `space-y-4` between sections
- `space-y-3` within sections
- `px-4` uniform padding
- ActionBar separator: `border-t border-warm-100`

### 2e. ActionBar Simplification
Remove export buttons from ActionBar. It becomes minimal:
- Auto-save status indicator
- Validation progress (Ampel)
- Draft save button (optional, could also move to Floating Panel)

---

## Pane 3: Canvas / Desk (flex-1)

**Philosophy**: The document is the star. Everything else supports it.

### 3a. Desk Background
Keep `--canvas-desk` (#F5F5F7). Add radial gradient for depth:
```css
.canvas-desk {
  background: var(--canvas-desk);
  background-image: radial-gradient(
    ellipse at center,
    rgba(255, 255, 255, 0.4) 0%,
    transparent 70%
  );
}
```

### 3b. Paper Proportions
- Container: `max-w-[210mm]` with strict A4 proportions
- Outer padding: `p-8 lg:p-12` (increased from current `p-4 md:p-6 lg:p-8`)
- Paper corners: `rounded-lg`

### 3c. Paper Shadow
Existing `--shadow-canvas-paper` (4-layer) plus edge definition:
```css
.canvas-paper {
  box-shadow: var(--shadow-canvas-paper);
  ring: 1px solid rgba(0, 0, 0, 0.02);
}
```

### 3d. Scroll & Spacing
- Bottom padding after paper: `pb-24` (breathing room + Floating Panel space)
- Paper extends based on TinyMCE autoresize content

### 3e. Empty State
Centered placeholder when no content:
- Document title + "Beginnen Sie mit der Eingabe..." in `text-muted-foreground`

---

## New Component: EditorActionPanel (Floating Action Panel)

**Philosophy**: Figma-style floating panel — all finalization actions in one place, over the canvas.

### Visual Layout
```
+-------------------------------------+
|  Dokument abschliessen         v/^  |  <- Collapsible header
+-------------------------------------+
|                                     |
|  Format:    [PDF *] [DOCX]         |  <- Toggle buttons
|                                     |
|  Anhaenge:                          |
|  [x] Arbeitsordnung.pdf            |  <- Checkbox list
|  [x] Datenschutzvereinbarung.pdf   |
|  [ ] Firmenwagen-Richtlinie.pdf    |
|                                     |
|  - - - - - - - - - - - - - - - - - |
|                                     |
|  Versendet am:   [ DD.MM.YYYY    ] |  <- Optional date input
|  Rueckfrist bis: [ DD.MM.YYYY    ] |  <- Optional date input
|                                     |
|  - - - - - - - - - - - - - - - - - |
|                                     |
|  [ Exportieren & Herunterladen    ] |  <- Primary action
|  [ Zur Freigabe einreichen     -> ] |  <- Secondary action
|                                     |
+-------------------------------------+
```

### Positioning & Behavior
- Position: `absolute bottom-6 right-6` within canvas container
- Width: `w-80` (320px)
- Z-index: `z-30` (above canvas, below modals)
- Default: Collapsed — shows only "Dokument abschliessen" header bar
- Toggle: Click header to expand/collapse
- Animation: `transition-all duration-200` slide up/down

### Styling
```css
bg-white/95 backdrop-blur-xl rounded-2xl shadow-float
border border-warm-100
p-4 space-y-4
```
Section dividers: `border-t border-dashed border-warm-200`

### Functional Mapping

| UI Element | Data Source | Action on Submit |
|------------|-------------|-----------------|
| Format toggle (PDF/DOCX) | Local state | Pass to `exportDocument(format)` |
| Anhaenge checkboxes | `GET /admin/attachments?country=XX` | Include selected IDs in export request |
| Versendet am (date) | User input, optional | Update `pipeline_stage` to "versendet" + create DocumentAction |
| Rueckfrist bis (date) | User input, optional | Create DocumentDeadline via `POST /user/deadlines` |
| "Exportieren" button | WizardContext | Triggers existing export flow with format + attachments |
| "Zur Freigabe" button | Approval API | Opens mini-dialog: select approver/group -> `POST /documents/approvals/request` |

### Mobile Behavior
- `<lg` breakpoint: Panel becomes full-width bottom sheet
- `rounded-t-2xl`, slides up from bottom
- Touch-friendly: larger tap targets, `py-3` button padding

---

## Files to Modify

### CSS/Styling Changes
1. `frontend/src/index.css` — Update `.canvas-desk` with radial gradient, canvas padding tokens
2. `frontend/tailwind.config.js` — Add any missing shadow/spacing tokens
3. `frontend/src/components/ui/input.tsx` — Ensure canvas-input is the default style
4. `frontend/src/components/Layout.tsx` or `Sidebar.tsx` — Sidebar CSS updates

### Component Modifications
5. `frontend/src/components/generator/panels/LeftControlPanel.tsx` — Section grouping, 2-col grid, remove export from ActionBar
6. `frontend/src/components/generator/panels/FormFieldsSection.tsx` — 2-col grid for name/salary fields
7. `frontend/src/components/generator/panels/ActionBar.tsx` — Simplify (remove export buttons)
8. `frontend/src/components/generator/editor/RightEditorPanel.tsx` — Increase canvas padding, add EditorActionPanel
9. `frontend/src/components/generator/SplitScreenEditor.tsx` — Adjust padding/spacing if needed

### New Components
10. `frontend/src/components/generator/editor/EditorActionPanel.tsx` — The Floating Action Panel (new file)

### Hooks (possibly new)
11. `frontend/src/hooks/useAttachments.ts` — Fetch available attachments for checkbox list (if not existing)

---

## Out of Scope
- Dark mode adjustments (follow-up)
- Mobile-specific bottom sheet animation (follow-up, basic responsive first)
- Approval dialog UI redesign (reuse existing approval flow UI if any)
- Backend changes (all endpoints already exist)
