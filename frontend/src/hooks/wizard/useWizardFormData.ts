/**
 * useWizardFormData - Form data state with undo/redo integration
 *
 * Manages the core form data (employee info, contract details, etc.),
 * dynamic form values, document type selection with defaults, and
 * integrates with useUndoRedo for history navigation.
 */

import { useState, useCallback, useEffect } from "react";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import {
    type FormData,
    initialFormData,
} from "@/components/generator/WizardContext";
import type { DocumentTypeResponse } from "./types";

// ══════════════════════════════════════════════════════════════════════════════
// RETURN TYPE
// ══════════════════════════════════════════════════════════════════════════════

export interface UseWizardFormDataReturn {
    formData: FormData;
    setFormDataRaw: (newState: FormData | ((prev: FormData) => FormData)) => void;
    dynamicFormValues: Record<string, string | number | boolean>;
    setDynamicFormValues: React.Dispatch<React.SetStateAction<Record<string, string | number | boolean>>>;
    documentTypeId: number | null;
    setDocumentTypeIdState: React.Dispatch<React.SetStateAction<number | null>>;
    documentTitle: string;
    setDocumentTitle: React.Dispatch<React.SetStateAction<string>>;
    documentTypes: DocumentTypeResponse[];
    isLoading: boolean;
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    hasUnsavedChanges: boolean;
    setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
    // Actions
    setDocumentType: (id: number) => void;
    updateFormField: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
    updateDynamicField: (name: string, value: string | number | boolean) => void;
    setFormData: (data: Partial<FormData>) => void;
    // Undo/Redo
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════════════════════

export function useWizardFormData(): UseWizardFormDataReturn {
    const toast = useToast();

    // Form Data with Undo/Redo
    const {
        state: formData,
        setState: setFormDataRaw,
        undo,
        redo,
        canUndo,
        canRedo,
    } = useUndoRedo<FormData>(initialFormData, {
        maxHistory: 30,
        debounceMs: 500,
    });

    const [dynamicFormValues, setDynamicFormValues] = useState<Record<string, string | number | boolean>>({});

    // Document Type State
    const [documentTypeId, setDocumentTypeIdState] = useState<number | null>(null);
    const [documentTypes, setDocumentTypes] = useState<DocumentTypeResponse[]>([]);
    const [documentTitle, setDocumentTitle] = useState("");

    // Loading / unsaved
    const [isLoading, setIsLoading] = useState(true);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // ── Load Document Types ─────────────────────────────────────────────────

    useEffect(() => {
        const loadDocumentTypes = async () => {
            setIsLoading(true);
            try {
                const response = await api.get<DocumentTypeResponse[]>("/api/v1/document-types");
                const activeTypes = response.data.filter(t => t.is_active);
                setDocumentTypes(activeTypes);
            } catch (error) {
                logError("Failed to load document types", { error: error as unknown as Record<string, unknown> });
                toast.error("Fehler", "Dokumenttypen konnten nicht geladen werden");
            } finally {
                setIsLoading(false);
            }
        };
        loadDocumentTypes();
    }, [toast]);

    // ── Form Actions ────────────────────────────────────────────────────────

    const setDocumentType = useCallback((id: number) => {
        setDocumentTypeIdState(id);
        setHasUnsavedChanges(true);

        // Apply defaults from document type
        const selectedDocType = documentTypes.find(dt => dt.id === id);
        if (selectedDocType) {
            setFormDataRaw(prev => ({
                ...prev,
                wochenstunden: String(selectedDocType.default_weekly_hours ?? 40),
                probezeit: String(selectedDocType.default_probation_months ?? 6) + " Monate",
            }));
        }
    }, [documentTypes, setFormDataRaw]);

    const updateFormField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
        setFormDataRaw(prev => ({ ...prev, [field]: value }));
        setHasUnsavedChanges(true);
    }, [setFormDataRaw]);

    const updateDynamicField = useCallback((name: string, value: string | number | boolean) => {
        setDynamicFormValues(prev => ({ ...prev, [name]: value }));
        setHasUnsavedChanges(true);
    }, []);

    const setFormData = useCallback((data: Partial<FormData>) => {
        setFormDataRaw(prev => ({ ...prev, ...data }));
        setHasUnsavedChanges(true);
    }, [setFormDataRaw]);

    return {
        formData,
        setFormDataRaw,
        dynamicFormValues,
        setDynamicFormValues,
        documentTypeId,
        setDocumentTypeIdState,
        documentTitle,
        setDocumentTitle,
        documentTypes,
        isLoading,
        setIsLoading,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        setDocumentType,
        updateFormField,
        updateDynamicField,
        setFormData,
        undo,
        redo,
        canUndo,
        canRedo,
    };
}
