/**
 * PlaceholderValidationWarning
 *
 * Displays a warning dialog when unknown placeholders are found in clause content.
 * Shows suggestions for similar placeholders (typo correction).
 */

import { AlertTriangle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface UnknownPlaceholder {
    name: string;
    suggestions: string[];
    suggestion_labels: string[];
}

interface PlaceholderValidationWarningProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    unknownPlaceholders: UnknownPlaceholder[];
    onAcceptSuggestion: (oldName: string, newName: string) => void;
    onIgnoreAll: () => void;
    onCancel: () => void;
}

export const PlaceholderValidationWarning = ({
    open,
    onOpenChange,
    unknownPlaceholders,
    onAcceptSuggestion,
    onIgnoreAll,
    onCancel,
}: PlaceholderValidationWarningProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="w-5 h-5" />
                        Unbekannte Platzhalter gefunden
                    </DialogTitle>
                    <DialogDescription>
                        Die folgenden Platzhalter existieren nicht im System.
                        Möglicherweise handelt es sich um Tippfehler.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-4 max-h-[300px] overflow-y-auto">
                    {unknownPlaceholders.map((placeholder) => (
                        <div
                            key={placeholder.name}
                            className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/20"
                        >
                            <div className="flex items-center justify-between">
                                <code className="text-sm font-mono text-amber-700 dark:text-amber-400">
                                    {"{{ "}
                                    {placeholder.name}
                                    {" }}"}
                                </code>
                            </div>

                            {placeholder.suggestions.length > 0 ? (
                                <div className="mt-2">
                                    <p className="text-xs text-muted-foreground mb-1">
                                        Meinten Sie:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {placeholder.suggestions.map((suggestion, index) => (
                                            <Button
                                                key={suggestion}
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs gap-1 hover:bg-green-50 hover:border-green-500 hover:text-green-700"
                                                onClick={() =>
                                                    onAcceptSuggestion(placeholder.name, suggestion)
                                                }
                                            >
                                                <Check className="w-3 h-3" />
                                                {placeholder.suggestion_labels[index] || suggestion}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Keine ähnlichen Platzhalter gefunden.
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="ghost" onClick={onCancel} className="gap-1">
                        <X className="w-4 h-4" />
                        Abbrechen
                    </Button>
                    <Button
                        variant="outline"
                        onClick={onIgnoreAll}
                        className="text-amber-600 border-amber-300 hover:bg-amber-50"
                    >
                        Trotzdem speichern
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
