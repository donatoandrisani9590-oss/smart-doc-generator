/**
 * ExportSuccessModal - Magic Moment nach erfolgreichem Export
 *
 * Feiert den Erfolg des Users mit:
 * - Animierter Checkmark
 * - Subtle Celebration Animation
 * - Lifecycle Quick-Actions (Versand markieren, Wiedervorlage, Genehmigung)
 * - Hinweis auf automatische Speicherung in Meine Dokumente
 * - "Zu Meine Dokumente" Button
 * - Download-Buttons
 *
 * v3.0: + Document Lifecycle Actions nach Export (Phase 3)
 */

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle, FileText, FileType2, X, Sparkles, FolderOpen, PlusCircle,
    Send, CalendarClock, ShieldCheck, Loader2,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

interface ExportSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    documentTitle: string;
    exportFormat: "pdf" | "docx";
    documentId?: number | null;
    onDownloadAgain?: (format: "pdf" | "docx") => void;
    onGoToDocuments?: () => void;
}

type QuickActionKey = "sent" | "reminder_set" | "approval_requested";

const QUICK_ACTIONS: Array<{
    key: QuickActionKey;
    label: string;
    description: string;
    icon: typeof Send;
    actionType: string;
}> = [
    {
        key: "sent",
        label: "Als versendet markieren",
        description: "Dokument wurde an Mitarbeiter gesendet",
        icon: Send,
        actionType: "sent",
    },
    {
        key: "reminder_set",
        label: "Wiedervorlage setzen",
        description: "In 14 Tagen erinnern",
        icon: CalendarClock,
        actionType: "reminder_set",
    },
    {
        key: "approval_requested",
        label: "Genehmigung anfragen",
        description: "Zur Freigabe vorlegen",
        icon: ShieldCheck,
        actionType: "approval_requested",
    },
];

export const ExportSuccessModal = ({
    isOpen,
    onClose,
    documentTitle,
    exportFormat,
    documentId,
    onDownloadAgain,
    onGoToDocuments,
}: ExportSuccessModalProps) => {
    const [showConfetti, setShowConfetti] = useState(false);
    const [completedActions, setCompletedActions] = useState<Set<QuickActionKey>>(new Set());
    const [loadingAction, setLoadingAction] = useState<QuickActionKey | null>(null);
    const toast = useToast();

    useEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: trigger confetti animation when modal opens
            setShowConfetti(true);
            setCompletedActions(new Set());
            const timer = setTimeout(() => setShowConfetti(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleQuickAction = useCallback(async (action: typeof QUICK_ACTIONS[number]) => {
        if (!documentId || loadingAction) return;

        setLoadingAction(action.key);
        try {
            const payload: Record<string, unknown> = {
                action_type: action.actionType,
                note: action.description,
            };

            // Add a 14-day due date for reminders
            if (action.key === "reminder_set") {
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 14);
                payload.due_date = dueDate.toISOString();
            }

            await api.post(`/api/v1/documents/${documentId}/actions`, payload);

            setCompletedActions(prev => new Set(prev).add(action.key));
            toast.success("Aktion gespeichert", action.label);
        } catch {
            toast.error("Fehler", "Aktion konnte nicht gespeichert werden");
        } finally {
            setLoadingAction(null);
        }
    }, [documentId, loadingAction, toast]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="sr-only">
                    <DialogTitle>Export erfolgreich</DialogTitle>
                </DialogHeader>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Schließen</span>
                </button>

                <div className="flex flex-col items-center text-center py-6">
                    {/* Animated Checkmark with Sparkles */}
                    <div className="relative mb-6">
                        <AnimatePresence>
                            {showConfetti && (
                                <>
                                    {[...Array(6)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            className="absolute"
                                            initial={{
                                                opacity: 0,
                                                scale: 0,
                                                x: 0,
                                                y: 0,
                                            }}
                                            animate={{
                                                opacity: [0, 1, 0],
                                                scale: [0, 1, 0.5],
                                                x: Math.cos((i * 60 * Math.PI) / 180) * 50,
                                                y: Math.sin((i * 60 * Math.PI) / 180) * 50,
                                            }}
                                            transition={{
                                                duration: 1,
                                                delay: i * 0.1,
                                                ease: "easeOut",
                                            }}
                                        >
                                            <Sparkles className="w-4 h-4 text-yellow-500" />
                                        </motion.div>
                                    ))}
                                </>
                            )}
                        </AnimatePresence>

                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{
                                type: "spring",
                                stiffness: 260,
                                damping: 20,
                                delay: 0.1,
                            }}
                            className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.3, type: "spring" }}
                            >
                                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                            </motion.div>
                        </motion.div>
                    </div>

                    {/* Success Message */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <h2 className="text-xl font-semibold text-foreground mb-2">
                            Dokument erstellt!
                        </h2>
                        <p className="text-sm text-muted-foreground mb-1">
                            <span className="font-medium text-foreground">{documentTitle || "Dokument"}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                            wurde als {exportFormat.toUpperCase()} heruntergeladen und in Meine Dokumente gespeichert
                        </p>
                    </motion.div>

                    {/* Saved confirmation */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg w-full"
                    >
                        <div className="flex items-center justify-center gap-2 text-sm text-green-700 dark:text-green-400">
                            <FolderOpen className="w-4 h-4" />
                            <span>
                                Automatisch in <span className="font-medium">Meine Dokumente</span> gespeichert
                            </span>
                        </div>
                    </motion.div>

                    {/* Lifecycle Quick Actions (Phase 3) */}
                    {documentId && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 }}
                            className="mt-5 w-full"
                        >
                            <p className="text-[11px] font-medium text-foreground/40 uppercase tracking-wider mb-2.5">
                                Nächste Schritte
                            </p>
                            <div className="space-y-1.5">
                                {QUICK_ACTIONS.map((action) => {
                                    const Icon = action.icon;
                                    const isDone = completedActions.has(action.key);
                                    const isLoading = loadingAction === action.key;

                                    return (
                                        <button
                                            key={action.key}
                                            onClick={() => handleQuickAction(action)}
                                            disabled={isDone || isLoading}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-foreground/[0.03] active:bg-foreground/[0.06] disabled:opacity-60 disabled:cursor-default group"
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isDone ? "bg-green-100 dark:bg-green-900/30" : "bg-foreground/[0.04] group-hover:bg-foreground/[0.07]"}`}>
                                                {isLoading ? (
                                                    <Loader2 className="w-4 h-4 animate-spin text-foreground/40" />
                                                ) : isDone ? (
                                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                                ) : (
                                                    <Icon className="w-4 h-4 text-foreground/50" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className={`text-[13px] font-medium ${isDone ? "text-green-700 dark:text-green-400" : "text-foreground"}`}>
                                                    {isDone ? "Erledigt" : action.label}
                                                </span>
                                                {!isDone && (
                                                    <p className="text-[11px] text-foreground/40 mt-0.5">
                                                        {action.description}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* Action Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: documentId ? 1.0 : 0.8 }}
                        className="mt-6 w-full space-y-3"
                    >
                        {/* Primary: Zu Meine Dokumente */}
                        {onGoToDocuments && (
                            <Button
                                variant="default"
                                className="w-full gap-2"
                                onClick={onGoToDocuments}
                            >
                                <FolderOpen className="w-4 h-4" />
                                Zu Meine Dokumente
                            </Button>
                        )}

                        {/* Secondary: Download in anderem Format */}
                        {onDownloadAgain && (
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="outline"
                                    className="gap-2"
                                    onClick={() => onDownloadAgain("pdf")}
                                >
                                    <FileText className="w-4 h-4" />
                                    PDF
                                </Button>
                                <Button
                                    variant="outline"
                                    className="gap-2"
                                    onClick={() => onDownloadAgain("docx")}
                                >
                                    <FileType2 className="w-4 h-4" />
                                    DOCX
                                </Button>
                            </div>
                        )}

                        {/* Tertiary: Neues Dokument oder Schließen */}
                        <Button
                            variant="ghost"
                            className="w-full gap-2 text-muted-foreground"
                            onClick={onClose}
                        >
                            <PlusCircle className="w-4 h-4" />
                            Weiteres Dokument erstellen
                        </Button>
                    </motion.div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ExportSuccessModal;
