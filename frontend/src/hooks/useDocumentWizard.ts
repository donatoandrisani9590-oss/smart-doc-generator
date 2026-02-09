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

import { useState, useCallback, useEffect } from "react";
import {
    type WizardState,
    type WizardActions,
    type WizardContextValue,
    initialFormData,
} from "@/components/generator/WizardContext";
import { getStorageKey } from "./wizard/types";
import {
    useWizardNavigation,
    useWizardFormData,
    useWizardClauses,
    useWizardPreview,
    useWizardDrafts,
    useWizardComments,
    useWizardExport,
} from "./wizard";

// ══════════════════════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════════════════════

export function useDocumentWizard(initialDraftId?: number): WizardContextValue {

    // ── 1. Form Data (incl. undo/redo, document types) ──────────────────────

    const form = useWizardFormData();

    // ── 2. Comments ─────────────────────────────────────────────────────────

    const commentsHook = useWizardComments({
        markUnsaved: () => form.setHasUnsavedChanges(true),
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

    const [userTemplateId, setUserTemplateId] = useState<number | null>(null);

    // ── 8. Export ────────────────────────────────────────────────────────────

    const exportHook = useWizardExport({
        documentTypeId: form.documentTypeId,
        documentTitle: form.documentTitle,
        formData: form.formData,
        dynamicFormValues: form.dynamicFormValues,
        documentClauses: clauses.documentClauses,
        selectedVariants: clauses.selectedVariants,
        selectedAttachmentIds: clauses.selectedAttachmentIds,
        userTemplateId,
        validateStep: nav.validateStep,
    });

    // ── 9. Split-Screen Editor State ────────────────────────────────────────
    //    Kept here because it is small and tightly coupled to previewHtml.

    const [editorContent, setEditorContentState] = useState("");
    const [hasLocalEdits, setHasLocalEdits] = useState(false);
    const [showCommentSidebar, setShowCommentSidebar] = useState(false);

    const setEditorContent = useCallback((content: string, isManualEdit: boolean = true) => {
        setEditorContentState(content);
        if (isManualEdit) {
            setHasLocalEdits(true);
            form.setHasUnsavedChanges(true);
        }
    }, [form]);

    const resetEditorToPreview = useCallback(() => {
        setEditorContentState(preview.previewHtml);
        setHasLocalEdits(false);
    }, [preview.previewHtml]);

    // Sync previewHtml -> editorContent when no manual edits
    useEffect(() => {
        if (preview.previewHtml && !hasLocalEdits) {
            setEditorContentState(preview.previewHtml);
        }
    }, [preview.previewHtml, hasLocalEdits]);

    const toggleCommentSidebar = useCallback(() => {
        setShowCommentSidebar(prev => !prev);
    }, []);

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
        // Comments
        comments: commentsHook.comments,
        // Status
        isLoading: form.isLoading,
        isSaving: drafts.isSaving || drafts.isAutoSaving,
        isGenerating: exportHook.isGenerating,
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
        setUserTemplateId,
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
