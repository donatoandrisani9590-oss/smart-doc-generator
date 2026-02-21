/**
 * KanbanBoard — Main drag-and-drop board for document pipeline management.
 *
 * Wraps @dnd-kit/core DndContext with 6 pipeline columns.
 * Certain stage transitions open confirmation/input dialogs before committing.
 *
 * Dialog triggers:
 *  - Drop on "versendet"      → Date + method dialog
 *  - Drop on "ruecklauf"      → Deadline picker (default +14 days)
 *  - Drop on "abgeschlossen"  → Confirmation dialog
 *  - Drop on "archiv"         → Confirmation dialog
 */

import { useState, useCallback, useMemo } from "react";
import { useDeleteDraft } from "@/hooks/api/useDraftQueries";
import {
    DndContext,
    DragOverlay,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import { Loader2 } from "lucide-react";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import {
    useKanbanBoard,
    useMoveDocument,
    PIPELINE_STAGES,
    STAGE_LABELS,
    type PipelineStage,
    type KanbanCardItem,
    type KanbanFilters,
} from "@/hooks/api/useKanbanQueries";

// ── Dialog Components ────────────────────────────────────────────────────
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

// ── Pending drop type ────────────────────────────────────────────────────
interface PendingDrop {
    documentId: number;
    targetStage: PipelineStage;
    currentStage: PipelineStage;
    cardTitle: string;
}

// ── Helper: format date for input[type=date] ────────────────────────────
function toDateInputValue(date: Date): string {
    return date.toISOString().slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════════════

interface KanbanBoardProps {
    filters?: KanbanFilters;
    onCardClick?: (id: number) => void;
    onDraftClick?: (draftId: number) => void;
}

export function KanbanBoard({ filters = {}, onCardClick, onDraftClick }: KanbanBoardProps) {
    const toast = useToast();

    // ── Data ─────────────────────────────────────────────────────────────
    const {
        data: board,
        isLoading,
        isError,
        error,
    } = useKanbanBoard({ ...filters, include_archived: true });
    const moveMutation = useMoveDocument();
    const deleteDraftMutation = useDeleteDraft();
    const [deleteDraftConfirm, setDeleteDraftConfirm] = useState<number | null>(null);

    const handleDeleteDraft = useCallback(
        (draftId: number) => {
            setDeleteDraftConfirm(draftId);
        },
        []
    );

    const confirmDeleteDraft = useCallback(
        async () => {
            if (!deleteDraftConfirm) return;
            try {
                await deleteDraftMutation.mutateAsync(deleteDraftConfirm);
                toast.success("Gelöscht", "Entwurf wurde gelöscht");
            } catch {
                toast.error("Fehler", "Entwurf konnte nicht gelöscht werden");
            }
        },
        [deleteDraftConfirm, deleteDraftMutation, toast]
    );

    // ── Drag state ───────────────────────────────────────────────────────
    const [activeCard, setActiveCard] = useState<KanbanCardItem | null>(null);

    // ── Dialog state ─────────────────────────────────────────────────────
    const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);

    // Versendet dialog fields
    const [sendDate, setSendDate] = useState(toDateInputValue(new Date()));
    const [sendMethod, setSendMethod] = useState("post");

    // Rücklauf dialog fields
    const [returnDeadline, setReturnDeadline] = useState(
        toDateInputValue(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))
    );

    // ── Sensors ──────────────────────────────────────────────────────────
    const mouseSensor = useSensor(MouseSensor, {
        activationConstraint: { distance: 8 },
    });
    const touchSensor = useSensor(TouchSensor, {
        activationConstraint: { delay: 200, tolerance: 5 },
    });
    const sensors = useSensors(mouseSensor, touchSensor);

    // ── Find a card by ID across all columns ─────────────────────────────
    const findCard = useCallback(
        (cardId: number): KanbanCardItem | undefined => {
            if (!board) return undefined;
            for (const col of board.columns) {
                const card = col.documents.find((d) => d.id === cardId);
                if (card) return card;
            }
            return undefined;
        },
        [board]
    );

    // ── Stages that require a dialog before commit ───────────────────────
    const DIALOG_STAGES = useMemo(
        () => new Set<PipelineStage>(["versendet", "ruecklauf", "abgeschlossen", "archiv"]),
        []
    );

    // ── Commit a stage move (after optional dialog) ──────────────────────
    const commitMove = useCallback(
        async (
            documentId: number,
            targetStage: PipelineStage,
            note?: string,
            metadata?: Record<string, unknown>
        ) => {
            try {
                const result = await moveMutation.mutateAsync({
                    documentId,
                    targetStage,
                    note,
                    metadata,
                });
                toast.success(
                    "Status geändert",
                    result.message || `Dokument nach "${STAGE_LABELS[targetStage]}" verschoben`
                );
            } catch (err) {
                toast.error(
                    "Fehler beim Status-Wechsel",
                    err instanceof Error ? err.message : "Unbekannter Fehler"
                );
            }
        },
        [moveMutation, toast]
    );

    // ── DnD Handlers ─────────────────────────────────────────────────────
    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            const docId = event.active.data.current?.documentId as number | undefined;
            if (docId) {
                setActiveCard(findCard(docId) ?? null);
            }
        },
        [findCard]
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            setActiveCard(null);

            const { active, over } = event;
            if (!over) return;

            const documentId = active.data.current?.documentId as number | undefined;
            const currentStage = active.data.current?.currentStage as PipelineStage | undefined;
            const targetStage = over.data.current?.stage as PipelineStage | undefined;

            if (!documentId || !currentStage || !targetStage) return;
            if (currentStage === targetStage) return; // No-op: same column

            const card = findCard(documentId);
            const cardTitle = card?.title || card?.employee_name || `Dokument #${documentId}`;

            // Stages that need a dialog
            if (DIALOG_STAGES.has(targetStage)) {
                setPendingDrop({ documentId, targetStage, currentStage, cardTitle });
                // Reset dialog fields to defaults
                setSendDate(toDateInputValue(new Date()));
                setSendMethod("post");
                setReturnDeadline(
                    toDateInputValue(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))
                );
                return;
            }

            // Direct move (entwurf, freigabe don't need a dialog)
            commitMove(documentId, targetStage);
        },
        [findCard, DIALOG_STAGES, commitMove]
    );

    // ── Dialog confirm handlers ──────────────────────────────────────────
    const confirmVersendet = useCallback(() => {
        if (!pendingDrop) return;
        commitMove(pendingDrop.documentId, "versendet", undefined, {
            send_date: sendDate,
            send_method: sendMethod,
        });
        setPendingDrop(null);
    }, [pendingDrop, sendDate, sendMethod, commitMove]);

    const confirmRuecklauf = useCallback(() => {
        if (!pendingDrop) return;
        commitMove(pendingDrop.documentId, "ruecklauf", undefined, {
            return_deadline: returnDeadline,
        });
        setPendingDrop(null);
    }, [pendingDrop, returnDeadline, commitMove]);

    const confirmSimple = useCallback(() => {
        if (!pendingDrop) return;
        commitMove(pendingDrop.documentId, pendingDrop.targetStage);
        setPendingDrop(null);
    }, [pendingDrop, commitMove]);

    const cancelDrop = useCallback(() => setPendingDrop(null), []);

    // ── Loading state ────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-60 gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Kanban-Board wird geladen...</span>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex items-center justify-center h-60">
                <div className="text-center space-y-2">
                    <p className="text-sm text-destructive font-medium">
                        Fehler beim Laden des Kanban-Boards
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {error instanceof Error ? error.message : "Unbekannter Fehler"}
                    </p>
                </div>
            </div>
        );
    }

    if (!board) return null;

    // ── Build column map for quick access ────────────────────────────────
    const columnMap = new Map(board.columns.map((col) => [col.stage, col]));

    return (
        <>
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                {/* Horizontally scrollable board */}
                <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
                    {PIPELINE_STAGES.map((stage) => {
                        const col = columnMap.get(stage);
                        return (
                            <KanbanColumn
                                key={stage}
                                stage={stage}
                                label={STAGE_LABELS[stage]}
                                count={col?.count ?? 0}
                                documents={col?.documents ?? []}
                                defaultCollapsed={stage === "archiv"}
                                onCardClick={(id) => {
                                    if (id < 0) {
                                        onDraftClick?.(Math.abs(id));
                                    } else {
                                        onCardClick?.(id);
                                    }
                                }}
                                onDeleteDraft={handleDeleteDraft}
                            />
                        );
                    })}
                </div>

                {/* Drag overlay — ghost card that follows cursor */}
                <DragOverlay dropAnimation={null}>
                    {activeCard ? (
                        <div className="w-[236px] rotate-2 opacity-90">
                            <KanbanCard card={activeCard} />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* ── Versendet Dialog ─────────────────────────────────────── */}
            <Dialog
                open={pendingDrop?.targetStage === "versendet"}
                onOpenChange={(open) => !open && cancelDrop()}
            >
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Versand bestätigen</DialogTitle>
                        <DialogDescription>
                            &bdquo;{pendingDrop?.cardTitle}&ldquo; als versendet markieren.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="send-date">Versanddatum</Label>
                            <Input
                                id="send-date"
                                type="date"
                                value={sendDate}
                                onChange={(e) => setSendDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="send-method">Versandart</Label>
                            <Select value={sendMethod} onValueChange={setSendMethod}>
                                <SelectTrigger id="send-method">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="post">Post</SelectItem>
                                    <SelectItem value="email">E-Mail</SelectItem>
                                    <SelectItem value="persoenlich">Persönlich</SelectItem>
                                    <SelectItem value="intern">Intern</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={cancelDrop}>
                            Abbrechen
                        </Button>
                        <Button
                            onClick={confirmVersendet}
                            disabled={moveMutation.isPending}
                        >
                            {moveMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Versand bestätigen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Rücklauf Dialog ──────────────────────────────────────── */}
            <Dialog
                open={pendingDrop?.targetStage === "ruecklauf"}
                onOpenChange={(open) => !open && cancelDrop()}
            >
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Rücklauf-Frist setzen</DialogTitle>
                        <DialogDescription>
                            Bis wann soll &bdquo;{pendingDrop?.cardTitle}&ldquo; zurückgesendet
                            werden?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="return-deadline">Rücklauffrist</Label>
                            <Input
                                id="return-deadline"
                                type="date"
                                value={returnDeadline}
                                onChange={(e) => setReturnDeadline(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Standard: 14 Tage ab heute
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={cancelDrop}>
                            Abbrechen
                        </Button>
                        <Button
                            onClick={confirmRuecklauf}
                            disabled={moveMutation.isPending}
                        >
                            {moveMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Frist setzen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Abgeschlossen / Archiv Confirmation ─────────────────── */}
            <AlertDialog
                open={
                    pendingDrop?.targetStage === "abgeschlossen" ||
                    pendingDrop?.targetStage === "archiv"
                }
                onOpenChange={(open) => !open && cancelDrop()}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pendingDrop?.targetStage === "archiv"
                                ? "Archivieren"
                                : "Abschließen"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDrop?.targetStage === "archiv"
                                ? `Möchten Sie "${pendingDrop?.cardTitle}" archivieren? Archivierte Dokumente werden aus der aktiven Ansicht entfernt.`
                                : `Möchten Sie "${pendingDrop?.cardTitle}" als abgeschlossen markieren?`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={cancelDrop}>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmSimple}
                            disabled={moveMutation.isPending}
                        >
                            {moveMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            {pendingDrop?.targetStage === "archiv"
                                ? "Archivieren"
                                : "Abschließen"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Delete Draft Confirmation ──────────────────────── */}
            <ConfirmDialog
                open={deleteDraftConfirm !== null}
                onOpenChange={(open) => { if (!open) setDeleteDraftConfirm(null); }}
                title="Entwurf löschen"
                description="Entwurf endgültig löschen?"
                confirmLabel="Löschen"
                onConfirm={confirmDeleteDraft}
            />
        </>
    );
}
