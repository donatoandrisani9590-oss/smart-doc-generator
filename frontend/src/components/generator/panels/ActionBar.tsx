/**
 * ActionBar - Export und Speichern Buttons für den Split-Screen Editor
 *
 * Fixiert am unteren Rand des linken Panels:
 * - Auto-Save Status Anzeige
 * - ValidationProgress Ampel (zeigt Formular-Status)
 * - Entwurf speichern Button (erlaubt partielle Daten)
 * - PDF Export Button
 * - DOCX Export Button
 *
 * Zeigt Loading-States während Export/Speichern.
 * v5.1: Draft-Speichern ohne vollständige Validierung, Auto-Save Status
 */

import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, FileText, FileType2, Loader2, AlertCircle, CheckCircle2, Cloud, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
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
    const { documentTypeId, documentTitle, formData, isGenerating, autoSaveStatus, lastSavedText } = state;
    const toast = useToast();
    const navigate = useNavigate();

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
    // Drafts only need a document type - partial data is explicitly allowed
    const canSaveDraft = !!documentTypeId;

    // Handler für Klick auf deaktivierte Export-Buttons (zeigt Toast mit fehlenden Feldern)
    const handleDisabledExportClick = useCallback(() => {
        if (!validationState.isValid && validationState.missingFields.length > 0) {
            const fieldNames = validationState.missingFields
                .slice(0, 3)
                .map(f => f.label)
                .join(", ");
            const moreCount = validationState.missingFields.length - 3;
            const message = moreCount > 0
                ? `${fieldNames} und ${moreCount} weitere`
                : fieldNames;

            toast.error(
                "Pflichtfelder fehlen",
                `Bitte füllen Sie aus: ${message}`
            );
        } else if (!documentTypeId) {
            toast.error(
                "Dokumenttyp fehlt",
                "Bitte wählen Sie zuerst einen Dokumenttyp aus."
            );
        }
    }, [validationState, documentTypeId, toast]);

    // Entwurf speichern (erlaubt partielle Daten)
    const handleSaveDraft = async () => {
        if (!canSaveDraft) return;
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

    // Navigate to "Meine Dokumente" from success modal
    const handleGoToDocuments = () => {
        setShowSuccessModal(false);
        navigate("/documents");
    };

    const isAnyLoading = isSavingDraft || isExportingPdf || isExportingDocx || isGenerating;

    // Auto-Save Status Anzeige
    const autoSaveIndicator = useMemo(() => {
        switch (autoSaveStatus) {
            case 'saving':
                return { icon: <Cloud className="w-3 h-3 animate-pulse" />, text: "Speichert...", color: "text-blue-500" };
            case 'saved':
                return { icon: <CheckCircle2 className="w-3 h-3" />, text: lastSavedText || "Gespeichert", color: "text-green-600" };
            case 'error':
                return { icon: <CloudOff className="w-3 h-3" />, text: "Speichern fehlgeschlagen", color: "text-red-500" };
            case 'offline':
                return { icon: <CloudOff className="w-3 h-3" />, text: "Offline gespeichert", color: "text-amber-500" };
            case 'pending':
                return { icon: <Cloud className="w-3 h-3" />, text: "Änderungen...", color: "text-warm-400" };
            default:
                return null;
        }
    }, [autoSaveStatus, lastSavedText]);

    return (
        <div className="p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 space-y-3">
            {/* Auto-Save Status */}
            {autoSaveIndicator && (
                <div className={`flex items-center justify-center gap-1.5 text-xs ${autoSaveIndicator.color}`}>
                    {autoSaveIndicator.icon}
                    <span>{autoSaveIndicator.text}</span>
                </div>
            )}

            {/* ValidationProgress Ampel */}
            <ValidationProgress
                validation={validationState}
                onScrollToField={handleScrollToField}
                className="w-full"
            />

            {/* Entwurf speichern - erlaubt auch partielle Daten */}
            <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleSaveDraft}
                disabled={!canSaveDraft || isAnyLoading}
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
                    onClick={canExport ? handleExportPdf : handleDisabledExportClick}
                    disabled={isAnyLoading}
                    data-disabled={!canExport}
                >
                    {isExportingPdf ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : !canExport ? (
                        <AlertCircle className="w-4 h-4" />
                    ) : (
                        <FileText className="w-4 h-4" />
                    )}
                    PDF
                </Button>
                <Button
                    variant="secondary"
                    className="gap-2"
                    onClick={canExport ? handleExportDocx : handleDisabledExportClick}
                    disabled={isAnyLoading}
                    data-disabled={!canExport}
                >
                    {isExportingDocx ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : !canExport ? (
                        <AlertCircle className="w-4 h-4" />
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

            {/* Export Success Modal */}
            <ExportSuccessModal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                documentTitle={documentTitle}
                exportFormat={lastExportFormat}
                onDownloadAgain={handleDownloadAgain}
                onGoToDocuments={handleGoToDocuments}
            />
        </div>
    );
};

export default ActionBar;
