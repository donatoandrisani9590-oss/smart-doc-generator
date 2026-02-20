# Design: "Neues Dokument erstellen" — Jony Ive Redesign

**Date:** 2026-02-21
**Status:** Approved
**Scope:** Redesign of StepDocumentType.tsx (596 lines) into a card-grid Progressive Disclosure UI

## Problem

The current "Neues Dokument erstellen" page is a flat, list-based wireframe with poor contrast (#A0A0A0 on white), broken UX flow (disconnected document name input, no clear CTA), and empty categories rendered. Users are overwhelmed with all fields at once.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Transition to naming step | Modal (shadcn Dialog) | Simplest, mobile-friendly, uses existing component |
| KI-Button placement | Both buttons in modal | Single-location focus after card click |
| Template selection | In modal (collapsible) | Progressive Disclosure stays clean |
| Nav "Neues Dokument" button | Dimmed/disabled on /generate | Context-aware without hiding |
| Recently used display | Own row above categories (compact) | Quick access without breaking hierarchy |

## Page Layout

- Centered content: `max-w-3xl` (800px), `py-12 px-6`
- Title: `text-3xl font-semibold tracking-tight` in `#1D1D1F`
- Subtitle: `text-base text-[#86868B]` with `mt-2 mb-8`
- Category headers: `text-xs font-medium uppercase tracking-wider text-[#86868B]`
- Empty categories (0 items) are NOT rendered

## Search Bar

- Dimensions: `h-12 px-4 text-base rounded-xl`
- Border: `border border-warm-200`
- Focus: `focus:ring-2 focus:ring-primary/20 focus:border-primary/40` (no hard outline)
- Search icon left (`text-[#86868B]`), X clear button right when text present
- Placeholder: `"Dokumenttyp suchen..."` in `text-[#86868B]/60`

## Template Card (The Star)

### Grid Layout
- Categories: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- Recently used: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` (compact, no description)

### Card Styling
- Base: `bg-white rounded-2xl border border-warm-100 p-5`
- Hover: `hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]`
- Transition: `transition-all duration-300 ease-out`
- Focus: `focus-visible:ring-2 focus-visible:ring-primary/30`
- Cursor: `cursor-pointer`

### Card Content
- Icon: Lucide React, mapped by category (see icon mapping below)
- Title: `font-semibold text-[#1D1D1F]`
- Description: `text-sm text-[#86868B]` (1-2 lines, from document type description field)
- Category badge: bottom-right, small pill

### Icon Mapping
| Category | Lucide Icon |
|----------|-------------|
| Vertrag | Briefcase |
| Beendigung | FileX |
| Brief | Mail |
| Mitteilung | MessageSquare |
| Bescheinigung | Award |
| Nachtrag | FilePlus |
| Disziplinar | AlertTriangle |
| Fallback | FileText |

## Create Document Dialog (Modal)

Triggered when user clicks a template card.

### Layout
- shadcn `<Dialog>` with `max-w-md`
- Header: Category icon + document type name + category badge
- Separator after header
- Body:
  - Document name input (auto-focus)
  - Placeholder: `"z.B. Arbeitsvertrag Max Müller"`
  - Helper text: `"Dieser Name erscheint in deiner Dokumentübersicht."`
  - Collapsible "Vorlage verwenden (optional)" section
    - Same logic as current template selection
- Footer:
  - Primary: "Erstellen" → `enterSplitScreenMode()`
  - Secondary: "Mit KI erstellen ✨" → opens SmartModeDialog
  - "Erstellen" disabled when title is empty
  - Enter key = submit (when title filled)

## Header Button Logic

- When `location.pathname === "/generate"`: "Neues Dokument" button gets `disabled`
- Styling: `opacity-50 cursor-not-allowed pointer-events-none`

## Component Architecture

```
StepDocumentType.tsx (~200 lines, refactored)
├── TemplateCard.tsx (~60 lines, new)
├── TemplateGrid.tsx (~80 lines, new)
├── CreateDocumentDialog.tsx (~120 lines, new)
└── categoryIcons.ts (~20 lines, new mapping)
```

### Unchanged
- WizardContext.tsx — no changes
- useDocumentWizard.ts — no changes
- DocumentWizard.tsx — no changes (query param support stays)
- SmartModeDialog — opened from within CreateDocumentDialog
- Recently-used localStorage logic — preserved, rendered differently

## Data Flow

```
User sees card grid
    ↓
Click card → setSelectedType(type) → open Dialog
    ↓
User types document name → local state
    ↓
[Optional] User expands template section → selects template
    ↓
Click "Erstellen":
  → actions.setDocumentType(type.id)
  → actions.setDocumentTitle(title)
  → saveRecentType(type.id)
  → [if template] actions.setUserTemplateId(id)
  → actions.enterSplitScreenMode()
    ↓
OR Click "Mit KI erstellen":
  → actions.setDocumentType(type.id)
  → actions.setDocumentTitle(title)
  → saveRecentType(type.id)
  → open SmartModeDialog
```

## Accessibility

- Cards are `<button>` elements with `role="button"` and `aria-label`
- Dialog has proper `aria-labelledby` and `aria-describedby`
- Focus trap in dialog
- Keyboard navigation: Tab through cards, Enter to select, Escape to close dialog
- Category sections use `<section>` with `aria-labelledby` heading
