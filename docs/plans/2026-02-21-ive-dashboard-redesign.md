# Ive Dashboard Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current cognitive-overload Dashboard with a Jony Ive-inspired widget grid on a breathing light-gray canvas.

**Architecture:** 7 new/rewritten components compose a CSS Grid dashboard. Leaf components (StatWidget, ActionStatWidget, OnboardingRing) are built first, then container components (CommandCenter, QuickTemplatesGrid, RecentDrafts), and finally the Dashboard page wires them all together. Existing API hooks are reused unchanged.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Lucide icons, TanStack Query (existing hooks)

---

### Task 1: Add Widget Shadow Token

**Files:**
- Modify: `frontend/tailwind.config.js` (line 96, inside `boxShadow`)
- Modify: `frontend/src/index.css` (after line 500, inside `@layer utilities`)

**Step 1: Add `widget` shadow to tailwind.config.js**

In `frontend/tailwind.config.js`, inside `theme.extend.boxShadow`, add after the `'elevated-hover'` entry:

```js
'widget': '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03), 0 12px 28px rgba(0,0,0,0.02)',
'widget-hover': '0 2px 4px rgba(0,0,0,0.05), 0 8px 16px rgba(0,0,0,0.04), 0 16px 32px rgba(0,0,0,0.03)',
```

**Step 2: Add `.widget-card` utility class to index.css**

In `frontend/src/index.css`, inside `@layer utilities`, add after the `.ive-card-interactive:hover` rule (~line 500):

```css
/* Widget card — Ive dashboard floating surface */
.widget-card {
  background: hsl(var(--card));
  border: none;
  border-radius: 1.25rem; /* rounded-2xl = 20px */
  padding: 1.5rem;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03), 0 12px 28px rgba(0,0,0,0.02);
  transition: box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.widget-card-interactive:hover {
  box-shadow: 0 2px 4px rgba(0,0,0,0.05), 0 8px 16px rgba(0,0,0,0.04), 0 16px 32px rgba(0,0,0,0.03);
  transform: translateY(-1px);
}

.dark .widget-card {
  box-shadow: 0 1px 3px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15), 0 12px 28px rgba(0,0,0,0.1);
}
.dark .widget-card-interactive:hover {
  box-shadow: 0 2px 6px rgba(0,0,0,0.25), 0 8px 16px rgba(0,0,0,0.2), 0 16px 32px rgba(0,0,0,0.15);
}
```

**Step 3: Build to verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/tailwind.config.js frontend/src/index.css
git commit -m "feat(dashboard): add widget-card shadow token for Ive redesign"
```

---

### Task 2: Create StatWidget Component

**Files:**
- Create: `frontend/src/components/dashboard/StatWidget.tsx`

**Step 1: Create the component**

```tsx
/**
 * StatWidget — Single stat metric card for the Ive dashboard grid.
 * Large number + small label on a floating white surface.
 */

import { type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatWidgetProps {
  value: number;
  label: string;
  icon?: LucideIcon;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

export function StatWidget({ value, label, icon: Icon, loading, onClick, className }: StatWidgetProps) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      className={cn(
        "widget-card text-left",
        onClick && "widget-card-interactive cursor-pointer",
        className
      )}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      <div className="flex items-start justify-between">
        <div>
          {loading ? (
            <Skeleton className="h-9 w-16 rounded" />
          ) : (
            <p className="text-3xl font-light tracking-tight text-[#1D1D1F] dark:text-foreground">
              {value}
            </p>
          )}
          <p className="text-xs text-[#86868B] dark:text-muted-foreground uppercase tracking-wider mt-1">
            {label}
          </p>
        </div>
        {Icon && (
          <Icon className="w-4 h-4 text-[#86868B] dark:text-muted-foreground opacity-60" />
        )}
      </div>
    </Wrapper>
  );
}
```

**Step 2: Build to verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/dashboard/StatWidget.tsx
git commit -m "feat(dashboard): add StatWidget component"
```

---

### Task 3: Create ActionStatWidget Component

**Files:**
- Create: `frontend/src/components/dashboard/ActionStatWidget.tsx`

**Step 1: Create the component**

```tsx
/**
 * ActionStatWidget — Conditional action-stat card.
 * Only renders when count > 0. Shows colored accent dot for urgency.
 * Clicking navigates to filtered document list.
 */

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionStatWidgetProps {
  value: number;
  label: string;
  icon: LucideIcon;
  accentColor: string; // e.g. "bg-amber-500"
  onClick: () => void;
  className?: string;
}

export function ActionStatWidget({ value, label, icon: Icon, accentColor, onClick, className }: ActionStatWidgetProps) {
  // Core design rule: zero-value action stats are never rendered
  if (value === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("widget-card widget-card-interactive text-left cursor-pointer", className)}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("w-1.5 h-1.5 rounded-full", accentColor)} />
        <Icon className="w-4 h-4 text-[#86868B] dark:text-muted-foreground" />
      </div>
      <p className="text-2xl font-light tracking-tight text-[#1D1D1F] dark:text-foreground">
        {value}
      </p>
      <p className="text-xs text-[#86868B] dark:text-muted-foreground uppercase tracking-wider mt-1">
        {label}
      </p>
    </button>
  );
}
```

**Step 2: Build to verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/dashboard/ActionStatWidget.tsx
git commit -m "feat(dashboard): add ActionStatWidget with conditional rendering"
```

---

### Task 4: Create OnboardingRing Component

**Files:**
- Create: `frontend/src/components/dashboard/OnboardingRing.tsx`

**Step 1: Create the component**

```tsx
/**
 * OnboardingRing — Circular progress widget for first-time setup.
 * SVG ring shows completion progress, step list below with links.
 * Hidden when all steps complete or dismissed.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Building2, Palette, FileText, LayoutTemplate, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingRingProps {
  clauseCount: number;
  documentTypeCount: number;
  hasCompanyData: boolean;
  hasLogo: boolean;
  onDismiss: () => void;
  className?: string;
}

interface Step {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  isComplete: boolean;
}

export function OnboardingRing({
  clauseCount,
  documentTypeCount,
  hasCompanyData,
  hasLogo,
  onDismiss,
  className,
}: OnboardingRingProps) {
  const steps: Step[] = useMemo(
    () => [
      { id: "company", label: "Firmendaten", icon: Building2, href: "/settings?tab=general", isComplete: hasCompanyData },
      { id: "branding", label: "Branding", icon: Palette, href: "/settings?tab=design", isComplete: hasLogo },
      { id: "clauses", label: "Textbausteine", icon: FileText, href: "/settings?tab=clauses", isComplete: clauseCount > 0 },
      { id: "templates", label: "Vorlage erstellen", icon: LayoutTemplate, href: "/settings?tab=templates", isComplete: documentTypeCount > 0 },
    ],
    [hasCompanyData, hasLogo, clauseCount, documentTypeCount]
  );

  const completedCount = steps.filter((s) => s.isComplete).length;
  const total = steps.length;

  if (completedCount === total) return null;

  // SVG ring geometry
  const size = 64;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (completedCount / total) * circumference;

  return (
    <div className={cn("widget-card relative", className)}>
      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-foreground transition-colors p-1 rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-muted"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Ring + count */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative">
          <svg width={size} height={size} className="-rotate-90">
            {/* Background ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(220 13% 91%)"
              strokeWidth={strokeWidth}
              className="dark:stroke-[hsl(225,12%,20%)]"
            />
            {/* Progress ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(228 58% 33%)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className="dark:stroke-primary transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-[#1D1D1F] dark:text-foreground">
            {completedCount}/{total}
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-[#1D1D1F] dark:text-foreground">Einrichtung</p>
          <p className="text-xs text-[#86868B] dark:text-muted-foreground">
            {total - completedCount} {total - completedCount === 1 ? "Schritt" : "Schritte"} verbleibend
          </p>
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-1.5">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.id}
              to={step.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                step.isComplete
                  ? "text-secondary"
                  : "text-[#86868B] dark:text-muted-foreground hover:text-[#1D1D1F] dark:hover:text-foreground hover:bg-[#F5F5F7] dark:hover:bg-muted"
              )}
            >
              {step.isComplete ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Icon className="w-3.5 h-3.5" />
              )}
              {step.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Build to verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/dashboard/OnboardingRing.tsx
git commit -m "feat(dashboard): add OnboardingRing progress widget"
```

---

### Task 5: Create CommandCenter Component

**Files:**
- Create: `frontend/src/components/dashboard/CommandCenter.tsx`

**Step 1: Create the component**

```tsx
/**
 * CommandCenter — Unified search + AI input for the dashboard.
 * Merges document search and KI-Dokumentassistent into one field.
 * Routes to /search for text queries, /agent for AI intents.
 */

import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandCenterProps {
  className?: string;
}

const AI_PREFIXES = ["erstelle", "generiere", "schreibe", "verfasse", "entwirf", "mach"];

export function CommandCenter({ className }: CommandCenterProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    // Detect AI intent by prefix
    const lowerQuery = trimmed.toLowerCase();
    const isAiIntent = AI_PREFIXES.some((p) => lowerQuery.startsWith(p));

    if (isAiIntent) {
      navigate(`/agent?prompt=${encodeURIComponent(trimmed)}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("widget-card !p-0 overflow-hidden", className)}
    >
      <div className={cn(
        "flex items-center gap-3 px-5 py-4 transition-shadow duration-200",
        isFocused && "shadow-[0_0_0_2px_hsl(228_58%_33%/0.15)]  rounded-2xl"
      )}>
        <Search className="w-5 h-5 text-[#86868B] dark:text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Dokument suchen oder KI bitten, eines zu entwerfen..."
          className="flex-1 bg-transparent text-[#1D1D1F] dark:text-foreground placeholder:text-[#86868B]/60 dark:placeholder:text-muted-foreground/40 text-base outline-none border-none"
        />
        <Sparkles className={cn(
          "w-5 h-5 shrink-0 transition-colors",
          isFocused ? "text-primary" : "text-[#86868B]/40 dark:text-muted-foreground/30"
        )} />
      </div>
    </form>
  );
}
```

**Step 2: Build to verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/dashboard/CommandCenter.tsx
git commit -m "feat(dashboard): add CommandCenter search + AI input"
```

---

### Task 6: Create QuickTemplatesGrid Component

**Files:**
- Create: `frontend/src/components/dashboard/QuickTemplatesGrid.tsx`

Note: This replaces the existing `QuickTemplates.tsx` on the Dashboard but does NOT delete it (it may be used elsewhere). The new component reuses the same icon-mapping logic and SmartModeDialog integration.

**Step 1: Create the component**

```tsx
/**
 * QuickTemplatesGrid — Top 3 document type cards for quick access.
 * Each card is a mini floating surface inside a widget-card container.
 * Hover: translateY(-1px) + shadow lift. "KI" badge for SmartMode.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, Briefcase, FileSignature, UserMinus, Wand2, Award,
  AlertTriangle, Home, GraduationCap, Car, FileCheck, Clock,
  Gift, ScrollText, Shield,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SmartModeDialog } from "@/components/generator/SmartModeDialog";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import { cn } from "@/lib/utils";

interface DocumentType {
  id: number;
  name: string;
  description?: string;
  country_code: string;
  is_active: boolean;
}

const getIconForType = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("arbeitsvertrag") || n.includes("anstellung")) return Briefcase;
  if (n.includes("einstellungszusage") || n.includes("zusage")) return FileCheck;
  if (n.includes("geheimhaltung") || n.includes("nda")) return Shield;
  if (n.includes("nachtrag") || n.includes("änderung")) return FileSignature;
  if (n.includes("gehaltserh") || n.includes("beförderung")) return Award;
  if (n.includes("abmahnung")) return AlertTriangle;
  if (n.includes("homeoffice") || n.includes("remote")) return Home;
  if (n.includes("fortbildung") || n.includes("weiterbildung")) return GraduationCap;
  if (n.includes("firmenwagen")) return Car;
  if (n.includes("bonus") || n.includes("prämie")) return Gift;
  if (n.includes("überstunden") || n.includes("arbeitszeit")) return Clock;
  if (n.includes("kündigung") || n.includes("aufhebung")) return UserMinus;
  if (n.includes("zeugnis")) return ScrollText;
  if (n.includes("freistellung")) return FileCheck;
  return FileText;
};

const ICON_COLORS = [
  "text-primary",
  "text-[#6EBD84]",
  "text-warm-500",
];

interface QuickTemplatesGridProps {
  className?: string;
}

export function QuickTemplatesGrid({ className }: QuickTemplatesGridProps) {
  const navigate = useNavigate();
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [smartModeOpen, setSmartModeOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);

  useEffect(() => {
    api.get<DocumentType[]>("/api/v1/document-types")
      .then(({ data }) => setTypes(data.filter((t) => t.is_active).slice(0, 3)))
      .catch((err) => logError("Failed to load quick templates", { error: err }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={cn("widget-card", className)}>
        <p className="text-xs font-semibold text-[#86868B] uppercase tracking-wider mb-4">Schnellstart</p>
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (types.length === 0) return null;

  return (
    <div className={cn("widget-card", className)}>
      <p className="text-xs font-semibold text-[#86868B] dark:text-muted-foreground uppercase tracking-wider mb-4">
        Schnellstart
      </p>
      <div className="grid grid-cols-1 gap-2">
        {types.map((type, index) => {
          const Icon = getIconForType(type.name);
          const iconColor = ICON_COLORS[index % ICON_COLORS.length];

          return (
            <div
              key={type.id}
              className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-[#F5F5F7] dark:hover:bg-muted hover:-translate-y-px group"
            >
              <button
                onClick={() => navigate(`/generate?type=${type.id}`)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <Icon className={cn("w-5 h-5 shrink-0", iconColor)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1D1D1F] dark:text-foreground truncate">
                    {type.name}
                  </p>
                  {type.description && (
                    <p className="text-xs text-[#86868B] dark:text-muted-foreground truncate">
                      {type.description}
                    </p>
                  )}
                </div>
              </button>
              <button
                onClick={() => {
                  setSelectedType(type);
                  setSmartModeOpen(true);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/8 text-primary text-xs font-medium hover:bg-primary/15 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                title="Mit KI erstellen"
              >
                <Wand2 className="w-3 h-3" />
                KI
              </button>
            </div>
          );
        })}
      </div>

      {selectedType && (
        <SmartModeDialog
          open={smartModeOpen}
          onOpenChange={setSmartModeOpen}
          documentTypeId={selectedType.id}
          documentTypeName={selectedType.name}
          onComplete={(formData, title) => {
            const params = new URLSearchParams();
            params.set("type", String(selectedType.id));
            params.set("data", JSON.stringify(formData));
            params.set("title", title);
            navigate(`/generate?${params.toString()}`);
          }}
        />
      )}
    </div>
  );
}
```

**Step 2: Build to verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/dashboard/QuickTemplatesGrid.tsx
git commit -m "feat(dashboard): add QuickTemplatesGrid widget"
```

---

### Task 7: Create RecentDrafts Component

**Files:**
- Create: `frontend/src/components/dashboard/RecentDrafts.tsx`

**Step 1: Create the component**

```tsx
/**
 * RecentDrafts — List of recently edited drafts in a widget card.
 * Each row: FileText icon | Name + subtitle | Timestamp | ChevronRight
 * Row hover: subtle bg change. Click navigates to editor.
 */

import { Link } from "react-router-dom";
import { FileText, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyActivity, type RecentDraft } from "@/hooks/api/useDashboardQueries";
import { cn } from "@/lib/utils";

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Minuten`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `vor ${diffHours} ${diffHours === 1 ? "Stunde" : "Stunden"}`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `vor ${diffDays} ${diffDays === 1 ? "Tag" : "Tagen"}`;
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

interface RecentDraftsProps {
  className?: string;
  limit?: number;
}

export function RecentDrafts({ className, limit = 5 }: RecentDraftsProps) {
  const { data, isLoading } = useMyActivity(limit);
  const drafts = data?.recent_drafts ?? [];

  if (!isLoading && drafts.length === 0) return null;

  return (
    <div className={cn("widget-card", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <p className="text-xs font-semibold text-[#86868B] dark:text-muted-foreground uppercase tracking-wider">
            Offene Entwürfe
          </p>
          {!isLoading && drafts.length > 0 && (
            <span className="text-xs text-[#86868B] dark:text-muted-foreground bg-[#F5F5F7] dark:bg-muted px-2 py-0.5 rounded-full tabular-nums">
              {drafts.length}
            </span>
          )}
        </div>
        <Link
          to="/documents?status=draft"
          className="text-xs text-primary hover:underline font-medium"
        >
          Alle anzeigen
        </Link>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-0.5">
          {drafts.map((draft: RecentDraft) => (
            <Link
              key={draft.id}
              to={`/generate?draft=${draft.id}`}
              className="flex items-center gap-3 px-3 py-3 -mx-1 rounded-xl transition-colors hover:bg-[#F5F5F7] dark:hover:bg-muted group"
            >
              <FileText className="w-4 h-4 text-[#86868B] dark:text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1D1D1F] dark:text-foreground truncate">
                  {draft.document_type_name}
                </p>
                <p className="text-xs text-[#86868B] dark:text-muted-foreground truncate">
                  {draft.name || "Unbenannter Entwurf"}
                  {draft.updated_at && (
                    <> &middot; {formatRelativeTime(draft.updated_at)}</>
                  )}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#86868B]/40 dark:text-muted-foreground/30 group-hover:text-[#86868B] dark:group-hover:text-muted-foreground transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Build to verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/dashboard/RecentDrafts.tsx
git commit -m "feat(dashboard): add RecentDrafts widget with relative timestamps"
```

---

### Task 8: Rewrite Dashboard.tsx

**Files:**
- Rewrite: `frontend/src/pages/Dashboard.tsx`

This is the main composition file. It wires all 6 widget components into the grid layout.

**Step 1: Rewrite the Dashboard**

Replace the entire content of `frontend/src/pages/Dashboard.tsx` with:

```tsx
/**
 * Dashboard — Ive-Inspired Widget Grid
 *
 * Breathing light-gray canvas (#F5F5F7) with floating white widget cards.
 * No hero banner. Pure typography greeting. Conditional action stats.
 * Grid: 1 col mobile → 3 col tablet → 4 col desktop.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileBarChart,
  FileStack,
  Files,
  MailX,
  RotateCcw,
  CalendarClock,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats, useDocumentTypes } from "@/hooks/useApi";
import { useClauses } from "@/hooks/useApi";
import { api } from "@/lib/api-client";
import { CommandCenter } from "@/components/dashboard/CommandCenter";
import { StatWidget } from "@/components/dashboard/StatWidget";
import { ActionStatWidget } from "@/components/dashboard/ActionStatWidget";
import { OnboardingRing } from "@/components/dashboard/OnboardingRing";
import { QuickTemplatesGrid } from "@/components/dashboard/QuickTemplatesGrid";
import { RecentDrafts } from "@/components/dashboard/RecentDrafts";

// ── Helpers (unchanged from original) ────────────────────────────────────

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
};

const getFirstName = (email: string): string | null => {
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/);
  if (parts.length > 0 && parts[0].length > 1) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  }
  return null;
};

// ── Action Summary Types ─────────────────────────────────────────────────

interface ActionSummaryResponse {
  ohne_versand: number;
  ruecksendung_ausstehend: number;
  wiedervorlage_faellig: number;
  freigabe_offen: number;
  entwuerfe_ablaufend: number;
}

const ACTION_STATS = [
  { key: "ohne_versand" as const, label: "Ohne Versand", icon: MailX, accent: "bg-amber-500" },
  { key: "ruecksendung_ausstehend" as const, label: "Rücksendung ausstehend", icon: RotateCcw, accent: "bg-blue-500" },
  { key: "wiedervorlage_faellig" as const, label: "Wiedervorlage fällig", icon: CalendarClock, accent: "bg-red-500" },
  { key: "freigabe_offen" as const, label: "Freigabe offen", icon: ShieldCheck, accent: "bg-purple-500" },
  { key: "entwuerfe_ablaufend" as const, label: "Entwürfe ablaufend", icon: Timer, accent: "bg-warm-400" },
];

// ── Component ────────────────────────────────────────────────────────────

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: clauses } = useClauses();
  const { data: documentTypes } = useDocumentTypes();

  const [actionSummary, setActionSummary] = useState<ActionSummaryResponse | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem("onboarding-dismissed") === "true"
  );

  const firstName = user ? getFirstName(user.email) : null;

  // Fetch action summary for conditional stat cards
  useEffect(() => {
    api.get<ActionSummaryResponse>("/api/v1/repository/action-summary")
      .then(({ data }) => setActionSummary(data))
      .catch(() => {});
  }, []);

  const handleDismissOnboarding = () => {
    setOnboardingDismissed(true);
    localStorage.setItem("onboarding-dismissed", "true");
  };

  const showOnboarding = !onboardingDismissed && !statsLoading;
  const hasDocTypes = (documentTypes?.length ?? 0) > 0;

  // Compute greeting subtitle
  const openDrafts = stats?.open_drafts ?? 0;
  const subtitle = !hasDocTypes
    ? "Richte deine erste Dokumentvorlage ein"
    : openDrafts > 0
      ? `Du hast ${openDrafts} offene ${openDrafts === 1 ? "Entwurf" : "Entwürfe"}`
      : "Alles erledigt — Zeit für neue Projekte!";

  return (
    <div className="animate-enter">
      {/* ── Canvas Container ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-8 space-y-8">

        {/* ── Greeting (no card, pure typography) ── */}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] dark:text-foreground">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-base text-[#86868B] dark:text-muted-foreground mt-1">
            {subtitle}
          </p>
        </div>

        {/* ── Widget Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">

          {/* Command Center — full width */}
          <div className="col-span-1 md:col-span-3 lg:col-span-4">
            <CommandCenter />
          </div>

          {/* Base Stats — always visible */}
          <StatWidget
            value={stats?.documents_this_month ?? 0}
            label="Diesen Monat"
            icon={FileBarChart}
            loading={statsLoading}
          />
          <StatWidget
            value={stats?.open_drafts ?? 0}
            label="Offen"
            icon={FileStack}
            loading={statsLoading}
            onClick={() => navigate("/documents?status=draft")}
          />
          <StatWidget
            value={stats?.documents_total ?? 0}
            label="Gesamt"
            icon={Files}
            loading={statsLoading}
            onClick={() => navigate("/documents")}
          />

          {/* Onboarding OR 4th stat fills the remaining column */}
          {showOnboarding ? (
            <OnboardingRing
              clauseCount={clauses?.length ?? 0}
              documentTypeCount={documentTypes?.length ?? 0}
              hasCompanyData={(stats?.documents_total ?? 0) > 0 || (documentTypes?.length ?? 0) > 0}
              hasLogo={false}
              onDismiss={handleDismissOnboarding}
            />
          ) : (
            // If no onboarding, render the first non-zero action stat here (if any)
            actionSummary && (() => {
              const first = ACTION_STATS.find((a) => (actionSummary[a.key] ?? 0) > 0);
              if (!first) return null;
              return (
                <ActionStatWidget
                  value={actionSummary[first.key]}
                  label={first.label}
                  icon={first.icon}
                  accentColor={first.accent}
                  onClick={() => navigate(`/documents?action=${first.key}`)}
                />
              );
            })()
          )}

          {/* Remaining action stats (skip the one already placed above) */}
          {actionSummary && ACTION_STATS
            .filter((a) => (actionSummary[a.key] ?? 0) > 0)
            .filter((_, i) => showOnboarding || i > 0) // skip first if used above
            .map((a) => (
              <ActionStatWidget
                key={a.key}
                value={actionSummary[a.key]}
                label={a.label}
                icon={a.icon}
                accentColor={a.accent}
                onClick={() => navigate(`/documents?action=${a.key}`)}
              />
            ))
          }

          {/* Quick Templates — 2 cols */}
          {hasDocTypes && (
            <div className="col-span-1 md:col-span-2 lg:col-span-2">
              <QuickTemplatesGrid />
            </div>
          )}

          {/* Recent Drafts — 2 cols */}
          <div className="col-span-1 md:col-span-1 lg:col-span-2">
            <RecentDrafts />
          </div>
        </div>

      </div>
    </div>
  );
};
```

**Step 2: Build to verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no TypeScript or bundling errors

**Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat(dashboard): Ive-inspired widget grid redesign

Replaces the blue hero banner + linear stack layout with:
- Breathing #F5F5F7 canvas with pure typography greeting
- Unified Command Center (search + AI)
- Individual floating stat widget cards
- Conditional action stats (hidden when 0)
- SVG progress ring for onboarding
- Quick templates + recent drafts in 2-col grid"
```

---

### Task 9: Visual Verification & Polish

**Step 1: Run dev server and verify**

Run: `cd frontend && npm run dev`

Verify in browser at http://localhost:5173/:
- [ ] No blue hero banner
- [ ] Clean text greeting on light-gray canvas
- [ ] Command Center spans full width
- [ ] 3 base stat cards in a row (+ onboarding or action stat in 4th slot)
- [ ] Zero-value action stats are NOT visible
- [ ] Quick templates show top 3 doc types
- [ ] Recent drafts show with icons, timestamps, chevrons
- [ ] Hover effects work: card lift, bg change on list items, KI badge fade-in
- [ ] Dark mode toggle works correctly
- [ ] Mobile responsiveness: stacks to 1 column

**Step 2: Fix any visual issues found during verification**

Adjust padding, spacing, colors as needed.

**Step 3: Final commit**

```bash
git add -A
git commit -m "fix(dashboard): visual polish from verification pass"
```

---

### Task 10: Final Build Verification

**Step 1: Run full production build**

Run: `cd frontend && npm run build`
Expected: Build succeeds, no warnings about unused imports

**Step 2: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 3: Run linter**

Run: `cd frontend && npx eslint src/pages/Dashboard.tsx src/components/dashboard/CommandCenter.tsx src/components/dashboard/StatWidget.tsx src/components/dashboard/ActionStatWidget.tsx src/components/dashboard/OnboardingRing.tsx src/components/dashboard/QuickTemplatesGrid.tsx src/components/dashboard/RecentDrafts.tsx`
Expected: No errors (warnings acceptable)
