# Briefpapier Gallery Redesign — Ive-Fidelity Stationery Cards

**Date:** 2026-02-21
**Scope:** `StationeryGalleryPage.tsx` + `StationeryCard.tsx` (2 files)
**Sidebar:** Untouched — existing active state is consistent across all 17 tabs

---

## Problem Statement

The current Briefpapier gallery has four deficiencies:

1. **Oversized cards** — 3:4 aspect ratio with a 64px `FileText` placeholder icon wastes space and looks like a wireframe
2. **No context menu** — Edit/delete actions are either missing or hidden behind hover-only overlays
3. **Unstructured header** — Title, upload button, and filter tabs float without visual hierarchy
4. **Underused design system** — None of our Ive tokens (`widget-card`, `ive-pill-tabs`, `--shadow-elevated`) are applied

## Design Decisions

### Card Component — StationeryCard

```
┌──────────────────────────────────────┐
│  ┌──────────────────────────────┐    │  ← #F5F5F7 canvas desk
│  │  ╔════════════════════╗      │    │
│  │  ║ ▬▬▬ header ▬▬▬▬▬  ║  [Standard]│  ← amber badge, top-right
│  │  ║                    ║      │    │
│  │  ║  ── ── ── ── ──   ║      │    │  ← faint lines = text hint
│  │  ║  ── ── ── ──      ║      │    │
│  │  ║                    ║      │    │
│  │  ║ ▬▬▬ footer ▬▬▬▬▬  ║      │    │
│  │  ╚════════════════════╝      │    │
│  └──────────────────────────────┘    │
│                                      │
│  Briefpapier Name             [ ⋮ ]  │  ← title + MoreVertical trigger
│  [DE] [Kopfzeile] [Fusszeile]        │  ← minimal badges
└──────────────────────────────────────┘
```

**Canvas area:**
- Outer container: `bg-[#F5F5F7]` (canvas-desk token), `p-4`, centered
- Inner "paper": Pure white, A4 proportions, subtle `shadow-canvas-paper`
- Header/footer zones: Faint colored bands rendered conditionally from `has_header` / `has_footer` / `has_logo` metadata
- If `thumbnail_url` exists: render actual thumbnail image instead of the schematic

**Standard badge:**
- `bg-amber-50 text-amber-700 border border-amber-200/60 text-xs font-medium rounded-md px-2 py-0.5`
- Positioned absolutely on canvas area, top-right

**Info section (below canvas):**
- Title: `text-[#1D1D1F] font-medium text-sm truncate`
- MoreVertical button: `ghost` variant, 28px, always visible (not hover-gated)
- Badges: `text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-0.5` — no icons inside badges

**Dropdown menu (Radix DropdownMenu):**
- Bearbeiten (Pencil icon, `text-foreground`)
- Als Standard setzen (Star icon, `text-foreground` — hidden if already default)
- Herunterladen (Download icon, `text-foreground`)
- `DropdownMenuSeparator`
- Löschen (Trash2 icon, `text-red-600`)

Only show edit/delete when `template.is_own === true`.

### Grid Layout

- `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5`
- Cards: `widget-card widget-card-interactive` classes for Ive shadow depth
- Overall grid wrapper: no extra card/border — cards float directly on the `bg-muted/30` content area already provided by SettingsHub

### Filter Tabs

Replace `Button` variants with existing `ive-pill-tabs` CSS:

```html
<div class="ive-pill-tabs">
  <button class="ive-pill-tab ive-pill-tab-active">Alle (3)</button>
  <button class="ive-pill-tab">🇩🇪 DE (3)</button>
  <button class="ive-pill-tab">🇮🇹 IT (1)</button>
</div>
```

Counts rendered inline as `(N)` — no `Badge` sub-components.

### Page Header

Same structure but tightened:
- `h2` title + `p` subtitle (unchanged)
- Upload button keeps `Plus` icon + "Briefpapier hochladen" text
- Pill tabs sit directly below header with `mt-4`

### Empty State

- Lighter Stamp icon (`w-10 h-10 text-muted-foreground/30`)
- Same copy, same upload CTA button
- Wrapped in `widget-card` for visual consistency

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/admin/StationeryCard.tsx` | Full rewrite: mini-canvas, dropdown menu, new badges |
| `frontend/src/pages/admin/StationeryGalleryPage.tsx` | Grid layout, ive-pill-tabs filters, tightened header |

## Files NOT Modified

- `SettingsHub.tsx` — sidebar active state stays as-is
- `index.css` — all needed tokens already exist
- `TemplateUploadDialog.tsx` — upload flow unchanged
- Backend — no API changes needed

## Out of Scope

- Actual thumbnail generation (backend already supports it; we show thumbnails when `thumbnail_url` is non-null)
- Sidebar active-state changes (confirmed: keep existing pattern)
- Dark mode (existing tokens handle it automatically via CSS custom properties)
