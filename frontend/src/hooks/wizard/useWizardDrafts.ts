/**
 * useWizardDrafts - Draft loading, saving, auto-save, and recovery
 *
 * Handles loading drafts from the API, manual save, and integrates
 * with useAutoSave for automatic persistence. Also manages the
 * "recover draft from localStorage" flow.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import { AUTO_SAVE } from "@/config/api.config";
import {
    type FormData,
    type Comment,
    type DocumentClause,
    type AutoSaveStatus,
    initialFormData,
} from "@/components/generator/WizardContext";
import { type DraftResponse, getStorageKey } from "./types";

// ══════════════════════════════════════════════════════════════════════════════
// HELPER
// ══════════════════════════════════════════════════════════════════════════════

function calculateDraftStep(formData: Partial<FormData> | null): number {
    if (!formData) return 0;

    // Has employee data? -> Step 2
    if (formData.vorname && formData.nachname) {
        // Has contract data? -> Step 3 (or 4 for review)
        if (formData.position && formData.gehalt && formData.eintrittsdatum) {
            return 3; // Jump to review step (index 3 in STANDARD_STEP_ORDER = step 5)
        }
        return 2; // Contract details step
    }

    return 1; // Employee info step
}

// ══════════════════════════════════════════════════════════════════════════════
// PARAMS
// ══════════════════════════════════════════════════════════════════════════════

export interface UseWizardDraftsParams {
    initialDraftId?: number;
    // Shared state accessors
    documentTypeId: number | null;
    documentTitle: string;
    formData: FormData;
    dynamicFormValues: Record<string, string | number | boolean>;
    comments: Comment[];
    documentClauses: DocumentClause[];
    selectedVariants: Record<number, { variantId: number; clauseId: number }>;
    selectedAttachmentIds: number[];
    currentStep: number;
    hasUnsavedChanges: boolean;
    // Setters the draft hook needs to call
    setDocumentTypeIdState: (id: number | null) => void;
    setDocumentTitle: (title: string) => void;
    setFormDataRaw: (newState: FormData | ((prev: FormData) => FormData)) => void;
    setDynamicFormValues: React.Dispatch<React.SetStateAction<Record<string, string | number | boolean>>>;
    setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
    setCurrentStep: (step: number) => void;
    setHasUnsavedChanges: (value: boolean) => void;
    setIsLoading: (value: boolean) => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// RETURN TYPE
// ══════════════════════════════════════════════════════════════════════════════

export interface UseWizardDraftsReturn {
    loadedDraftId: number | null;
    isSaving: boolean;
    // Auto-save state
    autoSaveStatus: AutoSaveStatus;
    lastSaved: Date | null;
    lastSavedText: string;
    hasRecoverableDraft: boolean;
    autoSaveError: Error | null;
    isAutoSaving: boolean;
    autoSaveHasUnsavedChanges: boolean;
    // Actions
    loadDraft: (draftId: number) => Promise<void>;
    saveDraft: () => Promise<void>;
    forceSave: () => Promise<void>;
    recoverDraft: () => void;
    discardDraft: () => void;
    clearAutoSaveError: () => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════════════════════

export function useWizardDrafts(params: UseWizardDraftsParams): UseWizardDraftsReturn {
    const {
        initialDraftId,
        documentTypeId,
        documentTitle,
        formData,
        dynamicFormValues,
        comments,
        documentClauses,
        selectedVariants,
        selectedAttachmentIds,
        currentStep,
        hasUnsavedChanges,
        setDocumentTypeIdState,
        setDocumentTitle,
        setFormDataRaw,
        setDynamicFormValues,
        setComments,
        setCurrentStep,
        setHasUnsavedChanges,
        setIsLoading,
    } = params;

    const toast = useToast();
    const navigate = useNavigate();

    const [loadedDraftId, setLoadedDraftId] = useState<number | null>(initialDraftId ?? null);
    const [draftVersion, setDraftVersion] = useState<number>(1);
    const [isSaving, setIsSaving] = useState(false);

    // ── Auto-Save Data Structure ────────────────────────────────────────────

    const autoSaveData = useMemo(() => ({
        formData,
        dynamicFormValues,
        documentTitle,
        documentTypeId,
        comments,
        documentClauses: documentClauses.filter(c => c.is_enabled).map(c => c.id),
        selectedVariants,
        selectedAttachmentIds,
        currentStep,
        timestamp: new Date().toISOString(),
    }), [formData, dynamicFormValues, documentTitle, documentTypeId, comments, documentClauses, selectedVariants, selectedAttachmentIds, currentStep]);

    // Auto-save callback - save to server (create or update) with optimistic locking
    const performAutoSave = useCallback(async (data: typeof autoSaveData): Promise<void> => {
        if (!data.documentTypeId) return;

        const draftName = data.documentTitle?.trim() || "Unbenannter Entwurf";
        const draftData = {
            document_type_id: data.documentTypeId,
            name: draftName,
            form_data: {
                ...data.formData,
                ...data.dynamicFormValues,
            },
            custom_clauses: data.documentClauses,
            version: draftVersion,
        };

        if (loadedDraftId) {
            // Update existing draft with version for conflict detection
            const response = await api.put<{ version: number }>(`/api/v1/drafts/${loadedDraftId}`, draftData);
            if (response.data?.version) {
                setDraftVersion(response.data.version);
            }
        } else {
            // Create new server-side draft on first auto-save
            const response = await api.post<{ id: number; version: number }>("/api/v1/drafts", draftData);
            if (response.data?.id) {
                setLoadedDraftId(response.data.id);
                setDraftVersion(response.data.version || 1);
            }
        }
    }, [loadedDraftId, draftVersion]);

    const autoSaveKey = useMemo(() =>
        documentTypeId ? `wizard_${documentTypeId}` : 'wizard_new',
    [documentTypeId]);

    const {
        lastSaved,
        isSaving: isAutoSaving,
        error: autoSaveError,
        forceSave,
        clearError: clearAutoSaveError,
        hasUnsavedChanges: autoSaveHasUnsavedChanges,
        lastSavedText,
        hasRecoverableDraft,
        recoverDraft: recoverDraftFromStorage,
        discardDraft: discardDraftFromStorage,
        saveStatus: autoSaveStatus,
    } = useAutoSave(
        autoSaveKey,
        autoSaveData,
        performAutoSave,
        {
            interval: AUTO_SAVE.interval,
            debounce: AUTO_SAVE.debounce,
            enabled: !!documentTypeId && hasUnsavedChanges,
            storagePrefix: AUTO_SAVE.storagePrefix,
            onSaveStart: () => {
                // Optional: Could show a subtle indicator
            },
            onSaveSuccess: () => {
                setHasUnsavedChanges(false);
            },
            onSaveError: (error) => {
                logError("Auto-save failed", { error: error as unknown as Record<string, unknown> });
            },
        }
    );

    // ── Recover / Discard Draft ─────────────────────────────────────────────

    const recoverDraft = useCallback(() => {
        const recovered = recoverDraftFromStorage();
        if (recovered) {
            if (recovered.formData) {
                setFormDataRaw({
                    ...initialFormData,
                    ...(recovered.formData as Partial<FormData>),
                });
            }
            if (recovered.dynamicFormValues) {
                setDynamicFormValues(recovered.dynamicFormValues as Record<string, string | number | boolean>);
            }
            if (recovered.documentTitle) {
                setDocumentTitle(recovered.documentTitle as string);
            }
            if (recovered.documentTypeId) {
                setDocumentTypeIdState(recovered.documentTypeId as number);
            }
            if (recovered.comments) {
                setComments(recovered.comments as Comment[]);
            }
            if (typeof recovered.currentStep === 'number') {
                setCurrentStep(recovered.currentStep);
            }

            toast.success("Entwurf wiederhergestellt", "Ihre nicht gespeicherten Änderungen wurden wiederhergestellt");
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recoverDraftFromStorage, setFormDataRaw, setDynamicFormValues, setDocumentTitle, setDocumentTypeIdState, setComments, setCurrentStep]);

    const discardDraft = useCallback(() => {
        discardDraftFromStorage();
        toast.info("Entwurf verworfen", "Der gespeicherte Entwurf wurde geloescht");
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [discardDraftFromStorage]);

    // ── Load Draft ──────────────────────────────────────────────────────────

    const loadDraft = useCallback(async (draftId: number) => {
        setIsLoading(true);
        try {
            const response = await api.get<DraftResponse>(`/api/v1/drafts/${draftId}`);
            const draft = response.data;

            setDocumentTypeIdState(draft.document_type_id);
            setDocumentTitle(draft.name || "");
            setLoadedDraftId(draftId);
            setDraftVersion(draft.version || 1);

            if (draft.form_data) {
                setFormDataRaw({
                    ...initialFormData,
                    ...(draft.form_data as Partial<FormData>),
                });
            }

            const jumpToStep = calculateDraftStep(draft.form_data as Partial<FormData>);
            setCurrentStep(jumpToStep);

            toast.success("Entwurf geladen", `"${draft.name || draft.document_type_name}" wurde geladen`);
        } catch (error) {
            logError("Failed to load draft", { error: error as unknown as Record<string, unknown> });
            toast.error("Fehler", "Entwurf konnte nicht geladen werden");
            navigate("/generate", { replace: true });
        } finally {
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate, setFormDataRaw, setDocumentTypeIdState, setDocumentTitle, setCurrentStep, setIsLoading]);

    // Load draft on mount if ID provided
    useEffect(() => {
        if (initialDraftId) {
            loadDraft(initialDraftId);
        }
    }, [initialDraftId, loadDraft]);

    // ── Manual Save Draft ───────────────────────────────────────────────────

    const saveDraft = useCallback(async () => {
        if (!documentTypeId) {
            toast.error("Fehler", "Bitte wählen Sie einen Dokumenttyp");
            return;
        }

        // Auto-generate title if empty (instead of blocking save)
        let draftName = documentTitle.trim();
        if (!draftName) {
            const nameParts = [formData.vorname, formData.nachname].filter(Boolean);
            draftName = nameParts.length > 0
                ? `Entwurf - ${nameParts.join(" ")}`
                : `Entwurf - ${new Date().toLocaleDateString("de-DE")}`;
        }

        setIsSaving(true);
        try {
            const mergedFormData = {
                ...formData,
                ...dynamicFormValues,
            };

            const draftData = {
                document_type_id: documentTypeId,
                name: draftName,
                form_data: mergedFormData,
                custom_clauses: documentClauses.filter(c => c.is_enabled).map(c => c.id),
                version: draftVersion,
            };

            if (loadedDraftId) {
                const response = await api.put<{ version: number }>(`/api/v1/drafts/${loadedDraftId}`, draftData);
                if (response.data?.version) {
                    setDraftVersion(response.data.version);
                }
                toast.success("Entwurf aktualisiert", `"${draftName}" wurde in Meine Dokumente gespeichert`);
            } else {
                const response = await api.post<{ id: number; version: number }>("/api/v1/drafts", draftData);
                setLoadedDraftId(response.data.id);
                setDraftVersion(response.data.version || 1);
                toast.success("Entwurf erstellt", `"${draftName}" wurde in Meine Dokumente gespeichert`);
            }

            // Clear localStorage
            if (documentTypeId) {
                localStorage.removeItem(getStorageKey(documentTypeId));
            }
            setHasUnsavedChanges(false);
        } catch (error: unknown) {
            const apiError = error as { status?: number };
            if (apiError.status === 409) {
                toast.error(
                    "Konflikt",
                    "Der Entwurf wurde zwischenzeitlich geaendert. Seite wird neu geladen...",
                );
                // Reload draft to get latest version
                if (loadedDraftId) {
                    setTimeout(() => loadDraft(loadedDraftId), 1500);
                }
                return;
            }
            logError("Failed to save draft", { error: error as unknown as Record<string, unknown> });
            toast.error("Fehler", "Entwurf konnte nicht gespeichert werden");
        } finally {
            setIsSaving(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [documentTypeId, documentTitle, formData, dynamicFormValues, documentClauses, loadedDraftId, setHasUnsavedChanges]);

    return {
        loadedDraftId,
        isSaving,
        autoSaveStatus: autoSaveStatus as AutoSaveStatus,
        lastSaved,
        lastSavedText,
        hasRecoverableDraft,
        autoSaveError,
        isAutoSaving,
        autoSaveHasUnsavedChanges,
        loadDraft,
        saveDraft,
        forceSave,
        recoverDraft,
        discardDraft,
        clearAutoSaveError,
    };
}
