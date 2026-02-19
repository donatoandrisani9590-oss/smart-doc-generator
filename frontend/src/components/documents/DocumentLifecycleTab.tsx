/**
 * DocumentLifecycleTab - Verwaltungs-Tab fuer die Dokument-Detailseite
 *
 * Zeigt den aktuellen Workflow-Status, Quick-Action-Buttons und eine
 * chronologische Timeline aller Aktionen (erstellt, versendet, etc.).
 *
 * API:
 *   GET    /api/v1/documents/{id}/actions     -> { actions, total }
 *   POST   /api/v1/documents/{id}/actions     -> ActionResponse (201)
 *   PATCH  /api/v1/documents/{id}/actions/{a} -> ActionResponse
 */

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import {
    FilePlus,
    Send,
    RotateCcw,
    PackageCheck,
    ShieldCheck,
    ThumbsUp,
    ThumbsDown,
    StickyNote,
    CheckCircle,
    CalendarClock,
    CalendarCheck,
    FileText,
    Clock,
    Loader2,
    Check,
    X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

import { api, isApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ActionResponse {
    id: number;
    document_id: number;
    action_type: string;
    performed_by_id: number | null;
    performed_by_name: string | null;
    performed_at: string | null;
    note: string | null;
    metadata_json: Record<string, unknown> | null;
    due_date: string | null;
    is_completed: boolean;
    completed_at: string | null;
}

interface ActionsListResponse {
    actions: ActionResponse[];
    total: number;
}

interface DocumentLifecycleTabProps {
    documentId: number;
}

// Lazy-load GuestLinkManager to keep initial bundle lean
const GuestLinkManager = lazy(() =>
    import("./GuestLinkManager").then(m => ({ default: m.GuestLinkManager }))
);

// ═══════════════════════════════════════════════════════════════════════════
// ACTION TYPE CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const ACTION_LABELS: Record<string, { label: string; icon: LucideIcon; color: string }> = {
    created: { label: "Erstellt", icon: FilePlus, color: "text-foreground/60" },
    sent: { label: "Versendet", icon: Send, color: "text-blue-600" },
    return_pending: { label: "Rücksendung angefordert", icon: RotateCcw, color: "text-amber-600" },
    returned: { label: "Zurückgekommen", icon: PackageCheck, color: "text-green-600" },
    approval_requested: { label: "Genehmigung angefragt", icon: ShieldCheck, color: "text-amber-600" },
    approved: { label: "Genehmigt", icon: ThumbsUp, color: "text-green-600" },
    rejected: { label: "Abgelehnt", icon: ThumbsDown, color: "text-red-600" },
    note: { label: "Notiz", icon: StickyNote, color: "text-foreground/60" },
    completed: { label: "Abgeschlossen", icon: CheckCircle, color: "text-green-600" },
    reminder_set: { label: "Wiedervorlage", icon: CalendarClock, color: "text-purple-600" },
    reminder_done: { label: "Wiedervorlage erledigt", icon: CalendarCheck, color: "text-green-600" },
};

function getActionConfig(actionType: string) {
    return (
        ACTION_LABELS[actionType] ?? {
            label: actionType,
            icon: FileText,
            color: "text-foreground/60",
        }
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS BANNER CONFIG
// ═══════════════════════════════════════════════════════════════════════════

type WorkflowStatus = "erstellt" | "in_bearbeitung" | "abgeschlossen";

const STATUS_CONFIG: Record<
    WorkflowStatus,
    { label: string; icon: LucideIcon; bg: string; text: string; dot: string }
> = {
    erstellt: {
        label: "Erstellt",
        icon: FileText,
        bg: "bg-foreground/[0.03]",
        text: "text-foreground/70",
        dot: "bg-foreground/30",
    },
    in_bearbeitung: {
        label: "In Bearbeitung",
        icon: Clock,
        bg: "bg-blue-50/60",
        text: "text-blue-700",
        dot: "bg-blue-500",
    },
    abgeschlossen: {
        label: "Abgeschlossen",
        icon: CheckCircle,
        bg: "bg-green-50/60",
        text: "text-green-700",
        dot: "bg-green-500",
    },
};

/**
 * Derive workflow status from the list of actions.
 * - If the most recent action is "completed" -> abgeschlossen
 * - If there are actions beyond "created" -> in_bearbeitung
 * - Otherwise -> erstellt
 */
function deriveStatus(actions: ActionResponse[]): WorkflowStatus {
    if (actions.length === 0) return "erstellt";

    const sorted = [...actions].sort((a, b) => {
        const dateA = a.performed_at ? new Date(a.performed_at).getTime() : 0;
        const dateB = b.performed_at ? new Date(b.performed_at).getTime() : 0;
        return dateB - dateA;
    });

    if (sorted[0].action_type === "completed") return "abgeschlossen";
    if (sorted.some((a) => a.action_type !== "created" && a.action_type !== "note")) {
        return "in_bearbeitung";
    }
    return "erstellt";
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function DocumentLifecycleTab({ documentId }: DocumentLifecycleTabProps) {
    const [actions, setActions] = useState<ActionResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showNoteInput, setShowNoteInput] = useState(false);
    const [noteText, setNoteText] = useState("");
    const noteInputRef = useRef<HTMLTextAreaElement>(null);

    // ── Fetch actions ────────────────────────────────────────────────────

    const fetchActions = useCallback(async () => {
        try {
            const { data } = await api.get<ActionsListResponse>(
                `/api/v1/documents/${documentId}/actions`
            );
            setActions(data.actions);
        } catch (err) {
            if (isApiError(err)) {
                toast.error(`Aktionen konnten nicht geladen werden: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    }, [documentId]);

    useEffect(() => {
        fetchActions();
    }, [fetchActions]);

    // ── Create action ────────────────────────────────────────────────────

    const createAction = useCallback(
        async (
            actionType: string,
            options?: { note?: string; dueDate?: string }
        ) => {
            setIsSubmitting(true);
            try {
                const body: Record<string, unknown> = { action_type: actionType };
                if (options?.note) body.note = options.note;
                if (options?.dueDate) body.due_date = options.dueDate;

                await api.post<ActionResponse>(
                    `/api/v1/documents/${documentId}/actions`,
                    body
                );

                const config = getActionConfig(actionType);
                toast.success(`${config.label} wurde erfasst`);
                await fetchActions();
            } catch (err) {
                if (isApiError(err)) {
                    toast.error(`Aktion fehlgeschlagen: ${err.message}`);
                } else {
                    toast.error("Aktion fehlgeschlagen");
                }
            } finally {
                setIsSubmitting(false);
            }
        },
        [documentId, fetchActions]
    );

    // ── Mark action as completed ─────────────────────────────────────────

    const markCompleted = useCallback(
        async (actionId: number) => {
            setIsSubmitting(true);
            try {
                await api.patch<ActionResponse>(
                    `/api/v1/documents/${documentId}/actions/${actionId}`,
                    { is_completed: true }
                );
                toast.success("Als erledigt markiert");
                await fetchActions();
            } catch (err) {
                if (isApiError(err)) {
                    toast.error(`Fehler: ${err.message}`);
                } else {
                    toast.error("Aktion fehlgeschlagen");
                }
            } finally {
                setIsSubmitting(false);
            }
        },
        [documentId, fetchActions]
    );

    // ── Quick action handlers ────────────────────────────────────────────

    const handleSent = useCallback(
        () => createAction("sent"),
        [createAction]
    );

    const handleReturnPending = useCallback(
        () => createAction("return_pending"),
        [createAction]
    );

    const handleReminder = useCallback(() => {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);
        createAction("reminder_set", {
            dueDate: dueDate.toISOString().split("T")[0],
        });
    }, [createAction]);

    const handleApprovalRequest = useCallback(
        () => createAction("approval_requested"),
        [createAction]
    );

    const handleComplete = useCallback(
        () => createAction("completed"),
        [createAction]
    );

    const handleNoteSubmit = useCallback(() => {
        if (!noteText.trim()) return;
        createAction("note", { note: noteText.trim() });
        setNoteText("");
        setShowNoteInput(false);
    }, [noteText, createAction]);

    const handleNoteToggle = useCallback(() => {
        setShowNoteInput((prev) => {
            const next = !prev;
            if (next) {
                // Focus the textarea after it renders
                setTimeout(() => noteInputRef.current?.focus(), 50);
            } else {
                setNoteText("");
            }
            return next;
        });
    }, []);

    // ── Derived state ────────────────────────────────────────────────────

    const status = deriveStatus(actions);
    const statusCfg = STATUS_CONFIG[status];
    const StatusIcon = statusCfg.icon;

    const sortedActions = [...actions].sort((a, b) => {
        const dateA = a.performed_at ? new Date(a.performed_at).getTime() : 0;
        const dateB = b.performed_at ? new Date(b.performed_at).getTime() : 0;
        return dateB - dateA;
    });

    // ── Loading state ────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="space-y-4" role="status" aria-label="Lade Verwaltungsdaten...">
                <Skeleton className="h-14 w-full rounded-2xl" />
                <div className="flex gap-2 flex-wrap">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-28 rounded-full" />
                    ))}
                </div>
                <div className="space-y-3 mt-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex gap-3">
                            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
                <span className="sr-only">Verwaltungsdaten werden geladen...</span>
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <div className="space-y-5">
            {/* ── Status Banner ─────────────────────────────────────────── */}
            <div
                className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-2xl",
                    "shadow-[var(--shadow-elevated)]",
                    statusCfg.bg
                )}
            >
                <div
                    className={cn(
                        "w-2.5 h-2.5 rounded-full shrink-0",
                        statusCfg.dot
                    )}
                />
                <StatusIcon className={cn("w-4 h-4 shrink-0", statusCfg.text)} />
                <span className={cn("text-[13px] font-medium", statusCfg.text)}>
                    {statusCfg.label}
                </span>
            </div>

            {/* ── Quick Actions ─────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-1.5">
                <QuickActionPill
                    icon={Send}
                    label="Versendet"
                    onClick={handleSent}
                    disabled={isSubmitting}
                />
                <QuickActionPill
                    icon={RotateCcw}
                    label="Rücksendung angefordert"
                    onClick={handleReturnPending}
                    disabled={isSubmitting}
                />
                <QuickActionPill
                    icon={CalendarClock}
                    label="Wiedervorlage"
                    onClick={handleReminder}
                    disabled={isSubmitting}
                />
                <QuickActionPill
                    icon={ShieldCheck}
                    label="Genehmigung anfragen"
                    onClick={handleApprovalRequest}
                    disabled={isSubmitting}
                />
                <QuickActionPill
                    icon={StickyNote}
                    label="Notiz hinzufügen"
                    onClick={handleNoteToggle}
                    disabled={isSubmitting}
                    active={showNoteInput}
                />
                <QuickActionPill
                    icon={CheckCircle}
                    label="Abschließen"
                    onClick={handleComplete}
                    disabled={isSubmitting}
                    variant="success"
                />
            </div>

            {/* ── Inline Note Input ────────────────────────────────────── */}
            {showNoteInput && (
                <div
                    className={cn(
                        "rounded-2xl p-3 space-y-2",
                        "bg-foreground/[0.02] shadow-[var(--shadow-elevated)]"
                    )}
                >
                    <textarea
                        ref={noteInputRef}
                        className={cn(
                            "w-full resize-none rounded-xl bg-white px-3 py-2",
                            "text-[13px] placeholder:text-foreground/30",
                            "focus:outline-none focus:ring-2 focus:ring-primary/20",
                            "shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]",
                            "min-h-[72px]"
                        )}
                        placeholder="Notiz eingeben..."
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                handleNoteSubmit();
                            }
                        }}
                        aria-label="Notiztext"
                    />
                    <div className="flex justify-end gap-1.5">
                        <Button
                            variant="ghost"
                            size="xs"
                            onClick={handleNoteToggle}
                            disabled={isSubmitting}
                            disableMotion
                        >
                            <X className="w-3 h-3 mr-1" />
                            Abbrechen
                        </Button>
                        <Button
                            size="xs"
                            onClick={handleNoteSubmit}
                            disabled={isSubmitting || !noteText.trim()}
                            disableMotion
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                                <Check className="w-3 h-3 mr-1" />
                            )}
                            Speichern
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Timeline ─────────────────────────────────────────────── */}
            {sortedActions.length === 0 ? (
                <div className="text-center py-8">
                    <FileText className="w-8 h-8 mx-auto text-foreground/20 mb-2" />
                    <p className="text-[13px] text-foreground/40">
                        Noch keine Aktionen vorhanden
                    </p>
                </div>
            ) : (
                <div className="relative" role="list" aria-label="Dokument-Aktionen">
                    {/* Vertical timeline line */}
                    <div
                        className="absolute left-[15px] top-4 bottom-4 w-px bg-foreground/[0.08]"
                        aria-hidden="true"
                    />

                    <div className="space-y-0">
                        {sortedActions.map((action, index) => (
                            <TimelineItem
                                key={action.id}
                                action={action}
                                isFirst={index === 0}
                                isLast={index === sortedActions.length - 1}
                                onMarkCompleted={markCompleted}
                                isSubmitting={isSubmitting}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* ── Guest Review Links ─────────────────────────────────── */}
            <Suspense fallback={<Skeleton className="h-20 w-full rounded-2xl" />}>
                <GuestLinkManager documentId={documentId} />
            </Suspense>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// QUICK ACTION PILL
// ═══════════════════════════════════════════════════════════════════════════

interface QuickActionPillProps {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    active?: boolean;
    variant?: "default" | "success";
}

function QuickActionPill({
    icon: Icon,
    label,
    onClick,
    disabled,
    active,
    variant = "default",
}: QuickActionPillProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                "text-[12px] font-medium transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                "disabled:opacity-40 disabled:pointer-events-none",
                active
                    ? "bg-primary/10 text-primary shadow-sm"
                    : variant === "success"
                      ? "bg-green-50/80 text-green-700 hover:bg-green-100 hover:shadow-sm"
                      : "bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.08] hover:text-foreground/80 hover:shadow-sm"
            )}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
        </button>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMELINE ITEM
// ═══════════════════════════════════════════════════════════════════════════

interface TimelineItemProps {
    action: ActionResponse;
    isFirst: boolean;
    isLast: boolean;
    onMarkCompleted: (actionId: number) => void;
    isSubmitting: boolean;
}

function TimelineItem({
    action,
    isFirst,
    isLast,
    onMarkCompleted,
    isSubmitting,
}: TimelineItemProps) {
    const config = getActionConfig(action.action_type);
    const Icon = config.icon;

    const isOpenAction =
        !action.is_completed &&
        (action.action_type === "return_pending" ||
            action.action_type === "approval_requested" ||
            action.action_type === "reminder_set");

    const formattedTime = action.performed_at
        ? formatTimeDisplay(action.performed_at)
        : null;

    const formattedDueDate = action.due_date
        ? format(new Date(action.due_date), "dd.MM.yyyy", { locale: de })
        : null;

    return (
        <div
            className={cn(
                "relative flex gap-3 pl-0 pr-1",
                isFirst ? "pt-0" : "pt-3",
                isLast ? "pb-0" : "pb-3"
            )}
            role="listitem"
        >
            {/* Timeline dot */}
            <div
                className={cn(
                    "relative z-10 flex items-center justify-center",
                    "w-[30px] h-[30px] shrink-0 rounded-full",
                    "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                )}
            >
                <Icon className={cn("w-3.5 h-3.5", config.color)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium text-foreground truncate">
                        {config.label}
                    </p>
                    {formattedTime && (
                        <time
                            className="text-[11px] text-foreground/40 shrink-0"
                            dateTime={action.performed_at ?? undefined}
                            title={
                                action.performed_at
                                    ? format(
                                          new Date(action.performed_at),
                                          "dd.MM.yyyy HH:mm",
                                          { locale: de }
                                      )
                                    : undefined
                            }
                        >
                            {formattedTime}
                        </time>
                    )}
                </div>

                {/* Performer */}
                {action.performed_by_name && (
                    <p className="text-[12px] text-foreground/50 mt-0.5">
                        {action.performed_by_name}
                    </p>
                )}

                {/* Note text */}
                {action.note && (
                    <div
                        className={cn(
                            "mt-1.5 px-3 py-2 rounded-xl",
                            "bg-foreground/[0.03] text-[12px] text-foreground/70",
                            "leading-relaxed"
                        )}
                    >
                        {action.note}
                    </div>
                )}

                {/* Due date for reminders */}
                {action.action_type === "reminder_set" && formattedDueDate && (
                    <p className="text-[12px] text-purple-600/70 mt-1">
                        Fällig am {formattedDueDate}
                    </p>
                )}

                {/* Completed badge */}
                {action.is_completed && action.completed_at && (
                    <div className="flex items-center gap-1 mt-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span className="text-[11px] text-green-600/70">
                            Erledigt{" "}
                            {formatTimeDisplay(action.completed_at)}
                        </span>
                    </div>
                )}

                {/* Mark as completed button for open actions */}
                {isOpenAction && (
                    <Button
                        variant="ghost"
                        size="xs"
                        className="mt-1.5 text-[11px] text-foreground/50 hover:text-foreground/80"
                        onClick={() => onMarkCompleted(action.id)}
                        disabled={isSubmitting}
                        disableMotion
                    >
                        <Check className="w-3 h-3 mr-1" />
                        {action.action_type === "reminder_set"
                            ? "Erledigt markieren"
                            : "Als erledigt markieren"}
                    </Button>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Show relative time for recent actions, absolute date for older ones.
 * - Within 7 days: "vor 3 Stunden", "vor 2 Tagen"
 * - Older: "15.01.2025"
 */
function formatTimeDisplay(isoDate: string): string {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 7) {
        return formatDistanceToNow(date, { addSuffix: true, locale: de });
    }
    return format(date, "dd.MM.yyyy", { locale: de });
}
