/**
 * ActionBar - Export und Speichern Buttons für den Split-Screen Editor
 *
 * Fixiert am unteren Rand des linken Panels:
 * - ValidationProgress Ampel (zeigt Formular-Status)
 * - Entwurf speichern Button
 * - PDF Export Button
 * - DOCX Export Button
 *
 * Zeigt Loading-States während Export/Speichern.
 * v4.2.1: ValidationProgress Ampel integriert
 */

import { useState, useMemo, useCallback } from "react";
import { Save, FileText, FileType2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWizardContext } from "../WizardContext";
import { ValidationProgress, type ValidationState, type ValidationIssue } from "../ValidationProgress";
import { ExportSuccessModal } from "../ExportSuccessModal";

// Pflichtfelder Definition
const REQUIRED_FIELDS = [
    { name: "vorname", label: "Vorname", group: "Mitarbeiterdaten" },
    { name: "nachname", label: "Nachname", group: "Mitarbeiterdaten" },
    { name: "position", label: "Position", group: "Vertragsdaten" },
    { name: "gehalt", label: "Gehalt", group: "Vertragsdaten" },
    { name: "eintrittsdatum", label: "Eintrittsdatum", group: "Vertragsdaten" },
    { name: "signatory_name", label: "Unterzeichner", group: "Unterzeichner" },
] as const;

export const ActionBar = () => {
    const { state, actions } = useWizardContext();
    const { documentTypeId, documentTitle, formData, isGenerating } = state;

    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [isExportingDocx, setIsExportingDocx] = useState(false);

    // Export Success Modal state
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [lastExportFormat, setLastExportFormat] = useState<"pdf" | "docx">("pdf");

    // Berechne Validierungs-State für die Ampel
    const validationState: ValidationState = useMemo(() => {
        const missingFields: ValidationIssue[] = [];
        let completedFields = 0;

        REQUIRED_FIELDS.forEach((field) => {
            const value = formData[field.name as keyof typeof formData];
            const isEmpty = value === undefined || value === null || value === "";

            if (isEmpty) {
                missingFields.push({
                    type: "missing",
                    field: field.name,
                    fieldId: field.name,
                    label: field.label,
                    message: "Pflichtfeld nicht ausgefüllt",
                    group: field.group,
                });
            } else {
                completedFields++;
            }
        });

        // Zusätzliche Validierung: Dokumenttitel
        if (!documentTitle.trim()) {
            missingFields.push({
                type: "missing",
                field: "documentTitle",
                fieldId: "documentTitle",
                label: "Dokumenttitel",
                message: "Bitte geben Sie einen Titel ein",
                group: "Dokument",
            });
        } else {
            completedFields++;
        }

        return {
            isValid: missingFields.length === 0,
            errors: [],
            warnings: [],
            missingFields,
            completedFields,
            totalRequiredFields: REQUIRED_FIELDS.length + 1, // +1 für Dokumenttitel
        };
    }, [formData, documentTitle]);

    // Scroll zu Feld Handler
    const handleScrollToField = useCallback((fieldId: string) => {
        const element = document.getElementById(fieldId);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.focus();
        }
    }, []);

    const canExport = documentTypeId && validationState.isValid;

    // Entwurf speichern
    const handleSaveDraft = async () => {
        if (!canExport) return;
        setIsSavingDraft(true);
        try {
            await actions.saveDraft();
        } finally {
            setIsSavingDraft(false);
        }
    };

    // PDF Export
    const handleExportPdf = async () => {
        if (!canExport) return;
        setIsExportingPdf(true);
        try {
            await actions.exportDocument("pdf");
            setLastExportFormat("pdf");
            setShowSuccessModal(true);
        } finally {
            setIsExportingPdf(false);
        }
    };

    // DOCX Export
    const handleExportDocx = async () => {
        if (!canExport) return;
        setIsExportingDocx(true);
        try {
            await actions.exportDocument("docx");
            setLastExportFormat("docx");
            setShowSuccessModal(true);
        } finally {
            setIsExportingDocx(false);
        }
    };

    // Download Again from Modal
    const handleDownloadAgain = async (format: "pdf" | "docx") => {
        setShowSuccessModal(false);
        if (format === "pdf") {
            await handleExportPdf();
        } else {
            await handleExportDocx();
        }
    };

    const isAnyLoading = isSavingDraft || isExportingPdf || isExportingDocx || isGenerating;

    return (
        <div className="p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 space-y-3">
            {/* ValidationProgress Ampel */}
            <ValidationProgress
                validation={validationState}
                onScrollToField={handleScrollToField}
                className="w-full"
            />

            {/* Entwurf speichern */}
            <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleSaveDraft}
                disabled={!canExport || isAnyLoading}
            >
                {isSavingDraft ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Save className="w-4 h-4" />
                )}
                Als Entwurf speichern
            </Button>

            {/* Export Buttons */}
            <div className="grid grid-cols-2 gap-2">
                <Button
                    variant="default"
                    className="gap-2"
                    onClick={handleExportPdf}
                    disabled={!canExport || isAnyLoading}
                >
                    {isExportingPdf ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <FileText className="w-4 h-4" />
                    )}
                    PDF
                </Button>
                <Button
                    variant="secondary"
                    className="gap-2"
                    onClick={handleExportDocx}
                    disabled={!canExport || isAnyLoading}
                >
                    {isExportingDocx ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <FileType2 className="w-4 h-4" />
                    )}
                    DOCX
                </Button>
            </div>

            {/* Hinweis wenn nicht exportierbar */}
            {!canExport && !validationState.isValid && (
                <p className="text-xs text-muted-foreground text-center">
                    Bitte füllen Sie alle Pflichtfelder aus.
                </p>
            )}
            {!canExport && validationState.isValid && !documentTypeId && (
                <p className="text-xs text-muted-foreground text-center">
                    Bitte wählen Sie einen Dokumenttyp.
                </p>
            )}

            {/* Export Success Modal - Magic Moment! */}
            <ExportSuccessModal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                documentTitle={documentTitle}
                exportFormat={lastExportFormat}
                onDownloadAgain={handleDownloadAgain}
                documentsThisMonth={1} // TODO: Aus Backend laden
            />
        </div>
    );
};

export default ActionBar;
