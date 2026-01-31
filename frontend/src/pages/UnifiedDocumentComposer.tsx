/**
 * UnifiedDocumentComposer - Smart UX Konzept Hauptseite
 *
 * 3-Spalten-Layout:
 * - Links (20%): Klausel-Bibliothek (Drag-Source)
 * - Mitte (55%): Document Canvas (Drop-Zone + Editor)
 * - Rechts (25%): Properties Panel (Kontext-sensitiv)
 *
 * Implementiert Phase 1 & 2 des Implementierungsplans.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, useBlocker } from "react-router-dom";
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { FileText, Loader2, ArrowLeft, Download, Eye, Save, Check, Cloud, GitBranch, ChevronDown, ChevronUp, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";

import { ClauseLibrarySidebar } from "@/components/composer/ClauseLibrarySidebar";
import { DocumentCanvas } from "@/components/composer/DocumentCanvas";
import { ClausePropertiesPanel } from "@/components/composer/ClausePropertiesPanel";
import { DeviationConfirmDialog } from "@/components/composer/DeviationConfirmDialog";
import { PromotionDialog, type PromotionData } from "@/components/composer/PromotionDialog";
import type {
    ClauseInstance,
    LibraryClause,
    ComposerDraft,
    ClauseInstanceListResponse,
} from "@/components/composer/types";

interface DocumentTypeResponse {
    id: number;
    name: string;
    country_code: string;
    is_active: boolean;
}

interface VariantGroupForDraft {
    id: number;
    variant_group_id: number;
    variant_group_name: string;
    variant_group_description?: string;
    display_order: number;
    is_mandatory: boolean;
    default_variant_id?: number;
    effective_default_id?: number;
    variants: Array<{
        id: number;
        variant_name: string;
        variant_code?: string;
        is_default: boolean;
        clause_id: number;
    }>;
}

export const UnifiedDocumentComposer = () => {
    const { draftId: paramDraftId } = useParams<{ draftId?: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const toast = useToast();

    // ══════════════════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════════════════

    // Draft State
    const [draftId, setDraftId] = useState<number | null>(
        paramDraftId ? parseInt(paramDraftId, 10) : null
    );
    const [draft, setDraft] = useState<ComposerDraft | null>(null);

    // Document Types
    const [documentTypes, setDocumentTypes] = useState<DocumentTypeResponse[]>([]);
    const [selectedDocTypeId, setSelectedDocTypeId] = useState<number | null>(null);

    // Variant Groups (v4.2 Feature)
    const [variantGroups, setVariantGroups] = useState<VariantGroupForDraft[]>([]);
    const [selectedVariants, setSelectedVariants] = useState<Record<number, number>>({});
    const [isLoadingVariants, setIsLoadingVariants] = useState(false);
    const [expandedVariantPreviews, setExpandedVariantPreviews] = useState<Record<number, boolean>>({});

    // Clauses
    const [clauses, setClauses] = useState<ClauseInstance[]>([]);
    const [selectedClauseId, setSelectedClauseId] = useState<number | null>(null);

    // Loading States
    const [isLoadingTypes, setIsLoadingTypes] = useState(true);
    const [isLoadingDraft, setIsLoadingDraft] = useState(false);
    const [isLoadingClauses, setIsLoadingClauses] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Drag & Drop
    const [activeLibraryClause, setActiveLibraryClause] = useState<LibraryClause | null>(null);

    // Deviation Dialog (Phase 2)
    const [deviationDialogOpen, setDeviationDialogOpen] = useState(false);
    const [pendingDeviationClauseId, setPendingDeviationClauseId] = useState<number | null>(null);
    const [isDeviating, setIsDeviating] = useState(false);

    // Promotion Dialog (Phase 3)
    const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
    const [pendingPromotionClauseId, setPendingPromotionClauseId] = useState<number | null>(null);
    const [isPromoting, setIsPromoting] = useState(false);

    // Auto-Save State (UX-Refactoring: Klares Feedback)
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Focus Mode
    const [isFocusMode, setIsFocusMode] = useState(false);

    // ══════════════════════════════════════════════════════════════════════════
    // SENSORS
    // ══════════════════════════════════════════════════════════════════════════

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // ══════════════════════════════════════════════════════════════════════════
    // LOAD DOCUMENT TYPES
    // ══════════════════════════════════════════════════════════════════════════

    useEffect(() => {
        const loadDocumentTypes = async () => {
            setIsLoadingTypes(true);
            try {
                const response = await api.get<DocumentTypeResponse[]>("/api/v1/document-types/");
                const activeTypes = response.data.filter((t) => t.is_active);
                setDocumentTypes(activeTypes);

                // Auto-select logic
                if (!draftId) {
                    const typeParam = searchParams.get("type");
                    if (typeParam) {
                        const typeId = parseInt(typeParam, 10);
                        // Validate if type exists
                        if (activeTypes.some(t => t.id === typeId)) {
                            setSelectedDocTypeId(typeId);
                        } else if (activeTypes.length > 0) {
                            setSelectedDocTypeId(activeTypes[0].id);
                        }
                    } else if (activeTypes.length > 0) {
                        setSelectedDocTypeId(activeTypes[0].id);
                    }
                }
            } catch (error) {
                logError("Failed to load document types", { error });
                toast.error("Fehler", "Dokumenttypen konnten nicht geladen werden");
            } finally {
                setIsLoadingTypes(false);
            }
        };
        loadDocumentTypes();
    }, []);

    // ══════════════════════════════════════════════════════════════════════════
    // LOAD VARIANT GROUPS FOR SELECTED DOCUMENT TYPE (v4.2 Feature)
    // ══════════════════════════════════════════════════════════════════════════

    useEffect(() => {
        if (!selectedDocTypeId || draftId) {
            setVariantGroups([]);
            setSelectedVariants({});
            return;
        }

        const loadVariantGroups = async () => {
            setIsLoadingVariants(true);
            try {
                const response = await api.get<VariantGroupForDraft[]>(
                    `/api/v1/document-types/${selectedDocTypeId}/variant-groups`
                );
                setVariantGroups(response.data);

                // Pre-select defaults
                const defaults: Record<number, number> = {};
                response.data.forEach((vg) => {
                    const defaultId = vg.effective_default_id || vg.default_variant_id;
                    if (defaultId) {
                        defaults[vg.variant_group_id] = defaultId;
                    } else if (vg.variants.length > 0) {
                        const defaultVariant = vg.variants.find(v => v.is_default);
                        defaults[vg.variant_group_id] = defaultVariant?.id || vg.variants[0].id;
                    }
                });
                setSelectedVariants(defaults);
            } catch (error) {
                logError("Failed to load variant groups", { error });
                setVariantGroups([]);
            } finally {
                setIsLoadingVariants(false);
            }
        };
        loadVariantGroups();
    }, [selectedDocTypeId, draftId]);

    // ══════════════════════════════════════════════════════════════════════════
    // LOAD EXISTING DRAFT (if draftId in URL)
    // ══════════════════════════════════════════════════════════════════════════

    useEffect(() => {
        if (!draftId) return;

        const loadDraft = async () => {
            setIsLoadingDraft(true);
            try {
                const response = await api.get<ComposerDraft>(
                    `/api/v1/composer/drafts/${draftId}`
                );
                setDraft(response.data);
                setSelectedDocTypeId(response.data.document_type_id);
            } catch (error) {
                logError("Failed to load draft", { error });
                toast.error("Fehler", "Entwurf konnte nicht geladen werden");
                navigate("/composer");
            } finally {
                setIsLoadingDraft(false);
            }
        };
        loadDraft();
    }, [draftId]);

    // ══════════════════════════════════════════════════════════════════════════
    // LOAD CLAUSES
    // ══════════════════════════════════════════════════════════════════════════

    useEffect(() => {
        if (!draftId) return;

        const loadClauses = async () => {
            setIsLoadingClauses(true);
            try {
                const response = await api.get<ClauseInstanceListResponse>(
                    `/api/v1/composer/drafts/${draftId}/clauses`
                );
                setClauses(response.data.clauses);
            } catch (error) {
                logError("Failed to load clauses", { error });
                setClauses([]);
            } finally {
                setIsLoadingClauses(false);
            }
        };
        loadClauses();
    }, [draftId]);

    // ══════════════════════════════════════════════════════════════════════════
    // AUTO-SAVE SYSTEM (UX-Refactoring: 30 Sekunden Intervall mit Feedback)
    // ══════════════════════════════════════════════════════════════════════════

    // Mark changes as unsaved when clauses change
    const markAsUnsaved = useCallback(() => {
        setHasUnsavedChanges(true);
    }, []);

    // Auto-save function
    const performAutoSave = useCallback(async () => {
        if (!draftId || !hasUnsavedChanges || isAutoSaving) return;

        setIsAutoSaving(true);
        try {
            // Touch the draft to update its timestamp (extends TTL)
            await api.post(`/api/v1/drafts/${draftId}/refresh`);

            setLastSavedAt(new Date());
            setHasUnsavedChanges(false);

            // Subtle feedback - no intrusive toast
        } catch (error) {
            logError("Auto-save failed", { error });
            // Don't show error toast for auto-save to avoid spam
        } finally {
            setIsAutoSaving(false);
        }
    }, [draftId, hasUnsavedChanges, isAutoSaving]);

    // Manual save function with toast feedback
    const handleManualSave = useCallback(async () => {
        if (!draftId) return;

        setIsAutoSaving(true);
        try {
            await api.post(`/api/v1/drafts/${draftId}/refresh`);

            setLastSavedAt(new Date());
            setHasUnsavedChanges(false);

            toast.success("Entwurf gespeichert", "Ihre Änderungen wurden gespeichert");
        } catch (error) {
            logError("Manual save failed", { error });
            toast.error("Fehler", "Entwurf konnte nicht gespeichert werden");
        } finally {
            setIsAutoSaving(false);
        }
    }, [draftId, toast]);

    // Set up auto-save interval (30 seconds)
    useEffect(() => {
        if (!draftId) return;

        autoSaveTimerRef.current = setInterval(() => {
            performAutoSave();
        }, 30000); // 30 Sekunden

        return () => {
            if (autoSaveTimerRef.current) {
                clearInterval(autoSaveTimerRef.current);
            }
        };
    }, [draftId, performAutoSave]);

    // Save on unmount if there are unsaved changes
    useEffect(() => {
        return () => {
            if (hasUnsavedChanges && draftId) {
                // Fire and forget - best effort save on unmount
                api.post(`/api/v1/drafts/${draftId}/refresh`).catch(() => { });
            }
        };
    }, [hasUnsavedChanges, draftId]);

    // ══════════════════════════════════════════════════════════════════════════
    // CREATE NEW DRAFT
    // ══════════════════════════════════════════════════════════════════════════

    const handleCreateDraft = async () => {
        if (!selectedDocTypeId) return;

        // Validate mandatory variant groups
        const missingMandatory = variantGroups.filter(
            vg => vg.is_mandatory && !selectedVariants[vg.variant_group_id]
        );
        if (missingMandatory.length > 0) {
            toast.error(
                "Auswahl erforderlich",
                `Bitte wählen Sie eine Variante für: ${missingMandatory.map(vg => vg.variant_group_name).join(", ")}`
            );
            return;
        }

        setIsLoadingDraft(true);
        try {
            const response = await api.post<ComposerDraft>("/api/v1/composer/drafts", {
                document_type_id: selectedDocTypeId,
                country_code: "DE",
                // Pass selected variants (v4.2 Feature)
                selected_variants: Object.entries(selectedVariants).map(([groupId, variantId]) => ({
                    variant_group_id: parseInt(groupId),
                    variant_id: variantId,
                })),
            });

            setDraft(response.data);
            setDraftId(response.data.id);
            navigate(`/composer/${response.data.id}`);

            toast.success("Entwurf erstellt", "Sie können jetzt mit der Bearbeitung beginnen");
        } catch (error) {
            logError("Failed to create draft", { error });
            toast.error("Fehler", "Entwurf konnte nicht erstellt werden");
        } finally {
            setIsLoadingDraft(false);
        }
    };

    // ══════════════════════════════════════════════════════════════════════════
    // DATA PROTECTION (QA FIX)
    // ══════════════════════════════════════════════════════════════════════════

    // 1. Browser-Level (Refresh/Close Tab)
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = ""; // Legacy requirement for some browsers
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasUnsavedChanges]);

    // 2. App-Level (Navigation)
    // Block navigation if user has unsaved changes
    useBlocker(
        ({ currentLocation, nextLocation }) =>
            hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
    );

    // ══════════════════════════════════════════════════════════════════════════
    // CLAUSE OPERATIONS
    // ══════════════════════════════════════════════════════════════════════════

    const handleAddLocalClause = async (position?: number) => {
        if (!draftId) return;

        try {
            const response = await api.post<ClauseInstance>(
                `/api/v1/composer/drafts/${draftId}/clauses`,
                {
                    title: "Neuer Abschnitt",
                    content_html: "",
                    position,
                }
            );

            // Clauses neu laden (einfacher als lokales State-Management)
            const clausesResponse = await api.get<ClauseInstanceListResponse>(
                `/api/v1/composer/drafts/${draftId}/clauses`
            );
            setClauses(clausesResponse.data.clauses);
            setSelectedClauseId(response.data.id);

            toast.success("Klausel hinzugefügt", "Bearbeiten Sie den Inhalt im rechten Panel");
        } catch (error) {
            logError("Failed to add local clause", { error });
            toast.error("Fehler", "Klausel konnte nicht hinzugefügt werden");
        }
    };

    const handleAddGlobalClause = async (libraryClause: LibraryClause, position?: number) => {
        if (!draftId) return;

        try {
            await api.post<ClauseInstance>(
                `/api/v1/composer/drafts/${draftId}/clauses`,
                {
                    title: libraryClause.title,
                    source_clause_id: libraryClause.id,
                    position,
                }
            );

            // Clauses neu laden
            const clausesResponse = await api.get<ClauseInstanceListResponse>(
                `/api/v1/composer/drafts/${draftId}/clauses`
            );
            setClauses(clausesResponse.data.clauses);

            toast.success("Klausel hinzugefügt", `"${libraryClause.title}" wurde dem Dokument hinzugefügt`);
        } catch (error) {
            logError("Failed to add global clause", { error });
            toast.error("Fehler", "Klausel konnte nicht hinzugefügt werden");
        }
    };

    const handleDeleteClause = async (instanceId: number) => {
        if (!draftId) return;

        try {
            await api.delete(`/api/v1/composer/drafts/${draftId}/clauses/${instanceId}`);

            setClauses((prev) => prev.filter((c) => c.id !== instanceId));
            if (selectedClauseId === instanceId) {
                setSelectedClauseId(null);
            }

            toast.success("Klausel entfernt");
        } catch (error) {
            logError("Failed to delete clause", { error });
            toast.error("Fehler", "Klausel konnte nicht entfernt werden");
        }
    };

    const handleUpdateClause = async (
        instanceId: number,
        updates: { title?: string; content_html?: string }
    ) => {
        if (!draftId) return;

        setIsSaving(true);
        try {
            await api.put(
                `/api/v1/composer/drafts/${draftId}/clauses/${instanceId}`,
                updates
            );

            setClauses((prev) =>
                prev.map((c) => (c.id === instanceId ? { ...c, ...updates } : c))
            );

            // Mark as having unsaved changes for auto-save feedback
            markAsUnsaved();
        } catch (error) {
            logError("Failed to update clause", { error });
            toast.error("Fehler", "Änderungen konnten nicht gespeichert werden");
        } finally {
            setIsSaving(false);
        }
    };

    // Deviation Dialog öffnen (Phase 2)
    const handleRequestDeviation = (instanceId: number) => {
        setPendingDeviationClauseId(instanceId);
        setDeviationDialogOpen(true);
    };

    // Deviation bestätigt (Phase 2)
    const handleConfirmDeviation = async (reason?: string) => {
        if (!draftId || !pendingDeviationClauseId) return;

        setIsDeviating(true);
        try {
            await api.post(
                `/api/v1/composer/drafts/${draftId}/clauses/${pendingDeviationClauseId}/deviate`,
                { reason }
            );

            // Clauses neu laden
            const clausesResponse = await api.get<ClauseInstanceListResponse>(
                `/api/v1/composer/drafts/${draftId}/clauses`
            );
            setClauses(clausesResponse.data.clauses);

            // Dialog schließen und auswählen
            setDeviationDialogOpen(false);
            setSelectedClauseId(pendingDeviationClauseId);
            setPendingDeviationClauseId(null);

            toast.success("Klausel aufgebrochen", "Sie können die Klausel jetzt bearbeiten");
        } catch (error) {
            logError("Failed to deviate clause", { error });
            toast.error("Fehler", "Klausel konnte nicht aufgebrochen werden");
        } finally {
            setIsDeviating(false);
        }
    };

    // Promotion Dialog öffnen (Phase 3)
    const handleRequestPromotion = (instanceId: number) => {
        setPendingPromotionClauseId(instanceId);
        setPromotionDialogOpen(true);
    };

    // Promotion bestätigt (Phase 3)
    const handleConfirmPromotion = async (data: PromotionData) => {
        if (!draftId || !pendingPromotionClauseId) return;

        setIsPromoting(true);
        try {
            await api.post(
                `/api/v1/composer/drafts/${draftId}/clauses/${pendingPromotionClauseId}/promote`,
                data
            );

            // Clauses neu laden falls convert_to_global
            if (data.convert_to_global) {
                const clausesResponse = await api.get<ClauseInstanceListResponse>(
                    `/api/v1/composer/drafts/${draftId}/clauses`
                );
                setClauses(clausesResponse.data.clauses);
            }

            // Dialog schließen
            setPromotionDialogOpen(false);
            setPendingPromotionClauseId(null);

            toast.success(
                "Zur Prüfung eingereicht",
                "Die Klausel wird nach Freigabe in der Bibliothek verfügbar sein"
            );
        } catch (error) {
            logError("Failed to promote clause", { error });
            toast.error("Fehler", "Klausel konnte nicht eingereicht werden");
        } finally {
            setIsPromoting(false);
        }
    };

    // ══════════════════════════════════════════════════════════════════════════
    // DRAG & DROP HANDLERS
    // ══════════════════════════════════════════════════════════════════════════

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;

        if (active.data.current?.type === "library-clause") {
            setActiveLibraryClause(active.data.current.clause as LibraryClause);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveLibraryClause(null);

        if (!over) return;

        // Library → Canvas Drop
        if (active.data.current?.type === "library-clause" && over.id === "document-canvas") {
            const libraryClause = active.data.current.clause as LibraryClause;
            await handleAddGlobalClause(libraryClause);
            return;
        }

        // Reorder within Canvas
        if (typeof active.id === "number" && typeof over.id === "number") {
            const oldIndex = clauses.findIndex((c) => c.id === active.id);
            const newIndex = clauses.findIndex((c) => c.id === over.id);

            if (oldIndex !== newIndex) {
                const newClauses = arrayMove(clauses, oldIndex, newIndex);
                setClauses(newClauses);

                // Update server
                if (draftId) {
                    try {
                        await api.patch(`/api/v1/composer/drafts/${draftId}/clauses/reorder`, {
                            new_order: newClauses.map((c, i) => ({
                                instance_id: c.id,
                                position: i,
                            })),
                        });
                    } catch (error) {
                        logError("Failed to reorder clauses", { error });
                        toast.error("Fehler", "Reihenfolge konnte nicht gespeichert werden");
                    }
                }
            }
        }
    };

    // ══════════════════════════════════════════════════════════════════════════
    // DERIVED STATE
    // ══════════════════════════════════════════════════════════════════════════

    const selectedClause = clauses.find((c) => c.id === selectedClauseId) || null;
    const selectedDocType = documentTypes.find((t) => t.id === selectedDocTypeId);

    // ══════════════════════════════════════════════════════════════════════════
    // LOADING STATE
    // ══════════════════════════════════════════════════════════════════════════

    if (isLoadingTypes) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-140px)]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Wird geladen...</p>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // NO DRAFT - SHOW SELECTOR
    // ══════════════════════════════════════════════════════════════════════════

    if (!draftId) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-140px)]">
                <div className="text-center max-w-lg">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileText className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Neues Dokument erstellen</h1>
                    <p className="text-muted-foreground mb-6">
                        Wählen Sie einen Dokumenttyp, um mit der Erstellung zu beginnen.
                    </p>

                    <div className="space-y-4">
                        <Select
                            value={selectedDocTypeId?.toString() ?? ""}
                            onValueChange={(v) => setSelectedDocTypeId(parseInt(v, 10))}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Dokumenttyp wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                                {documentTypes.map((type) => (
                                    <SelectItem key={type.id} value={type.id.toString()}>
                                        {type.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Varianten-Gruppen Auswahl (v4.2 Feature - UX-verbessert) */}
                        {isLoadingVariants && (
                            <div className="flex items-center justify-center py-4 text-muted-foreground">
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Lade Varianten...
                            </div>
                        )}

                        {!isLoadingVariants && variantGroups.length > 0 && (
                            <div className="text-left space-y-4">
                                {/* Section Header */}
                                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-t-lg border border-b-0 border-purple-200">
                                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                        <span className="text-sm font-bold text-purple-700">2</span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 text-purple-800 font-medium">
                                            <GitBranch className="w-4 h-4" />
                                            Varianten auswählen
                                        </div>
                                        <p className="text-xs text-purple-600">
                                            Wählen Sie für jeden Bereich die passende Variante
                                        </p>
                                    </div>
                                </div>

                                {/* Variant Cards Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-purple-50/50 rounded-b-lg border border-t-0 border-purple-200">
                                    {variantGroups.map((vg) => (
                                        <div
                                            key={vg.variant_group_id}
                                            className="bg-white rounded-lg border border-purple-200 overflow-hidden"
                                        >
                                            {/* Card Header */}
                                            <div className="p-3 border-b border-purple-100 bg-purple-50/50">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-sm text-foreground">
                                                        {vg.variant_group_name}
                                                    </span>
                                                    {vg.is_mandatory && (
                                                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                                                            Pflicht
                                                        </span>
                                                    )}
                                                </div>
                                                {vg.variant_group_description && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {vg.variant_group_description}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Radio Options */}
                                            <div className="p-3">
                                                <RadioGroup
                                                    value={selectedVariants[vg.variant_group_id]?.toString() ?? ""}
                                                    onValueChange={(v) =>
                                                        setSelectedVariants(prev => ({
                                                            ...prev,
                                                            [vg.variant_group_id]: parseInt(v, 10),
                                                        }))
                                                    }
                                                    className="space-y-2"
                                                >
                                                    {vg.variants.map((variant) => (
                                                        <div
                                                            key={variant.id}
                                                            className={`flex items-center space-x-3 p-2 rounded-md transition-colors ${selectedVariants[vg.variant_group_id] === variant.id
                                                                ? "bg-purple-50 border border-purple-200"
                                                                : "hover:bg-gray-50"
                                                                }`}
                                                        >
                                                            <RadioGroupItem
                                                                value={variant.id.toString()}
                                                                id={`variant-${variant.id}`}
                                                                className="text-purple-600"
                                                            />
                                                            <Label
                                                                htmlFor={`variant-${variant.id}`}
                                                                className="flex-1 cursor-pointer text-sm"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    {variant.variant_code && (
                                                                        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                                                                            {variant.variant_code}
                                                                        </span>
                                                                    )}
                                                                    <span>{variant.variant_name}</span>
                                                                    {variant.is_default && (
                                                                        <span className="text-xs text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                                                                            Standard
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </RadioGroup>
                                            </div>

                                            {/* Preview Collapsible */}
                                            <Collapsible
                                                open={expandedVariantPreviews[vg.variant_group_id]}
                                                onOpenChange={(open) =>
                                                    setExpandedVariantPreviews(prev => ({
                                                        ...prev,
                                                        [vg.variant_group_id]: open,
                                                    }))
                                                }
                                            >
                                                <CollapsibleTrigger asChild>
                                                    <button
                                                        type="button"
                                                        className="w-full flex items-center justify-center gap-1 p-2 border-t text-xs text-purple-600 hover:bg-purple-50 transition-colors"
                                                    >
                                                        {expandedVariantPreviews[vg.variant_group_id] ? (
                                                            <>
                                                                <ChevronUp className="w-3 h-3" />
                                                                Vorschau ausblenden
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ChevronDown className="w-3 h-3" />
                                                                Vorschau anzeigen
                                                            </>
                                                        )}
                                                    </button>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent>
                                                    <div className="p-3 bg-gray-50 border-t text-xs text-muted-foreground">
                                                        <p className="italic">
                                                            Ausgewählte Variante: <strong>{
                                                                vg.variants.find(v => v.id === selectedVariants[vg.variant_group_id])?.variant_name || "Keine"
                                                            }</strong>
                                                        </p>
                                                        <p className="mt-2 text-gray-500">
                                                            Die Klausel mit dieser Variante wird in Ihr Dokument eingefügt.
                                                        </p>
                                                    </div>
                                                </CollapsibleContent>
                                            </Collapsible>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Button
                            className="w-full"
                            onClick={handleCreateDraft}
                            disabled={!selectedDocTypeId || isLoadingDraft || isLoadingVariants}
                        >
                            {isLoadingDraft ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <FileText className="w-4 h-4 mr-2" />
                            )}
                            Dokument erstellen
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MAIN COMPOSER VIEW
    // ══════════════════════════════════════════════════════════════════════════

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="h-[calc(100vh-140px)] flex flex-col">
                {/* Top Bar */}
                <div className="h-14 border-b bg-white flex items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => navigate("/composer")}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Zurück
                        </Button>
                        <div className="h-6 w-px bg-border" />
                        <div>
                            <h1 className="font-semibold">{draft?.name || selectedDocType?.name || "Dokument"}</h1>
                            {/* UX-Refactoring: Speicherstatus statt technische ID */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {isAutoSaving ? (
                                    <span className="flex items-center gap-1 text-amber-600">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Wird gespeichert...
                                    </span>
                                ) : hasUnsavedChanges ? (
                                    <span className="flex items-center gap-1 text-amber-600">
                                        <Cloud className="w-3 h-3" />
                                        Nicht gespeichert
                                    </span>
                                ) : lastSavedAt ? (
                                    <span className="flex items-center gap-1 text-green-600">
                                        <Check className="w-3 h-3" />
                                        Gespeichert
                                    </span>
                                ) : (
                                    <span>Neuer Entwurf</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Focus Mode Toggle */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsFocusMode(!isFocusMode)}
                            title={isFocusMode ? "Focus Modus beenden" : "Focus Modus aktivieren"}
                        >
                            {isFocusMode ? (
                                <Minimize2 className="w-4 h-4 mr-2" />
                            ) : (
                                <Maximize2 className="w-4 h-4 mr-2" />
                            )}
                            {isFocusMode ? "Exit Focus" : "Focus"}
                        </Button>

                        {/* UX-Refactoring: Expliziter "Speichern" Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleManualSave}
                            disabled={isAutoSaving || !hasUnsavedChanges}
                            className={hasUnsavedChanges ? "border-amber-300 text-amber-700 hover:bg-amber-50" : ""}
                        >
                            {isAutoSaving ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            Speichern
                        </Button>
                        <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 mr-2" />
                            Vorschau
                        </Button>
                        <Button size="sm">
                            <Download className="w-4 h-4 mr-2" />
                            Exportieren
                        </Button>
                    </div>
                </div>

                {/* 3-Column Layout - Floating Panels ("Soft & Simple") */}
                <div className="flex-1 flex overflow-hidden transition-all duration-300 ease-in-out gap-4 p-4 bg-muted/20">
                    {/* Left: Library - Floating Panel */}
                    <div className={`${isFocusMode ? "w-0 opacity-0 p-0" : "w-1/4 min-w-[300px] opacity-100"} bg-white rounded-2xl shadow-sm border border-gray-100/50 overflow-hidden flex flex-col transition-all duration-300 ease-in-out`}>
                        <ClauseLibrarySidebar countryCode="DE" />
                    </div>

                    {/* Center: Canvas - "The Stage" */}
                    <div className="flex-1 rounded-2xl overflow-hidden relative flex flex-col shadow-inner bg-gray-50/50 border border-gray-100">
                        <DocumentCanvas
                            clauses={clauses}
                            selectedClauseId={selectedClauseId}
                            onSelectClause={setSelectedClauseId}
                            onAddLocalClause={handleAddLocalClause}
                            onDeleteClause={handleDeleteClause}
                            onDeviateClause={handleRequestDeviation}
                            documentTypeName={selectedDocType?.name}
                            isLoading={isLoadingClauses}
                        />
                    </div>

                    {/* Right: Properties - Floating Panel */}
                    <div className={`${isFocusMode ? "w-0 opacity-0 p-0" : "w-1/4 min-w-[320px] opacity-100"} bg-white rounded-2xl shadow-sm border border-gray-100/50 overflow-hidden flex flex-col transition-all duration-300 ease-in-out`}>
                        <ClausePropertiesPanel
                            clause={selectedClause}
                            onUpdate={handleUpdateClause}
                            onDeviate={handleRequestDeviation}
                            onPromote={handleRequestPromotion}
                            isSaving={isSaving}
                        />
                    </div>
                </div>
            </div>

            {/* Drag Overlay */}
            <DragOverlay>
                {activeLibraryClause && (
                    <div className="p-3 bg-white border-2 border-primary rounded-lg shadow-xl">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-green-600" />
                            <span className="font-medium">{activeLibraryClause.title}</span>
                        </div>
                    </div>
                )}
            </DragOverlay>

            {/* Deviation Confirmation Dialog (Phase 2) */}
            <DeviationConfirmDialog
                open={deviationDialogOpen}
                onOpenChange={setDeviationDialogOpen}
                clauseTitle={clauses.find(c => c.id === pendingDeviationClauseId)?.title || ""}
                onConfirm={handleConfirmDeviation}
                isLoading={isDeviating}
            />

            {/* Promotion Dialog (Phase 3) */}
            <PromotionDialog
                open={promotionDialogOpen}
                onOpenChange={setPromotionDialogOpen}
                clause={clauses.find(c => c.id === pendingPromotionClauseId) || null}
                onPromote={handleConfirmPromotion}
                isLoading={isPromoting}
            />
        </DndContext>
    );
};
