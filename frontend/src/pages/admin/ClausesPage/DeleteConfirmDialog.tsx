/**
 * DeleteConfirmDialog
 *
 * Confirmation dialog for deleting a clause, including
 * impact analysis showing which document types use the clause.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import type { DeleteConfirmDialogProps } from "./types";

export const DeleteConfirmDialog = ({
    open,
    onOpenChange,
    clause,
    onConfirm,
    isDeleting,
    usageCount = 0,
    usedInTypes = [],
}: DeleteConfirmDialogProps) => {
    if (!clause) return null;

    const hasUsage = usageCount > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md" aria-describedby="delete-clause-description">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                        Textbaustein löschen
                    </DialogTitle>
                    <DialogDescription id="delete-clause-description">
                        Diese Aktion kann nicht rückgängig gemacht werden.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-3">
                    {/* Impact Warning */}
                    {hasUsage && (
                        <Card className="border-amber-300 bg-amber-50">
                            <CardContent className="py-3">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                                    <div>
                                        <p className="text-sm font-medium text-amber-800">
                                            Dieser Textbaustein wird verwendet
                                        </p>
                                        <p className="text-xs text-amber-700 mt-1">
                                            {usageCount} Dokumenttyp{usageCount !== 1 ? "en" : ""} verwenden diesen Textbaustein:
                                        </p>
                                        {usedInTypes.length > 0 && (
                                            <ul className="text-xs text-amber-700 mt-1 list-disc list-inside">
                                                {usedInTypes.slice(0, 3).map((type, i) => (
                                                    <li key={i}>{type}</li>
                                                ))}
                                                {usedInTypes.length > 3 && (
                                                    <li>und {usedInTypes.length - 3} weitere...</li>
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Deletion Warning */}
                    <Card className="border-destructive/30 bg-destructive/5">
                        <CardContent className="py-3">
                            <p className="text-sm text-destructive">
                                Sind Sie sicher, dass Sie den Textbaustein{" "}
                                <strong>"{clause.title}"</strong> löschen möchten?
                            </p>
                            <p className="text-xs text-destructive/80 mt-2">
                                {hasUsage
                                    ? "Der Textbaustein wird aus allen oben genannten Dokumenttypen entfernt. Bestehende Dokumente sind nicht betroffen."
                                    : "Dieser Textbaustein wird derzeit nicht verwendet."}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isDeleting}
                    >
                        Abbrechen
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        aria-label={`Textbaustein ${clause.title} endgültig löschen`}
                    >
                        {isDeleting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                        ) : (
                            <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
                        )}
                        Endgültig löschen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
