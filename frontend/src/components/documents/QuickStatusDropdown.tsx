/**
 * QuickStatusDropdown — Inline status action dropdown for document rows.
 *
 * Two-section menu:
 *   1. Pipeline-Stage-Wechsel (Zur Freigabe, Versendet, Rücksendung erwartet, Abschließen, Archivieren)
 *   2. Schnellaktionen (Wiedervorlage, Notiz)
 *
 * Stage-Wechsel nutzen den `/repository/{id}/stage` Endpoint,
 * Schnellaktionen den `/documents/{id}/actions` Endpoint.
 */

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    ChevronDown,
    ShieldCheck,
    Send,
    RotateCcw,
    CheckCircle,
    Archive,
    Calendar,
    StickyNote,
    Loader2,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

interface QuickStatusDropdownProps {
    documentId: number;
    currentStage?: string;
}

// ── Stage actions — use /repository/{id}/stage endpoint ──────────────────

interface StageAction {
    targetStage: string;
    label: string;
    icon: typeof Send;
    color: string;
    needsDialog?: "due_date" | "note";
}

const STAGE_ACTIONS: StageAction[] = [
    { targetStage: "freigabe", label: "Zur Freigabe senden", icon: ShieldCheck, color: "text-purple-600" },
    { targetStage: "versendet", label: "Als versendet markieren", icon: Send, color: "text-blue-600", needsDialog: "note" },
    { targetStage: "ruecklauf", label: "Rücksendung erwartet", icon: RotateCcw, color: "text-orange-600", needsDialog: "due_date" },
    { targetStage: "abgeschlossen", label: "Abschließen", icon: CheckCircle, color: "text-green-600" },
    { targetStage: "archiv", label: "Archivieren", icon: Archive, color: "text-warm-500" },
];

// ── Quick actions — use /documents/{id}/actions endpoint ─────────────────

const QUICK_ACTIONS = [
    { type: "reminder_set", label: "Wiedervorlage", icon: Calendar, needsDialog: "due_date" as const },
    { type: "note", label: "Notiz hinzufügen", icon: StickyNote, needsDialog: "note" as const },
] as const;

export function QuickStatusDropdown({ documentId, currentStage }: QuickStatusDropdownProps) {
    const [open, setOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<"due_date" | "note" | null>(null);
    const [pendingAction, setPendingAction] = useState<{ type: "stage"; target: string } | { type: "action"; actionType: string } | null>(null);
    const [dueDate, setDueDate] = useState("");
    const [noteText, setNoteText] = useState("");
    const queryClient = useQueryClient();

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ["repository"] });
        queryClient.invalidateQueries({ queryKey: ["repository-stats"] });
        queryClient.invalidateQueries({ queryKey: ["kanban"] });
    };

    // Stage change mutation
    const stageChange = useMutation({
        mutationFn: async ({ target, note, metadata }: { target: string; note?: string; metadata?: Record<string, string> }) => {
            return api.patch(`/api/v1/repository/${documentId}/stage`, {
                target_stage: target,
                note: note || undefined,
                metadata: metadata || undefined,
            });
        },
        onSuccess: () => {
            invalidateAll();
            resetAndClose();
            toast.success("Status aktualisiert");
        },
        onError: () => {
            toast.error("Status konnte nicht geändert werden");
        },
    });

    // Quick action mutation
    const createAction = useMutation({
        mutationFn: async ({ actionType, note, dueDate: dd }: { actionType: string; note?: string; dueDate?: string }) => {
            return api.post(`/api/v1/documents/${documentId}/actions`, {
                action_type: actionType,
                note: note || undefined,
                due_date: dd || undefined,
            });
        },
        onSuccess: () => {
            invalidateAll();
            resetAndClose();
            toast.success("Aktion erstellt");
        },
        onError: () => {
            toast.error("Aktion konnte nicht erstellt werden");
        },
    });

    const isPending = stageChange.isPending || createAction.isPending;

    const resetAndClose = () => {
        setOpen(false);
        setDialogMode(null);
        setPendingAction(null);
        setDueDate("");
        setNoteText("");
    };

    const handleStageClick = (action: StageAction) => {
        if (action.needsDialog) {
            setDialogMode(action.needsDialog);
            setPendingAction({ type: "stage", target: action.targetStage });
        } else {
            stageChange.mutate({ target: action.targetStage });
        }
    };

    const handleQuickAction = (actionType: string, needsDialog?: "due_date" | "note") => {
        if (needsDialog) {
            setDialogMode(needsDialog);
            setPendingAction({ type: "action", actionType });
        } else {
            createAction.mutate({ actionType });
        }
    };

    const confirmDialog = () => {
        if (!pendingAction) return;

        if (pendingAction.type === "stage") {
            const metadata: Record<string, string> = {};
            if (dueDate) metadata.due_date = dueDate;
            stageChange.mutate({
                target: pendingAction.target,
                note: noteText || undefined,
                metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            });
        } else {
            createAction.mutate({
                actionType: pendingAction.actionType,
                note: noteText || undefined,
                dueDate: dueDate || undefined,
            });
        }
    };

    // Filter out current stage from available actions
    const availableStageActions = STAGE_ACTIONS.filter(
        (a) => a.targetStage !== (currentStage || "entwurf")
    );

    return (
        <Popover open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else setOpen(true); }}>
            <PopoverTrigger asChild>
                <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-xs h-7"
                    onClick={(e) => e.stopPropagation()}
                >
                    Status <ChevronDown className="w-3 h-3" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1" align="end" onClick={(e) => e.stopPropagation()}>
                {dialogMode ? (
                    /* ── Inline Dialog ─────────────────────────── */
                    <div className="p-2 space-y-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {dialogMode === "due_date" ? "Frist setzen" : "Notiz hinzufügen"}
                        </p>
                        {dialogMode === "due_date" && (
                            <Input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="h-8 text-sm"
                                min={new Date().toISOString().split("T")[0]}
                            />
                        )}
                        <Textarea
                            placeholder={dialogMode === "due_date" ? "Optionale Notiz..." : "Notiz eingeben..."}
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            rows={2}
                            className="text-sm resize-none"
                        />
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="flex-1 h-7 text-xs"
                                onClick={() => { setDialogMode(null); setPendingAction(null); }}
                                disabled={isPending}
                            >
                                Zurück
                            </Button>
                            <Button
                                size="sm"
                                className="flex-1 h-7 text-xs"
                                onClick={confirmDialog}
                                disabled={isPending || (dialogMode === "due_date" && !dueDate && !noteText) || (dialogMode === "note" && !noteText)}
                            >
                                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Bestätigen"}
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* ── Menu ──────────────────────────────────── */
                    <>
                        {/* Stage Transitions */}
                        <div className="py-1">
                            <p className="px-3 py-1 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                                Stage wechseln
                            </p>
                            {availableStageActions.map((a) => (
                                <button
                                    key={a.targetStage}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-warm-50 transition-colors disabled:opacity-50"
                                    disabled={isPending}
                                    onClick={() => handleStageClick(a)}
                                >
                                    <a.icon className={`w-3.5 h-3.5 ${a.color}`} />
                                    {a.label}
                                </button>
                            ))}
                        </div>

                        {/* Separator */}
                        <div className="mx-2 my-1 border-t border-warm-100" />

                        {/* Quick Actions */}
                        <div className="py-1">
                            <p className="px-3 py-1 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                                Schnellaktionen
                            </p>
                            {QUICK_ACTIONS.map((a) => (
                                <button
                                    key={a.type}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-warm-50 transition-colors disabled:opacity-50"
                                    disabled={isPending}
                                    onClick={() => handleQuickAction(a.type, a.needsDialog)}
                                >
                                    <a.icon className="w-3.5 h-3.5 text-muted-foreground" />
                                    {a.label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </PopoverContent>
        </Popover>
    );
}
