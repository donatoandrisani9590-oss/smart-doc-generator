/**
 * DeviationConfirmDialog - Bestätigungsdialog für "Schloss öffnen"
 *
 * Smart UX Phase 2:
 * - Warnt den Benutzer über die Konsequenzen
 * - Optionales Eingabefeld für Begründung
 * - Bestätigung erforderlich
 */

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Unlock, AlertTriangle } from "lucide-react";

interface DeviationConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clauseTitle: string;
    onConfirm: (reason?: string) => void;
    isLoading?: boolean;
}

export const DeviationConfirmDialog = ({
    open,
    onOpenChange,
    clauseTitle,
    onConfirm,
    isLoading = false,
}: DeviationConfirmDialogProps) => {
    const [reason, setReason] = useState("");

    const handleConfirm = () => {
        onConfirm(reason.trim() || undefined);
        setReason("");
    };

    const handleCancel = () => {
        setReason("");
        onOpenChange(false);
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-md">
                {/* UX-Refactoring: Vereinfachte, nutzerfreundliche Sprache */}
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Unlock className="w-5 h-5 text-primary" />
                        </div>
                        Text anpassen?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                        <p>
                            Sie können den Standardtext <strong>"{clauseTitle}"</strong> für diesen Vertrag individuell anpassen.
                        </p>

                        <div className="bg-muted/50 border rounded-lg p-3">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-muted-foreground">
                                    <strong>Hinweis:</strong> Die Änderung gilt nur für dieses Dokument.
                                    Die Vorlage selbst bleibt unverändert.
                                </div>
                            </div>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-2 py-2">
                    <Label htmlFor="deviation-reason" className="text-sm">
                        Begründung (optional)
                    </Label>
                    <Textarea
                        id="deviation-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="z.B. Anpassung für Führungskraft mit erweitertem Urlaubsanspruch"
                        className="resize-none"
                        rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                        Die Begründung wird für Audit-Zwecke gespeichert.
                    </p>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
                        Abbrechen
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className="bg-amber-600 hover:bg-amber-700"
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Wird abgewandelt...
                            </span>
                        ) : (
                            <>
                                <Unlock className="w-4 h-4 mr-2" />
                                Ja, anpassen
                            </>
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default DeviationConfirmDialog;
