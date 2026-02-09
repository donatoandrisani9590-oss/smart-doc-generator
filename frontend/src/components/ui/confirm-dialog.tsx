/**
 * ConfirmDialog - Wiederverwendbarer Bestätigungsdialog
 *
 * Für destruktive Aktionen (Löschen, Entfernen, Zurücksetzen).
 */

import { useState } from "react";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    /** Optional warning text shown in a highlighted box */
    warning?: string;
    /** Button label (default: "Löschen") */
    confirmLabel?: string;
    /** Button variant (default: "destructive") */
    confirmVariant?: "destructive" | "default";
    /** Async callback - dialog shows loading state until resolved */
    onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    warning,
    confirmLabel = "Löschen",
    confirmVariant = "destructive",
    onConfirm,
}: ConfirmDialogProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            await onConfirm();
            onOpenChange(false);
        } catch {
            // Error handling done by caller (toast etc.)
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        {confirmVariant === "destructive" && (
                            <Trash2 className="h-5 w-5 text-destructive" />
                        )}
                        {title}
                    </AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>

                {warning && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <p className="text-sm text-destructive">{warning}</p>
                    </div>
                )}

                <AlertDialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                    >
                        Abbrechen
                    </Button>
                    <Button
                        variant={confirmVariant}
                        onClick={handleConfirm}
                        disabled={isLoading}
                    >
                        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {confirmLabel}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
