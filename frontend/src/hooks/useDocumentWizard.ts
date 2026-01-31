/**
 * useDocumentWizard - Custom Hook für Document Generator Wizard State Management
 *
 * Extrahiert und verwaltet alle Logik für den schrittweisen Dokumenten-Workflow:
 * - Formulardaten mit Undo/Redo
 * - Draft-Laden und Speichern
 * - Klausel-Verwaltung
 * - Preview-Generierung
 * - Schritt-Navigation
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDebounce } from "use-debounce";
import { useNavigate } from "react-router-dom";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import {
    type WizardState,
    type WizardActions,
    type WizardContextValue,
    type FormData,
    type DocumentClause,
    type VariantGroup,
    type Comment,
    type AddCommentParams,
    initialFormData,
    STANDARD_STEP_ORDER,
    FULL_STEP_ORDER,
} from "@/components/generator/WizardContext";

// ══════════════════════════════════════════════════════════════════════════════
// API RESPONSE TYPES
// ══════════════════════════════════════════════════════════════════════════════

interface DocumentTypeResponse {
    id: number;
    name: string;
    country_code: string;
    category?: string;
    is_active: boolean;
    default_probation_months?: number;
    default_notice_period?: string;
    default_vacation_days?: number;
    default_weekly_hours?: number;
}

interface ClauseResponse {
    id: number;
    title: string;
    display_order: number;
    is_mandatory: boolean;
    is_default_selected?: boolean;
    clause_type: string;
    is_order_locked?: boolean;
    variant_group_id?: number;
    variant_group_name?: string;
}

interface DraftResponse {
    id: number;
    document_type_id: number;
    document_type_name: string;
    name: string | null;
    form_data: Record<string, unknown>;
    custom_clauses: number[] | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// LOCALSTORAGE KEYS
// ══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY_PREFIX = "doc_wizard_";
const getStorageKey = (typeId: number) => `${STORAGE_KEY_PREFIX}${typeId}`;

// ══════════════════════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════════════════════

export function useDocumentWizard(initialDraftId?: number): WizardContextValue {
    const toast = useToast();
    const navigate = useNavigate();

    // ══════════════════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════════════════

    // Navigation State
    const [currentStep, setCurrentStep] = useState(0);
    const [mode, setMode] = useState<"wizard" | "editor" | "split-screen">("wizard");
    const [showClausesStep, setShowClausesStep] = useState(false);

    // Document Type State
    const [documentTypeId, setDocumentTypeIdState] = useState<number | null>(null);
    const [documentTypes, setDocumentTypes] = useState<DocumentTypeResponse[]>([]);
    const [documentTitle, setDocumentTitle] = useState("");
    const [loadedDraftId, setLoadedDraftId] = useState<number | null>(initialDraftId ?? null);

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
    const [debouncedFormData] = useDebounce(formData, 150);

    // Clauses State
    const [documentClauses, setDocumentClauses] = useState<DocumentClause[]>([]);
    const [selectedVariants, setSelectedVariants] = useState<Record<number, { variantId: number; clauseId: number }>>({});
    const [variantGroups, setVariantGroups] = useState<VariantGroup[]>([]);

    // Attachments
    const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<number[]>([]);

    // Preview State
    const [previewHtml, setPreviewHtml] = useState("");
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    // Split-Screen Editor State
    const [editorContent, setEditorContentState] = useState("");
    const [hasLocalEdits, setHasLocalEdits] = useState(false);
    const [showCommentSidebar, setShowCommentSidebar] = useState(false);

    // Comments State (Apple Pages Style)
    const [comments, setComments] = useState<Comment[]>([]);

    // Loading States
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Validation
    const [validationErrors, setValidationErrors] = useState<Array<{ field: string; message: string }>>([]);

    // Refs
    const exportLockRef = useRef(false);

    // ══════════════════════════════════════════════════════════════════════════
    // COMPUTED VALUES
    // ══════════════════════════════════════════════════════════════════════════

    const stepOrder = useMemo(() => {
        return showClausesStep ? FULL_STEP_ORDER : STANDARD_STEP_ORDER;
    }, [showClausesStep]);

    const actualStepIndex = useMemo(() => {
        return stepOrder[currentStep] ?? currentStep;
    }, [stepOrder, currentStep]);

    // ══════════════════════════════════════════════════════════════════════════
    // LOAD DOCUMENT TYPES
    // ══════════════════════════════════════════════════════════════════════════

    useEffect(() => {
        const loadDocumentTypes = async () => {
            setIsLoading(true);
            try {
                const response = await api.get<DocumentTypeResponse[]>("/api/v1/document-types/");
                const activeTypes = response.data.filter(t => t.is_active);
                setDocumentTypes(activeTypes);
            } catch (error) {
                logError("Failed to load document types", { error });
                toast.error("Fehler", "Dokumenttypen konnten nicht geladen werden");
            } finally {
                setIsLoading(false);
            }
        };
        loadDocumentTypes();
    }, [toast]);

    // ══════════════════════════════════════════════════════════════════════════
    // LOAD DRAFT
    // ══════════════════════════════════════════════════════════════════════════

    const loadDraft = useCallback(async (draftId: number) => {
        setIsLoading(true);
        try {
            const response = await api.get<DraftResponse>(`/api/v1/drafts/${draftId}`);
            const draft = response.data;

            setDocumentTypeIdState(draft.document_type_id);
            setDocumentTitle(draft.name || "");
            setLoadedDraftId(draftId);

            if (draft.form_data) {
                setFormDataRaw({
                    ...initialFormData,
                    ...(draft.form_data as Partial<FormData>),
                });
            }

            // Calculate which step to jump to based on draft completeness
            const jumpToStep = calculateDraftStep(draft.form_data as Partial<FormData>);
            setCurrentStep(jumpToStep);

            toast.success("Entwurf geladen", `"${draft.name || draft.document_type_name}" wurde geladen`);
        } catch (error) {
            logError("Failed to load draft", { error });
            toast.error("Fehler", "Entwurf konnte nicht geladen werden");
            navigate("/generate", { replace: true });
        } finally {
            setIsLoading(false);
        }
    }, [navigate, setFormDataRaw, toast]);

    // Load draft on mount if ID provided
    useEffect(() => {
        if (initialDraftId) {
            loadDraft(initialDraftId);
        }
    }, [initialDraftId, loadDraft]);

    // ══════════════════════════════════════════════════════════════════════════
    // LOAD CLAUSES WHEN DOCUMENT TYPE CHANGES
    // ══════════════════════════════════════════════════════════════════════════

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
                        variant_group_id: clause.variant_group_id,
                    })));
            } catch (error) {
                logError("Failed to load clauses", { error });
                setDocumentClauses([]);
                setVariantGroups([]);
            }
        };

        loadClauses();
    }, [documentTypeId]);

    // ══════════════════════════════════════════════════════════════════════════
    // PREVIEW GENERATION
    // ══════════════════════════════════════════════════════════════════════════

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
            logError("Preview fetch failed", { error });
        } finally {
            setIsPreviewLoading(false);
        }
    }, [documentTypeId, documentClauses, selectedVariants, debouncedFormData, dynamicFormValues]);

    // Auto-refresh preview when data changes
    useEffect(() => {
        refreshPreview();
    }, [refreshPreview]);

    // ══════════════════════════════════════════════════════════════════════════
    // VALIDATION
    // ══════════════════════════════════════════════════════════════════════════

    const validateStep = useCallback((step: number): boolean => {
        const errors: Array<{ field: string; message: string }> = [];

        switch (step) {
            case 0: // Document Type
                if (!documentTypeId) {
                    errors.push({ field: "documentType", message: "Dokumenttyp ist erforderlich" });
                }
                break;

            case 1: // Employee Info
                if (!formData.vorname.trim()) {
                    errors.push({ field: "vorname", message: "Vorname ist erforderlich" });
                }
                if (!formData.nachname.trim()) {
                    errors.push({ field: "nachname", message: "Nachname ist erforderlich" });
                }
                break;

            case 2: // Contract Details
                if (!formData.position.trim()) {
                    errors.push({ field: "position", message: "Position ist erforderlich" });
                }
                if (!formData.gehalt || parseFloat(formData.gehalt) <= 0) {
                    errors.push({ field: "gehalt", message: "Gültiges Gehalt ist erforderlich" });
                }
                if (!formData.eintrittsdatum) {
                    errors.push({ field: "eintrittsdatum", message: "Eintrittsdatum ist erforderlich" });
                }
                break;

            case 3: // Clauses - optional, no validation needed
                break;

            case 4: // Review
                if (!formData.signatory_name.trim()) {
                    errors.push({ field: "signatory_name", message: "Unterzeichner ist erforderlich" });
                }
                break;
        }

        setValidationErrors(errors);
        return errors.length === 0;
    }, [documentTypeId, formData]);

    // ══════════════════════════════════════════════════════════════════════════
    // NAVIGATION ACTIONS
    // ══════════════════════════════════════════════════════════════════════════

    const goToStep = useCallback(async (targetStep: number): Promise<boolean> => {
        // Validate current step before moving forward
        if (targetStep > currentStep) {
            if (!validateStep(actualStepIndex)) {
                return false;
            }
        }

        // Save to localStorage on step change (including comments)
        if (documentTypeId) {
            try {
                localStorage.setItem(getStorageKey(documentTypeId), JSON.stringify({
                    formData,
                    dynamicFormValues,
                    documentTitle,
                    comments,
                    timestamp: new Date().toISOString(),
                }));
            } catch (e) {
                logError("Failed to save to localStorage", { error: e });
            }
        }

        setCurrentStep(targetStep);
        return true;
    }, [currentStep, actualStepIndex, validateStep, documentTypeId, formData, dynamicFormValues, documentTitle, comments]);

    const nextStep = useCallback(async (): Promise<boolean> => {
        const maxStep = stepOrder.length - 1;
        if (currentStep >= maxStep) return false;
        return goToStep(currentStep + 1);
    }, [currentStep, stepOrder.length, goToStep]);

    const prevStep = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    }, [currentStep]);

    const enterEditorMode = useCallback(() => {
        setMode("editor");
    }, []);

    const exitEditorMode = useCallback(() => {
        setMode("wizard");
    }, []);

    const toggleClausesStep = useCallback(() => {
        setShowClausesStep(prev => !prev);
    }, []);

    // ══════════════════════════════════════════════════════════════════════════
    // FORM ACTIONS
    // ══════════════════════════════════════════════════════════════════════════

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

    // ══════════════════════════════════════════════════════════════════════════
    // CLAUSE ACTIONS
    // ══════════════════════════════════════════════════════════════════════════

    const toggleClause = useCallback((uniqueId: string) => {
        setDocumentClauses(prev => prev.map(clause =>
            clause.unique_id === uniqueId && !clause.is_required
                ? { ...clause, is_enabled: !clause.is_enabled }
                : clause
        ));
        setHasUnsavedChanges(true);
    }, []);

    const reorderClauses = useCallback((clauses: DocumentClause[]) => {
        setDocumentClauses(clauses);
        setHasUnsavedChanges(true);
    }, []);

    const selectVariant = useCallback((groupId: number, variantId: number, clauseId: number) => {
        setSelectedVariants(prev => ({
            ...prev,
            [groupId]: { variantId, clauseId },
        }));
        setHasUnsavedChanges(true);
    }, []);

    // ══════════════════════════════════════════════════════════════════════════
    // ATTACHMENT ACTIONS
    // ══════════════════════════════════════════════════════════════════════════

    const toggleAttachment = useCallback((id: number) => {
        setSelectedAttachmentIds(prev =>
            prev.includes(id)
                ? prev.filter(a => a !== id)
                : [...prev, id]
        );
        setHasUnsavedChanges(true);
    }, []);

    // ══════════════════════════════════════════════════════════════════════════
    // DRAFT ACTIONS
    // ══════════════════════════════════════════════════════════════════════════

    const saveDraft = useCallback(async () => {
        if (!documentTypeId) {
            toast.error("Fehler", "Bitte wählen Sie einen Dokumenttyp");
            return;
        }

        if (!documentTitle.trim()) {
            toast.error("Titel erforderlich", "Bitte geben Sie einen Titel für den Entwurf ein");
            return;
        }

        setIsSaving(true);
        try {
            const mergedFormData = {
                ...formData,
                ...dynamicFormValues,
            };

            const draftData = {
                document_type_id: documentTypeId,
                name: documentTitle.trim(),
                form_data: mergedFormData,
                custom_clauses: documentClauses.filter(c => c.is_enabled).map(c => c.id),
            };

            if (loadedDraftId) {
                await api.put(`/api/v1/drafts/${loadedDraftId}`, draftData);
                toast.success("Entwurf aktualisiert", `"${documentTitle}" wurde gespeichert`);
            } else {
                const response = await api.post<{ id: number }>("/api/v1/drafts", draftData);
                setLoadedDraftId(response.data.id);
                toast.success("Entwurf gespeichert", `"${documentTitle}" wurde erstellt`);
            }

            // Clear localStorage
            if (documentTypeId) {
                localStorage.removeItem(getStorageKey(documentTypeId));
            }
            setHasUnsavedChanges(false);
            // Benutzer bleibt auf der Seite - kein automatisches Weiterleiten
        } catch (error) {
            logError("Failed to save draft", { error });
            toast.error("Fehler", "Entwurf konnte nicht gespeichert werden");
        } finally {
            setIsSaving(false);
        }
    }, [documentTypeId, documentTitle, formData, dynamicFormValues, documentClauses, loadedDraftId, navigate, toast]);

    // ══════════════════════════════════════════════════════════════════════════
    // EXPORT ACTIONS
    // ══════════════════════════════════════════════════════════════════════════

    const exportDocument = useCallback(async (format: "pdf" | "docx") => {
        if (exportLockRef.current) return;

        // Validate all required fields
        const allValid = [0, 1, 2, 4].every(step => validateStep(step));
        if (!allValid) {
            toast.error("Validierungsfehler", "Bitte füllen Sie alle Pflichtfelder aus");
            return;
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

            // Use native fetch for blob download
            const token = localStorage.getItem("auth_token");
            const response = await fetch(`/api/v1/documents/generate/${documentTypeId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    ...mergedFormData,
                    output_format: format,
                    attachment_ids: selectedAttachmentIds,
                    clause_ids: allClauseIds,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || "Export fehlgeschlagen");
            }

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

            toast.success("Dokument erstellt", `${format.toUpperCase()}-Datei wurde heruntergeladen`);
        } catch (error) {
            logError("Export failed", { error });
            toast.error("Export fehlgeschlagen", "Bitte versuchen Sie es erneut.");
        } finally {
            setIsGenerating(false);
            exportLockRef.current = false;
        }
    }, [documentTypeId, documentClauses, selectedVariants, formData, dynamicFormValues, selectedAttachmentIds, documentTitle, validateStep, toast]);

    // ══════════════════════════════════════════════════════════════════════════
    // UTILITY ACTIONS
    // ══════════════════════════════════════════════════════════════════════════

    const clearForm = useCallback(() => {
        setFormDataRaw(initialFormData);
        setDynamicFormValues({});
        setDocumentTitle("");
        setLoadedDraftId(null);
        setCurrentStep(0);
        setHasUnsavedChanges(false);
        setEditorContentState("");
        setHasLocalEdits(false);
        setComments([]); // Clear comments

        if (documentTypeId) {
            localStorage.removeItem(getStorageKey(documentTypeId));
        }
    }, [documentTypeId, setFormDataRaw]);

    // ══════════════════════════════════════════════════════════════════════════
    // SPLIT-SCREEN EDITOR ACTIONS
    // ══════════════════════════════════════════════════════════════════════════

    const setEditorContent = useCallback((content: string, isManualEdit: boolean = true) => {
        setEditorContentState(content);
        // Nur als lokale Änderung markieren wenn es eine echte manuelle Bearbeitung ist
        if (isManualEdit) {
            setHasLocalEdits(true);
            setHasUnsavedChanges(true);
        }
    }, []);

    const resetEditorToPreview = useCallback(() => {
        setEditorContentState(previewHtml);
        setHasLocalEdits(false);
    }, [previewHtml]);

    // Synchronisiere previewHtml mit editorContent, wenn keine manuellen Änderungen vorliegen
    useEffect(() => {
        if (previewHtml && !hasLocalEdits) {
            setEditorContentState(previewHtml);
        }
    }, [previewHtml, hasLocalEdits]);

    const toggleCommentSidebar = useCallback(() => {
        setShowCommentSidebar(prev => !prev);
    }, []);

    const enterSplitScreenMode = useCallback(() => {
        setMode("split-screen");
    }, []);

    // ══════════════════════════════════════════════════════════════════════════
    // COMMENT ACTIONS (Apple Pages Style)
    // ══════════════════════════════════════════════════════════════════════════

    const addComment = useCallback((params: AddCommentParams) => {
        const newComment: Comment = {
            id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            anchorId: "",
            content: params.content,
            author: "Aktueller Benutzer", // TODO: echten Benutzer aus Auth
            authorId: 1,
            createdAt: new Date().toISOString(),
            resolved: false,
            textSelection: params.textSelection,
            replies: [],
        };
        setComments(prev => [newComment, ...prev]);
        setHasUnsavedChanges(true);
    }, []);

    const deleteComment = useCallback((commentId: string) => {
        setComments(prev => prev.filter(c => c.id !== commentId));
        setHasUnsavedChanges(true);
    }, []);

    const resolveComment = useCallback((commentId: string) => {
        setComments(prev => prev.map(c =>
            c.id === commentId ? { ...c, resolved: true } : c
        ));
        setHasUnsavedChanges(true);
    }, []);

    const reopenComment = useCallback((commentId: string) => {
        setComments(prev => prev.map(c =>
            c.id === commentId ? { ...c, resolved: false } : c
        ));
        setHasUnsavedChanges(true);
    }, []);

    const addReply = useCallback((commentId: string, content: string) => {
        const newReply = {
            id: `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content,
            author: "Aktueller Benutzer", // TODO: echten Benutzer aus Auth
            authorId: 1,
            createdAt: new Date().toISOString(),
            mentions: [],
        };
        setComments(prev => prev.map(c =>
            c.id === commentId
                ? { ...c, replies: [...c.replies, newReply] }
                : c
        ));
        setHasUnsavedChanges(true);
    }, []);

    // ══════════════════════════════════════════════════════════════════════════
    // STATE OBJECT
    // ══════════════════════════════════════════════════════════════════════════

    const state: WizardState = {
        currentStep,
        mode,
        showClausesStep,
        documentTypeId,
        documentTitle,
        loadedDraftId,
        formData,
        dynamicFormValues,
        documentClauses,
        selectedVariants,
        variantGroups,
        selectedAttachmentIds,
        previewHtml,
        isPreviewLoading,
        editorContent,
        hasLocalEdits,
        showCommentSidebar,
        comments,
        isLoading,
        isSaving,
        isGenerating,
        hasUnsavedChanges,
        validationErrors,
    };

    const actions: WizardActions = {
        goToStep,
        nextStep,
        prevStep,
        enterEditorMode,
        exitEditorMode,
        toggleClausesStep,
        setDocumentType,
        setDocumentTitle,
        updateFormField,
        updateDynamicField,
        setFormData,
        toggleClause,
        reorderClauses,
        selectVariant,
        toggleAttachment,
        loadDraft,
        saveDraft,
        exportDocument,
        undo,
        redo,
        refreshPreview,
        clearForm,
        setEditorContent,
        resetEditorToPreview,
        toggleCommentSidebar,
        enterSplitScreenMode,
        addComment,
        deleteComment,
        resolveComment,
        reopenComment,
        addReply,
    };

    return {
        state,
        actions,
        canUndo,
        canRedo,
    };
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
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

export default useDocumentWizard;
