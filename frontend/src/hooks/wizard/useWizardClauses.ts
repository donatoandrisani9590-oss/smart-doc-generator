/**
 * useWizardClauses - Clause loading, toggling, reordering, variant selection
 *
 * Loads clauses from the API when document type changes, manages
 * enabled/disabled state, drag-reorder, and variant group selection.
 */

import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import type { DocumentClause, VariantGroup } from "@/components/generator/WizardContext";
import type { ClauseResponse } from "./types";

// ══════════════════════════════════════════════════════════════════════════════
// PARAMS
// ══════════════════════════════════════════════════════════════════════════════

export interface UseWizardClausesParams {
    /** Current document type ID - clauses reload when this changes */
    documentTypeId: number | null;
    /** Callback to mark unsaved changes in the parent */
    markUnsaved: () => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// RETURN TYPE
// ══════════════════════════════════════════════════════════════════════════════

export interface UseWizardClausesReturn {
    documentClauses: DocumentClause[];
    setDocumentClauses: React.Dispatch<React.SetStateAction<DocumentClause[]>>;
    selectedVariants: Record<number, { variantId: number; clauseId: number }>;
    variantGroups: VariantGroup[];
    selectedAttachmentIds: number[];
    toggleClause: (uniqueId: string) => void;
    reorderClauses: (clauses: DocumentClause[]) => void;
    selectVariant: (groupId: number, variantId: number, clauseId: number) => void;
    toggleAttachment: (id: number) => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════════════════════

export function useWizardClauses({ documentTypeId, markUnsaved }: UseWizardClausesParams): UseWizardClausesReturn {
    const [documentClauses, setDocumentClauses] = useState<DocumentClause[]>([]);
    const [selectedVariants, setSelectedVariants] = useState<Record<number, { variantId: number; clauseId: number }>>({});
    const [variantGroups, setVariantGroups] = useState<VariantGroup[]>([]);
    const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<number[]>([]);

    // ── Load clauses when document type changes ─────────────────────────────

    useEffect(() => {
        if (!documentTypeId) return;

        const loadClauses = async () => {
            try {
                const response = await api.get<ClauseResponse[]>(
                    `/api/v1/document-types/${documentTypeId}/clauses`
                );

                // Extract unique variant groups with their clauses
                const groupsMap = new Map<number, VariantGroup>();

                response.data.forEach((clause) => {
                    if (clause.clause_type === "variant" && clause.variant_group_id) {
                        if (!groupsMap.has(clause.variant_group_id)) {
                            groupsMap.set(clause.variant_group_id, {
                                id: clause.variant_group_id,
                                name: clause.variant_group_name || `Variante ${clause.variant_group_id}`,
                                clauses: [],
                            });
                        }
                        groupsMap.get(clause.variant_group_id)!.clauses.push({
                            id: clause.id,
                            name: clause.title,
                        });
                    }
                });
                setVariantGroups(Array.from(groupsMap.values()));

                // Set clauses (filter out variant clauses)
                setDocumentClauses(response.data
                    .filter((clause) => clause.clause_type !== "variant")
                    .map((clause) => ({
                        id: clause.id,
                        unique_id: `clause-${clause.id}`,
                        name: clause.title,
                        content: "",
                        is_required: clause.is_mandatory,
                        is_enabled: clause.is_mandatory || clause.is_default_selected || false,
                        order_index: clause.display_order,
                        has_variants: false,
                        has_paragraph_number: clause.has_paragraph_number ?? true,
                        variant_group_id: clause.variant_group_id,
                    })));
            } catch (error) {
                logError("Failed to load clauses", { error: error as unknown as Record<string, unknown> });
                setDocumentClauses([]);
                setVariantGroups([]);
            }
        };

        loadClauses();
    }, [documentTypeId]);

    // ── Clause Actions ──────────────────────────────────────────────────────

    const toggleClause = useCallback((uniqueId: string) => {
        setDocumentClauses(prev => prev.map(clause =>
            clause.unique_id === uniqueId && !clause.is_required
                ? { ...clause, is_enabled: !clause.is_enabled }
                : clause
        ));
        markUnsaved();
    }, [markUnsaved]);

    const reorderClauses = useCallback((clauses: DocumentClause[]) => {
        setDocumentClauses(clauses);
        markUnsaved();
    }, [markUnsaved]);

    const selectVariant = useCallback((groupId: number, variantId: number, clauseId: number) => {
        setSelectedVariants(prev => ({
            ...prev,
            [groupId]: { variantId, clauseId },
        }));
        markUnsaved();
    }, [markUnsaved]);

    const toggleAttachment = useCallback((id: number) => {
        setSelectedAttachmentIds(prev =>
            prev.includes(id)
                ? prev.filter(a => a !== id)
                : [...prev, id]
        );
        markUnsaved();
    }, [markUnsaved]);

    return {
        documentClauses,
        setDocumentClauses,
        selectedVariants,
        variantGroups,
        selectedAttachmentIds,
        toggleClause,
        reorderClauses,
        selectVariant,
        toggleAttachment,
    };
}
