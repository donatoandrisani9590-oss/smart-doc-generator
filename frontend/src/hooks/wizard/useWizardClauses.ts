/**
 * useWizardClauses - Clause loading, toggling, reordering, variant selection
 *
 * Loads clauses from the API when document type changes, manages
 * enabled/disabled state, drag-reorder, and variant group selection.
 * Auto-selects variants based on formData.vertragsart.
 */

import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import type { DocumentClause, VariantGroup, FormData } from "@/components/generator/WizardContext";
import type { ClauseResponse } from "./types";

// ══════════════════════════════════════════════════════════════════════════════
// API RESPONSE TYPE for variant-groups endpoint
// ══════════════════════════════════════════════════════════════════════════════

interface VariantGroupResponse {
    id: number;
    variant_group_id: number;
    variant_group_name: string;
    variant_group_description: string;
    display_order: number;
    is_mandatory: boolean;
    default_variant_id: number | null;
    effective_default_id: number | null;
    variant_count: number;
    variants: Array<{
        id: number;
        variant_name: string;
        variant_code: string | null;
        is_default: boolean;
        clause_id: number;
        clause_title: string | null;
        clause_content_preview: string | null;
        auto_select_condition?: {
            field: string;
            operator: string;
            value: string;
        } | null;
    }>;
}

// ══════════════════════════════════════════════════════════════════════════════
// PARAMS
// ══════════════════════════════════════════════════════════════════════════════

export interface UseWizardClausesParams {
    /** Current document type ID - clauses reload when this changes */
    documentTypeId: number | null;
    /** Form data for auto-selecting variants */
    formData: FormData;
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

export function useWizardClauses({ documentTypeId, formData, markUnsaved }: UseWizardClausesParams): UseWizardClausesReturn {
    const [documentClauses, setDocumentClauses] = useState<DocumentClause[]>([]);
    const [selectedVariants, setSelectedVariants] = useState<Record<number, { variantId: number; clauseId: number }>>({});
    const [variantGroups, setVariantGroups] = useState<VariantGroup[]>([]);
    const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<number[]>([]);

    // ── Load clauses when document type changes ─────────────────────────────

    useEffect(() => {
        if (!documentTypeId) return;

        const loadClauses = async () => {
            try {
                // Load clauses and variant groups in parallel
                const [clausesRes, variantGroupsRes] = await Promise.all([
                    api.get<ClauseResponse[]>(
                        `/api/v1/document-types/${documentTypeId}/clauses`
                    ),
                    api.get<VariantGroupResponse[]>(
                        `/api/v1/document-types/${documentTypeId}/variant-groups`
                    ).catch(() => ({ data: [] as VariantGroupResponse[] })),
                ]);

                // Build variant groups from dedicated endpoint (has auto_select_condition)
                const groups: VariantGroup[] = variantGroupsRes.data.map((vg) => ({
                    id: vg.variant_group_id,
                    name: vg.variant_group_name,
                    clauses: vg.variants.map((v) => ({
                        id: v.clause_id,
                        name: v.clause_title || v.variant_name,
                    })),
                    variants: vg.variants.map((v) => ({
                        id: v.id,
                        variant_name: v.variant_name,
                        variant_code: v.variant_code,
                        is_default: v.is_default,
                        clause_id: v.clause_id,
                        clause_title: v.clause_title,
                        auto_select_condition: v.auto_select_condition,
                    })),
                }));
                setVariantGroups(groups);

                // Set clauses (filter out variant-type clauses from the main list)
                setDocumentClauses(clausesRes.data
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

    // ── Auto-select variants based on vertragsart ───────────────────────────

    useEffect(() => {
        if (!variantGroups.length) return;

        const newSelections: Record<number, { variantId: number; clauseId: number }> = {};

        for (const group of variantGroups) {
            if (!group.variants?.length) continue;

            // Check each variant's auto_select_condition
            const matchingVariant = group.variants.find((v) => {
                if (!v.auto_select_condition) return false;
                const cond = v.auto_select_condition;
                return (
                    cond.field === "vertragsart" &&
                    cond.operator === "=" &&
                    cond.value === formData.vertragsart
                );
            });

            if (matchingVariant) {
                newSelections[group.id] = {
                    variantId: matchingVariant.id,
                    clauseId: matchingVariant.clause_id,
                };
            }
        }

        // Only update if selections actually differ
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync variant selections when contract type changes
        setSelectedVariants((prev) => {
            const hasChanges = Object.keys(newSelections).some(
                (k) =>
                    !prev[Number(k)] ||
                    prev[Number(k)].variantId !== newSelections[Number(k)].variantId
            );
            return hasChanges ? { ...prev, ...newSelections } : prev;
        });
    }, [formData.vertragsart, variantGroups]);

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
