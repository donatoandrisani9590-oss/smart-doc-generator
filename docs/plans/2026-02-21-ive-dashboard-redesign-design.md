# Ive Dashboard Redesign

**Date:** 2026-02-21
**Status:** Approved

## Problem

The current Dashboard creates cognitive overload:
- Massive blue gradient hero banner dominates the viewport
- Linear stack of disconnected blocks doesn't scale
- Five "0" action counters clutter the interface (Paradox of Choice)
- Search bar is buried inside the hero banner
- Too many competing CTAs (KI-Chat widget, Quick Templates, Action Cards)

## Vision

A Jony Ive-inspired widget grid on a breathing light-gray canvas. Pure typography, floating white cards with multi-layer shadows, and conditional rendering that only shows what matters.

## Architecture

### Page Structure
```
bg-[#F5F5F7] Canvas (full page)
  max-w-7xl mx-auto px-6 py-8
    ├── Greeting (typography only, no card)
    ├── CSS Grid (grid-cols-1 md:grid-cols-3 lg:grid-cols-4, gap-6)
    │   ├── CommandCenter (col-span-full)
    │   ├── StatWidget × 3 (always: Diesen Monat, Offen, Gesamt)
    │   ├── OnboardingRing (conditional, 1 col) OR ActionStatWidget × N (> 0 only)
    │   ├── QuickTemplates (col-span-2)
    │   └── RecentDrafts (col-span-2)
```

### Widget Card Base (Single Source of Truth)
```css
.widget-card {
  background: white;
  border-radius: 1rem;       /* rounded-2xl */
  padding: 1.5rem;           /* p-6 */
  border: none;
  box-shadow:
    0 1px 2px rgba(0,0,0,0.04),
    0 4px 12px rgba(0,0,0,0.03),
    0 12px 28px rgba(0,0,0,0.02);
}
```
No borders. Multi-layer shadow creates floating depth.

## Modules

### 1. Greeting (No Card)
- Position: Above the grid, flush left
- Content: Time-based greeting + user first name
- Style: `text-[#1D1D1F] text-3xl font-semibold`
- Subtitle: Dynamic context in `text-[#86868B] text-base`
- Reuses existing `getGreeting()` and `getFirstName()` helpers
- Data: `useAuth()` for user email

### 2. Command Center (col-span-full)
- Single white widget card
- Large input field with Search icon (left) + Sparkles icon (right)
- Placeholder: "Dokument suchen oder KI bitten, eines zu entwerfen..."
- Focus: `ring-2 ring-primary/20` + shadow bloom (no hard border)
- Behavior:
  - Text query -> navigates to `/search?q=...` (existing global search)
  - AI intent detection: if query starts with "erstelle"/"generiere" etc. -> navigate to `/agent?prompt=...`
- Data: None (stateless input, routes on submit)

### 3. Base Stats (3 cards, always visible)

| Stat | Key | Always Shown |
|------|-----|-------------|
| Diesen Monat | `documents_this_month` | Yes |
| Offen | `open_drafts` | Yes |
| Gesamt | `documents_total` | Yes |

- Style: Large number `text-3xl font-light text-[#1D1D1F]`, label `text-xs text-[#86868B] uppercase tracking-wider`
- Skeleton loading state
- Data: `useDashboardStats()`

### 4. Action Stats (conditional, only when > 0)

| Action | API Key | Color Dot | Icon |
|--------|---------|-----------|------|
| Ohne Versand | `ohne_versand` | Amber | MailX |
| Rucksendung ausstehend | `ruecksendung_ausstehend` | Blue | RotateCcw |
| Wiedervorlage fallig | `wiedervorlage_faellig` | Red | CalendarClock |
| Freigabe offen | `freigabe_offen` | Purple | ShieldCheck |
| Entwurfe ablaufend | `entwuerfe_ablaufend` | Warm | Timer |

- Same white card style as base stats
- Small colored dot (4px) next to icon indicates urgency category
- Click navigates to `/documents?action={key}`
- **ONLY rendered when count > 0** (conditional rendering)
- Data: `/api/v1/repository/action-summary` (existing ActionSummaryCards endpoint)

### 5. Onboarding Progress Ring (conditional)
- SVG circular progress ring (stroke-based, animated)
- Shows "3 von 4" with step labels below
- Step list with checkmarks for completed, links for incomplete
- Hidden when all steps complete or localStorage dismissed
- Takes same spot in grid as action stats (competes for space gracefully)
- Data: Same props as current `OnboardingBanner` (clauseCount, documentTypeCount, hasCompanyData, hasLogo)

### 6. Quick Templates (col-span-2)
- Section header: "SCHNELLSTART" in `text-xs font-semibold text-[#86868B] uppercase tracking-wider`
- Top 3 active document types as mini-cards inside the widget
- Each has: icon (colored) + name + description (truncated) + "KI" badge
- Hover: `translateY(-1px)` + shadow increase
- SmartMode dialog reused from existing `SmartModeDialog`
- Data: `/api/v1/document-types` (existing endpoint, top 3 active)

### 7. Recent Drafts (col-span-2)
- Header: "Offene Entwurfe" + count badge + "Alle anzeigen" link (-> /documents?status=draft)
- List of recent drafts (max 5)
- Each row: FileText icon (subtle, text-[#86868B]) | Name in `text-[#1D1D1F]` | Subtitle | Timestamp in `text-[#86868B]` | ChevronRight
- Row hover: `bg-[#F5F5F7]` (same as page canvas)
- Click navigates to `/generate?draft={id}`
- Data: `useMyActivity()` hook -> `recent_drafts`

## Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Canvas | `#F5F5F7` | Page background |
| Card | `#FFFFFF` | All widget cards |
| Text Primary | `#1D1D1F` | Headings, names, numbers |
| Text Secondary | `#86868B` | Labels, timestamps, placeholders |
| Brand Primary | `#243186` | Focus rings, accents |
| Brand Green | `#6EBD84` | Success indicators |

## Responsive Behavior

| Breakpoint | Grid | Notes |
|------------|------|-------|
| Mobile (< md) | 1 col | Everything stacks vertically |
| Tablet (md) | 3 cols | Stats = 3 across, Templates + Drafts stack |
| Desktop (lg) | 4 cols | Full layout as designed |

## What Gets Removed from Dashboard
- `bg-hero-gradient` blue banner
- `DocumentWizardChat` standalone widget
- `ActionSummaryCards` component (replaced by individual conditional stat cards)
- `DeadlinesWidget`
- `ApprovalRequestsWidget`
- `EmailDraftsWidget`
- `ActivityChart`

## What Gets Reused
- `useDashboardStats()` hook
- `useMyActivity()` hook
- `useGlobalSearch()` hook (for command center)
- `getGreeting()` / `getFirstName()` helpers
- `SmartModeDialog` component
- `OnboardingBanner` step logic (refactored into ring)
- Action summary API endpoint

## Files to Create
1. `frontend/src/pages/Dashboard.tsx` (rewrite)
2. `frontend/src/components/dashboard/CommandCenter.tsx`
3. `frontend/src/components/dashboard/StatWidget.tsx`
4. `frontend/src/components/dashboard/ActionStatWidget.tsx`
5. `frontend/src/components/dashboard/OnboardingRing.tsx`
6. `frontend/src/components/dashboard/RecentDrafts.tsx`
7. `frontend/src/components/dashboard/QuickTemplatesGrid.tsx`

## Files to Modify
1. `frontend/src/index.css` (add `.widget-card` shadow + `bg-canvas` token)

## Files Kept (Not Touched)
- All existing dashboard sub-components remain in codebase (not deleted)
- API hooks unchanged
- Layout.tsx / HeaderNav unchanged
