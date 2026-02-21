/**
 * EditorActionPanel — Floating "Finalize" panel over the canvas.
 *
 * Figma-style collapsible panel with:
 * - Export format toggle (PDF/DOCX)
 * - Attachment checkbox list
 * - Optional date fields (Versendet am, Rueckfrist bis)
 * - Export + Approval buttons
 *
 * Positioned absolute bottom-right of the canvas container.
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    ChevronDown,
    ChevronUp,
    Download,
    FileText,
    FileType2,
    Loader2,
    ShieldCheck,
    CalendarClock,
    Send,
    Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { useWizardContext } from "../WizardContext";
import { useCountry } from "@/hooks/useCountry";
import { useAttachments } from "@/hooks/api/useDocumentQueries";
import { useMoveDocument } from "@/hooks/api/useKanbanQueries";
import { api } from "@/lib/api-client";
import { ExportReviewModal } from "../ExportReviewModal";
import { ExportSuccessModal } from "../ExportSuccessModal";

export function EditorActionPanel() {
    const { state, actions } = useWizardContext();
    const { country } = useCountry();
    const toast = useToast();
    const navigate = useNavigate();
    const moveMutation = useMoveDocument();

    const {
        documentTypeId,
        documentTitle,
        formData,
        isGenerating,
        selectedAttachmentIds,
        lastExportedDocumentId,
    } = state;

    // ── Panel state ──────────────────────────────────────────────────────
    const [isExpanded, setIsExpanded] = useState(false);
    const [exportFormat, setExportFormat] = useState<"pdf" | "docx">("pdf");
    const [isExporting, setIsExporting] = useState(false);
    const exportInProgressRef = useRef(false);

    // Date fields
    const [sentDate, setSentDate] = useState("");
    const [returnDeadline, setReturnDeadline] = useState("");

    // Modals
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // ── Attachments ──────────────────────────────────────────────────────
    const { data: attachments } = useAttachments(country);

    // ── Validation ───────────────────────────────────────────────────────
    const REQUIRED_FIELDS = ["vorname", "nachname", "position", "gehalt", "eintrittsdatum", "signatory_name"] as const;

    const canExport = useMemo(() => {
        if (!documentTypeId || !documentTitle.trim()) return false;
        return REQUIRED_FIELDS.every(field => {
            const value = formData[field as keyof typeof formData];
            return value !== undefined && value !== null && value !== "";
        });
    }, [documentTypeId, documentTitle, formData]);

    // ── Export logic ─────────────────────────────────────────────────────
    const handleOpenReview = useCallback(() => {
        setShowReviewModal(true);
    }, []);

    const performExport = useCallback(async (format?: "pdf" | "docx"): Promise<boolean> => {
        const fmt = format || exportFormat;
        if (!canExport || exportInProgressRef.current) return false;
        exportInProgressRef.current = true;
        setIsExporting(true);

        try {
            await actions.exportDocument(fmt);
            return true;
        } catch (err) {
            toast.error(
                "Export fehlgeschlagen",
                err instanceof Error ? err.message : "Bitte versuche es erneut.",
            );
            return false;
        } finally {
            setIsExporting(false);
            exportInProgressRef.current = false;
        }
    }, [canExport, exportFormat, actions, toast]);

    const handleConfirmExport = useCallback(async () => {
        const success = await performExport();
        setShowReviewModal(false);
        if (success) {
            setShowSuccessModal(true);

            // Post-export: mark as sent if date provided
            if (sentDate && lastExportedDocumentId) {
                try {
                    await api.post(`/api/v1/documents/${lastExportedDocumentId}/actions`, {
                        action_type: "sent",
                        note: `Versendet am ${sentDate}`,
                        metadata_json: { send_date: sentDate },
                    });
                    await moveMutation.mutateAsync({
                        documentId: lastExportedDocumentId,
                        targetStage: "versendet",
                    });
                } catch { /* non-critical */ }
            }

            // Post-export: create deadline if return date provided
            if (returnDeadline && lastExportedDocumentId) {
                try {
                    await api.post("/api/v1/user/deadlines", {
                        deadline_type: "ruecklauf",
                        deadline_date: returnDeadline,
                        deadline_label: `Rücksendung: ${documentTitle}`,
                        employee_name: `${formData.vorname} ${formData.nachname}`.trim(),
                        generated_document_id: lastExportedDocumentId,
                    });
                } catch { /* non-critical */ }
            }
        }
    }, [performExport, sentDate, returnDeadline, lastExportedDocumentId, moveMutation, documentTitle, formData]);

    const handleDownloadAgain = useCallback(async (format: "pdf" | "docx") => {
        setShowSuccessModal(false);
        const success = await performExport(format);
        if (success) setShowSuccessModal(true);
    }, [performExport]);

    const handleGoToDocuments = useCallback(() => {
        setShowSuccessModal(false);
        navigate("/documents");
    }, [navigate]);

    // ── Approval ─────────────────────────────────────────────────────────
    const [isRequestingApproval, setIsRequestingApproval] = useState(false);

    const handleRequestApproval = useCallback(async () => {
        if (!lastExportedDocumentId) {
            toast.error("Bitte zuerst exportieren", "Das Dokument muss vor der Freigabe exportiert werden.");
            return;
        }
        setIsRequestingApproval(true);
        try {
            await api.post(`/api/v1/documents/${lastExportedDocumentId}/actions`, {
                action_type: "approval_requested",
                note: "Freigabe über Generator angefragt",
            });
            await moveMutation.mutateAsync({
                documentId: lastExportedDocumentId,
                targetStage: "freigabe",
            });
            toast.success("Freigabe angefragt");
        } catch {
            toast.error("Fehler", "Freigabe konnte nicht angefragt werden");
        } finally {
            setIsRequestingApproval(false);
        }
    }, [lastExportedDocumentId, moveMutation, toast]);

    // ── Render ───────────────────────────────────────────────────────────

    return (
        <>
            <div className="absolute bottom-6 right-6 z-30 w-80">
                {/* Collapsible Panel */}
                <div className="bg-white/95 dark:bg-card/95 backdrop-blur-xl rounded-2xl shadow-float border border-warm-100 dark:border-border overflow-hidden transition-all duration-200">
                    {/* Header — always visible */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-warm-50/50 dark:hover:bg-warm-50/5 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Download className="w-4 h-4 text-primary" />
                            Dokument abschließen
                        </div>
                        {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        )}
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                        <div className="px-4 pb-4 space-y-4">
                            {/* Format Toggle */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Format</Label>
                                <div className="flex gap-1 p-1 bg-warm-50 dark:bg-warm-50/10 rounded-lg">
                                    <button
                                        onClick={() => setExportFormat("pdf")}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                                            exportFormat === "pdf"
                                                ? "bg-white dark:bg-card shadow-soft-xs text-foreground"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        <FileText className="w-3.5 h-3.5 text-red-500" />
                                        PDF
                                    </button>
                                    <button
                                        onClick={() => setExportFormat("docx")}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                                            exportFormat === "docx"
                                                ? "bg-white dark:bg-card shadow-soft-xs text-foreground"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        <FileType2 className="w-3.5 h-3.5 text-blue-500" />
                                        DOCX
                                    </button>
                                </div>
                            </div>

                            {/* Attachments */}
                            {attachments && attachments.length > 0 && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Paperclip className="w-3 h-3" />
                                        Anhänge
                                    </Label>
                                    <div className="space-y-1 max-h-32 overflow-auto">
                                        {attachments.map((att: { id: number; name: string }) => (
                                            <label
                                                key={att.id}
                                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-warm-50/50 dark:hover:bg-warm-50/5 cursor-pointer transition-colors"
                                            >
                                                <Checkbox
                                                    checked={selectedAttachmentIds.includes(att.id)}
                                                    onCheckedChange={() => actions.toggleAttachment(att.id)}
                                                />
                                                <span className="text-xs text-foreground/80 truncate">{att.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Divider */}
                            <div className="border-t border-dashed border-warm-200 dark:border-border/50" />

                            {/* Date Fields */}
                            <div className="space-y-2">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Send className="w-3 h-3" />
                                        Versendet am
                                    </Label>
                                    <Input
                                        type="date"
                                        value={sentDate}
                                        onChange={(e) => setSentDate(e.target.value)}
                                        className="h-8 text-xs canvas-input"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <CalendarClock className="w-3 h-3" />
                                        Rückfrist bis
                                    </Label>
                                    <Input
                                        type="date"
                                        value={returnDeadline}
                                        onChange={(e) => setReturnDeadline(e.target.value)}
                                        className="h-8 text-xs canvas-input"
                                    />
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-dashed border-warm-200 dark:border-border/50" />

                            {/* Action Buttons */}
                            <div className="space-y-2">
                                <Button
                                    className="w-full gap-2"
                                    onClick={handleOpenReview}
                                    disabled={!canExport || isExporting || isGenerating}
                                >
                                    {isExporting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Download className="w-4 h-4" />
                                    )}
                                    {isExporting ? "Exportiert..." : "Exportieren & Herunterladen"}
                                </Button>

                                {lastExportedDocumentId && (
                                    <Button
                                        variant="outline"
                                        className="w-full gap-2"
                                        onClick={handleRequestApproval}
                                        disabled={isRequestingApproval}
                                    >
                                        {isRequestingApproval ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <ShieldCheck className="w-4 h-4" />
                                        )}
                                        Zur Freigabe einreichen
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <ExportReviewModal
                isOpen={showReviewModal}
                onClose={() => setShowReviewModal(false)}
                onConfirm={handleConfirmExport}
                isExporting={isExporting}
                exportFormat={exportFormat}
                documentTitle={documentTitle}
                formData={formData}
            />
            <ExportSuccessModal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                documentTitle={documentTitle}
                exportFormat={exportFormat}
                documentId={lastExportedDocumentId}
                onDownloadAgain={handleDownloadAgain}
                onGoToDocuments={handleGoToDocuments}
            />
        </>
    );
}
