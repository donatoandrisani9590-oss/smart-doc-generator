/**
 * useWizardPreview - Preview HTML generation
 *
 * Generates an HTML preview of the document by calling the backend API
 * whenever form data, enabled clauses, or selected variants change.
 */

import { useState, useCallback, useEffect } from "react";
import { useDebounce } from "use-debounce";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import type { FormData, DocumentClause } from "@/components/generator/WizardContext";

// ══════════════════════════════════════════════════════════════════════════════
// PARAMS
// ══════════════════════════════════════════════════════════════════════════════

export interface UseWizardPreviewParams {
    documentTypeId: number | null;
    formData: FormData;
    dynamicFormValues: Record<string, string | number | boolean>;
    documentClauses: DocumentClause[];
    selectedVariants: Record<number, { variantId: number; clauseId: number }>;
}

// ══════════════════════════════════════════════════════════════════════════════
// RETURN TYPE
// ══════════════════════════════════════════════════════════════════════════════

export interface UseWizardPreviewReturn {
    previewHtml: string;
    isPreviewLoading: boolean;
    refreshPreview: () => Promise<void>;
}

// ══════════════════════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════════════════════

export function useWizardPreview(params: UseWizardPreviewParams): UseWizardPreviewReturn {
    const { documentTypeId, formData, dynamicFormValues, documentClauses, selectedVariants } = params;

    const [previewHtml, setPreviewHtml] = useState("");
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    const [debouncedFormData] = useDebounce(formData, 150);

    const refreshPreview = useCallback(async () => {
        if (!documentTypeId) return;

        const enabledClauseIds = documentClauses
            .filter((clause) => clause.is_enabled)
            .sort((a, b) => a.order_index - b.order_index)
            .map((clause) => clause.id);

        const variantClauseIds = Object.values(selectedVariants).map((v) => v.clauseId);
        const allClauseIds = [...enabledClauseIds, ...variantClauseIds];

        setIsPreviewLoading(true);
        try {
            const mergedFormData = {
                ...debouncedFormData,
                ...dynamicFormValues,
            };

            const response = await api.post<string>("/api/v1/preview/html", {
                document_type_id: documentTypeId,
                form_data: mergedFormData,
                clause_ids: allClauseIds,
            });
            setPreviewHtml(response.data);
        } catch (error) {
            logError("Preview fetch failed", { error: error as unknown as Record<string, unknown> });
        } finally {
            setIsPreviewLoading(false);
        }
    }, [documentTypeId, documentClauses, selectedVariants, debouncedFormData, dynamicFormValues]);

    // Auto-refresh preview when data changes
    useEffect(() => {
        refreshPreview();
    }, [refreshPreview]);

    return {
        previewHtml,
        isPreviewLoading,
        refreshPreview,
    };
}
