/**
 * PostExportActions — Lifecycle actions shown after first successful export.
 *
 * Appears in the ActionBar below export buttons once `lastExportedDocumentId` is set.
 * Provides quick access to common post-export workflow transitions:
 *  - Als versendet markieren (→ versendet)
 *  - Wiedervorlage setzen (→ reminder_set action)
 *  - Zur Freigabe senden (→ freigabe)
 *  - Abschließen (→ abgeschlossen)
 *
 * Uses POST /documents/{id}/actions for events and PATCH /repository/{id}/stage
 * for pipeline_stage transitions (same endpoint as Kanban drag-and-drop).
 */

import { useState, useCallback } from "react";
import {
    Send,
    CalendarClock,
    ShieldCheck,
    CheckCircle,
    Loader2,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api-client";
import { useMoveDocument } from "@/hooks/api/useKanbanQueries";
import { useToast } from "@/components/ui/toast";

// ── Types ────────────────────────────────────────────────────────────────

type ActionKey = "sent" | "reminder" | "approval" | "completed";

interface PostExportActionsProps {
    documentId: number;
}

// ── Helper ───────────────────────────────────────────────────────────────

function toDateInputValue(date: Date): string {
    return date.toISOString().slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════════════

export function PostExportActions({ documentId }: PostExportActionsProps) {
    const toast = useToast();
    const moveMutation = useMoveDocument();

    const [completedActions, setCompletedActions] = useState<Set<ActionKey>>(new Set());
    const [loadingAction, setLoadingAction] = useState<ActionKey | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);

    // Wiedervorlage popover state
    const [reminderDate, setReminderDate] = useState(
        toDateInputValue(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))
    );
    const [reminderOpen, setReminderOpen] = useState(false);

    // Versendet popover state
    const [sendMethod, setSendMethod] = useState("post");
    const [sendOpen, setSendOpen] = useState(false);

    const markDone = useCallback((key: ActionKey) => {
        setCompletedActions((prev) => new Set(prev).add(key));
    }, []);

    // ── Action: Als versendet markieren ──────────────────────────────────
    const handleMarkSent = useCallback(async () => {
        setLoadingAction("sent");
        try {
            // 1. Create the "sent" DocumentAction event
            await api.post(`/api/v1/documents/${documentId}/actions`, {
                action_type: "sent",
                note: `Versandart: ${sendMethod}`,
                metadata_json: { send_method: sendMethod, send_date: new Date().toISOString() },
            });
            // 2. Move pipeline_stage to "versendet"
            await moveMutation.mutateAsync({
                documentId,
                targetStage: "versendet",
                metadata: { send_method: sendMethod },
            });
            markDone("sent");
            setSendOpen(false);
            toast.success("Als versendet markiert");
        } catch {
            toast.error("Fehler", "Versand konnte nicht markiert werden");
        } finally {
            setLoadingAction(null);
        }
    }, [documentId, sendMethod, moveMutation, markDone, toast]);

    // ── Action: Wiedervorlage setzen ─────────────────────────────────────
    const handleSetReminder = useCallback(async () => {
        setLoadingAction("reminder");
        try {
            const dueDate = new Date(reminderDate);
            dueDate.setHours(9, 0, 0, 0); // 09:00 Uhr

            await api.post(`/api/v1/documents/${documentId}/actions`, {
                action_type: "reminder_set",
                note: `Wiedervorlage am ${new Date(reminderDate).toLocaleDateString("de-DE")}`,
                due_date: dueDate.toISOString(),
            });
            markDone("reminder");
            setReminderOpen(false);
            toast.success("Wiedervorlage gesetzt", `Erinnerung am ${new Date(reminderDate).toLocaleDateString("de-DE")}`);
        } catch {
            toast.error("Fehler", "Wiedervorlage konnte nicht gesetzt werden");
        } finally {
            setLoadingAction(null);
        }
    }, [documentId, reminderDate, markDone, toast]);

    // ── Action: Zur Freigabe senden ──────────────────────────────────────
    const handleRequestApproval = useCallback(async () => {
        setLoadingAction("approval");
        try {
            await api.post(`/api/v1/documents/${documentId}/actions`, {
                action_type: "approval_requested",
                note: "Freigabe über Generator angefragt",
            });
            await moveMutation.mutateAsync({
                documentId,
                targetStage: "freigabe",
            });
            markDone("approval");
            toast.success("Freigabe angefragt");
        } catch {
            toast.error("Fehler", "Freigabe konnte nicht angefragt werden");
        } finally {
            setLoadingAction(null);
        }
    }, [documentId, moveMutation, markDone, toast]);

    // ── Action: Abschließen ──────────────────────────────────────────────
    const handleComplete = useCallback(async () => {
        setLoadingAction("completed");
        try {
            await api.post(`/api/v1/documents/${documentId}/actions`, {
                action_type: "completed",
                note: "Über Generator abgeschlossen",
            });
            await moveMutation.mutateAsync({
                documentId,
                targetStage: "abgeschlossen",
            });
            markDone("completed");
            toast.success("Dokument abgeschlossen");
        } catch {
            toast.error("Fehler", "Abschließen fehlgeschlagen");
        } finally {
            setLoadingAction(null);
        }
    }, [documentId, moveMutation, markDone, toast]);

    // ── Render helpers ───────────────────────────────────────────────────
    const isDone = (key: ActionKey) => completedActions.has(key);
    const isLoading = (key: ActionKey) => loadingAction === key;
    const isDisabled = (key: ActionKey) => isDone(key) || loadingAction !== null;

    const ActionIcon = ({ actionKey, Icon }: { actionKey: ActionKey; Icon: typeof Send }) => {
        if (isLoading(actionKey)) return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
        if (isDone(actionKey)) return <CheckCircle className="w-3.5 h-3.5 text-green-600" />;
        return <Icon className="w-3.5 h-3.5" />;
    };

    return (
        <div className="border-t border-warm-200 dark:border-warm-700 pt-2.5">
            {/* Section header — collapsible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between w-full text-[11px] font-medium text-foreground/40 uppercase tracking-wider px-1 mb-2 hover:text-foreground/60 transition-colors"
            >
                <span>Nach dem Export</span>
                {isExpanded ? (
                    <ChevronUp className="w-3 h-3" />
                ) : (
                    <ChevronDown className="w-3 h-3" />
                )}
            </button>

            {isExpanded && (
                <div className="space-y-1">
                    {/* Als versendet markieren — with popover for method */}
                    <Popover open={sendOpen} onOpenChange={setSendOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start gap-2 h-8 text-xs font-normal"
                                disabled={isDisabled("sent")}
                            >
                                <ActionIcon actionKey="sent" Icon={Send} />
                                {isDone("sent") ? "Versendet" : "Als versendet markieren"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent side="right" align="start" className="w-56 p-3 space-y-3">
                            <p className="text-xs font-medium">Versandart</p>
                            <select
                                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={sendMethod}
                                onChange={(e) => setSendMethod(e.target.value)}
                            >
                                <option value="post">Post</option>
                                <option value="email">E-Mail</option>
                                <option value="persoenlich">Persönlich</option>
                                <option value="intern">Intern</option>
                            </select>
                            <Button
                                size="sm"
                                className="w-full h-7 text-xs"
                                onClick={handleMarkSent}
                                disabled={isLoading("sent")}
                            >
                                {isLoading("sent") && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                                Bestätigen
                            </Button>
                        </PopoverContent>
                    </Popover>

                    {/* Wiedervorlage setzen — with popover for date */}
                    <Popover open={reminderOpen} onOpenChange={setReminderOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start gap-2 h-8 text-xs font-normal"
                                disabled={isDisabled("reminder")}
                            >
                                <ActionIcon actionKey="reminder" Icon={CalendarClock} />
                                {isDone("reminder") ? "Wiedervorlage gesetzt" : "Wiedervorlage setzen"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent side="right" align="start" className="w-56 p-3 space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Datum</Label>
                                <Input
                                    type="date"
                                    className="h-8 text-xs"
                                    value={reminderDate}
                                    onChange={(e) => setReminderDate(e.target.value)}
                                />
                                <p className="text-[10px] text-muted-foreground">Standard: 14 Tage</p>
                            </div>
                            <Button
                                size="sm"
                                className="w-full h-7 text-xs"
                                onClick={handleSetReminder}
                                disabled={isLoading("reminder")}
                            >
                                {isLoading("reminder") && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                                Setzen
                            </Button>
                        </PopoverContent>
                    </Popover>

                    {/* Zur Freigabe senden — direct action */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 h-8 text-xs font-normal"
                        disabled={isDisabled("approval")}
                        onClick={handleRequestApproval}
                    >
                        <ActionIcon actionKey="approval" Icon={ShieldCheck} />
                        {isDone("approval") ? "Freigabe angefragt" : "Zur Freigabe senden"}
                    </Button>

                    {/* Abschließen — direct action */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 h-8 text-xs font-normal"
                        disabled={isDisabled("completed")}
                        onClick={handleComplete}
                    >
                        <ActionIcon actionKey="completed" Icon={CheckCircle} />
                        {isDone("completed") ? "Abgeschlossen" : "Abschließen"}
                    </Button>
                </div>
            )}
        </div>
    );
}
