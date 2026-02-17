/**
 * useDocumentWizard - Custom Hook fuer Document Generator Wizard State Management
 *
 * Thin orchestrator that composes sub-hooks from ./wizard/ into the
 * unified WizardContextValue interface. Each sub-hook manages one
 * concern (navigation, form data, clauses, preview, drafts, comments, export).
 *
 * The return type (WizardContextValue) is unchanged -- all existing
 * consumers continue to work without modification.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
    type WizardState,
    type WizardActions,
    type WizardContextValue,
    initialFormData,
} from "@/components/generator/WizardContext";
import { getStorageKey } from "./wizard/types";
import { apiFetch } from "@/lib/api-client";
import {
    useWizardNavigation,
    useWizardFormData,
    useWizardClauses,
    useWizardPreview,
    useWizardDrafts,
    useWizardComments,
    useWizardExport,
} from "./wizard";
import { useAuth } from "@/contexts/AuthContext";

// ══════════════════════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════════════════════

export function useDocumentWizard(initialDraftId?: number): WizardContextValue {

    // ── 0. Auth Context (for comment author) ──────────────────────────────
    const { user } = useAuth();

    // ── 1. Form Data (incl. undo/redo, document types) ──────────────────────

    const form = useWizardFormData();

    // ── 2. Comments ─────────────────────────────────────────────────────────

    const commentsHook = useWizardComments({
        markUnsaved: () => form.setHasUnsavedChanges(true),
        currentUserName: user?.email || "Unbekannt",
        currentUserId: user?.id || 0,
    });

    // ── 3. Navigation (needs form state for validation + localStorage) ──────

    const nav = useWizardNavigation({
        documentTypeId: form.documentTypeId,
        formData: form.formData,
        dynamicFormValues: form.dynamicFormValues,
        documentTitle: form.documentTitle,
        comments: commentsHook.comments,
    });

    // ── 4. Clauses ──────────────────────────────────────────────────────────

    const clauses = useWizardClauses({
        documentTypeId: form.documentTypeId,
        formData: form.formData,
        markUnsaved: () => form.setHasUnsavedChanges(true),
    });

    // ── 5. Preview ──────────────────────────────────────────────────────────

    const preview = useWizardPreview({
        documentTypeId: form.documentTypeId,
        formData: form.formData,
        dynamicFormValues: form.dynamicFormValues,
        documentClauses: clauses.documentClauses,
        selectedVariants: clauses.selectedVariants,
    });

    // ── 6. Drafts + Auto-Save ───────────────────────────────────────────────

    const drafts = useWizardDrafts({
        initialDraftId,
        documentTypeId: form.documentTypeId,
        documentTitle: form.documentTitle,
        formData: form.formData,
        dynamicFormValues: form.dynamicFormValues,
        comments: commentsHook.comments,
        documentClauses: clauses.documentClauses,
        selectedVariants: clauses.selectedVariants,
        selectedAttachmentIds: clauses.selectedAttachmentIds,
        currentStep: nav.currentStep,
        hasUnsavedChanges: form.hasUnsavedChanges,
        setDocumentTypeIdState: form.setDocumentTypeIdState,
        setDocumentTitle: form.setDocumentTitle,
        setFormDataRaw: form.setFormDataRaw,
        setDynamicFormValues: form.setDynamicFormValues,
        setComments: commentsHook.setComments,
        setCurrentStep: nav.setCurrentStep,
        setHasUnsavedChanges: form.setHasUnsavedChanges,
        setIsLoading: form.setIsLoading,
        enterSplitScreenMode: nav.enterSplitScreenMode,
    });

    // ── 7. User Template Selection (optional layout template) ──────────────

    const [userTemplateId, setUserTemplateIdState] = useState<number | null>(null);

    // ── 7b. Stationery Zones (Header/Footer from Blanko template) ────────

    const [stationeryZones, setStationeryZones] = useState<WizardState["stationeryZones"]>(null);
    const stationeryAbortRef = useRef<AbortController | null>(null);

    const loadStationeryZones = useCallback(async (templateId: number) => {
        // Cancel any in-flight request to prevent race conditions
        if (stationeryAbortRef.current) {
            stationeryAbortRef.current.abort();
        }
        const abortController = new AbortController();
        stationeryAbortRef.current = abortController;

        try {
            const response = await apiFetch(`/api/v1/user-templates/${templateId}/zones`, {
                signal: abortController.signal,
            });

            // Don't update state if this request was superseded
            if (abortController.signal.aborted) return;

            if (response.ok) {
                const data: {
                    template_id: number;
                    template_name: string;
                    header_images: Array<{ data: string; filename: string }>;
                    footer_images: Array<{ data: string; filename: string }>;
                    header_text: string;
                    footer_text: string;
                    page_margins: { top: number; bottom: number; left: number; right: number };
                } = await response.json();
                setStationeryZones({
                    headerImages: data.header_images || [],
                    footerImages: data.footer_images || [],
                    headerText: data.header_text || "",
                    footerText: data.footer_text || "",
                    pageMargins: data.page_margins || { top: 1.27, bottom: 1.27, left: 1.27, right: 1.27 },
                });
            } else {
                // Template nicht gefunden oder Zugriff verweigert
                console.warn(`Briefpapier-Zonen konnten nicht geladen werden (HTTP ${response.status})`);
                setStationeryZones(null);
                // Template-Auswahl zurücksetzen, falls 404
                if (response.status === 404) {
                    setUserTemplateIdState(null);
                }
            }
        } catch (err) {
            // Ignore abort errors - expected when switching templates quickly
            if (err instanceof DOMException && err.name === "AbortError") return;
            // Zones are optional, don't block document creation
            setStationeryZones(null);
        }
    }, []);

    // Clear zones when template is unselected
    const handleSetUserTemplateId = useCallback((id: number | null) => {
        setUserTemplateIdState(id);
        if (!id) {
            setStationeryZones(null);
        }
    }, []);

    // ── 8. Split-Screen Editor State ────────────────────────────────────────
    //    Declared before Export so editorContent/hasLocalEdits can be passed.

    const [editorContent, setEditorContentState] = useState("");
    const [hasLocalEdits, setHasLocalEdits] = useState(false);
    const [showCommentSidebar, setShowCommentSidebar] = useState(false);
    const [showChatSidebar, setShowChatSidebar] = useState(false);

    const setEditorContent = useCallback((content: string, isManualEdit: boolean = true) => {
        setEditorContentState(content);
        if (isManualEdit) {
            setHasLocalEdits(true);
            form.setHasUnsavedChanges(true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form.setHasUnsavedChanges is a stable callback
    }, [form.setHasUnsavedChanges]);

    const resetEditorToPreview = useCallback(() => {
        setEditorContentState(preview.previewHtml);
        setHasLocalEdits(false);
    }, [preview.previewHtml]);

    // Reset editor state when document type changes
    useEffect(() => {
        setEditorContentState("");
        setHasLocalEdits(false);
    }, [form.documentTypeId]);

    // Sync previewHtml -> editorContent when no manual edits
    useEffect(() => {
        if (preview.previewHtml && !hasLocalEdits) {
            setEditorContentState(preview.previewHtml);
        }
    }, [preview.previewHtml, hasLocalEdits]);

    const toggleCommentSidebar = useCallback(() => {
        setShowCommentSidebar(prev => !prev);
    }, []);

    const toggleChatSidebar = useCallback(() => {
        setShowChatSidebar(prev => !prev);
    }, []);

    // ── 9. Export ────────────────────────────────────────────────────────────

    const exportHook = useWizardExport({
        documentTypeId: form.documentTypeId,
        documentTitle: form.documentTitle,
        formData: form.formData,
        dynamicFormValues: form.dynamicFormValues,
        documentClauses: clauses.documentClauses,
        selectedVariants: clauses.selectedVariants,
        selectedAttachmentIds: clauses.selectedAttachmentIds,
        userTemplateId,
        editorContent,
        hasLocalEdits,
        validateStep: nav.validateStep,
    });

    // ── 10. Utility: clearForm ──────────────────────────────────────────────

    const clearForm = useCallback(() => {
        form.setFormDataRaw(initialFormData);
        form.setDynamicFormValues({});
        form.setDocumentTitle("");
        nav.setCurrentStep(0);
        form.setHasUnsavedChanges(false);
        setEditorContentState("");
        setHasLocalEdits(false);
        commentsHook.setComments([]);
        setStationeryZones(null);

        if (form.documentTypeId) {
            localStorage.removeItem(getStorageKey(form.documentTypeId));
        }
    }, [form, nav, commentsHook]);

    // ══════════════════════════════════════════════════════════════════════════
    // COMPOSE STATE + ACTIONS
    // ══════════════════════════════════════════════════════════════════════════

    const state: WizardState = {
        // Navigation
        currentStep: nav.currentStep,
        mode: nav.mode,
        showClausesStep: nav.showClausesStep,
        // Document
        documentTypeId: form.documentTypeId,
        documentTitle: form.documentTitle,
        loadedDraftId: drafts.loadedDraftId,
        userTemplateId,
        stationeryZones,
        // Form
        formData: form.formData,
        dynamicFormValues: form.dynamicFormValues,
        // Clauses
        documentClauses: clauses.documentClauses,
        selectedVariants: clauses.selectedVariants,
        variantGroups: clauses.variantGroups,
        selectedAttachmentIds: clauses.selectedAttachmentIds,
        // Preview
        previewHtml: preview.previewHtml,
        isPreviewLoading: preview.isPreviewLoading,
        // Editor
        editorContent,
        hasLocalEdits,
        showCommentSidebar,
        showChatSidebar,
        // Comments
        comments: commentsHook.comments,
        // Status
        isLoading: form.isLoading,
        isSaving: drafts.isSaving || drafts.isAutoSaving,
        isGenerating: exportHook.isGenerating,
        hasExported: exportHook.hasExported,
        hasUnsavedChanges: form.hasUnsavedChanges || drafts.autoSaveHasUnsavedChanges,
        validationErrors: nav.validationErrors,
        // Auto-Save
        autoSaveStatus: drafts.autoSaveStatus,
        lastSaved: drafts.lastSaved,
        lastSavedText: drafts.lastSavedText,
        hasRecoverableDraft: drafts.hasRecoverableDraft,
        autoSaveError: drafts.autoSaveError,
    };

    const actions: WizardActions = {
        // Navigation
        goToStep: nav.goToStep,
        nextStep: nav.nextStep,
        prevStep: nav.prevStep,
        enterEditorMode: nav.enterEditorMode,
        exitEditorMode: nav.exitEditorMode,
        toggleClausesStep: nav.toggleClausesStep,
        // Document / Form
        setDocumentType: form.setDocumentType,
        setDocumentTitle: form.setDocumentTitle,
        setUserTemplateId: handleSetUserTemplateId,
        loadStationeryZones,
        updateFormField: form.updateFormField,
        updateDynamicField: form.updateDynamicField,
        setFormData: form.setFormData,
        // Clauses
        toggleClause: clauses.toggleClause,
        reorderClauses: clauses.reorderClauses,
        selectVariant: clauses.selectVariant,
        toggleAttachment: clauses.toggleAttachment,
        // Drafts
        loadDraft: drafts.loadDraft,
        saveDraft: drafts.saveDraft,
        // Export
        exportDocument: exportHook.exportDocument,
        // Undo/Redo
        undo: form.undo,
        redo: form.redo,
        // Utilities
        refreshPreview: preview.refreshPreview,
        clearForm,
        // Editor
        setEditorContent,
        resetEditorToPreview,
        toggleCommentSidebar,
        toggleChatSidebar,
        enterSplitScreenMode: nav.enterSplitScreenMode,
        // Comments
        addComment: commentsHook.addComment,
        deleteComment: commentsHook.deleteComment,
        resolveComment: commentsHook.resolveComment,
        reopenComment: commentsHook.reopenComment,
        addReply: commentsHook.addReply,
        // Auto-Save
        forceSave: drafts.forceSave,
        recoverDraft: drafts.recoverDraft,
        discardDraft: drafts.discardDraft,
        clearAutoSaveError: drafts.clearAutoSaveError,
    };

    return {
        state,
        actions,
        canUndo: form.canUndo,
        canRedo: form.canRedo,
    };
}

export default useDocumentWizard;
