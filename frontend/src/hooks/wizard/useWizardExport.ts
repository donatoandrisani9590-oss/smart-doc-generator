/**
 * useWizardExport - Document export/download
 *
 * Handles exporting the document as PDF or DOCX by calling the
 * generation API and triggering a browser download.
 */

import { useState, useCallback, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import type { FormData, DocumentClause } from "@/components/generator/WizardContext";

// ══════════════════════════════════════════════════════════════════════════════
// PARAMS
// ══════════════════════════════════════════════════════════════════════════════

export interface UseWizardExportParams {
    documentTypeId: number | null;
    documentTitle: string;
    formData: FormData;
    dynamicFormValues: Record<string, string | number | boolean>;
    documentClauses: DocumentClause[];
    selectedVariants: Record<number, { variantId: number; clauseId: number }>;
    selectedAttachmentIds: number[];
    userTemplateId: number | null;
    editorContent: string;
    hasLocalEdits: boolean;
    validateStep: (step: number) => boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// RETURN TYPE
// ══════════════════════════════════════════════════════════════════════════════

export interface UseWizardExportReturn {
    isGenerating: boolean;
    hasExported: boolean;
    /** Returns the document ID from the backend (for lifecycle actions), or null on failure. */
    exportDocument: (format: "pdf" | "docx") => Promise<number | null>;
    /** The document ID from the last successful export */
    lastExportedDocumentId: number | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════════════════════

export function useWizardExport(params: UseWizardExportParams): UseWizardExportReturn {
    const {
        documentTypeId,
        documentTitle,
        formData,
        dynamicFormValues,
        documentClauses,
        selectedVariants,
        selectedAttachmentIds,
        userTemplateId,
        editorContent,
        hasLocalEdits,
        validateStep,
    } = params;

    const toast = useToast();
    const [isGenerating, setIsGenerating] = useState(false);
    const [hasExported, setHasExported] = useState(false);
    const [lastExportedDocumentId, setLastExportedDocumentId] = useState<number | null>(null);
    const exportLockRef = useRef(false);

    const exportDocument = useCallback(async (format: "pdf" | "docx"): Promise<number | null> => {
        if (exportLockRef.current) return null;

        // Validate all required fields
        const allValid = [0, 1, 2, 4].every(step => validateStep(step));
        if (!allValid) {
            toast.error("Validierungsfehler", "Bitte füllen Sie alle Pflichtfelder aus");
            return null;
        }

        exportLockRef.current = true;
        setIsGenerating(true);

        try {
            const enabledClauseIds = documentClauses
                .filter((clause) => clause.is_enabled)
                .sort((a, b) => a.order_index - b.order_index)
                .map((clause) => clause.id);

            const variantClauseIds = Object.values(selectedVariants).map((v) => v.clauseId);
            const allClauseIds = [...enabledClauseIds, ...variantClauseIds];

            const mergedFormData = {
                ...formData,
                ...dynamicFormValues,
            };

            const response = await apiFetch(`/api/v1/documents/generate/${documentTypeId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...mergedFormData,
                    output_format: format,
                    attachment_ids: selectedAttachmentIds,
                    clause_ids: allClauseIds,
                    ...(userTemplateId ? { user_template_id: userTemplateId } : {}),
                    ...(hasLocalEdits && editorContent ? { editor_html_content: editorContent } : {}),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || "Export fehlgeschlagen");
            }

            // Capture the document ID from the response header (Phase 3 lifecycle)
            const documentIdHeader = response.headers.get("X-Document-Id");
            const documentId = documentIdHeader ? parseInt(documentIdHeader, 10) : null;

            const blob = await response.blob();

            // Download file
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${documentTitle || "Dokument"}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            setHasExported(true);
            if (documentId && !isNaN(documentId)) {
                setLastExportedDocumentId(documentId);
            }
            toast.success("Dokument erstellt", `${format.toUpperCase()}-Datei wurde heruntergeladen`);
            return documentId && !isNaN(documentId) ? documentId : null;
        } catch (error) {
            logError("Export failed", { error: error as unknown as Record<string, unknown> });
            toast.error("Export fehlgeschlagen", "Bitte versuchen Sie es erneut.");
            return null;
        } finally {
            setIsGenerating(false);
            exportLockRef.current = false;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [documentTypeId, documentClauses, selectedVariants, formData, dynamicFormValues, selectedAttachmentIds, userTemplateId, editorContent, hasLocalEdits, documentTitle, validateStep]);

    return {
        isGenerating,
        hasExported,
        exportDocument,
        lastExportedDocumentId,
    };
}
