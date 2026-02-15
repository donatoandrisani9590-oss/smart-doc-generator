/**
 * WizardContext - Geteilter State für den Document Generator Wizard
 *
 * Verwaltet alle Formulardaten, Validierung und Navigation zwischen Schritten.
 */

import { createContext, useContext, type ReactNode } from "react";

// ══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════

export interface FormData {
    // Mitarbeiterdaten
    vorname: string;
    nachname: string;
    strasse: string;
    plz: string;
    ort: string;
    geburtsdatum: string;

    // Vertragsdaten
    position: string;
    gehalt: string;
    eintrittsdatum: string;
    wochenstunden: string;
    probezeit: string;
    urlaubstage: string;
    entgeltgruppe: string;
    kuendigungsfrist: string;
    au_frist: string;

    // Zusatzleistungen
    firmenwagen: boolean;
    homeoffice: boolean;
    jahressonderzahlung: boolean;
    urlaubsgeld_pro_tag: string;
    vwl_betrag: string;
    schichtzuschlaege: boolean;
    arbeitszeitkonto: boolean;
    vertragsstrafe: boolean;

    // Unterschrift
    signatory_name: string;
}

export interface DocumentClause {
    id: number;
    unique_id: string;
    name: string;
    content: string;
    is_required: boolean;
    is_enabled: boolean;
    order_index: number;
    has_variants: boolean;
    variant_group_id?: number;
}

export interface SelectedVariant {
    variantId: number;
    clauseId: number;
}

export interface VariantGroup {
    id: number;
    name: string;
    clauses: Array<{
        id: number;
        name: string;
    }>;
}

// ══════════════════════════════════════════════════════════════════════════════
// COMMENT TYPES (Apple Pages Style)
// ══════════════════════════════════════════════════════════════════════════════

export interface CommentTextSelection {
    text: string;           // Ausgewählter Text-Snippet
    paragraphIndex: number;
    startOffset: number;
    endOffset: number;
}

export interface CommentReply {
    id: string;
    content: string;
    author: string;
    authorId: number;
    createdAt: string;
    mentions: string[];     // @erwähnte User-IDs
}

export interface Comment {
    id: string;
    anchorId: string;           // Marker im Dokument (für Phase 5)
    content: string;
    author: string;
    authorId: number;
    createdAt: string;
    resolved: boolean;
    textSelection: CommentTextSelection | null;
    replies: CommentReply[];
}

export interface AddCommentParams {
    content: string;
    textSelection: CommentTextSelection | null;
}

/** Auto-Save status types */
export type AutoSaveStatus =
    | 'idle'           // No changes, nothing to save
    | 'pending'        // Changes detected, waiting for debounce
    | 'saving'         // Currently saving
    | 'saved'          // Just saved successfully
    | 'error'          // Save failed
    | 'offline';       // Saved to localStorage (offline mode)

export interface WizardState {
    // Navigation
    currentStep: number;
    mode: "wizard" | "editor" | "split-screen";
    showClausesStep: boolean; // Textbausteine-Schritt wird standardmäßig übersprungen

    // Dokument
    documentTypeId: number | null;
    documentTitle: string;
    loadedDraftId: number | null;

    // Eigene Vorlage (optional: DOCX mit Branding/Layout)
    userTemplateId: number | null;

    // Briefpapier-Zonen (Header/Footer aus Blanko)
    stationeryZones: {
        headerImages: Array<{ data: string; filename: string }>;
        footerImages: Array<{ data: string; filename: string }>;
        headerText: string;
        footerText: string;
        pageMargins: { top: number; bottom: number; left: number; right: number };
    } | null;

    // Formulardaten
    formData: FormData;
    dynamicFormValues: Record<string, string | number | boolean>;

    // Textbausteine
    documentClauses: DocumentClause[];
    selectedVariants: Record<number, SelectedVariant>;
    variantGroups: VariantGroup[];

    // Anhänge
    selectedAttachmentIds: number[];

    // Preview
    previewHtml: string;
    isPreviewLoading: boolean;

    // Split-Screen Editor State
    editorContent: string;          // Aktueller TinyMCE-Inhalt
    hasLocalEdits: boolean;         // True wenn direkt im Editor bearbeitet
    showCommentSidebar: boolean;    // Kommentar-Panel sichtbar
    showChatSidebar: boolean;       // Chat-Assistent-Panel sichtbar

    // Kommentare (Apple Pages Style)
    comments: Comment[];

    // Status
    isLoading: boolean;
    isSaving: boolean;
    isGenerating: boolean;
    hasExported: boolean;
    hasUnsavedChanges: boolean;

    // Validierung
    validationErrors: Array<{ field: string; message: string }>;

    // Auto-Save State
    autoSaveStatus: AutoSaveStatus;
    lastSaved: Date | null;
    lastSavedText: string;
    hasRecoverableDraft: boolean;
    autoSaveError: Error | null;
}

export interface WizardActions {
    // Navigation
    goToStep: (step: number) => Promise<boolean>;
    nextStep: () => Promise<boolean>;
    prevStep: () => void;
    enterEditorMode: () => void;
    exitEditorMode: () => void;
    toggleClausesStep: () => void;

    // Dokument
    setDocumentType: (id: number) => void;
    setDocumentTitle: (title: string) => void;
    setUserTemplateId: (id: number | null) => void;
    loadStationeryZones: (templateId: number) => Promise<void>;

    // Formulardaten
    updateFormField: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
    updateDynamicField: (name: string, value: string | number | boolean) => void;
    setFormData: (data: Partial<FormData>) => void;

    // Textbausteine
    toggleClause: (uniqueId: string) => void;
    reorderClauses: (clauses: DocumentClause[]) => void;
    selectVariant: (groupId: number, variantId: number, clauseId: number) => void;

    // Anhänge
    toggleAttachment: (id: number) => void;

    // Draft
    loadDraft: (draftId: number) => Promise<void>;
    saveDraft: () => Promise<void>;

    // Export
    exportDocument: (format: "pdf" | "docx") => Promise<void>;

    // Undo/Redo
    undo: () => void;
    redo: () => void;

    // Utilities
    refreshPreview: () => Promise<void>;
    clearForm: () => void;

    // Split-Screen Editor Actions
    setEditorContent: (content: string, isUserEdit?: boolean) => void;
    resetEditorToPreview: () => void;
    toggleCommentSidebar: () => void;
    toggleChatSidebar: () => void;
    enterSplitScreenMode: () => void;

    // Kommentar Actions
    addComment: (params: AddCommentParams) => void;
    deleteComment: (commentId: string) => void;
    resolveComment: (commentId: string) => void;
    reopenComment: (commentId: string) => void;
    addReply: (commentId: string, content: string) => void;

    // Auto-Save Actions
    forceSave: () => Promise<void>;
    recoverDraft: () => void;
    discardDraft: () => void;
    clearAutoSaveError: () => void;
}

export interface WizardContextValue {
    state: WizardState;
    actions: WizardActions;
    canUndo: boolean;
    canRedo: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ══════════════════════════════════════════════════════════════════════════════

export const initialFormData: FormData = {
    vorname: "",
    nachname: "",
    strasse: "",
    plz: "",
    ort: "",
    geburtsdatum: "",
    position: "",
    gehalt: "",
    eintrittsdatum: "",
    wochenstunden: "40",
    probezeit: "6 Monate",
    urlaubstage: "30",
    entgeltgruppe: "",
    kuendigungsfrist: "4 Wochen zum 15./Monatsende",
    au_frist: "am ersten Kalendertag",
    firmenwagen: false,
    homeoffice: false,
    jahressonderzahlung: true,
    urlaubsgeld_pro_tag: "17",
    vwl_betrag: "26,59",
    schichtzuschlaege: false,
    arbeitszeitkonto: false,
    vertragsstrafe: true,
    signatory_name: "",
};

export const initialWizardState: WizardState = {
    currentStep: 0,
    mode: "wizard",
    showClausesStep: false, // Standardmäßig übersprungen

    documentTypeId: null,
    documentTitle: "",
    loadedDraftId: null,

    userTemplateId: null,
    stationeryZones: null,

    formData: initialFormData,
    dynamicFormValues: {},

    documentClauses: [],
    selectedVariants: {},
    variantGroups: [],

    selectedAttachmentIds: [],

    previewHtml: "",
    isPreviewLoading: false,

    editorContent: "",
    hasLocalEdits: false,
    showCommentSidebar: false,
    showChatSidebar: false,

    comments: [],

    isLoading: false,
    isSaving: false,
    isGenerating: false,
    hasExported: false,
    hasUnsavedChanges: false,

    validationErrors: [],

    // Auto-Save State
    autoSaveStatus: "idle",
    lastSaved: null,
    lastSavedText: "Noch nicht gespeichert",
    hasRecoverableDraft: false,
    autoSaveError: null,
};

// ══════════════════════════════════════════════════════════════════════════════
// CONTEXT
// ══════════════════════════════════════════════════════════════════════════════

const WizardContext = createContext<WizardContextValue | null>(null);

export const useWizardContext = (): WizardContextValue => {
    const context = useContext(WizardContext);
    if (!context) {
        throw new Error("useWizardContext must be used within a WizardProvider");
    }
    return context;
};

export const WizardProvider = ({
    children,
    value,
}: {
    children: ReactNode;
    value: WizardContextValue;
}) => {
    return (
        <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// STEP CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

export const WIZARD_STEPS = [
    {
        id: "document-type",
        label: "Dokument",
        description: "Dokumenttyp und Titel",
    },
    {
        id: "employee-info",
        label: "Mitarbeiter",
        description: "Persönliche Daten",
    },
    {
        id: "contract-details",
        label: "Vertrag",
        description: "Vertragsdetails",
    },
    {
        id: "clauses",
        label: "Textbausteine",
        description: "Textbausteine anpassen",
        optional: true,
    },
    {
        id: "review",
        label: "Vorschau",
        description: "Prüfen und exportieren",
    },
] as const;

// Standard-Flow überspringt Schritt 4 (Textbausteine)
export const STANDARD_STEP_ORDER = [0, 1, 2, 4]; // Schritt 3 (Textbausteine) wird übersprungen
export const FULL_STEP_ORDER = [0, 1, 2, 3, 4]; // Alle Schritte

export type StepId = (typeof WIZARD_STEPS)[number]["id"];

export default WizardContext;
