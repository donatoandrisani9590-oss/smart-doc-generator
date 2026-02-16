/**
 * ClauseFormDialog - Vollständiger Dialog für Textbaustein-Erstellung/-bearbeitung
 *
 * Features:
 * - Mehrstufiger Wizard für neue Textbausteine
 * - Integrierter TipTap WYSIWYG Editor
 * - Platzhalter-Picker mit Validierung
 * - Kategorie-Auswahl mit Vorschlägen
 * - Land-Auswahl (DE/IT)
 * - Live-Vorschau
 * - Validierung vor Speicherung
 * - Warnung bei ungespeicherten Änderungen (QA Fix)
 *
 * v2.0: UX-Verbesserungen für Release
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    useCreateClause,
    useUpdateClause,
    useClauses,
    type Clause,
    type ClauseCreateRequest,
} from "@/hooks/useApi";
import {
    useClauseImpact,
    useClauseNotes,
    useAddClauseNote,
} from "@/hooks/useClauseExtras";
import {
    FileText,
    Loader2,
    CheckCircle2,
    ChevronRight,
    ChevronLeft,
    Sparkles,
    Eye,
    Save,
    X,
    AlertTriangle,
} from "lucide-react";

import type { ClauseFormDialogProps, WizardStep } from "./types";
import { BasicsStep } from "./BasicsStep";
import { ContentStep } from "./ContentStep";
import { PreviewStep, ImpactTab, NotesTab } from "./PreviewStep";

export const ClauseFormDialog = ({
    open,
    onOpenChange,
    editClause,
    defaultCountryCode = "DE",
    onSuccess,
}: ClauseFormDialogProps) => {
    const isEditMode = !!editClause;

    // Form State
    const [currentStep, setCurrentStep] = useState<WizardStep>("basics");
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("");
    const [customCategory, setCustomCategory] = useState("");
    const [countryCode, setCountryCode] = useState(defaultCountryCode);
    const [content, setContent] = useState("");
    const [isActive, setIsActive] = useState(true);
    // Paragraph numbering (v4.4 - §1, §2 for contracts, none for letters)
    const [hasParagraphNumber, setHasParagraphNumber] = useState(true);
    // AI metadata (v4.3 - enables AI to find and select this clause)
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");
    const [description, setDescription] = useState("");
    const [tone, setTone] = useState<string>("neutral");

    // Tab State (Edit Mode)
    const [activeTab, setActiveTab] = useState("editor");
    const [newNote, setNewNote] = useState("");

    // Hook Data
    const { data: impactData, isLoading: isLoadingImpact } = useClauseImpact(editClause?.id || 0);
    const { data: notes, isLoading: isLoadingNotes } = useClauseNotes(editClause?.id || 0);
    const addNoteMutation = useAddClauseNote();

    // Validation State
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    // ═══════════════════════════════════════════════════════════════════════════
    // UNSAVED CHANGES TRACKING (QA Critical Fix)
    // ═══════════════════════════════════════════════════════════════════════════
    const [showDiscardDialog, setShowDiscardDialog] = useState(false);
    const initialValuesRef = useRef<{
        title: string;
        category: string;
        content: string;
    } | null>(null);

    // Track if user has made changes
    const hasUnsavedChanges = useCallback(() => {
        if (!initialValuesRef.current) return false;
        return (
            title !== initialValuesRef.current.title ||
            category !== initialValuesRef.current.category ||
            content !== initialValuesRef.current.content
        );
    }, [title, category, content]);

    // Handle close attempt with unsaved changes
    const handleCloseAttempt = useCallback((shouldClose: boolean) => {
        if (!shouldClose) {
            // Dialog is being closed
            if (hasUnsavedChanges()) {
                setShowDiscardDialog(true);
            } else {
                onOpenChange(false);
            }
        } else {
            onOpenChange(true);
        }
    }, [hasUnsavedChanges, onOpenChange]);

    // Confirm discard
    const handleConfirmDiscard = useCallback(() => {
        setShowDiscardDialog(false);
        onOpenChange(false);
    }, [onOpenChange]);

    // API Hooks
    const createMutation = useCreateClause();
    const updateMutation = useUpdateClause();
    const { data: existingClauses } = useClauses(countryCode);

    // Initialize form when editing
    useEffect(() => {
        if (editClause) {
            setTitle(editClause.title || "");
            setCategory(editClause.category || "");
            setCountryCode(editClause.country_code || "DE");
            setContent(editClause.content || "");
            setIsActive(editClause.is_active);
            setHasParagraphNumber((editClause as any).has_paragraph_number ?? true);
            setTags((editClause as any).tags || []);
            setDescription((editClause as any).description || "");
            setTone((editClause as any).tone || "neutral");
            setCurrentStep("content"); // Skip to content in edit mode
            // Store initial values for change detection
            initialValuesRef.current = {
                title: editClause.title || "",
                category: editClause.category || "",
                content: editClause.content || "",
            };
        } else {
            // Reset form for new clause
            setTitle("");
            setCategory("");
            setCustomCategory("");
            setCountryCode(defaultCountryCode);
            setContent("");
            setIsActive(true);
            setHasParagraphNumber(true);
            setTags([]);
            setTagInput("");
            setDescription("");
            setTone("neutral");
            setCurrentStep("basics");
            setActiveTab("editor");
            setErrors({});
            setTouched({});
            // Store initial values (empty)
            initialValuesRef.current = {
                title: "",
                category: "",
                content: "",
            };
        }
    }, [editClause, defaultCountryCode, open]);

    const handleAddNote = async () => {
        if (!newNote.trim() || !editClause) return;
        try {
            await addNoteMutation.mutateAsync({
                clauseId: editClause.id,
                data: { content: newNote, note_type: "info" }
            });
            setNewNote("");
        } catch (e) {
            console.error("Failed to add note", e);
        }
    };

    // Validation
    const validateBasics = useCallback(() => {
        const newErrors: Record<string, string> = {};

        if (!title.trim()) {
            newErrors.title = "Titel ist erforderlich";
        } else if (title.length < 3) {
            newErrors.title = "Titel muss mindestens 3 Zeichen haben";
        } else if (title.length > 200) {
            newErrors.title = "Titel darf maximal 200 Zeichen haben";
        }

        // Check for duplicate titles
        const effectiveCategory = category === "custom" ? customCategory : category;
        const duplicate = existingClauses?.find(
            (c: Clause) =>
                c.title?.toLowerCase() === title.toLowerCase() &&
                c.id !== editClause?.id
        );
        if (duplicate) {
            newErrors.title = "Ein Textbaustein mit diesem Titel existiert bereits";
        }

        if (!effectiveCategory) {
            newErrors.category = "Kategorie ist erforderlich";
        }

        if (category === "custom" && !customCategory.trim()) {
            newErrors.customCategory = "Bitte geben Sie eine Kategorie ein";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [title, category, customCategory, existingClauses, editClause]);

    const validateContent = useCallback(() => {
        const newErrors: Record<string, string> = {};

        // Strip HTML tags and check for actual content
        const textContent = content.replace(/<[^>]*>/g, "").trim();
        if (!textContent) {
            newErrors.content = "Textbaustein-Inhalt ist erforderlich";
        } else if (textContent.length < 10) {
            newErrors.content = "Textbaustein-Inhalt muss mindestens 10 Zeichen haben";
        }

        setErrors((prev) => ({ ...prev, ...newErrors }));
        return !newErrors.content;
    }, [content]);

    // Navigation
    const canProceedToContent = title.trim() && (category === "custom" ? customCategory.trim() : category);
    const canProceedToPreview = content.replace(/<[^>]*>/g, "").trim().length >= 10;

    // Save
    const handleSave = async () => {
        if (!validateBasics() || !validateContent()) {
            return;
        }

        const effectiveCategory = category === "custom" ? customCategory : category;

        const clauseData: ClauseCreateRequest = {
            title: title.trim(),
            content_html: content,
            country_code: countryCode,
            category: effectiveCategory,
            is_active: isActive,
            has_paragraph_number: hasParagraphNumber,
            tags: tags.length > 0 ? tags : undefined,
            description: description.trim() || undefined,
            tone: tone || undefined,
        } as ClauseCreateRequest;

        try {
            let result;
            if (isEditMode && editClause) {
                result = await updateMutation.mutateAsync({
                    id: editClause.id,
                    data: clauseData,
                });
            } else {
                result = await createMutation.mutateAsync(clauseData);
            }

            onSuccess?.(result);
            onOpenChange(false);
        } catch (error) {
            // Error is handled by mutation
            console.error("Save failed:", error);
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;
    const saveError = createMutation.error || updateMutation.error;

    // Render step indicator (only shown in preview step)
    const renderStepIndicator = () => {
        if (currentStep !== "preview") return null;
        return (
            <div className="flex items-center justify-center gap-2 mb-4">
                <button
                    type="button"
                    onClick={() => setCurrentStep("basics")}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/20 text-secondary cursor-pointer hover:bg-secondary/30"
                >
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium hidden sm:inline">Bearbeiten</span>
                </button>
                <ChevronRight className="w-4 h-4 mx-2 text-border" />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-white">
                    <Eye className="w-4 h-4" />
                    <span className="text-sm font-medium hidden sm:inline">Vorschau</span>
                </div>
            </div>
        );
    };

    return (
        <>
            <Dialog open={open} onOpenChange={handleCloseAttempt}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            {isEditMode ? (
                                <>
                                    <FileText className="w-5 h-5 text-primary" />
                                    Textbaustein bearbeiten
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5 text-primary" />
                                    Neuen Textbaustein erstellen
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditMode
                                ? "Bearbeiten Sie den Textbaustein und seinen Inhalt"
                                : "Erstellen Sie einen neuen wiederverwendbaren Textbaustein für Ihre Dokumente"}
                        </DialogDescription>
                    </DialogHeader>

                    {!isEditMode && renderStepIndicator()}

                    <div className="py-2">
                        {isEditMode ? (
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-4 mb-4">
                                    <TabsTrigger value="editor">Editor</TabsTrigger>
                                    <TabsTrigger value="details">Details</TabsTrigger>
                                    <TabsTrigger value="impact">Auswirkung</TabsTrigger>
                                    <TabsTrigger value="notes">Notizen</TabsTrigger>
                                </TabsList>
                                <TabsContent value="editor" className="mt-0">
                                    <ContentStep
                                        content={content}
                                        setContent={setContent}
                                        countryCode={countryCode}
                                        errors={errors}
                                        touched={touched}
                                    />
                                </TabsContent>
                                <TabsContent value="details" className="mt-0">
                                    <BasicsStep
                                        title={title}
                                        setTitle={setTitle}
                                        category={category}
                                        setCategory={setCategory}
                                        customCategory={customCategory}
                                        setCustomCategory={setCustomCategory}
                                        countryCode={countryCode}
                                        setCountryCode={setCountryCode}
                                        description={description}
                                        setDescription={setDescription}
                                        tags={tags}
                                        setTags={setTags}
                                        tagInput={tagInput}
                                        setTagInput={setTagInput}
                                        tone={tone}
                                        setTone={setTone}
                                        hasParagraphNumber={hasParagraphNumber}
                                        setHasParagraphNumber={setHasParagraphNumber}
                                        errors={errors}
                                        touched={touched}
                                        setTouched={setTouched}
                                    />
                                </TabsContent>
                                <TabsContent value="impact" className="mt-0">
                                    <ImpactTab
                                        editClause={editClause}
                                        impactData={impactData}
                                        isLoadingImpact={isLoadingImpact}
                                    />
                                </TabsContent>
                                <TabsContent value="notes" className="mt-0">
                                    <NotesTab
                                        editClause={editClause}
                                        notes={notes}
                                        isLoadingNotes={isLoadingNotes}
                                        newNote={newNote}
                                        setNewNote={setNewNote}
                                        onAddNote={handleAddNote}
                                        isAddingNote={addNoteMutation.isPending}
                                    />
                                </TabsContent>
                            </Tabs>
                        ) : (
                            <>
                                {(currentStep === "basics" || currentStep === "content") && (
                                    <div className="space-y-4">
                                        {/* Compact Basics: Title + Category inline */}
                                        <BasicsStep
                                            title={title}
                                            setTitle={setTitle}
                                            category={category}
                                            setCategory={setCategory}
                                            customCategory={customCategory}
                                            setCustomCategory={setCustomCategory}
                                            countryCode={countryCode}
                                            setCountryCode={setCountryCode}
                                            description={description}
                                            setDescription={setDescription}
                                            tags={tags}
                                            setTags={setTags}
                                            tagInput={tagInput}
                                            setTagInput={setTagInput}
                                            tone={tone}
                                            setTone={setTone}
                                            hasParagraphNumber={hasParagraphNumber}
                                            setHasParagraphNumber={setHasParagraphNumber}
                                            errors={errors}
                                            touched={touched}
                                            setTouched={setTouched}
                                            compact
                                        />
                                        {/* Editor directly below */}
                                        <ContentStep
                                            content={content}
                                            setContent={setContent}
                                            countryCode={countryCode}
                                            errors={errors}
                                            touched={touched}
                                        />
                                    </div>
                                )}
                                {currentStep === "preview" && (
                                    <PreviewStep
                                        title={title}
                                        category={category}
                                        customCategory={customCategory}
                                        countryCode={countryCode}
                                        content={content}
                                        isActive={isActive}
                                        setIsActive={setIsActive}
                                        saveError={saveError}
                                    />
                                )}
                            </>
                        )}
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
                        {/* Cancel */}
                        <Button
                            variant="ghost"
                            onClick={() => handleCloseAttempt(false)}
                            disabled={isSaving}
                            className="sm:mr-auto"
                        >
                            <X className="w-4 h-4 mr-2" />
                            Abbrechen
                        </Button>

                        {/* Back (only in preview step or edit mode) */}
                        {(currentStep === "preview" || isEditMode) && (
                            <Button
                                variant="outline"
                                onClick={() => setCurrentStep("basics")}
                                disabled={isSaving}
                            >
                                <ChevronLeft className="w-4 h-4 mr-2" />
                                Zurück
                            </Button>
                        )}

                        {/* Next / Save */}
                        {/* Preview button (create mode, not on preview step) */}
                        {!isEditMode && currentStep !== "preview" && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    if (validateBasics() && validateContent()) {
                                        setCurrentStep("preview");
                                    }
                                }}
                                disabled={!canProceedToContent || !canProceedToPreview}
                            >
                                <Eye className="w-4 h-4 mr-2" />
                                Vorschau
                            </Button>
                        )}

                        {/* Save button */}
                        <Button
                            onClick={handleSave}
                            disabled={isSaving || (!isEditMode && (!canProceedToContent || !canProceedToPreview))}
                            className="bg-primary hover:bg-primary/90"
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            {isEditMode ? "Änderungen speichern" : "Textbaustein erstellen"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Discard Changes Confirmation Dialog */}
            <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Ungespeicherte Änderungen
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Sie haben Änderungen vorgenommen, die noch nicht gespeichert wurden.
                            Wenn Sie fortfahren, gehen diese Änderungen verloren.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Zurück zur Bearbeitung</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDiscard}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Änderungen verwerfen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
