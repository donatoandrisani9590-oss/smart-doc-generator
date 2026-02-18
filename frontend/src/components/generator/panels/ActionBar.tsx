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

import { useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Save, FileText, FileType2, Loader2, CheckCircle2, Cloud, CloudOff, Download, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { useWizardContext } from "../WizardContext";
import { ValidationProgress, type ValidationState, type ValidationIssue } from "../ValidationProgress";
import { ExportSuccessModal } from "../ExportSuccessModal";
import { ExportReviewModal } from "../ExportReviewModal";

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

    // Guard against double-click race condition (setState is async)
    const exportInProgressRef = useRef(false);

    // Export Review Modal state (Zusammenfassung vor Export)
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewExportFormat, setReviewExportFormat] = useState<"pdf" | "docx">("pdf");

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

    // Review-Modal öffnen statt direkt exportieren
    const handleOpenReview = useCallback((format: "pdf" | "docx") => {
        setReviewExportFormat(format);
        setShowReviewModal(true);
    }, []);

    // Shared export logic (DRY)
    const performExport = async (format: "pdf" | "docx"): Promise<boolean> => {
        if (!canExport || exportInProgressRef.current) return false;
        exportInProgressRef.current = true;
        if (format === "pdf") setIsExportingPdf(true);
        else setIsExportingDocx(true);

        try {
            await actions.exportDocument(format);
            return true;
        } catch (err) {
            toast.error(
                "Export fehlgeschlagen",
                err instanceof Error ? err.message : "Bitte versuchen Sie es erneut.",
            );
            return false;
        } finally {
            if (format === "pdf") setIsExportingPdf(false);
            else setIsExportingDocx(false);
            exportInProgressRef.current = false;
        }
    };

    // Export nach Review-Bestätigung
    const handleConfirmExport = async () => {
        const format = reviewExportFormat;
        const success = await performExport(format);
        setShowReviewModal(false);
        if (success) {
            setLastExportFormat(format);
            setShowSuccessModal(true);
        }
    };

    // Direct export (für Download Again — überspringt Review)
    const handleDirectExport = async (format: "pdf" | "docx") => {
        const success = await performExport(format);
        if (success) {
            setLastExportFormat(format);
            setShowSuccessModal(true);
        }
    };

    // Download Again from Success Modal (skips review)
    const handleDownloadAgain = async (format: "pdf" | "docx") => {
        setShowSuccessModal(false);
        await handleDirectExport(format);
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
        <div className="p-3 shadow-[var(--shadow-up-subtle)] bg-background space-y-2.5">
            {/* Auto-Save Status */}
            {autoSaveIndicator && (
                <div className={`flex items-center justify-center gap-1.5 text-[11px] ${autoSaveIndicator.color}`}>
                    {autoSaveIndicator.icon}
                    <span>{autoSaveIndicator.text}</span>
                </div>
            )}

            {/* ValidationProgress — the single source of truth for status */}
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

            {/* Export Button — only visible when ready (reduces visual noise) */}
            {canExport && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="default"
                            className="w-full gap-2"
                            disabled={isAnyLoading}
                        >
                            {(isExportingPdf || isExportingDocx) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            {isExportingPdf ? "Exportiert PDF…" : isExportingDocx ? "Exportiert DOCX…" : "Exportieren"}
                            {!isAnyLoading && <ChevronDown className="w-3.5 h-3.5 ml-auto opacity-60" />}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-[calc(var(--radix-dropdown-menu-trigger-width))]">
                        <DropdownMenuItem onClick={() => handleOpenReview("pdf")} className="gap-2 cursor-pointer">
                            <FileText className="w-4 h-4 text-red-500" />
                            Als PDF exportieren
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenReview("docx")} className="gap-2 cursor-pointer">
                            <FileType2 className="w-4 h-4 text-blue-500" />
                            Als DOCX exportieren
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            {/* Export Review Modal (Zusammenfassung vor Export) */}
            <ExportReviewModal
                isOpen={showReviewModal}
                onClose={() => setShowReviewModal(false)}
                onConfirm={handleConfirmExport}
                isExporting={isExportingPdf || isExportingDocx}
                exportFormat={reviewExportFormat}
                documentTitle={documentTitle}
                formData={formData}
            />

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
