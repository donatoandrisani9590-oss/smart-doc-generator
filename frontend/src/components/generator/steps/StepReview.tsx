/**
 * StepReview - Schritt 5: Vorschau und Export
 *
 * Zeigt eine Zusammenfassung und Live-Vorschau:
 * - Kompakte Zusammenfassung der Eingaben
 * - Unterzeichner-Feld
 * - Scrollbare Dokumentvorschau
 * - Export-Buttons (PDF, DOCX, Entwurf)
 * - Link zu Klauseln anpassen
 */

import { CheckCircle, ArrowLeft, Download, Save, FileText, Edit, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { sanitizeHtml } from "@/utils/sanitize";
import { useWizardContext } from "../WizardContext";
import "@/styles/preview.css";

interface DocumentType {
    id: number;
    name: string;
}

interface StepReviewProps {
    documentTypes: DocumentType[];
}

export const StepReview = ({ documentTypes }: StepReviewProps) => {
    const { state, actions } = useWizardContext();
    const {
        formData,
        documentTypeId,
        documentTitle,
        documentClauses,
        previewHtml,
        isPreviewLoading,
        isSaving,
        isGenerating,
        validationErrors,
        showClausesStep,
    } = state;

    const documentTypeName = documentTypes.find((t) => t.id === documentTypeId)?.name || "Dokument";
    const enabledClausesCount = documentClauses.filter((c) => c.is_enabled).length;

    const getError = (field: string) =>
        validationErrors.find((e) => e.field === field)?.message;

    const formatGehalt = (gehalt: string) => {
        const num = parseFloat(gehalt);
        if (isNaN(num)) return gehalt;
        return new Intl.NumberFormat("de-DE", {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 0,
        }).format(num);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "—";
        try {
            return new Date(dateStr).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            });
        } catch {
            return dateStr;
        }
    };

    const isValid =
        formData.signatory_name.trim().length >= 2 &&
        formData.vorname.trim() &&
        formData.nachname.trim() &&
        formData.position.trim() &&
        formData.gehalt &&
        formData.eintrittsdatum;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold">Zusammenfassung</h2>
                <p className="text-muted-foreground">
                    Prüfen Sie Ihre Eingaben und exportieren Sie das Dokument.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Linke Spalte: Zusammenfassung */}
                <div className="space-y-4">
                    {/* Zusammenfassung */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">
                                {documentTitle || documentTypeName}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Dokumenttyp</span>
                                <span className="font-medium">{documentTypeName}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Mitarbeiter</span>
                                <span className="font-medium">
                                    {formData.vorname} {formData.nachname}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Position</span>
                                <span className="font-medium">{formData.position || "—"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Gehalt</span>
                                <span className="font-medium">
                                    {formData.gehalt ? `${formatGehalt(formData.gehalt)} brutto` : "—"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Beginn</span>
                                <span className="font-medium">
                                    {formatDate(formData.eintrittsdatum)}
                                </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Klauseln</span>
                                <span className="font-medium">
                                    {enabledClausesCount} aktiv
                                    {!showClausesStep && " (Standard)"}
                                </span>
                            </div>

                            {/* Link zu Klauseln */}
                            {!showClausesStep && (
                                <button
                                    type="button"
                                    onClick={() => actions.toggleClausesStep()}
                                    className="w-full mt-2 text-xs text-primary hover:underline flex items-center justify-center gap-1"
                                >
                                    <FileText className="w-3 h-3" />
                                    Klauseln anpassen
                                </button>
                            )}
                        </CardContent>
                    </Card>

                    {/* Unterzeichner */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="space-y-2">
                                <Label htmlFor="signatory_name">
                                    Unterzeichner (Arbeitgeber) <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="signatory_name"
                                    value={formData.signatory_name}
                                    onChange={(e) => actions.updateFormField("signatory_name", e.target.value)}
                                    placeholder="Max Manager"
                                    className={getError("signatory_name") ? "border-destructive" : ""}
                                />
                                {getError("signatory_name") && (
                                    <p className="text-xs text-destructive">{getError("signatory_name")}</p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Name für die Unterschriftenzeile im Dokument
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Export Buttons */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="space-y-3">
                                <Button
                                    variant="outline"
                                    className="w-full gap-2"
                                    onClick={() => actions.saveDraft()}
                                    disabled={isSaving || !documentTitle.trim()}
                                >
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    Als Entwurf speichern
                                </Button>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        variant="outline"
                                        className="gap-2"
                                        onClick={() => actions.exportDocument("docx")}
                                        disabled={isGenerating || !isValid}
                                    >
                                        {isGenerating ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Download className="w-4 h-4" />
                                        )}
                                        DOCX
                                    </Button>
                                    <Button
                                        className="gap-2"
                                        onClick={() => actions.exportDocument("pdf")}
                                        disabled={isGenerating || !isValid}
                                    >
                                        {isGenerating ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Download className="w-4 h-4" />
                                        )}
                                        PDF
                                    </Button>
                                </div>
                                {!isValid && (
                                    <p className="text-xs text-center text-muted-foreground">
                                        Bitte füllen Sie alle Pflichtfelder aus.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Rechte Spalte: Preview */}
                <Card className="overflow-hidden">
                    <CardHeader className="pb-2 bg-muted/30">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Dokumentvorschau
                            </CardTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => actions.enterEditorMode()}
                                className="gap-1 text-xs"
                            >
                                <Edit className="w-3 h-3" />
                                Bearbeiten
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div
                            className="preview-container overflow-auto bg-white"
                            style={{ maxHeight: "500px" }}
                        >
                            {isPreviewLoading ? (
                                <div className="flex items-center justify-center h-64">
                                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : previewHtml ? (
                                <div
                                    className="preview-content p-6"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-64 text-muted-foreground">
                                    <p>Vorschau wird geladen...</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-4">
                <Button
                    variant="outline"
                    size="lg"
                    onClick={() => actions.prevStep()}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Zurück
                </Button>
            </div>
        </div>
    );
};

export default StepReview;
