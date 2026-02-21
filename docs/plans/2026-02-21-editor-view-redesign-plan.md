# Editor View Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine all 3 panes of the editor view for visual consistency and add a Floating Action Panel for export, attachments, deadlines, and approval.

**Architecture:** Evolutionary polish of existing SplitScreenEditor structure — CSS refinements to Sidebar, LeftControlPanel section grouping, Canvas desk enhancements, plus a new EditorActionPanel component. No backend changes. All APIs exist.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, shadcn/ui, existing WizardContext state, existing TanStack Query hooks.

---

### Task 1: Sidebar Visual Polish

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

**Step 1: Update SidebarItem active/hover states**

In `Sidebar.tsx`, update the `SidebarItem` component's `cn()` classes (lines 31-38):

```tsx
const SidebarItem = ({ icon: Icon, label, href, active, badge, collapsed }: SidebarItemProps) => (
    <Link
        to={href}
        title={collapsed ? label : undefined}
        className={cn(
            "group flex items-center transition-all duration-150 rounded-lg mx-1",
            collapsed
                ? "justify-center px-0 py-2.5"
                : "justify-between px-3 py-2",
            active
                ? "bg-white dark:bg-white/10 shadow-soft-xs text-primary font-medium"
                : "text-foreground/50 hover:bg-warm-100 dark:hover:bg-warm-100/10 hover:text-foreground"
        )}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? label : undefined}
    >
```

**Step 2: Update Sidebar container background**

In `Sidebar.tsx`, update the outer `<div>` (line 122-125):

Change `glass-sidebar` to explicit warm background:
```tsx
<div className={cn(
    "h-screen flex flex-col font-sans bg-warm-50/80 dark:bg-card border-r border-warm-100 dark:border-border transition-all duration-200",
    collapsed ? "w-16" : "w-[260px]"
)}>
```

**Step 3: Update logo area separator**

At line 127, update the logo container:
```tsx
<div className={cn("h-16 flex items-center border-b border-warm-100 dark:border-border/50", collapsed ? "px-3 justify-center" : "px-5")}>
```

**Step 4: Update SidebarSection spacing**

In `SidebarSection` (line 70), update the section header button opacity:
```tsx
className="flex items-center justify-between w-full px-4 py-1.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-widest hover:text-muted-foreground/60 transition-colors"
```

**Step 5: Update bottom section styling**

At line 238, update the user dropdown area:
```tsx
<div className={cn(
    "border-t border-warm-100 dark:border-border/50",
    collapsed ? "p-2" : "p-3"
)}>
```

**Step 6: Build and verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds with zero errors.

**Step 7: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "style(sidebar): warm background, active pills, consistent spacing"
```

---

### Task 2: Canvas Desk Refinements

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/generator/editor/RightEditorPanel.tsx`

**Step 1: Add radial gradient to .canvas-desk**

In `index.css`, find the `.canvas-desk` class and add the radial gradient:

```css
.canvas-desk {
  background-color: var(--canvas-desk);
  background-image: radial-gradient(
    ellipse at 50% 40%,
    rgba(255, 255, 255, 0.4) 0%,
    transparent 70%
  );
}
```

**Step 2: Add ring to .canvas-paper for edge definition**

In `index.css`, find the `.canvas-paper` class and add:

```css
.canvas-paper {
  /* ... existing shadow ... */
  outline: 1px solid rgba(0, 0, 0, 0.02);
  border-radius: 0.5rem;  /* rounded-lg */
}
```

**Step 3: Increase canvas padding in RightEditorPanel**

In `RightEditorPanel.tsx` line 177, update the editor container padding:

Change:
```tsx
<div className="flex-1 overflow-auto bg-transparent p-4 md:p-6 lg:p-8 pb-10 md:pb-12 lg:pb-16">
```
To:
```tsx
<div className="flex-1 overflow-auto bg-transparent p-6 md:p-8 lg:p-12 pb-24 md:pb-28 lg:pb-32">
```

**Step 4: Build and verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add frontend/src/index.css frontend/src/components/generator/editor/RightEditorPanel.tsx
git commit -m "style(canvas): radial gradient on desk, paper edge ring, increased padding"
```

---

### Task 3: LeftControlPanel Section Grouping

**Files:**
- Modify: `frontend/src/components/generator/panels/FormFieldsSection.tsx`
- Modify: `frontend/src/components/generator/panels/LeftControlPanel.tsx`

**Step 1: Wrap Mitarbeiterdaten section in group container**

In `FormFieldsSection.tsx`, find the `{/* Mitarbeiterdaten */}` section (line 497). Wrap the `<div className="space-y-3">` in a group container:

```tsx
{/* Mitarbeiterdaten */}
<div className="bg-warm-50/50 dark:bg-warm-50/5 rounded-xl p-3 space-y-3">
    <h4 className="ive-section-header">
        {labels.section_employee}
    </h4>
    {/* ... rest of employee fields ... */}
</div>
```

**Step 2: Wrap Vertragsdaten section in group container**

Find `{/* Vertragsdaten */}` (line 592). Replace the `pt-5 border-t border-border/15` with the group container:

```tsx
{/* Vertragsdaten */}
<div className="bg-warm-50/50 dark:bg-warm-50/5 rounded-xl p-3 space-y-3">
    <h4 className="ive-section-header">
        {labels.section_contract}
    </h4>
    {/* ... rest of contract fields (remove the pt-5 border-t from the wrapper) ... */}
</div>
```

**Step 3: Wrap Zusatzleistungen section in group container**

Find `{/* Zusatzleistungen */}` (line 792). Same treatment:

```tsx
{/* Zusatzleistungen */}
<div className="bg-warm-50/50 dark:bg-warm-50/5 rounded-xl p-3 space-y-3">
    <h4 className="ive-section-header">
        {labels.section_benefits}
    </h4>
    {/* ... checkboxes (remove pt-5 border-t) ... */}
</div>
```

**Step 4: Wrap Unterzeichner section in group container**

Find `{/* Unterzeichner */}` (line 948). Same treatment:

```tsx
<div className="bg-warm-50/50 dark:bg-warm-50/5 rounded-xl p-3 space-y-3">
    <h4 className="ive-section-header">
        {labels.section_signatory}
    </h4>
    {/* ... signatory field (remove pt-5 border-t) ... */}
</div>
```

**Step 5: Wrap AT-Optionen section in group container**

Find `{/* AT-Optionen */}` (line 905). Same treatment:

```tsx
{formData.vertragsart === "at_angestellter" && (
    <div className="bg-warm-50/50 dark:bg-warm-50/5 rounded-xl p-3 space-y-3">
        <h4 className="ive-section-header">
            {labels.section_at}
        </h4>
        {/* ... AT checkboxes (remove pt-5 border-t) ... */}
    </div>
)}
```

**Step 6: Update outer container spacing**

In `FormFieldsSection.tsx` line 432, update the outer container:

Change: `<div className="space-y-5 px-0.5">`
To: `<div className="space-y-4">`

**Step 7: Update LeftControlPanel scrollarea content spacing**

In `LeftControlPanel.tsx` line 131, ensure consistent padding:

Verify: `<div className="p-4 space-y-4">` — this should already be correct.

**Step 8: Build and verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 9: Commit**

```bash
git add frontend/src/components/generator/panels/FormFieldsSection.tsx frontend/src/components/generator/panels/LeftControlPanel.tsx
git commit -m "style(left-panel): wrap form sections in warm group containers"
```

---

### Task 4: ActionBar Simplification

**Files:**
- Modify: `frontend/src/components/generator/panels/ActionBar.tsx`

**Step 1: Remove export dropdown and PostExportActions from ActionBar**

The export functionality and post-export lifecycle actions will move to the new EditorActionPanel. The ActionBar becomes minimal: sidebar toggles + auto-save + validation + save draft.

In `ActionBar.tsx`, remove:
- The entire `{canExport && ( <DropdownMenu>...</DropdownMenu> )}` block (lines 271-304)
- The `<PostExportActions>` render (lines 307-310)
- The `ExportReviewModal` and `ExportSuccessModal` renders (lines 312-332)
- Remove unused imports: `FileText, FileType2, Download, ChevronDown, Printer`
- Remove unused imports: `DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger`
- Remove unused imports: `ExportSuccessModal, ExportReviewModal, PostExportActions`
- Remove unused state: `isExportingPdf, isExportingDocx, showReviewModal, reviewExportFormat, showSuccessModal, lastExportFormat`
- Remove unused functions: `performExport, handleConfirmExport, handleDirectExport, handleDownloadAgain, handleGoToDocuments, handleOpenReview`
- Remove unused variable: `canExport`
- Keep: `exportInProgressRef` — will be unused, remove too

**Step 2: Simplify the button area**

Change the buttons section to just the Save Draft button, full width:

```tsx
{/* Speichern */}
<Button
    variant="ghost"
    className="w-full gap-2"
    onClick={handleSaveDraft}
    disabled={!canSaveDraft || isAnyLoading}
>
    {isSavingDraft ? (
        <Loader2 className="w-4 h-4 animate-spin" />
    ) : (
        <Save className="w-4 h-4" />
    )}
    Entwurf speichern
</Button>
```

**Step 3: Update isAnyLoading**

Remove `isExportingPdf || isExportingDocx` from the `isAnyLoading` calculation:

```tsx
const isAnyLoading = isSavingDraft || isGenerating;
```

**Step 4: Build and verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds. There may be "unused" warnings for exports that the EditorActionPanel will later use — that's fine.

**Step 5: Commit**

```bash
git add frontend/src/components/generator/panels/ActionBar.tsx
git commit -m "refactor(action-bar): remove export UI, keep only save + validation"
```

---

### Task 5: EditorActionPanel — New Floating Action Panel

**Files:**
- Create: `frontend/src/components/generator/editor/EditorActionPanel.tsx`
- Modify: `frontend/src/components/generator/editor/RightEditorPanel.tsx`

**Step 1: Create EditorActionPanel component**

Create `frontend/src/components/generator/editor/EditorActionPanel.tsx`:

```tsx
/**
 * EditorActionPanel — Floating "Finalize" panel over the canvas.
 *
 * Figma-style collapsible panel with:
 * - Export format toggle (PDF/DOCX)
 * - Attachment checkbox list
 * - Optional date fields (Versendet am, Rueckfrist bis)
 * - Export + Approval buttons
 *
 * Positioned absolute bottom-right of the canvas container.
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    ChevronDown,
    ChevronUp,
    Download,
    FileText,
    FileType2,
    Loader2,
    ShieldCheck,
    CalendarClock,
    Send,
    Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { useWizardContext } from "../WizardContext";
import { useCountry } from "@/hooks/useCountry";
import { useAttachments } from "@/hooks/api/useDocumentQueries";
import { useMoveDocument } from "@/hooks/api/useKanbanQueries";
import { api } from "@/lib/api-client";
import { ExportReviewModal } from "../ExportReviewModal";
import { ExportSuccessModal } from "../ExportSuccessModal";

export function EditorActionPanel() {
    const { state, actions } = useWizardContext();
    const { country } = useCountry();
    const toast = useToast();
    const navigate = useNavigate();
    const moveMutation = useMoveDocument();

    const {
        documentTypeId,
        documentTitle,
        formData,
        isGenerating,
        selectedAttachmentIds,
        lastExportedDocumentId,
    } = state;

    // ── Panel state ──────────────────────────────────────────────────────
    const [isExpanded, setIsExpanded] = useState(false);
    const [exportFormat, setExportFormat] = useState<"pdf" | "docx">("pdf");
    const [isExporting, setIsExporting] = useState(false);
    const exportInProgressRef = useRef(false);

    // Date fields
    const [sentDate, setSentDate] = useState("");
    const [returnDeadline, setReturnDeadline] = useState("");

    // Modals
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // ── Attachments ──────────────────────────────────────────────────────
    const { data: attachments } = useAttachments(country);

    // ── Validation ───────────────────────────────────────────────────────
    const REQUIRED_FIELDS = ["vorname", "nachname", "position", "gehalt", "eintrittsdatum", "signatory_name"] as const;

    const canExport = useMemo(() => {
        if (!documentTypeId || !documentTitle.trim()) return false;
        return REQUIRED_FIELDS.every(field => {
            const value = formData[field as keyof typeof formData];
            return value !== undefined && value !== null && value !== "";
        });
    }, [documentTypeId, documentTitle, formData]);

    // ── Export logic ─────────────────────────────────────────────────────
    const handleOpenReview = useCallback(() => {
        setShowReviewModal(true);
    }, []);

    const performExport = useCallback(async (): Promise<boolean> => {
        if (!canExport || exportInProgressRef.current) return false;
        exportInProgressRef.current = true;
        setIsExporting(true);

        try {
            await actions.exportDocument(exportFormat);
            return true;
        } catch (err) {
            toast.error(
                "Export fehlgeschlagen",
                err instanceof Error ? err.message : "Bitte versuche es erneut.",
            );
            return false;
        } finally {
            setIsExporting(false);
            exportInProgressRef.current = false;
        }
    }, [canExport, exportFormat, actions, toast]);

    const handleConfirmExport = useCallback(async () => {
        const success = await performExport();
        setShowReviewModal(false);
        if (success) {
            setShowSuccessModal(true);

            // Post-export: mark as sent if date provided
            if (sentDate && lastExportedDocumentId) {
                try {
                    await api.post(`/api/v1/documents/${lastExportedDocumentId}/actions`, {
                        action_type: "sent",
                        note: `Versendet am ${sentDate}`,
                        metadata_json: { send_date: sentDate },
                    });
                    await moveMutation.mutateAsync({
                        documentId: lastExportedDocumentId,
                        targetStage: "versendet",
                    });
                } catch { /* non-critical */ }
            }

            // Post-export: create deadline if return date provided
            if (returnDeadline && lastExportedDocumentId) {
                try {
                    await api.post("/api/v1/user/deadlines", {
                        deadline_type: "ruecklauf",
                        deadline_date: returnDeadline,
                        deadline_label: `Rücksendung: ${documentTitle}`,
                        employee_name: `${formData.vorname} ${formData.nachname}`.trim(),
                        generated_document_id: lastExportedDocumentId,
                    });
                } catch { /* non-critical */ }
            }
        }
    }, [performExport, sentDate, returnDeadline, lastExportedDocumentId, moveMutation, documentTitle, formData]);

    const handleDownloadAgain = useCallback(async () => {
        setShowSuccessModal(false);
        const success = await performExport();
        if (success) setShowSuccessModal(true);
    }, [performExport]);

    const handleGoToDocuments = useCallback(() => {
        setShowSuccessModal(false);
        navigate("/documents");
    }, [navigate]);

    // ── Approval ─────────────────────────────────────────────────────────
    const [isRequestingApproval, setIsRequestingApproval] = useState(false);

    const handleRequestApproval = useCallback(async () => {
        if (!lastExportedDocumentId) {
            toast.error("Bitte zuerst exportieren", "Das Dokument muss vor der Freigabe exportiert werden.");
            return;
        }
        setIsRequestingApproval(true);
        try {
            await api.post(`/api/v1/documents/${lastExportedDocumentId}/actions`, {
                action_type: "approval_requested",
                note: "Freigabe über Generator angefragt",
            });
            await moveMutation.mutateAsync({
                documentId: lastExportedDocumentId,
                targetStage: "freigabe",
            });
            toast.success("Freigabe angefragt");
        } catch {
            toast.error("Fehler", "Freigabe konnte nicht angefragt werden");
        } finally {
            setIsRequestingApproval(false);
        }
    }, [lastExportedDocumentId, moveMutation, toast]);

    // ── Render ───────────────────────────────────────────────────────────

    return (
        <>
            <div className="absolute bottom-6 right-6 z-30 w-80">
                {/* Collapsible Panel */}
                <div className="bg-white/95 dark:bg-card/95 backdrop-blur-xl rounded-2xl shadow-float border border-warm-100 dark:border-border overflow-hidden transition-all duration-200">
                    {/* Header — always visible */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-warm-50/50 dark:hover:bg-warm-50/5 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Download className="w-4 h-4 text-primary" />
                            Dokument abschließen
                        </div>
                        {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        )}
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                        <div className="px-4 pb-4 space-y-4">
                            {/* Format Toggle */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Format</Label>
                                <div className="flex gap-1 p-1 bg-warm-50 dark:bg-warm-50/10 rounded-lg">
                                    <button
                                        onClick={() => setExportFormat("pdf")}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                                            exportFormat === "pdf"
                                                ? "bg-white dark:bg-card shadow-soft-xs text-foreground"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        <FileText className="w-3.5 h-3.5 text-red-500" />
                                        PDF
                                    </button>
                                    <button
                                        onClick={() => setExportFormat("docx")}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                                            exportFormat === "docx"
                                                ? "bg-white dark:bg-card shadow-soft-xs text-foreground"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        <FileType2 className="w-3.5 h-3.5 text-blue-500" />
                                        DOCX
                                    </button>
                                </div>
                            </div>

                            {/* Attachments */}
                            {attachments && attachments.length > 0 && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Paperclip className="w-3 h-3" />
                                        Anhänge
                                    </Label>
                                    <div className="space-y-1 max-h-32 overflow-auto">
                                        {attachments.map((att) => (
                                            <label
                                                key={att.id}
                                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-warm-50/50 dark:hover:bg-warm-50/5 cursor-pointer transition-colors"
                                            >
                                                <Checkbox
                                                    checked={selectedAttachmentIds.includes(att.id)}
                                                    onCheckedChange={() => actions.toggleAttachment(att.id)}
                                                />
                                                <span className="text-xs text-foreground/80 truncate">{att.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Divider */}
                            <div className="border-t border-dashed border-warm-200 dark:border-border/50" />

                            {/* Date Fields */}
                            <div className="space-y-2">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Send className="w-3 h-3" />
                                        Versendet am
                                    </Label>
                                    <Input
                                        type="date"
                                        value={sentDate}
                                        onChange={(e) => setSentDate(e.target.value)}
                                        className="h-8 text-xs canvas-input"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <CalendarClock className="w-3 h-3" />
                                        Rückfrist bis
                                    </Label>
                                    <Input
                                        type="date"
                                        value={returnDeadline}
                                        onChange={(e) => setReturnDeadline(e.target.value)}
                                        className="h-8 text-xs canvas-input"
                                    />
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-dashed border-warm-200 dark:border-border/50" />

                            {/* Action Buttons */}
                            <div className="space-y-2">
                                <Button
                                    className="w-full gap-2"
                                    onClick={handleOpenReview}
                                    disabled={!canExport || isExporting || isGenerating}
                                >
                                    {isExporting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Download className="w-4 h-4" />
                                    )}
                                    {isExporting ? "Exportiert..." : "Exportieren & Herunterladen"}
                                </Button>

                                {lastExportedDocumentId && (
                                    <Button
                                        variant="outline"
                                        className="w-full gap-2"
                                        onClick={handleRequestApproval}
                                        disabled={isRequestingApproval}
                                    >
                                        {isRequestingApproval ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <ShieldCheck className="w-4 h-4" />
                                        )}
                                        Zur Freigabe einreichen
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <ExportReviewModal
                isOpen={showReviewModal}
                onClose={() => setShowReviewModal(false)}
                onConfirm={handleConfirmExport}
                isExporting={isExporting}
                exportFormat={exportFormat}
                documentTitle={documentTitle}
                formData={formData}
            />
            <ExportSuccessModal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                documentTitle={documentTitle}
                exportFormat={exportFormat}
                documentId={lastExportedDocumentId}
                onDownloadAgain={handleDownloadAgain}
                onGoToDocuments={handleGoToDocuments}
            />
        </>
    );
}
```

**Step 2: Add EditorActionPanel to RightEditorPanel**

In `RightEditorPanel.tsx`, import and render the new panel.

Add import:
```tsx
import { EditorActionPanel } from "./EditorActionPanel";
```

In the return JSX, add the panel inside the main `<div>` (after the editor container div, before the closing `</div>` of the outermost container). The container already has `relative` positioning:

```tsx
return (
    <div className="h-full flex flex-col relative">
        {/* ... existing tone preview banner ... */}
        {/* ... existing editor container ... */}

        {/* Floating Action Panel */}
        <EditorActionPanel />
    </div>
);
```

**Step 3: Build and verify**

Run: `cd frontend && npm run build`
Expected: Build succeeds. The panel renders collapsed in bottom-right.

**Step 4: Commit**

```bash
git add frontend/src/components/generator/editor/EditorActionPanel.tsx frontend/src/components/generator/editor/RightEditorPanel.tsx
git commit -m "feat(editor): add floating EditorActionPanel for export, attachments, deadlines, approval"
```

---

### Task 6: Build Verification & Integration Test

**Files:** None (verification only)

**Step 1: Full build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with zero errors. Warnings about unused vars are acceptable if they're pre-existing.

**Step 2: Check for type errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No new type errors introduced.

**Step 3: Visual check — verify key CSS changes**

Review the following in a browser (or verify in build output):
1. Sidebar has warm-50 background, white active pills
2. Form sections have bg-warm-50/50 rounded containers
3. Canvas desk has subtle radial gradient
4. Paper has rounded-lg with outline ring
5. EditorActionPanel floats bottom-right, collapses/expands
6. ActionBar no longer has export dropdown

**Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: integration adjustments after editor redesign"
```

---

## File Summary

| # | Action | File | Description |
|---|--------|------|-------------|
| 1 | Modify | `frontend/src/components/layout/Sidebar.tsx` | Warm background, active pills, spacing |
| 2 | Modify | `frontend/src/index.css` | Canvas desk radial gradient, paper ring |
| 3 | Modify | `frontend/src/components/generator/editor/RightEditorPanel.tsx` | Increased padding, EditorActionPanel |
| 4 | Modify | `frontend/src/components/generator/panels/FormFieldsSection.tsx` | Section group containers |
| 5 | Modify | `frontend/src/components/generator/panels/LeftControlPanel.tsx` | Spacing adjustments |
| 6 | Modify | `frontend/src/components/generator/panels/ActionBar.tsx` | Remove export UI |
| 7 | Create | `frontend/src/components/generator/editor/EditorActionPanel.tsx` | Floating action panel |

## Dependency Order

Tasks 1, 2, 3, and 4 are independent and can be parallelized.
Task 5 depends on Task 4 (ActionBar simplified first, then new panel added).
Task 6 depends on all previous tasks.
