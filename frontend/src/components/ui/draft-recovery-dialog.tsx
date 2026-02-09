/**
 * DraftRecoveryDialog - Dialog zur Wiederherstellung von Auto-Saved Drafts
 *
 * Wird angezeigt wenn ein nicht gespeicherter Entwurf im localStorage gefunden wird.
 * Bietet dem Benutzer die Wahl:
 * - Entwurf wiederherstellen
 * - Entwurf verwerfen und neu beginnen
 */

import { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    FileText,
    Clock,
    RotateCcw,
    Trash2,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    History,
    Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

// ============================================================================
// TYPES
// ============================================================================

export interface DraftInfo {
    /** Storage key for the draft */
    key: string;
    /** Timestamp when the draft was saved */
    timestamp: string;
    /** Draft data */
    data: unknown;
    /** Human-readable description (e.g., document title) */
    title?: string;
    /** Document type if available */
    documentType?: string;
}

export interface DraftRecoveryDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Callback when dialog closes */
    onOpenChange: (open: boolean) => void;
    /** Draft information to display */
    draft: DraftInfo | null;
    /** Callback when user chooses to recover the draft */
    onRecover: () => void;
    /** Callback when user chooses to discard the draft */
    onDiscard: () => void;
    /** Optional: Show preview of draft contents */
    showPreview?: boolean;
    /** Optional: Custom title for the dialog */
    title?: string;
    /** Optional: Custom description for the dialog */
    description?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a timestamp for display
 */
const formatTimestamp = (timestamp: string): string => {
    try {
        const date = new Date(timestamp);
        return formatDistanceToNow(date, { addSuffix: true, locale: de });
    } catch {
        return "Unbekanntes Datum";
    }
};

// formatFullTimestamp is available for future detailed timestamp display
// Currently using formatTimestamp for relative time display

/**
 * Get a summary of draft data for preview
 */
const getDraftSummary = (data: unknown): string[] => {
    if (!data || typeof data !== "object") return [];

    const summary: string[] = [];
    const obj = data as Record<string, unknown>;

    // Common field mappings
    const fieldLabels: Record<string, string> = {
        vorname: "Vorname",
        nachname: "Nachname",
        position: "Position",
        gehalt: "Gehalt",
        eintrittsdatum: "Eintrittsdatum",
        documentTitle: "Dokumenttitel",
        title: "Titel",
    };

    Object.entries(fieldLabels).forEach(([key, label]) => {
        if (obj[key] && typeof obj[key] === "string" && (obj[key] as string).trim()) {
            summary.push(`${label}: ${obj[key]}`);
        }
    });

    return summary.slice(0, 5); // Max 5 items
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DraftRecoveryDialog({
    open,
    onOpenChange,
    draft,
    onRecover,
    onDiscard,
    showPreview = true,
    title = "Entwurf gefunden",
    description = "Ein nicht gespeicherter Entwurf wurde gefunden. Möchten Sie diesen wiederherstellen?",
}: DraftRecoveryDialogProps) {
    const [showDetails, setShowDetails] = useState(false);
    const [confirmDiscard, setConfirmDiscard] = useState(false);

    // Reset details state when dialog opens
    useEffect(() => {
        if (open) {
            // Use setTimeout to avoid synchronous setState warning
            const timer = setTimeout(() => {
                setShowDetails(false);
                setConfirmDiscard(false);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [open]);

    // Get draft summary for preview
    const draftSummary = useMemo(() => {
        if (!draft?.data) return [];
        return getDraftSummary(draft.data);
    }, [draft]);

    if (!draft) return null;

    const handleRecover = () => {
        onRecover();
        onOpenChange(false);
    };

    const handleDiscardClick = () => {
        setConfirmDiscard(true);
    };

    const handleConfirmDiscard = () => {
        onDiscard();
        setConfirmDiscard(false);
        onOpenChange(false);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" />
                            {title}
                        </DialogTitle>
                        <DialogDescription>{description}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Draft Info Card */}
                        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                            {/* Title */}
                            {draft.title && (
                                <div className="flex items-start gap-2">
                                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium">
                                            {draft.title}
                                        </p>
                                        {draft.documentType && (
                                            <Badge variant="secondary" className="mt-1 text-xs">
                                                {draft.documentType}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Timestamp */}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>
                                    Gespeichert {formatTimestamp(draft.timestamp)}
                                </span>
                            </div>

                            {/* Toggle Details */}
                            {showPreview && draftSummary.length > 0 && (
                                <>
                                    <Separator />
                                    <button
                                        type="button"
                                        onClick={() => setShowDetails(!showDetails)}
                                        className="flex items-center gap-2 text-sm text-primary hover:underline w-full"
                                    >
                                        {showDetails ? (
                                            <>
                                                <ChevronUp className="h-4 w-4" />
                                                Details ausblenden
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown className="h-4 w-4" />
                                                Details anzeigen
                                            </>
                                        )}
                                    </button>

                                    {showDetails && (
                                        <div className="space-y-2 pt-2">
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                Inhalt (Vorschau)
                                            </p>
                                            <ScrollArea className="max-h-32">
                                                <ul className="space-y-1 text-sm">
                                                    {draftSummary.map((item, index) => (
                                                        <li
                                                            key={index}
                                                            className="flex items-center gap-2 text-muted-foreground"
                                                        >
                                                            <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </ScrollArea>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Storage Info */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Database className="h-3.5 w-3.5" />
                            <span>
                                Lokal im Browser gespeichert
                            </span>
                        </div>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            variant="outline"
                            onClick={handleDiscardClick}
                            className="sm:order-1"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Verwerfen
                        </Button>
                        <Button
                            onClick={handleRecover}
                            className="sm:order-2"
                        >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Wiederherstellen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Discard Dialog */}
            <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Entwurf verwerfen?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Dieser Vorgang kann nicht rückgängig gemacht werden. Der gespeicherte Entwurf
                            wird dauerhaft gelöscht und alle nicht gespeicherten Änderungen gehen verloren.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDiscard}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Endgueltig verwerfen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

// ============================================================================
// SIMPLE RECOVERY BANNER
// ============================================================================

export interface DraftRecoveryBannerProps {
    /** Whether a draft is available */
    hasDraft: boolean;
    /** Draft timestamp */
    timestamp?: string;
    /** Callback when user clicks recover */
    onRecover: () => void;
    /** Callback when user clicks dismiss */
    onDismiss: () => void;
    /** Additional className */
    className?: string;
}

export function DraftRecoveryBanner({
    hasDraft,
    timestamp,
    onRecover,
    onDismiss,
    className,
}: DraftRecoveryBannerProps) {
    if (!hasDraft) return null;

    return (
        <div
            className={cn(
                "flex items-center justify-between gap-4 px-4 py-3 rounded-lg border",
                "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
                className
            )}
        >
            <div className="flex items-center gap-3">
                <History className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Nicht gespeicherter Entwurf gefunden
                    </p>
                    {timestamp && (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                            {formatTimestamp(timestamp)}
                        </p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDismiss}
                    className="text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300 dark:hover:text-amber-100 dark:hover:bg-amber-900"
                >
                    Verwerfen
                </Button>
                <Button
                    size="sm"
                    onClick={onRecover}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Wiederherstellen
                </Button>
            </div>
        </div>
    );
}

export default DraftRecoveryDialog;
