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

import { useState, useEffect } from "react";
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
import { FileText, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";

import { ClauseLibrarySidebar } from "@/components/composer/ClauseLibrarySidebar";
import { DocumentCanvas } from "@/components/composer/DocumentCanvas";
import { ClausePropertiesPanel } from "@/components/composer/ClausePropertiesPanel";
import { DeviationConfirmDialog } from "@/components/composer/DeviationConfirmDialog";
import { PromotionDialog } from "@/components/composer/PromotionDialog";
import type {
    ClauseInstance,
    LibraryClause,
    ComposerDraft,
    ClauseInstanceListResponse,
} from "@/components/composer/types";

import type { DocumentTypeResponse, VariantGroupForDraft } from "./types";
import { useAutoSave } from "./useAutoSave";
import { useClauseOperations } from "./useClauseOperations";
import { DocumentTypeSelector } from "./DocumentTypeSelector";
import { ComposerHeader } from "./ComposerHeader";

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

    // Clauses
    const [clauses, setClauses] = useState<ClauseInstance[]>([]);
    const [selectedClauseId, setSelectedClauseId] = useState<number | null>(null);

    // Loading States
    const [isLoadingTypes, setIsLoadingTypes] = useState(true);
    const [isLoadingDraft, setIsLoadingDraft] = useState(false);
    const [isLoadingClauses, setIsLoadingClauses] = useState(false);

    // Drag & Drop
    const [activeLibraryClause, setActiveLibraryClause] = useState<LibraryClause | null>(null);

    // Focus Mode
    const [isFocusMode, setIsFocusMode] = useState(false);

    // ══════════════════════════════════════════════════════════════════════════
    // HOOKS
    // ══════════════════════════════════════════════════════════════════════════

    const autoSave = useAutoSave({ draftId });

    const clauseOps = useClauseOperations({
        draftId,
        clauses,
        setClauses,
        selectedClauseId,
        setSelectedClauseId,
        markAsUnsaved: autoSave.markAsUnsaved,
    });

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
    // DATA PROTECTION (QA FIX)
    // ══════════════════════════════════════════════════════════════════════════

    // 1. Browser-Level (Refresh/Close Tab)
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (autoSave.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = ""; // Legacy requirement for some browsers
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [autoSave.hasUnsavedChanges]);

    // 2. App-Level (Navigation)
    // Block navigation if user has unsaved changes
    useBlocker(
        ({ currentLocation, nextLocation }) =>
            autoSave.hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
    );

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

        // Library -> Canvas Drop
        if (active.data.current?.type === "library-clause" && over.id === "document-canvas") {
            const libraryClause = active.data.current.clause as LibraryClause;
            await clauseOps.handleAddGlobalClause(libraryClause);
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
            <DocumentTypeSelector
                documentTypes={documentTypes}
                selectedDocTypeId={selectedDocTypeId}
                setSelectedDocTypeId={setSelectedDocTypeId}
                variantGroups={variantGroups}
                selectedVariants={selectedVariants}
                setSelectedVariants={setSelectedVariants}
                isLoadingVariants={isLoadingVariants}
                isLoadingDraft={isLoadingDraft}
                setIsLoadingDraft={setIsLoadingDraft}
                setDraft={setDraft}
                setDraftId={setDraftId}
            />
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
                <ComposerHeader
                    draftName={draft?.name}
                    documentTypeName={selectedDocType?.name}
                    autoSaveState={{
                        lastSavedAt: autoSave.lastSavedAt,
                        hasUnsavedChanges: autoSave.hasUnsavedChanges,
                        isAutoSaving: autoSave.isAutoSaving,
                    }}
                    onManualSave={autoSave.handleManualSave}
                    isFocusMode={isFocusMode}
                    onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
                />

                {/* 3-Column Layout - Floating Panels ("Soft & Simple") */}
                <div className="flex-1 flex overflow-hidden transition-all duration-300 ease-in-out gap-4 p-4 bg-muted/20">
                    {/* Left: Library - Floating Panel */}
                    <div className={`${isFocusMode ? "w-0 opacity-0 p-0" : "w-1/4 min-w-[300px] opacity-100"} bg-white rounded-2xl shadow-sm border border-warm-100/50 overflow-hidden flex flex-col transition-all duration-300 ease-in-out`}>
                        <ClauseLibrarySidebar countryCode="DE" />
                    </div>

                    {/* Center: Canvas - "The Stage" */}
                    <div className="flex-1 rounded-2xl overflow-hidden relative flex flex-col shadow-inner bg-warm-50/50 border border-warm-100">
                        <DocumentCanvas
                            clauses={clauses}
                            selectedClauseId={selectedClauseId}
                            onSelectClause={setSelectedClauseId}
                            onAddLocalClause={clauseOps.handleAddLocalClause}
                            onDeleteClause={clauseOps.handleDeleteClause}
                            onDeviateClause={clauseOps.handleRequestDeviation}
                            documentTypeName={selectedDocType?.name}
                            isLoading={isLoadingClauses}
                        />
                    </div>

                    {/* Right: Properties - Floating Panel */}
                    <div className={`${isFocusMode ? "w-0 opacity-0 p-0" : "w-1/4 min-w-[320px] opacity-100"} bg-white rounded-2xl shadow-sm border border-warm-100/50 overflow-hidden flex flex-col transition-all duration-300 ease-in-out`}>
                        <ClausePropertiesPanel
                            clause={selectedClause}
                            onUpdate={clauseOps.handleUpdateClause}
                            onDeviate={clauseOps.handleRequestDeviation}
                            onPromote={clauseOps.handleRequestPromotion}
                            isSaving={clauseOps.isSaving}
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
                open={clauseOps.deviationDialogOpen}
                onOpenChange={clauseOps.setDeviationDialogOpen}
                clauseTitle={clauses.find(c => c.id === clauseOps.pendingDeviationClauseId)?.title || ""}
                onConfirm={clauseOps.handleConfirmDeviation}
                isLoading={clauseOps.isDeviating}
            />

            {/* Promotion Dialog (Phase 3) */}
            <PromotionDialog
                open={clauseOps.promotionDialogOpen}
                onOpenChange={clauseOps.setPromotionDialogOpen}
                clause={clauses.find(c => c.id === clauseOps.pendingPromotionClauseId) || null}
                onPromote={clauseOps.handleConfirmPromotion}
                isLoading={clauseOps.isPromoting}
            />
        </DndContext>
    );
};
