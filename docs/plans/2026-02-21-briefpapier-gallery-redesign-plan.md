# Briefpapier Gallery Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the oversized, wireframe-quality Briefpapier gallery with compact Ive-fidelity cards featuring a mini-canvas A4 preview, Radix DropdownMenu context actions, and ive-pill-tabs filter control.

**Architecture:** Pure presentational rewrite of 2 existing React components. No new files, no API changes, no routing changes. StationeryCard gets a full rewrite (mini-canvas + dropdown), StationeryGalleryPage gets filter tabs + grid layout updates. All business logic (fetch, delete, edit, set-default, download) stays unchanged.

**Tech Stack:** React 19, Tailwind CSS 4, Radix DropdownMenu (existing `@/components/ui/dropdown-menu`), Lucide icons, existing CSS tokens (`widget-card`, `ive-pill-tabs`, `--canvas-desk`, `--shadow-canvas-paper`)

**Design doc:** `docs/plans/2026-02-21-briefpapier-gallery-redesign-design.md`

---

### Task 1: Rewrite StationeryCard — Mini-Canvas + DropdownMenu

**Files:**
- Modify: `frontend/src/components/admin/StationeryCard.tsx` (full rewrite, lines 1-169)

**Step 1: Rewrite StationeryCard.tsx**

Replace the entire file content with the new implementation. The type export (`StationeryTemplate`) and props interface stay identical — only the JSX and imports change.

Key changes:
- **Remove:** `Card`, `CardContent`, `Badge`, `Button` imports; `FileText`, `Image`, `PanelTop`, `PanelBottom` icons; hover overlay pattern
- **Add:** `DropdownMenu*` imports from `@/components/ui/dropdown-menu`; `MoreVertical`, `Pencil`, `Download`, `Star`, `Trash2` icons
- **Canvas area:** Replace `aspect-[3/4]` + 64px FileText icon with a padded `bg-[var(--canvas-desk)]` container holding a white A4-proportioned mini-paper with conditional header/footer zone bands
- **Standard badge:** Repositioned on canvas, amber styling (`bg-amber-50 text-amber-700 border border-amber-200/60`)
- **Info section:** Title row with `MoreVertical` dropdown trigger on the right. Metadata badges become minimal `text-xs` pills without icons
- **DropdownMenu:** Bearbeiten, Als Standard setzen (hidden if default), Herunterladen, separator, Löschen (red). Edit/delete gated on `is_own`

```tsx
/**
 * StationeryCard - Ive-fidelity card for a Briefpapier (letterhead) template
 *
 * Compact card with mini-canvas A4 preview showing header/footer zone bands,
 * metadata badges, and a DropdownMenu for all CRUD actions.
 */

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    MoreVertical,
    Pencil,
    Download,
    Star,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (unchanged — same export contract)
// ═══════════════════════════════════════════════════════════════════════════

export interface StationeryTemplate {
    id: number;
    name: string;
    description: string | null;
    original_filename: string;
    file_size: number;
    country_code: string | null;
    has_header: boolean;
    has_footer: boolean;
    has_logo: boolean;
    font_family: string | null;
    scope: "company" | "team" | "private";
    team_id: number | null;
    category: string | null;
    template_type: "stationery" | "content";
    is_default: boolean;
    is_own: boolean;
    thumbnail_url: string | null;
    created_at: string;
    updated_at: string | null;
}

interface StationeryCardProps {
    template: StationeryTemplate;
    onSetDefault: (id: number) => void;
    onDelete: (template: StationeryTemplate) => void;
    onDownload: (template: StationeryTemplate) => void;
    onEdit: (template: StationeryTemplate) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// MINI-CANVAS — schematic A4 preview with header/footer zone bands
// ═══════════════════════════════════════════════════════════════════════════

function MiniCanvas({ template }: { template: StationeryTemplate }) {
    return (
        <div className="flex items-center justify-center p-5 bg-[var(--canvas-desk)]">
            <div
                className="relative w-full bg-white rounded-sm"
                style={{
                    aspectRatio: "210 / 297",
                    boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
                }}
            >
                {/* Header zone band */}
                {template.has_header && (
                    <div className="absolute top-0 inset-x-0 h-[14%] bg-[var(--canvas-desk)] rounded-t-sm flex items-center justify-center">
                        {template.has_logo && (
                            <div className="w-6 h-2.5 rounded-[2px] bg-[#C8C8CC]" />
                        )}
                    </div>
                )}

                {/* Text line hints — centered body area */}
                <div className="absolute inset-x-0 flex flex-col gap-[5px] px-[18%]" style={{ top: template.has_header ? "22%" : "12%" }}>
                    <div className="h-[2px] rounded-full bg-[#E5E5EA] w-[70%]" />
                    <div className="h-[2px] rounded-full bg-[#E5E5EA] w-full" />
                    <div className="h-[2px] rounded-full bg-[#E5E5EA] w-[85%]" />
                    <div className="h-[2px] rounded-full bg-[#E5E5EA] w-[60%]" />
                </div>

                {/* Footer zone band */}
                {template.has_footer && (
                    <div className="absolute bottom-0 inset-x-0 h-[10%] bg-[var(--canvas-desk)] rounded-b-sm" />
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function StationeryCard({ template, onSetDefault, onDelete, onDownload, onEdit }: StationeryCardProps) {
    return (
        <div className="widget-card widget-card-interactive overflow-hidden !p-0">
            {/* Canvas preview area */}
            <div className="relative">
                {template.thumbnail_url ? (
                    <div className="flex items-center justify-center p-5 bg-[var(--canvas-desk)]">
                        <img
                            src={template.thumbnail_url}
                            alt={template.name}
                            className="w-full rounded-sm object-contain"
                            style={{
                                aspectRatio: "210 / 297",
                                boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
                            }}
                        />
                    </div>
                ) : (
                    <MiniCanvas template={template} />
                )}

                {/* Standard badge — top right of canvas */}
                {template.is_default && (
                    <div className="absolute top-2.5 right-2.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60 rounded-md px-2 py-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                            Standard
                        </span>
                    </div>
                )}
            </div>

            {/* Info section */}
            <div className="px-4 py-3">
                {/* Title row + dropdown trigger */}
                <div className="flex items-center justify-between gap-2">
                    <h4
                        className="text-sm font-medium text-[var(--canvas-text)] truncate"
                        title={template.name}
                    >
                        {template.name}
                    </h4>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className={cn(
                                    "shrink-0 inline-flex items-center justify-center rounded-md",
                                    "w-7 h-7 text-muted-foreground/60 hover:text-foreground",
                                    "hover:bg-muted/50 transition-colors",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                )}
                            >
                                <MoreVertical className="w-4 h-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            {template.is_own && (
                                <DropdownMenuItem onClick={() => onEdit(template)}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Bearbeiten
                                </DropdownMenuItem>
                            )}
                            {!template.is_default && (
                                <DropdownMenuItem onClick={() => onSetDefault(template.id)}>
                                    <Star className="w-4 h-4 mr-2" />
                                    Als Standard setzen
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => onDownload(template)}>
                                <Download className="w-4 h-4 mr-2" />
                                Herunterladen
                            </DropdownMenuItem>
                            {template.is_own && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => onDelete(template)}
                                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Löschen
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Metadata badges */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {template.country_code && (
                        <span className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-0.5">
                            {template.country_code}
                        </span>
                    )}
                    {template.has_header && (
                        <span className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-0.5">
                            Kopfzeile
                        </span>
                    )}
                    {template.has_footer && (
                        <span className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-0.5">
                            Fusszeile
                        </span>
                    )}
                    {template.has_logo && (
                        <span className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-0.5">
                            Logo
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default StationeryCard;
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no TypeScript errors (the export contract is identical)

**Step 3: Commit**

```bash
git add frontend/src/components/admin/StationeryCard.tsx
git commit -m "feat: rewrite StationeryCard with mini-canvas preview and dropdown menu"
```

---

### Task 2: Update StationeryGalleryPage — ive-pill-tabs + Grid + Empty State

**Files:**
- Modify: `frontend/src/pages/admin/StationeryGalleryPage.tsx` (lines 11-14, 26-33, 376-463)

**Step 1: Update imports**

Remove unused imports that were only needed for the old filter buttons:
- Remove `Badge` from `@/components/ui/badge` (line 14)
- Keep all other imports unchanged

**Step 2: Replace filter tabs (lines 392-424)**

Replace the `<div className="flex gap-2 flex-wrap">` filter section with `ive-pill-tabs`:

```tsx
{/* Country Filter — ive-pill-tabs */}
{uniqueCountries.length > 0 && (
    <div className="ive-pill-tabs">
        <button
            className={cn("ive-pill-tab", activeCountryFilter === "all" && "ive-pill-tab-active")}
            onClick={() => setActiveCountryFilter("all")}
        >
            Alle ({templates.length})
        </button>
        {uniqueCountries.map((cc) => {
            const count = templates.filter(
                (t) => t.country_code?.toUpperCase() === cc
            ).length;
            return (
                <button
                    key={cc}
                    className={cn("ive-pill-tab", activeCountryFilter === cc && "ive-pill-tab-active")}
                    onClick={() => setActiveCountryFilter(cc)}
                >
                    {countryFlag(cc)} {cc} ({count})
                </button>
            );
        })}
    </div>
)}
```

This requires adding `cn` import: `import { cn } from "@/lib/utils";`

**Step 3: Update grid layout (line 451)**

Change from:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```
To:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
```

**Step 4: Update empty state (lines 432-449)**

Replace the `Card className="border-dashed"` empty state with `widget-card` styling and smaller icon:

```tsx
<div className="widget-card flex flex-col items-center justify-center py-12 text-center">
    <Stamp className="w-10 h-10 text-muted-foreground/30 mb-4" />
    <h3 className="text-base font-medium text-foreground mb-1">
        {activeCountryFilter !== "all"
            ? `Kein Briefpapier für ${countryFlag(activeCountryFilter)} ${activeCountryFilter}`
            : "Noch kein Briefpapier"}
    </h3>
    <p className="text-sm text-muted-foreground max-w-md mb-4">
        Lade eine DOCX-Datei mit deinem Firmen-Briefpapier hoch (Logo, Kopf-/Fusszeile),
        um dieses als Layout-Basis bei der Dokumentenerstellung zu verwenden.
    </p>
    <Button onClick={() => setUploadOpen(true)} variant="outline" className="gap-2">
        <Upload className="w-4 h-4" />
        Erstes Briefpapier hochladen
    </Button>
</div>
```

**Step 5: Clean up unused imports**

After edits, remove unused imports:
- Remove `Badge` (no longer used in this file)
- Remove `Card`, `CardContent` (empty state no longer uses them)
- Add `cn` from `@/lib/utils` (needed for ive-pill-tabs)

Final import block should be:
```tsx
import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Plus,
    Trash2,
    Loader2,
    Upload,
    Stamp,
    Save,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { StationeryCard } from "@/components/admin/StationeryCard";
import { TemplateUploadDialog } from "@/components/admin/TemplateUploadDialog";
import type { StationeryTemplate } from "@/components/admin/StationeryCard";
```

**Step 6: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds, no TypeScript errors, no unused import warnings

**Step 7: Commit**

```bash
git add frontend/src/pages/admin/StationeryGalleryPage.tsx
git commit -m "feat: update Briefpapier gallery with ive-pill-tabs and compact grid"
```

---

### Task 3: Visual QA — Build + Verify

**Step 1: Run full build**

Run: `cd frontend && npm run build`
Expected: Clean build, zero errors

**Step 2: Start dev server and visually verify**

Run: `cd frontend && npm run dev`

Open browser to `http://localhost:5173/settings?tab=stationery` and verify:
- [ ] Cards are compact (no more massive 3:4 icons)
- [ ] Mini-canvas shows A4 paper with header/footer zone bands
- [ ] Standard badge shows amber "Standard" on default template
- [ ] MoreVertical (⋮) button visible on every card
- [ ] Dropdown opens with: Bearbeiten, Als Standard setzen, Herunterladen, ----, Löschen
- [ ] Löschen is red, edit/delete hidden for non-owned templates
- [ ] Filter tabs use ive-pill-tabs (pill capsule style, not buttons)
- [ ] Grid is 4 columns on xl, 3 on lg, 2 on sm, 1 on mobile
- [ ] Empty state uses widget-card styling
- [ ] Cards have widget-card shadow + hover elevation

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: visual QA adjustments for Briefpapier redesign"
```
