/**
 * ClauseImpactDialog - Auswirkungsanalyse für Klausel-Änderungen
 *
 * v4.2 Feature (Kapitel 15.2.5):
 * Zeigt vor dem Speichern einer Klausel-Änderung:
 * - Welche Dokumenttypen verwenden diese Klausel?
 * - Wie oft wurde sie in den letzten 30 Tagen genutzt?
 * - Warning bei vielen Auswirkungen
 */

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    AlertTriangle,
    FileText,
    CheckCircle,
    Loader2,
    Info,
    Save,
    X,
} from "lucide-react";

interface DocumentTypeUsage {
    id: number;
    name: string;
    category: string | null;
    is_mandatory: boolean;
    usage_count_30_days: number;
}

interface ClauseImpactAnalysis {
    clause_id: number;
    clause_title: string;
    clause_version: number;
    affected_document_types: DocumentTypeUsage[];
    total_document_types: number;
    total_usage_30_days: number;
}

interface ClauseImpactDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clauseId: number;
    clauseTitle: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ClauseImpactDialog({
    open,
    onOpenChange,
    clauseId,
    clauseTitle,
    onConfirm,
    onCancel,
}: ClauseImpactDialogProps) {
    const [impactData, setImpactData] = useState<ClauseImpactAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch impact data when dialog opens
    useEffect(() => {
        if (open && clauseId) {
            fetchImpactAnalysis();
        }
    }, [open, clauseId]);

    const fetchImpactAnalysis = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/v1/clauses/${clauseId}/impact`);
            if (!response.ok) {
                throw new Error("Auswirkungsanalyse konnte nicht geladen werden");
            }
            const data = await response.json();
            setImpactData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        } finally {
            setIsLoading(false);
        }
    };

    const getSeverityLevel = () => {
        if (!impactData) return "low";
        if (impactData.total_document_types >= 5 || impactData.total_usage_30_days >= 50) return "high";
        if (impactData.total_document_types >= 2 || impactData.total_usage_30_days >= 10) return "medium";
        return "low";
    };

    const severity = getSeverityLevel();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {severity === "high" ? (
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                        ) : severity === "medium" ? (
                            <AlertTriangle className="w-5 h-5 text-warning" />
                        ) : (
                            <Info className="w-5 h-5 text-blue-500" />
                        )}
                        Auswirkungsanalyse
                    </DialogTitle>
                    <DialogDescription>
                        Sie ändern: <strong>{clauseTitle}</strong>
                        {impactData && ` (Version ${impactData.clause_version} → ${impactData.clause_version + 1})`}
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="bg-destructive/10 text-destructive rounded-lg p-4">
                        {error}
                    </div>
                ) : impactData ? (
                    <div className="space-y-4">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-muted/50 rounded-lg p-4 text-center">
                                <div className="text-3xl font-bold">{impactData.total_document_types}</div>
                                <div className="text-sm text-muted-foreground">Dokumenttypen betroffen</div>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-4 text-center">
                                <div className="text-3xl font-bold">{impactData.total_usage_30_days}</div>
                                <div className="text-sm text-muted-foreground">Dokumente (letzte 30 Tage)</div>
                            </div>
                        </div>

                        {/* Warning for high impact */}
                        {severity === "high" && (
                            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-medium text-destructive">Hohe Auswirkung</div>
                                    <div className="text-sm text-muted-foreground">
                                        Diese Klausel wird intensiv genutzt. Änderungen wirken sich auf viele bestehende Dokumenttypen aus.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Affected Document Types */}
                        {impactData.affected_document_types.length > 0 ? (
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-muted px-4 py-2 text-sm font-medium">
                                    Diese Klausel wird verwendet in:
                                </div>
                                <div className="divide-y max-h-[250px] overflow-y-auto">
                                    {impactData.affected_document_types.map((dt) => (
                                        <div
                                            key={dt.id}
                                            className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
                                        >
                                            <div className="flex items-center gap-3">
                                                <FileText className="w-4 h-4 text-muted-foreground" />
                                                <div>
                                                    <div className="font-medium">{dt.name}</div>
                                                    {dt.category && (
                                                        <div className="text-xs text-muted-foreground">{dt.category}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={dt.is_mandatory ? "default" : "secondary"}>
                                                    {dt.is_mandatory ? "Pflicht" : "Optional"}
                                                </Badge>
                                                <span className="text-sm text-muted-foreground">
                                                    {dt.usage_count_30_days} Dokumente
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-medium text-green-800 dark:text-green-200">Keine Auswirkungen</div>
                                    <div className="text-sm text-green-700 dark:text-green-300">
                                        Diese Klausel wird aktuell in keinem aktiven Dokumenttyp verwendet.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Save Options */}
                        <div className="border-t pt-4">
                            <div className="text-sm font-medium mb-2">Speicheroptionen:</div>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="saveOption" defaultChecked className="w-4 h-4" />
                                    <span className="text-sm">Änderung sofort für alle aktivieren</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-muted-foreground">
                                    <input type="radio" name="saveOption" disabled className="w-4 h-4" />
                                    <span className="text-sm">
                                        Neue Version erstellen (alte bleibt für bestehende Typen)
                                        <Badge variant="outline" className="ml-2 text-xs">Bald verfügbar</Badge>
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>
                ) : null}

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onCancel}>
                        <X className="w-4 h-4 mr-2" />
                        Abbrechen
                    </Button>
                    <Button
                        onClick={onConfirm}
                        variant={severity === "high" ? "destructive" : "default"}
                        disabled={isLoading}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Änderung speichern
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
