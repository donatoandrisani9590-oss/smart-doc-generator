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
