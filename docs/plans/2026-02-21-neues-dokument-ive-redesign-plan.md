# "Neues Dokument erstellen" Ive Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat list-based StepDocumentType (596 lines) with a Jony Ive-inspired card-grid Progressive Disclosure UI using a modal for the naming step.

**Architecture:** Decompose the monolithic StepDocumentType into 4 focused components: a category icon mapper, individual TemplateCard, a TemplateGrid orchestrator, and a CreateDocumentDialog. The page becomes a search bar + card grid; clicking a card opens a Dialog with title input, optional template selection, and two CTAs.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Dialog, Collapsible, Badge, Input, Button), Lucide React icons.

---

### Task 1: Create categoryIcons.ts — Icon mapping utility

**Files:**
- Create: `frontend/src/components/generator/steps/categoryIcons.ts`

**Step 1: Create the icon mapping file**

```typescript
import {
    Briefcase,
    FileX,
    Mail,
    MessageSquare,
    Award,
    FilePlus,
    AlertTriangle,
    FileText,
    type LucideIcon,
} from "lucide-react";

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
    vertrag: Briefcase,
    contract: Briefcase,
    beendigung: FileX,
    brief: Mail,
    letter: Mail,
    mitteilung: MessageSquare,
    memo: MessageSquare,
    bescheinigung: Award,
    certificate: Award,
    nachtrag: FilePlus,
    amendment: FilePlus,
    disziplinar: AlertTriangle,
};

export function getCategoryIcon(category?: string): LucideIcon {
    if (!category) return FileText;
    return CATEGORY_ICON_MAP[category.toLowerCase()] ?? FileText;
}

// Re-export existing category label translation
const CATEGORY_LABELS: Record<string, string> = {
    contract: "Vertrag",
    letter: "Brief",
    memo: "Mitteilung",
    certificate: "Bescheinigung",
    amendment: "Nachtrag",
    default: "Allgemein",
};

export function translateCategory(category: string): string {
    const lower = category.toLowerCase();
    return CATEGORY_LABELS[lower] || category;
}
```

**Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to categoryIcons.ts

**Step 3: Commit**

```bash
git add frontend/src/components/generator/steps/categoryIcons.ts
git commit -m "feat: add category icon mapping for Ive card redesign"
```

---

### Task 2: Create TemplateCard.tsx — The star component

**Files:**
- Create: `frontend/src/components/generator/steps/TemplateCard.tsx`

**Step 1: Create the card component**

```typescript
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getCategoryIcon, translateCategory } from "./categoryIcons";

interface DocumentType {
    id: number;
    name: string;
    category?: string;
    description?: string | null;
    updated_at?: string | null;
}

interface TemplateCardProps {
    type: DocumentType;
    /** Compact mode for "Zuletzt verwendet" row */
    compact?: boolean;
    onClick: (type: DocumentType) => void;
}

export function TemplateCard({ type, compact, onClick }: TemplateCardProps) {
    const Icon = getCategoryIcon(type.category);

    if (compact) {
        return (
            <button
                onClick={() => onClick(type)}
                className={cn(
                    "flex items-center gap-2.5 p-3 rounded-xl bg-white border border-warm-100",
                    "transition-all duration-300 ease-out cursor-pointer text-left w-full",
                    "hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                )}
                aria-label={`${type.name} auswählen`}
            >
                <Icon className="w-4 h-4 text-[#86868B] shrink-0" />
                <span className="text-sm font-medium text-[#1D1D1F] truncate">
                    {type.name}
                </span>
            </button>
        );
    }

    return (
        <button
            onClick={() => onClick(type)}
            className={cn(
                "flex flex-col items-start p-5 rounded-2xl bg-white border border-warm-100",
                "transition-all duration-300 ease-out cursor-pointer text-left w-full",
                "hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            )}
            aria-label={`${type.name} auswählen`}
        >
            <Icon className="w-6 h-6 text-[#86868B] mb-3" />
            <span className="text-[15px] font-semibold text-[#1D1D1F] leading-tight">
                {type.name}
            </span>
            {type.description && (
                <span className="text-sm text-[#86868B] mt-1 line-clamp-2">
                    {type.description}
                </span>
            )}
            {type.category && (
                <Badge
                    variant="outline"
                    className="mt-3 text-[11px] font-normal text-[#86868B] border-warm-200"
                >
                    {translateCategory(type.category)}
                </Badge>
            )}
        </button>
    );
}
```

**Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/generator/steps/TemplateCard.tsx
git commit -m "feat: add TemplateCard component with Ive hover effects"
```

---

### Task 3: Create CreateDocumentDialog.tsx — Modal for naming + CTA

**Files:**
- Create: `frontend/src/components/generator/steps/CreateDocumentDialog.tsx`

**Context:** This Dialog opens when a card is clicked. It shows the selected document type, a title input, optional template selection (Vorlage verwenden), and two action buttons. The template selection logic is moved here from the old StepDocumentType.

**Step 1: Create the dialog component**

```typescript
import { useState, useEffect, useCallback } from "react";
import { ArrowRight, Sparkles, LayoutTemplate, ChevronDown, FileText } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { getCategoryIcon, translateCategory } from "./categoryIcons";

interface DocumentType {
    id: number;
    name: string;
    category?: string;
    description?: string | null;
    updated_at?: string | null;
}

interface UserTemplateOption {
    id: number;
    name: string;
    has_logo: boolean;
    has_header: boolean;
    has_footer: boolean;
    scope: string;
    category: string | null;
    is_own: boolean;
}

interface CreateDocumentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedType: DocumentType | null;
    onCreateManual: (title: string, templateId: number | null) => void;
    onCreateWithAI: (title: string, templateId: number | null) => void;
}

export function CreateDocumentDialog({
    open,
    onOpenChange,
    selectedType,
    onCreateManual,
    onCreateWithAI,
}: CreateDocumentDialogProps) {
    const [title, setTitle] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [userTemplates, setUserTemplates] = useState<UserTemplateOption[]>([]);
    const [templateSectionOpen, setTemplateSectionOpen] = useState(false);

    // Reset state when dialog opens with a new type
    useEffect(() => {
        if (open) {
            setTitle("");
            setSelectedTemplateId(null);
            setTemplateSectionOpen(false);
        }
    }, [open]);

    // Fetch user templates once
    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const response = await apiFetch("/api/v1/user-templates");
                if (response.ok) {
                    const data = await response.json();
                    setUserTemplates(data.items || []);
                }
            } catch {
                // Templates are optional
            }
        };
        fetchTemplates();
    }, []);

    const handleCreate = useCallback(() => {
        if (!title.trim()) return;
        onCreateManual(title.trim(), selectedTemplateId);
    }, [title, selectedTemplateId, onCreateManual]);

    const handleCreateWithAI = useCallback(() => {
        if (!title.trim()) return;
        onCreateWithAI(title.trim(), selectedTemplateId);
    }, [title, selectedTemplateId, onCreateWithAI]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && title.trim()) {
                e.preventDefault();
                handleCreate();
            }
        },
        [handleCreate, title]
    );

    if (!selectedType) return null;

    const Icon = getCategoryIcon(selectedType.category);
    const ownTemplates = userTemplates.filter((t) => t.is_own);
    const sharedTemplates = userTemplates.filter((t) => !t.is_own);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-warm-50 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-[#86868B]" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-semibold text-[#1D1D1F]">
                                {selectedType.name}
                            </DialogTitle>
                            {selectedType.category && (
                                <DialogDescription className="mt-0.5">
                                    <Badge
                                        variant="outline"
                                        className="text-[11px] font-normal text-[#86868B] border-warm-200"
                                    >
                                        {translateCategory(selectedType.category)}
                                    </Badge>
                                </DialogDescription>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                <Separator className="my-1" />

                <div className="space-y-4 py-2">
                    {/* Document Name Input */}
                    <div className="space-y-2">
                        <Label
                            htmlFor="dialog-document-title"
                            className="text-sm font-medium text-[#1D1D1F]"
                        >
                            Dokumentname
                        </Label>
                        <Input
                            id="dialog-document-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="z.B. Arbeitsvertrag Max Müller"
                            className="h-11 rounded-xl"
                            autoFocus
                        />
                        <p className="text-xs text-[#86868B]">
                            Dieser Name erscheint in deiner Dokumentübersicht.
                        </p>
                    </div>

                    {/* Optional Template Selection */}
                    {userTemplates.length > 0 && (
                        <Collapsible
                            open={templateSectionOpen || !!selectedTemplateId}
                            onOpenChange={setTemplateSectionOpen}
                        >
                            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-[#86868B] hover:text-[#1D1D1F] transition-colors group w-full">
                                <LayoutTemplate className="w-4 h-4" />
                                <span>Vorlage verwenden (optional)</span>
                                <ChevronDown
                                    className={cn(
                                        "w-3.5 h-3.5 transition-transform ml-auto",
                                        (templateSectionOpen || !!selectedTemplateId) &&
                                            "rotate-180"
                                    )}
                                />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-3 space-y-2">
                                <p className="text-xs text-[#86868B]">
                                    Verwende eine DOCX-Vorlage als Layout-Basis (mit Logo,
                                    Kopf-/Fußzeile).
                                </p>
                                <div className="grid gap-2">
                                    {/* No template option */}
                                    <button
                                        onClick={() => setSelectedTemplateId(null)}
                                        className={cn(
                                            "w-full text-left px-3 py-2.5 rounded-xl border transition-all text-sm",
                                            !selectedTemplateId
                                                ? "ring-2 ring-primary/30 bg-primary/5 border-primary/20 font-medium text-[#1D1D1F]"
                                                : "border-warm-100 hover:border-warm-200 text-[#86868B]"
                                        )}
                                    >
                                        Standard-Layout (ohne Vorlage)
                                    </button>

                                    {/* Own templates */}
                                    {ownTemplates.length > 0 && (
                                        <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider pt-1">
                                            Eigene Vorlagen
                                        </div>
                                    )}
                                    {ownTemplates.map((template) => (
                                        <TemplateOptionButton
                                            key={template.id}
                                            template={template}
                                            isSelected={selectedTemplateId === template.id}
                                            onClick={() => setSelectedTemplateId(template.id)}
                                        />
                                    ))}

                                    {/* Shared templates */}
                                    {sharedTemplates.length > 0 && (
                                        <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider pt-1">
                                            Geteilte Vorlagen
                                        </div>
                                    )}
                                    {sharedTemplates.map((template) => (
                                        <TemplateOptionButton
                                            key={template.id}
                                            template={template}
                                            isSelected={selectedTemplateId === template.id}
                                            onClick={() => setSelectedTemplateId(template.id)}
                                        />
                                    ))}
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    )}
                </div>

                <DialogFooter className="flex-row gap-2 sm:justify-end">
                    <Button
                        onClick={handleCreate}
                        disabled={!title.trim()}
                        className="h-10 px-5 rounded-xl"
                    >
                        Erstellen
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleCreateWithAI}
                        disabled={!title.trim()}
                        className="h-10 px-5 rounded-xl text-primary/70 border-primary/20 hover:bg-primary/5"
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Mit KI erstellen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --- Internal sub-component ---

function TemplateOptionButton({
    template,
    isSelected,
    onClick,
}: {
    template: UserTemplateOption;
    isSelected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full text-left px-3 py-2.5 rounded-xl border transition-all",
                isSelected
                    ? "ring-2 ring-primary/30 bg-primary/5 border-primary/20"
                    : "border-warm-100 hover:border-warm-200"
            )}
        >
            <div className="flex items-center gap-2">
                <FileText
                    className={cn(
                        "w-4 h-4 shrink-0",
                        isSelected ? "text-primary" : "text-warm-400"
                    )}
                />
                <span
                    className={cn(
                        "text-sm truncate",
                        isSelected ? "font-medium text-[#1D1D1F]" : "text-[#1D1D1F]"
                    )}
                >
                    {template.name}
                </span>
                <div className="flex gap-1 ml-auto shrink-0">
                    {template.has_logo && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1">
                            Logo
                        </Badge>
                    )}
                    {template.has_header && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1">
                            Kopf
                        </Badge>
                    )}
                    {template.has_footer && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1">
                            Fuß
                        </Badge>
                    )}
                    {template.category && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1">
                            {template.category}
                        </Badge>
                    )}
                </div>
            </div>
        </button>
    );
}
```

**Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/generator/steps/CreateDocumentDialog.tsx
git commit -m "feat: add CreateDocumentDialog with title input and template selection"
```

---

### Task 4: Rewrite StepDocumentType.tsx — Card grid with progressive disclosure

**Files:**
- Modify: `frontend/src/components/generator/steps/StepDocumentType.tsx` (full rewrite, 596 → ~200 lines)

**Context:** This is the main rewrite. The new StepDocumentType renders a search bar + card grid. Clicking a card opens CreateDocumentDialog. The component uses the same WizardContext hooks and recently-used localStorage logic.

**Step 1: Rewrite StepDocumentType.tsx**

Replace the entire file content with:

```typescript
/**
 * StepDocumentType — Jony Ive Redesign
 *
 * Card-grid with Progressive Disclosure:
 * 1. Search bar + card grid (categories + recently used)
 * 2. Click card → Dialog (title + optional template + CTA)
 *
 * v5.0: Complete visual redesign
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Clock, X, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWizardContext } from "../WizardContext";
import { SmartModeDialog } from "../SmartModeDialog";
import { TemplateCard } from "./TemplateCard";
import { CreateDocumentDialog } from "./CreateDocumentDialog";
import { translateCategory } from "./categoryIcons";

interface DocumentType {
    id: number;
    name: string;
    category?: string;
    description?: string | null;
    updated_at?: string | null;
}

interface StepDocumentTypeProps {
    documentTypes: DocumentType[];
    isLoading?: boolean;
}

const RECENT_TYPES_KEY = "sdg_recent_document_types";
const MAX_RECENT = 5;

export const StepDocumentType = ({ documentTypes, isLoading }: StepDocumentTypeProps) => {
    const { actions } = useWizardContext();
    const [searchQuery, setSearchQuery] = useState("");
    const [recentTypeIds, setRecentTypeIds] = useState<number[]>([]);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<DocumentType | null>(null);

    // SmartMode state
    const [isSmartModeOpen, setIsSmartModeOpen] = useState(false);
    const [smartModeTitle, setSmartModeTitle] = useState("");

    // Load recently used from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(RECENT_TYPES_KEY);
            if (stored) {
                setRecentTypeIds(JSON.parse(stored));
            }
        } catch {
            // Ignore localStorage errors
        }
    }, []);

    const saveRecentType = useCallback((typeId: number) => {
        setRecentTypeIds((prev) => {
            const updated = [typeId, ...prev.filter((id) => id !== typeId)].slice(0, MAX_RECENT);
            try {
                localStorage.setItem(RECENT_TYPES_KEY, JSON.stringify(updated));
            } catch {
                // Ignore
            }
            return updated;
        });
    }, []);

    // Filter by search query
    const filteredTypes = useMemo(() => {
        if (!searchQuery.trim()) return documentTypes;
        const query = searchQuery.toLowerCase();
        return documentTypes.filter(
            (type) =>
                type.name.toLowerCase().includes(query) ||
                type.category?.toLowerCase().includes(query)
        );
    }, [documentTypes, searchQuery]);

    // Recently used types (only those that still exist)
    const recentTypes = useMemo(() => {
        return recentTypeIds
            .map((id) => documentTypes.find((t) => t.id === id))
            .filter((t): t is DocumentType => t !== undefined);
    }, [recentTypeIds, documentTypes]);

    // Group by category, filter out empty groups
    const groupedTypes = useMemo(() => {
        const groups: Record<string, DocumentType[]> = {};
        for (const type of filteredTypes) {
            const category = type.category || "Sonstige";
            if (!groups[category]) groups[category] = [];
            groups[category].push(type);
        }
        return Object.entries(groups).filter(([, types]) => types.length > 0);
    }, [filteredTypes]);

    // Card click → open dialog
    const handleCardClick = useCallback((type: DocumentType) => {
        setSelectedType(type);
        setDialogOpen(true);
    }, []);

    // Create manually
    const handleCreateManual = useCallback(
        (title: string, templateId: number | null) => {
            if (!selectedType) return;
            actions.setDocumentType(selectedType.id);
            actions.setDocumentTitle(title);
            saveRecentType(selectedType.id);
            if (templateId) actions.setUserTemplateId(templateId);
            setDialogOpen(false);
            actions.enterSplitScreenMode();
        },
        [selectedType, actions, saveRecentType]
    );

    // Create with AI
    const handleCreateWithAI = useCallback(
        (title: string, templateId: number | null) => {
            if (!selectedType) return;
            actions.setDocumentType(selectedType.id);
            actions.setDocumentTitle(title);
            saveRecentType(selectedType.id);
            if (templateId) actions.setUserTemplateId(templateId);
            setSmartModeTitle(title);
            setDialogOpen(false);
            setIsSmartModeOpen(true);
        },
        [selectedType, actions, saveRecentType]
    );

    return (
        <div className="max-w-3xl mx-auto py-12 px-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F]">
                    Neues Dokument
                </h1>
                <p className="text-base text-[#86868B] mt-2">
                    Wähle eine Vorlage und starte die Erstellung.
                </p>
            </div>

            {/* Search Bar */}
            <div className="relative mb-8">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#86868B]" />
                <Input
                    id="document-type-search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Dokumenttyp suchen..."
                    className={cn(
                        "h-12 pl-11 pr-10 text-base rounded-xl",
                        "border border-warm-200 bg-white",
                        "placeholder:text-[#86868B]/60",
                        "focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                    )}
                    disabled={isLoading}
                />
                {searchQuery && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-[#86868B] hover:text-[#1D1D1F]"
                        onClick={() => setSearchQuery("")}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {/* Recently Used (compact row) */}
            {!searchQuery && recentTypes.length > 0 && (
                <section className="mb-8" aria-labelledby="recent-heading">
                    <h2
                        id="recent-heading"
                        className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[#86868B] mb-3"
                    >
                        <Clock className="w-3 h-3" />
                        Zuletzt verwendet
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                        {recentTypes.map((type) => (
                            <TemplateCard
                                key={`recent-${type.id}`}
                                type={type}
                                compact
                                onClick={handleCardClick}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Category Grids */}
            {groupedTypes.map(([category, types]) => (
                <section key={category} className="mb-8" aria-labelledby={`cat-${category}`}>
                    <h2
                        id={`cat-${category}`}
                        className="text-xs font-medium uppercase tracking-wider text-[#86868B] mb-3"
                    >
                        {translateCategory(category)}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {types.map((type) => (
                            <TemplateCard
                                key={type.id}
                                type={type}
                                onClick={handleCardClick}
                            />
                        ))}
                    </div>
                </section>
            ))}

            {/* No Results */}
            {filteredTypes.length === 0 && (
                <div className="text-center py-16">
                    <Search className="w-8 h-8 mx-auto mb-3 text-[#86868B]/40" />
                    <p className="text-sm text-[#86868B]">
                        Keine Ergebnisse für &ldquo;{searchQuery}&rdquo;
                    </p>
                </div>
            )}

            {/* Footer Link */}
            <div className="text-center pt-4">
                <a
                    href="/settings?tab=templates"
                    className="text-xs text-[#86868B]/50 hover:text-[#86868B] transition-colors inline-flex items-center gap-1"
                >
                    Eigene Word-Vorlage importieren
                    <ArrowRight className="w-3 h-3" />
                </a>
            </div>

            {/* Create Document Dialog */}
            <CreateDocumentDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                selectedType={selectedType}
                onCreateManual={handleCreateManual}
                onCreateWithAI={handleCreateWithAI}
            />

            {/* Smart Mode Dialog */}
            {selectedType && (
                <SmartModeDialog
                    open={isSmartModeOpen}
                    onOpenChange={setIsSmartModeOpen}
                    documentTypeId={selectedType.id}
                    documentTypeName={selectedType.name}
                    onComplete={(smartModeData, title) => {
                        actions.setDocumentTitle(title || smartModeTitle);

                        const knownFields = [
                            "vorname", "nachname", "strasse", "plz", "ort", "geburtsdatum",
                            "position", "gehalt", "eintrittsdatum", "wochenstunden", "probezeit",
                            "urlaubstage", "firmenwagen", "homeoffice", "signatory_name",
                        ];

                        const formDataFields: Record<string, unknown> = {};
                        for (const [key, value] of Object.entries(smartModeData)) {
                            if (knownFields.includes(key)) {
                                formDataFields[key] = value;
                            } else if (
                                typeof value === "string" ||
                                typeof value === "number" ||
                                typeof value === "boolean"
                            ) {
                                actions.updateDynamicField(key, value);
                            }
                        }

                        if (Object.keys(formDataFields).length > 0) {
                            actions.setFormData(
                                formDataFields as Partial<
                                    import("../WizardContext").FormData
                                >
                            );
                        }

                        actions.enterSplitScreenMode();
                    }}
                />
            )}
        </div>
    );
};

export default StepDocumentType;
```

**Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Run full build**

Run: `cd frontend && npm run build 2>&1 | tail -20`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/src/components/generator/steps/StepDocumentType.tsx
git commit -m "feat: rewrite StepDocumentType as Ive-inspired card grid with modal"
```

---

### Task 5: Update DocumentGenerator.tsx — Pass description field through

**Files:**
- Modify: `frontend/src/pages/DocumentGenerator.tsx:23-29` (add `description` to interface)
- Modify: `frontend/src/pages/DocumentGenerator.tsx:99-104` (pass `description` in map)
- Modify: `frontend/src/components/generator/DocumentWizard.tsx:49-54` (add `description` to interface)

**Step 1: Update DocumentTypeResponse interface in DocumentGenerator.tsx**

In `frontend/src/pages/DocumentGenerator.tsx`, add `description` to the interface and to the mapping:

```typescript
// Line 23-29: Add description field
interface DocumentTypeResponse {
    id: number;
    name: string;
    country_code: string;
    category?: string;
    description?: string | null;
    is_active: boolean;
}
```

And update the mapping at line 99-104:

```typescript
documentTypes={documentTypes.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    country_code: t.country_code,
    category: t.category,
}))}
```

**Step 2: Update DocumentType interface in DocumentWizard.tsx**

In `frontend/src/components/generator/DocumentWizard.tsx`, line 49-54:

```typescript
interface DocumentType {
    id: number;
    name: string;
    description?: string | null;
    country_code?: string;
    category?: string;
}
```

**Step 3: Verify build**

Run: `cd frontend && npm run build 2>&1 | tail -20`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/src/pages/DocumentGenerator.tsx frontend/src/components/generator/DocumentWizard.tsx
git commit -m "feat: pass document type description through wizard pipeline"
```

---

### Task 6: Update DocumentWizard.tsx — Remove max-w-4xl wrapper

**Files:**
- Modify: `frontend/src/components/generator/DocumentWizard.tsx:252-256`

**Context:** The old wrapper had `max-w-4xl mx-auto py-8 px-4`. The new StepDocumentType handles its own layout with `max-w-3xl mx-auto py-12 px-6`, so the wrapper should be removed to avoid double-centering.

**Step 1: Simplify the wizard mode rendering**

Change lines 252-256 from:

```typescript
return (
    <div className="max-w-4xl mx-auto py-8 px-4">
        <StepDocumentType documentTypes={documentTypes} />
    </div>
);
```

To:

```typescript
return <StepDocumentType documentTypes={documentTypes} />;
```

**Step 2: Verify build**

Run: `cd frontend && npm run build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/src/components/generator/DocumentWizard.tsx
git commit -m "refactor: remove redundant wrapper div, StepDocumentType handles own layout"
```

---

### Task 7: Update HeaderNav.tsx — Disable "Neues Dokument" on /generate

**Files:**
- Modify: `frontend/src/components/layout/HeaderNav.tsx:92-102`

**Step 1: Add route-aware disabled state**

Replace the "New Document CTA" button section (lines 95-102):

```typescript
{/* New Document CTA */}
<Button
    size="sm"
    className={cn(
        "hidden sm:flex gap-2 rounded-full px-4 h-8 text-[12px] shadow-[var(--shadow-elevated)]",
        pathname === "/generate" && "opacity-50 cursor-not-allowed pointer-events-none"
    )}
    onClick={() => navigate("/generate")}
    disabled={pathname === "/generate"}
    aria-disabled={pathname === "/generate"}
>
    <PlusCircle className="w-3.5 h-3.5" />
    <span className="hidden md:inline">Neues Dokument</span>
</Button>
```

Also update the mobile nav link (lines 158-165):

```typescript
<Link
    to="/generate"
    onClick={() => setMobileMenuOpen(false)}
    className={cn(
        "flex items-center gap-2 px-4 py-3 text-sm font-medium",
        pathname === "/generate"
            ? "text-primary/40 pointer-events-none"
            : "text-primary"
    )}
    aria-disabled={pathname === "/generate"}
>
    <PlusCircle className="w-4 h-4" />
    Neues Dokument
</Link>
```

**Step 2: Verify build**

Run: `cd frontend && npm run build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/src/components/layout/HeaderNav.tsx
git commit -m "feat: disable 'Neues Dokument' nav button on /generate route"
```

---

### Task 8: Visual verification and final build

**Step 1: Run full build**

Run: `cd frontend && npm run build 2>&1 | tail -20`
Expected: Build succeeds with no errors

**Step 2: Run lint check**

Run: `cd frontend && npx eslint src/components/generator/steps/ src/components/layout/HeaderNav.tsx src/pages/DocumentGenerator.tsx --max-warnings=5 2>&1 | tail -20`
Expected: No new errors (existing warnings are acceptable)

**Step 3: Create final commit if needed**

If any fixes were needed, commit them.

**Step 4: Squash or leave as-is**

The task produces 7 atomic commits that can be squashed into one feature commit if desired:
```
feat: Ive redesign — card grid with progressive disclosure for document creation
```
