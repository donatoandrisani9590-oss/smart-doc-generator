# Sprint 3: Design-Harmonisierung — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Standardize z-index hierarchy, replace hardcoded hex colors with semantic tokens, unify typography to design-token scale, and convert CSS border-radius to token variables.

**Architecture:** 4 independent fix groups (z-index, colors, typography, border-radius), each committable separately. All changes are visual-only — no logic changes.

**Tech Stack:** React 19, Tailwind CSS 4, CSS custom properties, shadcn/ui

---

## Task 1: Z-Index — Tooltip & CountrySelector (z-50 → z-20)

Fix tooltips and dropdowns that share z-50 with modals, causing overlap conflicts.

**Files:**
- Modify: `frontend/src/components/ui/tooltip.tsx:21`
- Modify: `frontend/src/components/layout/CountrySelector.tsx:70`

**Step 1: Fix tooltip.tsx**

Line 21, change `z-50` to `z-20`:

```tsx
// OLD:
"z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 ..."

// NEW:
"z-20 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 ..."
```

**Step 2: Fix CountrySelector.tsx**

Line 70, change `z-50` to `z-20`:

```tsx
// OLD:
className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-border/50 overflow-hidden z-50"

// NEW:
className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-border/50 overflow-hidden z-20"
```

**Step 3: Verify build**

Run: `cd frontend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add frontend/src/components/ui/tooltip.tsx frontend/src/components/layout/CountrySelector.tsx
git commit -m "fix(z-index): move tooltip and country dropdown to z-20

Tooltips and dropdowns should render below modals (z-50) and
backdrops (z-40), not at the same layer. Follows 5-tier hierarchy:
z-10 indicators, z-20 popovers, z-30 headers, z-40 backdrops, z-50 modals.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Z-Index — NotificationDropdown & DocumentApprovalPanel

**Files:**
- Modify: `frontend/src/components/notifications/NotificationDropdown.tsx:112`
- Modify: `frontend/src/components/documents/DocumentApprovalPanel.tsx:590`

**Step 1: Fix NotificationDropdown.tsx**

Line 112, change `z-50` to `z-20` on the dropdown content (backdrop on line 107 stays z-40):

```tsx
// OLD (line 112):
<div className="absolute right-0 top-full mt-2 w-96 bg-background border rounded-lg shadow-xl z-50 overflow-hidden">

// NEW:
<div className="absolute right-0 top-full mt-2 w-96 bg-background border rounded-lg shadow-xl z-20 overflow-hidden">
```

**Step 2: Fix DocumentApprovalPanel.tsx**

Line 590, change `z-10` to `z-20` on the autocomplete dropdown:

```tsx
// OLD (line 590):
<div className="absolute z-10 w-full mt-1 bg-white border border-warm-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">

// NEW:
<div className="absolute z-20 w-full mt-1 bg-white border border-warm-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
```

**Step 3: Commit**

```bash
git add frontend/src/components/notifications/NotificationDropdown.tsx frontend/src/components/documents/DocumentApprovalPanel.tsx
git commit -m "fix(z-index): notification dropdown z-20, approval autocomplete z-20

NotificationDropdown content moves from z-50 (modal layer) to z-20
(popover layer). DocumentApprovalPanel autocomplete moves from z-10
(indicator layer) to z-20 (popover layer).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Z-Index — Dialog Overlay (z-50 → z-40)

The dialog overlay and content both share z-50. Overlay should be z-40 (backdrop), content stays z-50 (modal).

**Files:**
- Modify: `frontend/src/components/ui/dialog.tsx:23`

**Step 1: Fix dialog.tsx overlay**

Line 23, change `z-50` to `z-40` on `DialogOverlay`:

```tsx
// OLD:
"fixed inset-0 z-50 glass-overlay",

// NEW:
"fixed inset-0 z-40 glass-overlay",
```

Line 43 (`DialogContent`) stays `z-50` — correct.

**Step 2: Commit**

```bash
git add frontend/src/components/ui/dialog.tsx
git commit -m "fix(z-index): dialog overlay z-40, content stays z-50

Separates backdrop (z-40) from modal content (z-50) so the overlay
doesn't compete with the dialog itself for stacking context.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Hardcoded Colors — Dashboard.tsx & StatWidget.tsx

Replace `text-[#1D1D1F]` → `text-foreground` and `text-[#86868B]` → `text-muted-foreground`.

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx` (lines 102, 105)
- Modify: `frontend/src/components/dashboard/StatWidget.tsx` (lines 37, 41, 46)

**Step 1: Fix Dashboard.tsx**

```tsx
// Line 102 OLD:
<h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] dark:text-foreground">

// NEW (remove dark: prefix since token handles both):
<h1 className="text-3xl font-semibold tracking-tight text-foreground">

// Line 105 OLD:
<p className="text-base text-[#86868B] dark:text-muted-foreground mt-1">

// NEW:
<p className="text-base text-muted-foreground mt-1">
```

**Step 2: Fix StatWidget.tsx**

```tsx
// Line 37 OLD:
<p className="text-3xl font-light tracking-tight text-[#1D1D1F] dark:text-foreground">
// NEW:
<p className="text-3xl font-light tracking-tight text-foreground">

// Line 41 OLD:
<p className="text-xs text-[#86868B] dark:text-muted-foreground uppercase tracking-wider mt-1">
// NEW:
<p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">

// Line 46 OLD:
<Icon className="w-4 h-4 text-[#86868B] dark:text-muted-foreground opacity-60" />
// NEW:
<Icon className="w-4 h-4 text-muted-foreground opacity-60" />
```

**Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx frontend/src/components/dashboard/StatWidget.tsx
git commit -m "fix(tokens): replace hardcoded hex colors with semantic tokens

Dashboard: text-[#1D1D1F] → text-foreground, text-[#86868B] → text-muted-foreground.
StatWidget: same 3 replacements. Removes redundant dark: prefixes since
semantic tokens handle dark mode natively.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Hardcoded Colors — CompanySettingsPage.tsx

**Files:**
- Modify: `frontend/src/pages/admin/CompanySettingsPage.tsx` (lines 237, 283, 369, 382, 468)

**Step 1: Replace all 5 instances**

```tsx
// Line 237 OLD:
<h1 className="text-xl font-semibold tracking-tight text-[#1D1D1F]">
// NEW:
<h1 className="text-xl font-semibold tracking-tight text-foreground">

// Line 283 OLD:
<h2 className="text-[15px] font-semibold text-[#1D1D1F]">
// NEW:
<h2 className="text-base font-semibold text-foreground">

// Line 369 OLD:
<h2 className="text-[15px] font-semibold text-[#1D1D1F]">
// NEW:
<h2 className="text-base font-semibold text-foreground">

// Line 382 OLD:
className="text-sm font-medium text-[#1D1D1F] flex items-center gap-2"
// NEW:
className="text-sm font-medium text-foreground flex items-center gap-2"

// Line 468 OLD:
className="text-sm font-medium text-[#1D1D1F] flex items-center gap-2"
// NEW:
className="text-sm font-medium text-foreground flex items-center gap-2"
```

**Step 2: Commit**

```bash
git add frontend/src/pages/admin/CompanySettingsPage.tsx
git commit -m "fix(tokens): CompanySettingsPage hex colors → semantic tokens

5 instances of text-[#1D1D1F] → text-foreground.
2 instances of text-[15px] → text-base (typography fix bundled).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Hardcoded Colors — AttachmentsPage.tsx

**Files:**
- Modify: `frontend/src/pages/admin/AttachmentsPage.tsx` (lines 507, 523, 542, 657)

**Step 1: Replace gradient hex colors with semantic tokens**

```tsx
// Line 507 OLD:
<Card className="bg-gradient-to-br from-[#243186]/5 to-[#243186]/10 border-primary/20">
// NEW:
<Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">

// Line 523 OLD:
<Card className="bg-gradient-to-br from-[#6EBD84]/5 to-[#6EBD84]/10 border-[#6EBD84]/20">
// NEW:
<Card className="bg-gradient-to-br from-secondary/5 to-secondary/10 border-secondary/20">

// Line 542 OLD:
<div className="w-12 h-12 rounded-xl bg-[#6E6E73]/10 flex items-center justify-center">
// NEW:
<div className="w-12 h-12 rounded-xl bg-muted-foreground/10 flex items-center justify-center">

// Line 657 OLD:
<div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#243186]/5 to-[#243186]/10 flex items-center justify-center flex-shrink-0">
// NEW:
<div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center flex-shrink-0">
```

**Step 2: Commit**

```bash
git add frontend/src/pages/admin/AttachmentsPage.tsx
git commit -m "fix(tokens): AttachmentsPage hex gradients → semantic tokens

from-[#243186] → from-primary, from-[#6EBD84] → from-secondary,
bg-[#6E6E73] → bg-muted-foreground. Design-system propagation ready.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Hardcoded Colors — index.css (Editor & Placeholder Chips)

**Files:**
- Modify: `frontend/src/index.css` (lines 1010, 1018, 1035, 1037, 1039, 1042, 1050)

**Step 1: Replace hex colors with CSS custom property tokens**

```css
/* Line 1010 OLD: */
  color: #374151;
/* NEW: */
  color: hsl(var(--muted-foreground));

/* Line 1018 OLD: */
  color: #9ca3af;
/* NEW: */
  color: hsl(var(--muted-foreground) / 0.6);

/* Line 1035 OLD: */
  background: #eef2ff;
/* NEW: */
  background: hsl(var(--primary) / 0.05);

/* Line 1037 OLD: */
  color: #4f46e5;
/* NEW: */
  color: hsl(var(--primary));

/* Line 1039 OLD: */
  border-radius: 4px;
/* NEW (also fixes border-radius token): */
  border-radius: calc(var(--radius) - 8px);

/* Line 1042 OLD: */
  border: 1px solid #e0e7ff;
/* NEW: */
  border: 1px solid hsl(var(--primary) / 0.1);

/* Line 1050 OLD: */
  background: #e0e7ff;
/* NEW: */
  background: hsl(var(--primary) / 0.1);
```

**Step 2: Commit**

```bash
git add frontend/src/index.css
git commit -m "fix(tokens): index.css hardcoded hex → CSS custom property tokens

Editor text: #374151 → --muted-foreground
Placeholder text: #9ca3af → --muted-foreground/0.6
Placeholder chips: indigo hex → --primary tokens (bg, color, border)
Also fixes placeholder-chip border-radius to use --radius token.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Typography — Add text-2xs Token

Add the missing `text-2xs` font size token to the Tailwind config for 10px badge/micro-label text.

**Files:**
- Modify: `frontend/tailwind.config.js`

**Step 1: Add fontSize configuration**

After the `fontFamily` block (line 81), add:

```js
            fontSize: {
                '2xs': ['10px', { lineHeight: '14px' }],
            },
```

The full `theme.extend` section should look like:

```js
theme: {
    extend: {
        colors: { ... },
        borderRadius: { ... },
        fontFamily: { ... },
        fontSize: {
            '2xs': ['10px', { lineHeight: '14px' }],
        },
        boxShadow: { ... },
        ...
    },
},
```

**Step 2: Verify build**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/tailwind.config.js
git commit -m "feat(tokens): add text-2xs (10px) font size token

New token for badges, micro-labels, and status indicators.
Maps text-[10px] to a proper design-system value.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Typography — Replace Arbitrary Sizes in AgentPage & LegalAuditPage

These two files have the highest density of arbitrary font sizes.

**Files:**
- Modify: `frontend/src/pages/AgentPage.tsx` (8 replacements)
- Modify: `frontend/src/pages/admin/LegalAuditPage.tsx` (10 replacements)

**Step 1: Fix AgentPage.tsx**

Apply these replacements using replace_all where possible:

| Line | Old | New |
|------|-----|-----|
| 226, 310, 333, 354 | `text-[10px]` | `text-2xs` |
| 266, 282 | `text-[10px]` | `text-2xs` |
| 316, 339, 361 | `text-[11px]` | `text-xs` |

**Step 2: Fix LegalAuditPage.tsx**

| Line | Old | New |
|------|-----|-----|
| 140 | `text-[12px]` | `text-xs` |
| 445 | `text-[13px]` | `text-sm` |
| 455, 466 | `text-[11px]` | `text-xs` |
| 471, 479, 486 | `text-[12px]` | `text-xs` |
| 498, 514 | `text-[11px]` | `text-xs` |

**Step 3: Commit**

```bash
git add frontend/src/pages/AgentPage.tsx frontend/src/pages/admin/LegalAuditPage.tsx
git commit -m "fix(typography): AgentPage + LegalAuditPage arbitrary px → tokens

text-[10px] → text-2xs, text-[11px] → text-xs,
text-[12px] → text-xs, text-[13px] → text-sm.
18 replacements across 2 files.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Typography — Replace Arbitrary Sizes in Repository, Search, SettingsHub, DesignManager

**Files:**
- Modify: `frontend/src/pages/Repository.tsx` (4 replacements)
- Modify: `frontend/src/pages/Search.tsx` (4 replacements)
- Modify: `frontend/src/pages/SettingsHub.tsx` (5 replacements)
- Modify: `frontend/src/pages/admin/DesignManager.tsx` (7 replacements)

**Step 1: Fix Repository.tsx**

| Line | Old | New |
|------|-----|-----|
| 459 | `text-[11px]` | `text-xs` |
| 527, 552, 564 | `text-[13px]` | `text-sm` |

**Step 2: Fix Search.tsx**

| Line | Old | New |
|------|-----|-----|
| 199, 222, 234, 246 | `text-[13px]` | `text-sm` |

**Step 3: Fix SettingsHub.tsx**

| Line | Old | New |
|------|-----|-----|
| 286 | `text-[13px]` | `text-sm` |
| 297 | `text-[12px]` | `text-xs` |
| 298 | `text-[10px]` | `text-2xs` |
| 332 | `text-[10px]` | `text-2xs` |
| 341 | `text-[13px]` | `text-sm` |

**Step 4: Fix DesignManager.tsx**

| Line | Old | New |
|------|-----|-----|
| 684, 689, 698, 705, 714 | `text-[10px]` | `text-2xs` |
| 724 | `text-[9px]` | `text-2xs` |
| 690 | `text-[11px]` | `text-xs` |
| 730 | `text-[11px]` | `text-xs` |

**Step 5: Commit**

```bash
git add frontend/src/pages/Repository.tsx frontend/src/pages/Search.tsx frontend/src/pages/SettingsHub.tsx frontend/src/pages/admin/DesignManager.tsx
git commit -m "fix(typography): Repository/Search/Settings/DesignManager → tokens

20 replacements: text-[9-13px] → text-2xs/text-xs/text-sm.
Unifies typography across filter labels, metadata, and previews.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 11: CSS Border-Radius — index.css

Convert hardcoded pixel values in index.css to CSS custom property tokens.

**Files:**
- Modify: `frontend/src/index.css` (2 targeted fixes)

**Step 1: Fix logo-skeleton border-radius**

```css
/* Line 597 OLD: */
    border-radius: 6px;
/* NEW: */
    border-radius: calc(var(--radius) - 6px);
```

**Step 2: Keep intentional values**

These stay as-is (intentional overrides):
- Line 489: `border-radius: 0 !important;` — canvas-input focus reset
- Line 998: `border-radius: 2px;` — sub-token level, too small for token
- Line 1097: `border-radius: 0 !important;` — TinyMCE override

Note: Line 1039 (placeholder-chip) was already fixed in Task 7.

**Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "fix(tokens): index.css border-radius → var(--radius) token

logo-skeleton: 6px → calc(var(--radius) - 6px).
Intentional overrides (0, 2px) kept as-is.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 12: CSS Border-Radius — preview.css & magic-import.css

**Files:**
- Modify: `frontend/src/styles/preview.css` (lines 262, 269, 294, 383)
- Modify: `frontend/src/styles/magic-import.css` (lines 14, 214, 235, 305, 365, 379)

**Step 1: Fix preview.css**

```css
/* Line 262 OLD: */
    border-radius: 8px;
/* NEW: */
    border-radius: var(--radius-sm, 8px);

/* Line 269 OLD: */
    border-radius: 4px !important;
/* NEW: */
    border-radius: var(--radius-xs, 4px) !important;

/* Line 294 — keep 2px (sub-token) */

/* Line 383 OLD: */
    border-radius: 4px !important;
/* NEW: */
    border-radius: var(--radius-xs, 4px) !important;
```

**Step 2: Fix magic-import.css**

```css
/* Line 14 OLD: */
    border-radius: 8px;
/* NEW: */
    border-radius: var(--radius-sm, 8px);

/* Line 97 — keep 3px (sub-token) */
/* Line 154 — keep 50% (circle, intentional) */
/* Line 273 — keep 9999px (pill, intentional) */

/* Lines 214, 305, 365, 379 OLD: */
    border-radius: 4px;
/* NEW: */
    border-radius: var(--radius-xs, 4px);

/* Line 235 OLD: */
    border-radius: 8px;
/* NEW: */
    border-radius: var(--radius-sm, 8px);

/* Line 261 OLD: */
    border-radius: 6px;
/* NEW: */
    border-radius: calc(var(--radius) - 6px);
```

**Step 3: Add radius token vars to index.css (if not present)**

Check if `--radius-sm` and `--radius-xs` are defined. If not, add to the `:root` section in `index.css`:

```css
  --radius-sm: 8px;
  --radius-xs: 4px;
```

**Step 4: Commit**

```bash
git add frontend/src/styles/preview.css frontend/src/styles/magic-import.css frontend/src/index.css
git commit -m "fix(tokens): CSS border-radius → var(--radius) tokens

preview.css: 3 fixes (8px → --radius-sm, 4px → --radius-xs)
magic-import.css: 7 fixes (8px → --radius-sm, 4px → --radius-xs, 6px → calc)
Intentional values (2px, 3px, 50%, 9999px) kept as-is.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Inline borderRadius → Tailwind Classes

**Files:**
- Modify: `frontend/src/components/onboarding/OnboardingTour.tsx:260`

**Step 1: Fix OnboardingTour.tsx**

This is a style prop on a highlight overlay div. The `borderRadius: "8px"` can stay as inline style since the whole object is dynamic positioning (`top`, `left`, `width`, `height` are computed at runtime). Replacing just `borderRadius` with a Tailwind class while keeping the rest as inline style would be inconsistent. Mark as intentional — no change needed.

**Step 2: Verify no other inline borderRadius in TSX**

The grep found only 1 instance. Skip this task — inline style is appropriate for dynamically positioned overlays.

---

## Task 14: Final Build Verification

**Step 1: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

**Step 2: Run production build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 3: Verify no remaining hardcoded hex colors in key files**

Run: `cd frontend && grep -rn "text-\[#" src/pages/Dashboard.tsx src/components/dashboard/StatWidget.tsx src/pages/admin/CompanySettingsPage.tsx src/pages/admin/AttachmentsPage.tsx`
Expected: 0 results

**Step 4: Verify text-2xs is available**

Run: `cd frontend && grep -rn "text-2xs" src/ | head -5`
Expected: Multiple results showing the new token in use
