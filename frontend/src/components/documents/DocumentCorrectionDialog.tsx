/**
 * DocumentCorrectionDialog Component
 *
 * Allows users to correct a document:
 * 1. Load existing form data
 * 2. Edit values
 * 3. Generate new version
 */

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    useDocumentWithVersions,
    useStartCorrection,
    useSubmitCorrection,
    useCancelCorrection,
} from "@/hooks/useApi";
import { Loader2, AlertCircle, CheckCircle, Edit3, History, FileText } from "lucide-react";

// Deutsche Labels für Formulardaten-Anzeige
const FORM_FIELD_LABELS: Record<string, string> = {
    signatory_name: "Unterzeichner",
    vorname: "Vorname",
    nachname: "Nachname",
    eintrittsdatum: "Eintrittsdatum",
    geburtsdatum: "Geburtsdatum",
    position: "Position",
    gehalt: "Gehalt",
    wochenstunden: "Wochenstunden",
    urlaubstage: "Urlaubstage",
    probezeit: "Probezeit",
    strasse: "Straße",
    plz: "PLZ",
    ort: "Ort",
    firmenwagen: "Firmenwagen",
    homeoffice: "Home Office",
    adresse: "Adresse",
    arbeitgeber: "Arbeitgeber",
};

function formatFieldLabel(key: string): string {
    if (FORM_FIELD_LABELS[key]) return FORM_FIELD_LABELS[key];
    // Fallback: Underscores ersetzen + erster Buchstabe groß
    const label = key.replace(/_/g, " ");
    return label.charAt(0).toUpperCase() + label.slice(1);
}

interface DocumentCorrectionDialogProps {
    documentId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export const DocumentCorrectionDialog = ({
    documentId,
    open,
    onOpenChange,
    onSuccess,
}: DocumentCorrectionDialogProps) => {
    const [step, setStep] = useState<"start" | "edit" | "confirm">("start");
    const [correctionId, setCorrectionId] = useState<number | null>(null);
    const [formData, setFormData] = useState<Record<string, unknown>>({});
    const [originalData, setOriginalData] = useState<Record<string, unknown>>({});
    const [changeReason, setChangeReason] = useState("");
    const [error, setError] = useState<string | null>(null);

    const { data: document, isLoading, refetch } = useDocumentWithVersions(documentId);
    const startCorrection = useStartCorrection();
    const submitCorrection = useSubmitCorrection();
    const cancelCorrection = useCancelCorrection();

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset dialog state when it opens
            setStep("start");
            setCorrectionId(null);
            setChangeReason("");
            setError(null);
            if (document?.form_data) {
                setFormData({ ...document.form_data });
                setOriginalData({ ...document.form_data });
            }
        }
    }, [open, document?.form_data]);

    // Detect changed fields
    const changedFields = useMemo(() => {
        const changed: string[] = [];
        for (const key of Object.keys(formData)) {
            if (JSON.stringify(formData[key]) !== JSON.stringify(originalData[key])) {
                changed.push(key);
            }
        }
        return changed;
    }, [formData, originalData]);

    const handleStartCorrection = async () => {
        try {
            setError(null);
            const result = await startCorrection.mutateAsync({
                document_id: documentId,
                requested_changes: changeReason || undefined,
            });
            setCorrectionId(result.id);
            setStep("edit");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Fehler beim Starten der Korrektur");
        }
    };

    const handleSubmit = async () => {
        if (!correctionId) return;
        if (changedFields.length === 0) {
            setError("Keine Änderungen vorgenommen");
            return;
        }
        if (!changeReason.trim()) {
            setError("Bitte gib einen Änderungsgrund an");
            return;
        }

        try {
            setError(null);
            await submitCorrection.mutateAsync({
                correctionId,
                data: {
                    form_data: formData,
                    change_reason: changeReason,
                    changed_fields: changedFields,
                },
            });
            refetch();
            onSuccess?.();
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Fehler beim Speichern der Korrektur");
        }
    };

    const handleCancel = async () => {
        if (correctionId) {
            try {
                await cancelCorrection.mutateAsync(correctionId);
            } catch {
                // Ignore cancel errors
            }
        }
        onOpenChange(false);
    };

    const updateField = (key: string, value: unknown) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    if (isLoading) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl">
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    if (!document) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Dokument nicht gefunden</DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground">
                        Das Dokument konnte nicht geladen werden.
                    </p>
                    <DialogFooter>
                        <Button onClick={() => onOpenChange(false)}>Schließen</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={handleCancel}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Edit3 className="w-5 h-5" />
                        Dokument korrigieren
                    </DialogTitle>
                    <DialogDescription>
                        {document.title || `Dokument #${document.id}`}
                        {document.employee_name && ` - ${document.employee_name}`}
                        <span className="ml-2 text-xs">
                            (Version {document.current_version})
                        </span>
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto py-4">
                    {step === "start" && (
                        <div className="space-y-6">
                            {/* Version History */}
                            {document.versions.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="font-medium flex items-center gap-2">
                                        <History className="w-4 h-4" />
                                        Versionsverlauf
                                    </h4>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {document.versions.map((v) => (
                                            <div
                                                key={v.id}
                                                className={`p-3 rounded-lg border ${
                                                    v.is_current
                                                        ? "bg-primary/5 border-primary"
                                                        : "bg-muted/30"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">
                                                        Version {v.version_number}
                                                        {v.is_current && (
                                                            <span className="ml-2 text-xs text-primary">
                                                                (aktuell)
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(v.created_at).toLocaleString("de")}
                                                    </span>
                                                </div>
                                                {v.change_reason && (
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        {v.change_reason}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Grund der Korrektur (optional)</Label>
                                <Textarea
                                    value={changeReason}
                                    onChange={(e) => setChangeReason(e.target.value)}
                                    placeholder="z.B. Gehaltsanpassung, Tippfehler korrigiert..."
                                    rows={3}
                                />
                            </div>

                            <div className="p-4 bg-muted/30 rounded-lg">
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Aktuelle Formulardaten
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    {Object.entries(document.form_data || {}).slice(0, 6).map(([key, value]) => (
                                        <div key={key} className="flex justify-between">
                                            <span className="text-muted-foreground">{formatFieldLabel(key)}:</span>
                                            <span className="font-medium truncate max-w-[150px]" title={String(value)}>
                                                {String(value)}
                                            </span>
                                        </div>
                                    ))}
                                    {Object.keys(document.form_data || {}).length > 6 && (
                                        <div className="col-span-2 text-muted-foreground text-xs">
                                            ... und {Object.keys(document.form_data || {}).length - 6} weitere Felder
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === "edit" && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Bearbeite die Felder, die korrigiert werden sollen.
                                Geänderte Felder werden hervorgehoben.
                            </p>

                            <div className="grid gap-4">
                                {Object.entries(formData).map(([key, value]) => {
                                    const isChanged = changedFields.includes(key);
                                    return (
                                        <div
                                            key={key}
                                            className={`p-3 rounded-lg border transition-colors ${
                                                isChanged
                                                    ? "bg-yellow-50 border-yellow-300"
                                                    : "bg-white"
                                            }`}
                                        >
                                            <Label className="flex items-center gap-2">
                                                {formatFieldLabel(key)}
                                                {isChanged && (
                                                    <span className="text-xs text-yellow-600 font-normal">
                                                        (geändert)
                                                    </span>
                                                )}
                                            </Label>
                                            <Input
                                                value={String(value || "")}
                                                onChange={(e) => updateField(key, e.target.value)}
                                                className="mt-1"
                                            />
                                            {isChanged && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Original: {String(originalData[key] || "-")}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {changedFields.length > 0 && (
                                <div className="space-y-2 mt-6">
                                    <Label className="text-red-600">
                                        Änderungsgrund *
                                    </Label>
                                    <Textarea
                                        value={changeReason}
                                        onChange={(e) => setChangeReason(e.target.value)}
                                        placeholder="Bitte begründe die Änderung..."
                                        rows={2}
                                        className={!changeReason.trim() ? "border-red-300" : ""}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {step === "confirm" && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                                <div>
                                    <h4 className="font-medium text-green-800">
                                        Korrektur bestätigen
                                    </h4>
                                    <p className="text-sm text-green-700">
                                        {changedFields.length} Feld(er) wurden geändert
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-medium">Geänderte Felder:</h4>
                                {changedFields.map((field) => (
                                    <div key={field} className="p-2 bg-muted/30 rounded text-sm">
                                        <span className="font-medium">{formatFieldLabel(field)}:</span>
                                        <span className="text-muted-foreground ml-2">
                                            {String(originalData[field])}
                                        </span>
                                        <span className="mx-2">→</span>
                                        <span className="text-primary font-medium">
                                            {String(formData[field])}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="p-3 bg-muted/30 rounded-lg">
                                <span className="text-sm font-medium">Grund:</span>
                                <p className="text-sm text-muted-foreground">{changeReason}</p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button variant="outline" onClick={handleCancel}>
                        Abbrechen
                    </Button>

                    {step === "start" && (
                        <Button
                            onClick={handleStartCorrection}
                            disabled={startCorrection.isPending}
                        >
                            {startCorrection.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : null}
                            Korrektur starten
                        </Button>
                    )}

                    {step === "edit" && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setStep("start")}
                            >
                                Zurück
                            </Button>
                            <Button
                                onClick={() => setStep("confirm")}
                                disabled={changedFields.length === 0 || !changeReason.trim()}
                            >
                                Weiter zur Bestätigung
                            </Button>
                        </>
                    )}

                    {step === "confirm" && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setStep("edit")}
                            >
                                Zurück
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={submitCorrection.isPending}
                            >
                                {submitCorrection.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : null}
                                Korrektur speichern
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
