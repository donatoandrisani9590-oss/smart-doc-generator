# True-Fidelity Canvas — UI/UX Redesign

**Date:** 2026-02-20
**Status:** Approved
**Scope:** Document generator split-screen editor — visual, interaction, and architecture redesign

---

## Vision

Transform the document editor from a traditional toolbar-based interface into a "True-Fidelity Canvas" — where the user feels they are working directly on a physical, digital sheet of paper. The interface radiates focus, calm, and elegance. Visual noise is eliminated. What the user sees is exactly what will be exported as PDF (WYSIWYG in perfection).

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Editor engine | Keep TinyMCE, hide toolbar | Lowest risk, keeps DOCX export, reuses all state management |
| Formatting UI | Custom floating bubble menu | Selection-only, no static toolbar breaking paper illusion |
| Input style | Filled inputs with `#F5F5F7` bg | Ergonomic, clearly interactive, focus state with brand blue |
| Workflow nav | Compact dots in left panel header | Right side 100% dedicated to paper canvas |
| Data binding | Client-side Mustache template rendering | Zero-latency form→document sync (<5ms vs 200-400ms) |
| Banners | Moved to left panel as collapsible cards | Nothing competes with the paper on the right |

---

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Desk background | `#F5F5F7` | Right panel canvas surface |
| Paper | `#FFFFFF` | A4 document surface |
| Primary text | `#1D1D1F` | Deep anthracite, all text/labels |
| Secondary text | `#86868B` | Placeholders, hints, muted labels |
| Primary brand | `#243186` | Focus rings, active states, accents |
| Input fill | `#F5F5F7` | Rest-state input background |

---

## 1. Layout Architecture

### Split-Screen Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────┐  ┌────────────────────────────────────┐   │
│  │  LEFT PANEL (360px) │  │      RIGHT "DESK" (flex-1)         │   │
│  │                     │  │                                    │   │
│  │  Workflow Dots      │  │   bg: #F5F5F7                      │   │
│  │  Document Title     │  │                                    │   │
│  │  Stationery Picker  │  │      ┌──────────────────┐          │   │
│  │  Tone Selector      │  │      │                  │          │   │
│  │                     │  │      │    A4 Paper       │          │   │
│  │  [AI Cards]         │  │      │    210mm × 297mm  │          │   │
│  │                     │  │      │    layered shadow  │          │   │
│  │  MITARBEITERDATEN   │  │      │                  │          │   │
│  │  [Form Fields...]   │  │      │                  │          │   │
│  │                     │  │      └──────────────────┘          │   │
│  │  VERTRAGSDATEN      │  │                                    │   │
│  │  [Form Fields...]   │  │   No toolbar. No stepper.          │   │
│  │                     │  │   No chrome. Just paper on desk.   │   │
│  │  ┌──────┐ ┌──────┐ │  │                                    │   │
│  │  │Draft │ │Export│ │  │                                    │   │
│  │  └──────┘ └──────┘ │  │                                    │   │
│  └─────────────────────┘  └────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Changes from Current

- Right panel bg: `hsl(220 10% 93%)` → `#F5F5F7` (warm neutral)
- Above the paper: toolbar with WorkflowStepper + buttons → **nothing**
- WorkflowStepper: right panel toolbar → compact dots in left panel header
- Left panel width: `340px`/`380px` breakpoint → single `360px`
- Banners (compliance, ghostwriter, consistency): stacked above paper → left panel collapsible cards

---

## 2. Paper as Hero — Shadow & Presence

### CSS Specification

```css
.canvas-paper {
  width: 210mm;
  min-height: 297mm;
  padding: 25mm 20mm;
  background: #FFFFFF;
  border-radius: 4px;
  margin: 2rem auto;

  /* 4-layer Ive shadow — natural light simulation */
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.03),        /* hairline edge */
    0 1px 3px rgba(0, 0, 0, 0.04),         /* tight contact */
    0 8px 24px rgba(0, 0, 0, 0.06),        /* mid-range depth */
    0 24px 48px rgba(0, 0, 0, 0.04);       /* ambient spread */

  /* Content typography */
  font-family: Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.15;
  color: #1D1D1F;
}

/* Dark mode */
.dark .canvas-paper {
  background: hsl(225 14% 14%);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.06),
    0 1px 3px rgba(0, 0, 0, 0.2),
    0 8px 24px rgba(0, 0, 0, 0.3),
    0 24px 48px rgba(0, 0, 0, 0.2);
}
```

### Template Placeholders (Unfilled Fields)

```css
.template-placeholder {
  color: #86868B;
  background: #F5F5F7;
  border-radius: 3px;
  padding: 0 4px;
  font-style: italic;
}
```

### Logo Skeleton (Missing Company Logo)

```css
.logo-skeleton {
  width: 120px;
  height: 48px;
  background: linear-gradient(135deg, #F5F5F7 0%, #EBEBED 100%);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

Never display broken browser image icons.

### Responsive Behavior

- Desktop (>1200px): Paper at full 210mm, centered with generous desk margins
- Tablet (768-1200px): Paper scales to fit (max-width: 100%), side padding reduces
- Mobile (<768px): Left panel becomes full-screen tab, paper fills width

---

## 3. Floating Bubble Menu

### Visual Design

```
          ┌──────────────────────────────────────┐
          │  B   I   U  │  H₁  H₂  │  •  1.  🔗  ✨│
          └─────────────────────┬────────────────┘
                                ▼
                    ███ selected text ███
```

### CSS Specification

```css
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
  transform: translateX(-50%);
}

@keyframes bubble-appear {
  from { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.96); }
  to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}

.bubble-tool {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1D1D1F;
  transition: background 0.15s ease;
}

.bubble-tool:hover { background: rgba(0, 0, 0, 0.06); }
.bubble-tool.active { background: rgba(36, 49, 134, 0.1); color: #243186; }

.bubble-separator {
  width: 1px;
  height: 20px;
  background: rgba(0, 0, 0, 0.1);
  margin: 0 2px;
}

/* Dark mode */
.dark .bubble-menu {
  background: rgba(30, 33, 48, 0.92);
  border-color: rgba(255, 255, 255, 0.1);
}
```

### Tool Groups

| Group | Tools | TinyMCE Commands |
|-------|-------|------------------|
| Text | **B** / *I* / U | `Bold`, `Italic`, `Underline` |
| Structure | H₁ / H₂ | `FormatBlock` h1/h2 |
| Lists + Link | Bullet / Numbered / Link | `InsertUnorderedList`, `InsertOrderedList`, `mceLink` |
| AI | ✨ (sparkle) | Opens AI refinement popover (existing AIToolbar logic) |

### Behavior

- Appears 200ms after selection stabilizes (debounced)
- Positioned 8px above selection top, centered horizontally
- Disappears on: click outside, Escape, empty selection
- Edge-clamped to stay within paper bounds
- Integrates with TinyMCE via iframe `getBoundingClientRect()` translation (existing pattern)

---

## 4. Left Panel — Form Redesign

### Header Zone (Fixed)

**Workflow Dots:**
- ● = completed (green check on hover)
- ◐ = current step
- ○ = future step
- Current step name as `text-sm text-muted-foreground` below dots

**Tone Selector:** Compact segmented control (single row of labeled pills) replacing 5 ToneCards with icons. Saves ~40px vertical space.

### Form Fields

**Input Style:**

```css
.canvas-input {
  background: #F5F5F7;
  border: 1.5px solid transparent;
  border-radius: 8px;
  padding: 10px 14px;
  color: #1D1D1F;
  font-size: 14px;
  transition: all 0.2s ease;
  width: 100%;
}

.canvas-input:focus {
  border-color: #243186;
  background: #FFFFFF;
  box-shadow: 0 0 0 3px rgba(36, 49, 134, 0.08);
  outline: none;
}

.canvas-input::placeholder { color: #86868B; }
```

**Changes from current `.ive-input`:**
- Closed container with soft fill (not borderless bottom-line)
- Clear focus state with brand blue border + glow ring
- Background lifts to white on focus (subtle depth cue)

### Removed Elements

- "0 von 7 Pflichtfeldern" counter → replaced with progress ring (only after 1+ fields filled)
- Duplicate "Neues Dokument" buttons
- Any zero-state counters

### AI Feature Cards (Relocated from Right Panel)

```
┌──────────────────────────────────┐
│  🤖 KI-Entwurf verfügbar    ▾  │  ← Ghostwriter (collapsed)
├──────────────────────────────────┤
│  ⚠ 2 Konsistenz-Hinweise    ▾  │  ← Consistency (only if issues)
└──────────────────────────────────┘
```

Collapsible cards between tone selector and form fields. Expand inline when clicked.

### Bottom Action Bar

Two buttons: Save Draft + Export. Subtle auto-save indicator below.

---

## 5. Client-Side Template Rendering

### Architecture

Replace 150ms debounced server API call with instant Mustache rendering.

```
Current flow (200-400ms):
  FormField onChange → updateFormField → debounce 150ms → POST /preview/html → previewHtml → editor

New flow (<5ms):
  FormField onChange → updateFormField → Mustache.render(template, formData) → editorContent → editor
```

### Template Fetch

New backend endpoint:

```
GET /api/v1/document-types/{id}/template
→ {
    html_template: "<h1>{{document_title}}</h1><p>Zwischen...</p>...",
    clause_templates: { 42: "<p>§1 {{vorname}} {{nachname}}...</p>" }
  }
```

One-time fetch when document type is selected.

### Client Rendering Hook

```typescript
// useClientRenderer.ts
import Mustache from 'mustache';

function useClientRenderer() {
  const [compiledTemplate, setCompiledTemplate] = useState<string | null>(null);

  const render = useCallback((formData: FormData, clauses: DocumentClause[]) => {
    if (!compiledTemplate) return '';

    const data = {
      ...formData,
      gehalt: formData.gehalt ? `${Number(formData.gehalt).toLocaleString('de-DE')} €` : '',
      eintrittsdatum: formData.eintrittsdatum
        ? new Date(formData.eintrittsdatum).toLocaleDateString('de-DE')
        : '',
      clauses: clauses
        .filter(c => c.is_enabled)
        .sort((a, b) => a.order_index - b.order_index),
    };

    return Mustache.render(compiledTemplate, data);
  }, [compiledTemplate]);

  return { render, setCompiledTemplate };
}
```

### Unfilled Placeholder Rendering

Template `{{vorname}}` when empty renders as:
```html
<span class="template-placeholder">Vorname</span>
```

### Server Preview Preserved For

- Export (final authoritative HTML)
- Prüfung step (compliance checks)
- Background validation (every 30s, silent correction if discrepancy)

---

## 6. Implementation Phases

### Phase 1: Visual Foundation (CSS-only, zero risk)
New design tokens, `.canvas-input`, `.canvas-paper`, `.bubble-menu` styles.
No component changes — purely additive CSS.

### Phase 2: Paper Canvas (Right Panel)
Remove toolbar from RightEditorPanel. Set TinyMCE `toolbar: false`.
Apply paper shadow and desk background. Move banners to left panel.
Add logo skeleton placeholder.

### Phase 3: Bubble Menu
New `BubbleMenu.tsx`. Selection detection via TinyMCE events.
`execCommand` for B/I/U/H1/H2/lists/link.
Merge AIToolbar into bubble. Glass pill with animation.

### Phase 4: Left Panel Redesign
Workflow dots. Segmented tone control. Filled inputs.
Remove counter, add progress ring. Simplify action bar.

### Phase 5: Client-Side Template Rendering
Backend template endpoint. `useClientRenderer` with Mustache.
Placeholder skeleton rendering. Keep server preview for export.

### Phase 6: Polish & Edge Cases
Dark mode parity. Responsive breakpoints. Keyboard accessibility.
Animation tuning. Performance profiling.

### Risk Mitigation
- Each phase independently deployable
- Phase 1 purely additive (no breakage)
- TinyMCE `toolbar: false` is one-line, easily revertible
- Server preview never removed, only supplemented
- Feature flags possible via existing `FeatureSettingsContext`

---

## Files Affected (Estimated)

### New Files
- `frontend/src/components/generator/editor/BubbleMenu.tsx`
- `frontend/src/hooks/wizard/useClientRenderer.ts`
- Backend: template endpoint in document_types router

### Modified Files (Major)
- `frontend/src/index.css` — new design tokens and classes
- `frontend/src/components/generator/editor/RightEditorPanel.tsx` — remove toolbar, desk bg
- `frontend/src/components/editor/DocumentEditor.tsx` — `toolbar: false`
- `frontend/src/components/generator/panels/LeftControlPanel.tsx` — workflow dots, tone control, banners
- `frontend/src/components/generator/panels/FormFieldsSection.tsx` — input style swap
- `frontend/src/components/generator/SplitScreenEditor.tsx` — layout adjustments
- `frontend/src/components/generator/WorkflowStepper.tsx` — refactor to dot variant
- `frontend/src/hooks/useDocumentWizard.ts` — integrate client renderer
- `frontend/src/components/generator/editor/AIToolbar.tsx` — merge into BubbleMenu

### Modified Files (Minor)
- `frontend/tailwind.config.js` — new color tokens
- `frontend/src/components/generator/WizardContext.tsx` — template state
- `frontend/src/components/generator/GhostwriterCard.tsx` — move to left panel
- `frontend/src/components/generator/ConsistencyBanner.tsx` — move to left panel
- `frontend/src/components/editor/FullDocumentPreview.tsx` — shadow update
