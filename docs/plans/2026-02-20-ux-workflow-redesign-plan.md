# UX Workflow Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign Tonalität, Dokumenten-Bibliothek, Editor-Vorschau and Freigabe-Workflow for a seamless, user-friendly document lifecycle experience.

**Architecture:** Evolutionary upgrade of existing pages — no new routes. Repository.tsx gets quick-actions + filters, DocumentDetail.tsx gets prominent status/approval actions at the top, the editor always shows full document with header/footer, and ToneSlider is replaced with interactive ToneCards with AI preview.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, shadcn/ui, TinyMCE (self-hosted), existing FastAPI backend (no new endpoints needed)

---

## Task 1: ToneCards Component (Replace ToneSlider)

**Files:**
- Create: `frontend/src/components/generator/ToneCards.tsx`
- Modify: `frontend/src/components/generator/panels/LeftControlPanel.tsx` (import swap)
- Test: Manual — visual component in Wizard

**Step 1: Create ToneCards.tsx**

This replaces `ToneSlider.tsx`. Same exported types (`TONE_LEVELS`, `ToneLevel`), same props interface, but renders 5 clickable cards instead of a dot slider.

```tsx
// frontend/src/components/generator/ToneCards.tsx
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Scale, Briefcase, Handshake, Hand, Heart } from "lucide-react";

export const TONE_LEVELS = [
    { value: 1, label: "Formal", icon: Scale, description: "Juristisch exakt, sachlich" },
    { value: 2, label: "Professionell", icon: Briefcase, description: "Klar und höflich, Standard" },
    { value: 3, label: "Warm", icon: Handshake, description: "Wertschätzend, willkommen" },
    { value: 4, label: "Persönlich", icon: Hand, description: "Warme, menschliche Nähe" },
    { value: 5, label: "Empathisch", icon: Heart, description: "Einfühlsam, sensibel" },
] as const;

export type ToneLevel = 1 | 2 | 3 | 4 | 5;

interface ToneCardsProps {
    value: ToneLevel;
    onChange: (tone: ToneLevel) => void;
    disabled?: boolean;
    className?: string;
}

export function ToneCards({ value, onChange, disabled = false, className }: ToneCardsProps) {
    const handleSelect = useCallback(
        (tone: ToneLevel) => { if (!disabled) onChange(tone); },
        [disabled, onChange]
    );

    return (
        <div className={cn("space-y-1.5", className)}>
            <span className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wider">
                Tonalität
            </span>
            <div className="grid grid-cols-5 gap-1.5">
                {TONE_LEVELS.map((tone) => {
                    const isActive = tone.value === value;
                    const Icon = tone.icon;
                    return (
                        <button
                            key={tone.value}
                            type="button"
                            onClick={() => handleSelect(tone.value as ToneLevel)}
                            disabled={disabled}
                            className={cn(
                                "flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all duration-200",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                                isActive
                                    ? "border-primary bg-primary/5 scale-[1.02] shadow-sm"
                                    : "border-warm-200 hover:border-warm-300 hover:bg-warm-50",
                                disabled && "opacity-40 cursor-not-allowed"
                            )}
                            aria-label={tone.label}
                        >
                            <Icon className={cn(
                                "w-4 h-4",
                                isActive ? "text-primary" : "text-muted-foreground/60"
                            )} />
                            <span className={cn(
                                "text-[10px] font-medium leading-tight",
                                isActive ? "text-primary" : "text-muted-foreground/70"
                            )}>
                                {tone.label}
                            </span>
                        </button>
                    );
                })}
            </div>
            <p className="text-[10px] text-muted-foreground/40 text-center">
                {TONE_LEVELS[value - 1].description}
            </p>
        </div>
    );
}

export default ToneCards;
```

**Step 2: Update LeftControlPanel.tsx import**

In `frontend/src/components/generator/panels/LeftControlPanel.tsx`, change:
```tsx
// OLD
import { ToneSlider } from "../ToneSlider";
// NEW
import { ToneCards } from "../ToneCards";
```

And in the JSX (around line 135):
```tsx
// OLD
<ToneSlider value={state.toneOfVoice} onChange={actions.setToneOfVoice} />
// NEW
<ToneCards value={state.toneOfVoice} onChange={actions.setToneOfVoice} />
```

**Step 3: Build and verify**

Run: `cd frontend && npm run build`
Expected: No type errors. The old `ToneSlider.tsx` stays for now (no imports left, can be deleted later).

**Step 4: Commit**

```bash
git add frontend/src/components/generator/ToneCards.tsx frontend/src/components/generator/panels/LeftControlPanel.tsx
git commit -m "feat: replace ToneSlider with ToneCards — 5 visual icon cards for tone selection"
```

---

## Task 2: Tone Live-Preview with AI Refine + Undo

**Files:**
- Modify: `frontend/src/components/generator/ToneCards.tsx` (add preview logic)
- Modify: `frontend/src/components/generator/editor/RightEditorPanel.tsx` (wire up preview banner)

**Step 1: Add preview state and streaming to ToneCards**

Extend `ToneCards` with an `onPreviewRequest` callback prop. The parent (`RightEditorPanel`) will handle the actual streaming logic since it owns the editor content.

Add new props to `ToneCardsProps`:
```tsx
interface ToneCardsProps {
    value: ToneLevel;
    onChange: (tone: ToneLevel) => void;
    disabled?: boolean;
    className?: string;
    // NEW: Preview system
    isPreviewActive?: boolean;
    previewTone?: string;
    onPreviewRequest?: (tone: ToneLevel) => void;
    onAcceptPreview?: () => void;
    onRevertPreview?: () => void;
    isStreaming?: boolean;
}
```

Add a preview banner below the cards:
```tsx
{isPreviewActive && (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs">
        <RefreshCw className={cn("w-3.5 h-3.5 text-blue-600", isStreaming && "animate-spin")} />
        <span className="text-blue-700 flex-1">
            Vorschau: „{previewTone}"
        </span>
        <button
            onClick={onAcceptPreview}
            disabled={isStreaming}
            className="px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
            Übernehmen
        </button>
        <button
            onClick={onRevertPreview}
            className="px-2 py-0.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-100"
        >
            Original
        </button>
    </div>
)}
```

**Step 2: Wire up in RightEditorPanel.tsx**

In `RightEditorPanel.tsx`, add state for tone preview:
```tsx
const [tonePreview, setTonePreview] = useState<{
    originalContent: string;
    previewContent: string;
    tone: ToneLevel;
    isStreaming: boolean;
} | null>(null);

const handleTonePreview = useCallback(async (tone: ToneLevel) => {
    const currentContent = state.editorContent || state.previewHtml;
    if (!currentContent) return;

    setTonePreview({ originalContent: currentContent, previewContent: "", tone, isStreaming: true });

    // Use existing streaming refine endpoint
    const tonePresets: Record<number, string> = {
        1: "formal", 2: "concise", 3: "friendly", 4: "friendly", 5: "friendly"
    };

    try {
        await apiStreamSSE("/api/v1/smart/refine/stream", {
            method: "POST",
            body: JSON.stringify({
                text: currentContent,
                preset: tonePresets[tone],
                tone_of_voice: tone,
            }),
            onToken: (token) => {
                setTonePreview(prev => prev ? { ...prev, previewContent: prev.previewContent + token } : null);
            },
            onDone: () => {
                setTonePreview(prev => prev ? { ...prev, isStreaming: false } : null);
            },
        });
    } catch {
        setTonePreview(null);
    }
}, [state.editorContent, state.previewHtml]);

const handleAcceptPreview = useCallback(() => {
    if (tonePreview?.previewContent) {
        actions.setEditorContent(tonePreview.previewContent);
    }
    setTonePreview(null);
}, [tonePreview, actions]);

const handleRevertPreview = useCallback(() => {
    if (tonePreview?.originalContent) {
        actions.setEditorContent(tonePreview.originalContent);
    }
    setTonePreview(null);
}, [tonePreview, actions]);
```

Pass these as props to `ToneCards` in LeftControlPanel (or lift to RightEditorPanel toolbar).

**Step 3: Build and verify**

Run: `cd frontend && npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/components/generator/ToneCards.tsx frontend/src/components/generator/editor/RightEditorPanel.tsx
git commit -m "feat: add tone live-preview with AI streaming + undo to original"
```

---

## Task 3: Full Document Preview in Editor (Header + Footer Zones)

**Files:**
- Create: `frontend/src/components/editor/FullDocumentPreview.tsx`
- Modify: `frontend/src/components/generator/editor/RightEditorPanel.tsx` (wrap editor)
- Modify: `frontend/src/components/generator/WizardContext.tsx` (add designSettings to state)

**Step 1: Create FullDocumentPreview wrapper**

This component wraps the TinyMCE editor with static header and footer zones, creating a complete A4 document view.

```tsx
// frontend/src/components/editor/FullDocumentPreview.tsx
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DocumentZones {
    logoUrl?: string | null;
    logoPosition?: "left" | "center" | "right";
    logoWidthCm?: string;
    companyName?: string;
    headerLines: (string | null)[];
    footerLines: (string | null)[];
    primaryColor?: string;
}

interface FullDocumentPreviewProps {
    zones: DocumentZones;
    children: ReactNode; // The TinyMCE editor or read-only content
    className?: string;
    readOnly?: boolean;
}

export function FullDocumentPreview({ zones, children, className, readOnly }: FullDocumentPreviewProps) {
    const hasHeader = zones.logoUrl || zones.headerLines.some(Boolean);
    const hasFooter = zones.footerLines.some(Boolean);

    return (
        <div className={cn(
            "mx-auto bg-white dark:bg-card rounded-2xl shadow-[var(--shadow-elevated)] overflow-hidden",
            className
        )} style={{ maxWidth: "min(210mm, 100%)" }}>
            {/* Header Zone — not editable */}
            {hasHeader && (
                <div className="px-[25mm] pt-[15mm] pb-[5mm] border-b border-warm-100 select-none pointer-events-none">
                    <div className={cn(
                        "flex items-start gap-4",
                        zones.logoPosition === "right" && "flex-row-reverse",
                        zones.logoPosition === "center" && "flex-col items-center"
                    )}>
                        {zones.logoUrl && (
                            <img
                                src={zones.logoUrl}
                                alt="Firmenlogo"
                                className="object-contain"
                                style={{ width: `${zones.logoWidthCm || "5"}cm`, maxHeight: "2.5cm" }}
                            />
                        )}
                        <div className={cn(
                            "flex-1 text-xs text-muted-foreground/60 leading-relaxed",
                            zones.logoPosition === "center" && "text-center"
                        )}>
                            {zones.companyName && (
                                <p className="font-semibold text-sm" style={{ color: zones.primaryColor || "#243186" }}>
                                    {zones.companyName}
                                </p>
                            )}
                            {zones.headerLines.filter(Boolean).map((line, i) => (
                                <p key={i}>{line}</p>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Content Zone — TinyMCE editor or read-only HTML */}
            <div className="min-h-[200mm]">
                {children}
            </div>

            {/* Footer Zone — not editable */}
            {hasFooter && (
                <div className="px-[25mm] py-[10mm] border-t border-warm-100 select-none pointer-events-none">
                    <div className="text-[9px] text-muted-foreground/40 leading-relaxed text-center space-y-0.5">
                        {zones.footerLines.filter(Boolean).map((line, i) => (
                            <p key={i}>{line}</p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
```

**Step 2: Fetch DesignSettings in RightEditorPanel**

In `RightEditorPanel.tsx`, use the existing `useDesignSettings` hook:

```tsx
import { useDesignSettings } from "@/hooks/api/useDocumentTypeQueries";
import { useCountry } from "@/hooks/useCountry";
import { FullDocumentPreview } from "@/components/editor/FullDocumentPreview";

// Inside the component:
const { country } = useCountry();
const { data: designSettings } = useDesignSettings(country);

// Build zones from DesignSettings (fallback) or stationeryZones (primary)
const documentZones = useMemo(() => {
    if (stationeryZones) {
        // Stationery zones take priority — already have header/footer from template
        return null; // StationeryCanvas handles its own rendering
    }
    if (!designSettings) return null;
    return {
        logoUrl: designSettings.logo_path,
        logoPosition: designSettings.logo_position || "right",
        logoWidthCm: designSettings.logo_width_cm || "5",
        companyName: designSettings.company_name,
        headerLines: [designSettings.header_line1, designSettings.header_line2, designSettings.header_line3],
        footerLines: [designSettings.footer_line1, designSettings.footer_line2, designSettings.footer_line3],
        primaryColor: designSettings.primary_color,
    };
}, [stationeryZones, designSettings]);
```

**Step 3: Wrap editor in FullDocumentPreview**

Replace the current editor rendering block (around line 346-357) with:

```tsx
{userTemplateId && stationeryZones ? (
    <StationeryCanvas /* ...existing props... */ />
) : documentZones ? (
    <FullDocumentPreview zones={documentZones}>
        <DocumentEditor
            value={displayContent}
            onChange={handleEditorChange}
            onUserEdit={handleUserEdit}
            onEditorInit={handleEditorInit}
            isLoading={isPreviewLoading}
            className="split-screen-editor"
            compact
        />
    </FullDocumentPreview>
) : (
    <div className="bg-white dark:bg-card rounded-2xl shadow-[var(--shadow-elevated)]">
        <DocumentEditor /* ...existing fallback... */ />
    </div>
)}
```

**Step 4: Build and verify**

Run: `cd frontend && npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/editor/FullDocumentPreview.tsx frontend/src/components/generator/editor/RightEditorPanel.tsx
git commit -m "feat: always show full document with header/footer/logo in editor"
```

---

## Task 4: Repository — Enhanced Filters + "Freigabe offen" Tab

**Files:**
- Modify: `frontend/src/pages/Repository.tsx` (new tab, persistent filters, always-visible filters)

**Step 1: Add "Freigabe offen" tab**

In `Repository.tsx`, extend the status filter tabs array (around line 346):

```tsx
// Add after "Korrekturen":
{ key: "approval_pending" as const, label: "Freigabe offen", count: actionSummary?.freigabe_offen ?? 0 },
```

Update the `activeFilter` state type:
```tsx
const [activeFilter, setActiveFilter] = useState<"all" | "draft" | "completed" | "corrections" | "approval_pending">("all");
```

Add the filter logic in the data fetching section — when `activeFilter === "approval_pending"`, set the action filter to `"freigabe_offen"`.

**Step 2: Make filters always visible**

Remove the `showFilters` toggle. The filter row (Typ dropdown, Zeitraum) should always render:

```tsx
{/* Always visible filter row */}
<div className="flex gap-3 mt-3">
    <Select value={filters.document_type_id?.toString() || ""} onValueChange={/* ... */}>
        <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Alle Typen" />
        </SelectTrigger>
        {/* ... */}
    </Select>
    {/* Date range filters */}
</div>
```

**Step 3: Persist filter state to localStorage**

```tsx
const [activeFilter, setActiveFilter] = useState<string>(() => {
    return localStorage.getItem("repo-active-filter") || "all";
});

useEffect(() => {
    localStorage.setItem("repo-active-filter", activeFilter);
}, [activeFilter]);
```

**Step 4: Build and verify**

Run: `cd frontend && npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/pages/Repository.tsx
git commit -m "feat: add Freigabe-offen tab, always-visible filters, persist filter state"
```

---

## Task 5: Repository — Quick-Actions per Document Row

**Files:**
- Create: `frontend/src/components/documents/QuickStatusDropdown.tsx`
- Create: `frontend/src/components/documents/QuickApprovalButton.tsx`
- Modify: `frontend/src/pages/Repository.tsx` (add quick-actions to rows)

**Step 1: Create QuickStatusDropdown**

A popover dropdown that appears on a document row, offering status transitions:

```tsx
// frontend/src/components/documents/QuickStatusDropdown.tsx
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown, Send, Calendar, StickyNote, CheckCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

interface QuickStatusDropdownProps {
    documentId: number;
    currentStatus: string;
}

export function QuickStatusDropdown({ documentId, currentStatus }: QuickStatusDropdownProps) {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    const createAction = useMutation({
        mutationFn: async (actionType: string) => {
            return api.post(`/documents/${documentId}/actions`, { action_type: actionType });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["repository"] });
            setOpen(false);
        },
    });

    const actions = [
        { type: "sent", label: "Versendet", icon: Send },
        { type: "reminder_set", label: "Wiedervorlage", icon: Calendar },
        { type: "note", label: "Notiz", icon: StickyNote },
        { type: "completed", label: "Abschließen", icon: CheckCircle },
    ];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button size="sm" variant="ghost" className="gap-1 text-xs h-7" onClick={(e) => e.stopPropagation()}>
                    Status <ChevronDown className="w-3 h-3" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end">
                {actions.map(a => (
                    <button
                        key={a.type}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-warm-50 transition-colors"
                        onClick={(e) => { e.stopPropagation(); createAction.mutate(a.type); }}
                    >
                        <a.icon className="w-3.5 h-3.5 text-muted-foreground" />
                        {a.label}
                    </button>
                ))}
            </PopoverContent>
        </Popover>
    );
}
```

**Step 2: Create QuickApprovalButton**

```tsx
// frontend/src/components/documents/QuickApprovalButton.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
// Reuse the existing approval request dialog from DocumentApprovalPanel
// or create a lightweight inline version

interface QuickApprovalButtonProps {
    documentId: number;
}

export function QuickApprovalButton({ documentId }: QuickApprovalButtonProps) {
    const [showDialog, setShowDialog] = useState(false);

    return (
        <>
            <Button
                size="sm"
                className="gap-1 text-xs h-7 bg-primary hover:bg-primary/90"
                onClick={(e) => { e.stopPropagation(); setShowDialog(true); }}
            >
                <Send className="w-3 h-3" />
                Freigabe
            </Button>
            {/* Reuse DocumentApprovalPanel's request dialog or create inline */}
            {showDialog && (
                // ApprovalRequestDialog component (extract from DocumentApprovalPanel)
                null
            )}
        </>
    );
}
```

**Step 3: Add to Repository.tsx document rows**

In the hover actions section (around line 730), add after existing buttons:

```tsx
{item.type === "document" && (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <QuickStatusDropdown documentId={item.id} currentStatus={item.workflow_status} />
        <QuickApprovalButton documentId={item.id} />
        <Button size="sm" variant="ghost" className="h-7" onClick={(e) => { e.stopPropagation(); /* download */ }}>
            <Download className="w-3.5 h-3.5" />
        </Button>
    </div>
)}
```

**Step 4: Build and verify**

Run: `cd frontend && npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/documents/QuickStatusDropdown.tsx frontend/src/components/documents/QuickApprovalButton.tsx frontend/src/pages/Repository.tsx
git commit -m "feat: add quick-action buttons (status change, approval, download) to document rows"
```

---

## Task 6: DocumentDetail — Prominent Status & Approval Actions at Top

**Files:**
- Modify: `frontend/src/pages/DocumentDetail.tsx` (move status/approval actions to top)

**Step 1: Add status action bar below the existing action bar**

Currently the status actions are hidden inside the "Verwaltung" tab. Move the most important actions to a prominent bar just below the header action bar.

After the action bar div (around line 275), add:

```tsx
{/* Prominent Status & Approval Bar */}
<div className="shrink-0 mx-1 mb-3">
    <div className="card-soft p-4 space-y-3">
        {/* Current Status */}
        <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status:</span>
            <DocumentStatusBadge status={document.workflow_status} />
            {pendingApproval && (
                <Badge variant="outline" className="border-amber-300 text-amber-700 text-[10px]">
                    Freigabe ausstehend
                </Badge>
            )}
        </div>

        {/* Primary Actions */}
        <div className="flex flex-wrap gap-2">
            {/* Show "Zur Freigabe senden" as primary CTA if no pending approval */}
            {!pendingApproval && (
                <Button size="sm" className="gap-1.5" onClick={() => { setActiveTab("freigabe"); setSidebarOpen(true); }}>
                    <Send className="w-3.5 h-3.5" />
                    Zur Freigabe senden
                </Button>
            )}

            {/* Approver actions if current user is the approver */}
            {pendingApproval && isApprover && (
                <>
                    <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700" onClick={handleApprove}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Freigeben
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 border-orange-300 text-orange-700" onClick={handleRequestChanges}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Änderungen anfordern
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 border-red-300 text-red-700" onClick={handleReject}>
                        <XCircle className="w-3.5 h-3.5" />
                        Ablehnen
                    </Button>
                </>
            )}

            {/* Secondary actions */}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleQuickAction("sent")}>
                <Mail className="w-3.5 h-3.5" />
                Versendet
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleQuickAction("completed")}>
                <CheckCircle className="w-3.5 h-3.5" />
                Abschließen
            </Button>
        </div>
    </div>
</div>
```

**Step 2: Fetch approval data at page level**

Use the existing `useDocumentApproval` hook at the DocumentDetail level:
```tsx
import { useDocumentApproval } from "@/hooks/useDocumentApproval";

const { data: approval } = useDocumentApproval(document?.id);
const isApprover = approval?.approver_id === currentUser?.id;
const pendingApproval = approval?.status === "pending_approval";
```

**Step 3: Build and verify**

Run: `cd frontend && npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/pages/DocumentDetail.tsx
git commit -m "feat: promote status and approval actions to top of DocumentDetail page"
```

---

## Task 7: Wizard Success Banner with Approval CTA

**Files:**
- Modify: `frontend/src/components/generator/editor/RightEditorPanel.tsx` (add success banner)

**Step 1: Add inline success banner after generation**

Use existing state fields `hasExported` and `lastExportedDocumentId` from WizardContext.

After the banners section (ComplianceRiskBanner, ConsistencyBanner, etc.) and before the editor, add:

```tsx
{/* Post-Export Success Banner */}
{state.hasExported && state.lastExportedDocumentId && (
    <div className="mb-3 p-4 rounded-xl bg-green-50 border border-green-200 space-y-3">
        <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-900 text-sm">Dokument erfolgreich generiert!</span>
        </div>
        <div className="flex gap-2">
            <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                    // Trigger download (existing logic from ActionBar)
                    window.open(`/api/v1/repository/${state.lastExportedDocumentId}/download`, "_blank");
                }}
            >
                <Download className="w-3.5 h-3.5" />
                Herunterladen
            </Button>
            <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setShowApprovalDialog(true)}
            >
                <Send className="w-3.5 h-3.5" />
                Zur Freigabe senden
            </Button>
            <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 ml-auto"
                onClick={() => navigate(`/documents/${state.lastExportedDocumentId}`)}
            >
                In Bibliothek öffnen
                <ArrowRight className="w-3.5 h-3.5" />
            </Button>
        </div>
    </div>
)}
```

**Step 2: Add ApprovalRequestDialog state**

```tsx
const [showApprovalDialog, setShowApprovalDialog] = useState(false);
```

Reuse the approval request dialog from DocumentApprovalPanel (extract it into a shared component if not already separate).

**Step 3: Build and verify**

Run: `cd frontend && npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/components/generator/editor/RightEditorPanel.tsx
git commit -m "feat: add success banner with approval CTA after document generation"
```

---

## Task 8: Document Preview in DocumentDetail with Full Header/Footer

**Files:**
- Modify: `frontend/src/pages/DocumentDetail.tsx` (wrap preview in FullDocumentPreview)

**Step 1: Import and use FullDocumentPreview**

The DocumentDetail page currently renders `DocumentPreviewPanel` for the left side. Wrap it with the same `FullDocumentPreview` component:

```tsx
import { FullDocumentPreview } from "@/components/editor/FullDocumentPreview";
import { useDesignSettings } from "@/hooks/api/useDocumentTypeQueries";
import { useCountry } from "@/hooks/useCountry";

// Inside the component:
const { country } = useCountry();
const { data: designSettings } = useDesignSettings(country);

const documentZones = useMemo(() => {
    if (!designSettings) return null;
    return {
        logoUrl: designSettings.logo_path,
        logoPosition: designSettings.logo_position || "right",
        logoWidthCm: designSettings.logo_width_cm || "5",
        companyName: designSettings.company_name,
        headerLines: [designSettings.header_line1, designSettings.header_line2, designSettings.header_line3],
        footerLines: [designSettings.footer_line1, designSettings.footer_line2, designSettings.footer_line3],
        primaryColor: designSettings.primary_color,
    };
}, [designSettings]);
```

Wrap the `DocumentPreviewPanel`:
```tsx
{documentZones ? (
    <FullDocumentPreview zones={documentZones} readOnly>
        <DocumentPreviewPanel /* ...existing props... */ />
    </FullDocumentPreview>
) : (
    <DocumentPreviewPanel /* ...existing props... */ />
)}
```

**Step 2: Build and verify**

Run: `cd frontend && npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/pages/DocumentDetail.tsx
git commit -m "feat: wrap DocumentDetail preview with full header/footer/logo"
```

---

## Task 9: Enhanced Comment Sidebar for Approval Flow

**Files:**
- Modify: `frontend/src/pages/DocumentDetail.tsx` (auto-open comments for approvers)

**Step 1: Auto-open comment sidebar for approvers**

When a document has a pending approval and the current user is the approver, automatically open the comment tab and sidebar:

```tsx
// In a useEffect after approval data loads:
useEffect(() => {
    if (approval?.status === "pending_approval" && isApprover) {
        // Auto-open comments tab for approvers
        setActiveTab("kommentare");
        setSidebarOpen(true);
    }
}, [approval?.status, isApprover]);
```

**Step 2: Add approval context hint in comment sidebar**

When in approval mode, show a hint at the top of the comments sidebar:

```tsx
{pendingApproval && isApprover && activeTab === "kommentare" && (
    <div className="p-3 mb-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
        <p className="font-medium">Freigabe-Prüfung</p>
        <p className="mt-1 text-amber-700">
            Markieren Sie Text im Dokument, um Kommentare hinzuzufügen.
            Nutzen Sie die Aktionen oben, um das Dokument freizugeben oder Änderungen anzufordern.
        </p>
    </div>
)}
```

**Step 3: Build and verify**

Run: `cd frontend && npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/pages/DocumentDetail.tsx
git commit -m "feat: auto-open comment sidebar for approvers, add review guidance hint"
```

---

## Task 10: Final Build Verification + Cleanup

**Files:**
- Delete: `frontend/src/components/generator/ToneSlider.tsx` (if no remaining imports)

**Step 1: Check for remaining ToneSlider imports**

Run: `grep -r "ToneSlider" frontend/src/`
Expected: No matches (or only in the old file itself)

If clean, delete `ToneSlider.tsx`.

**Step 2: Full build**

Run: `cd frontend && npm run build`
Expected: PASS with zero errors

**Step 3: Backend tests**

Run: `cd backend && python -m pytest tests/ -x -q`
Expected: Same baseline pass/fail as before (no backend changes)

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: remove deprecated ToneSlider, final cleanup"
```

---

## Summary of All Tasks

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|----------------|
| 1 | ToneCards component | `ToneCards.tsx` | `LeftControlPanel.tsx` |
| 2 | Tone live-preview with AI | — | `ToneCards.tsx`, `RightEditorPanel.tsx` |
| 3 | Full document preview (header/footer) | `FullDocumentPreview.tsx` | `RightEditorPanel.tsx` |
| 4 | Repository filters + Freigabe tab | — | `Repository.tsx` |
| 5 | Quick-actions per document row | `QuickStatusDropdown.tsx`, `QuickApprovalButton.tsx` | `Repository.tsx` |
| 6 | Prominent status/approval in DocumentDetail | — | `DocumentDetail.tsx` |
| 7 | Wizard success banner with approval CTA | — | `RightEditorPanel.tsx` |
| 8 | Full preview in DocumentDetail | — | `DocumentDetail.tsx` |
| 9 | Enhanced comment sidebar for approvers | — | `DocumentDetail.tsx` |
| 10 | Cleanup + verification | Delete `ToneSlider.tsx` | — |

**Estimated new files:** 4
**Estimated modified files:** 5
**Backend changes:** 0 (all endpoints already exist)
