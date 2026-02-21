/**
 * KanbanCard — Draggable card for the Kanban board.
 *
 * Shows: document type badge, employee name, relative date, due date indicator.
 * Left border colored by document type (hash-based).
 * Status indicators: red = overdue, purple = approval pending, amber = return pending.
 */

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Clock, AlertCircle, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "@/lib/dateUtils";
import type { KanbanCardItem } from "@/hooks/api/useKanbanQueries";

// ── Document type color palette (DS v2.1, matches Repository.tsx) ────────
const DOC_TYPE_COLORS = [
    "var(--nw-blue-700)", "var(--nw-green-500)", "var(--nw-warm-500)",
    "var(--nw-blue-500)", "var(--color-review)", "var(--color-return)",
] as const;

function getDocTypeColor(typeName?: string | null): string {
    if (!typeName) return DOC_TYPE_COLORS[0];
    let hash = 0;
    for (let i = 0; i < typeName.length; i++) {
        hash = ((hash << 5) - hash + typeName.charCodeAt(i)) | 0;
    }
    return DOC_TYPE_COLORS[Math.abs(hash) % DOC_TYPE_COLORS.length];
}

// ── Overdue detection ───────────────────────────────────────────────────
function isOverdue(dueDateStr: string | null): boolean {
    if (!dueDateStr) return false;
    return new Date(dueDateStr) < new Date();
}

function formatDueDate(dueDateStr: string): string {
    const date = new Date(dueDateStr);
    return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ═══════════════════════════════════════════════════════════════════════════

interface KanbanCardProps {
    card: KanbanCardItem;
    onClick?: (id: number) => void;
    onDelete?: (id: number) => void;
}

export function KanbanCard({ card, onClick, onDelete }: KanbanCardProps) {
    const isDraft = card.source === "draft" || card.id < 0;

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `card-${card.id}`,
        data: { documentId: card.id, currentStage: card.pipeline_stage },
        disabled: isDraft,
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        borderLeftColor: isDraft ? undefined : getDocTypeColor(card.document_type_name),
    };

    const overdue = isOverdue(card.next_due_date);

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={() => onClick?.(card.id)}
            className={`
                border border-[var(--border-light)] rounded-[var(--radius-md)] bg-[var(--bg-surface)] p-4 cursor-grab active:cursor-grabbing
                shadow-sm hover:shadow-md hover:-translate-y-px
                transition-all duration-150
                ${isDragging ? "opacity-50 ring-2 ring-primary/30" : ""}
                ${isDraft ? "border-dashed border-[var(--border)] bg-[var(--bg-input)]/50 cursor-pointer" : ""}
            `}
        >
            {/* Row 1: Type badge + overdue indicator (prototype kanban-card-type) */}
            <div className="flex items-center justify-between gap-2 mb-1">
                {card.document_type_name ? (
                    <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)] truncate max-w-[140px]">
                        {card.document_type_name}
                    </span>
                ) : (
                    <span />
                )}
                {isDraft && (
                    <span className="text-[10px] font-medium text-[var(--nw-amber)] bg-[var(--nw-amber-light)] px-1.5 py-0.5 rounded-full shrink-0">
                        Entwurf
                    </span>
                )}
                {overdue && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--nw-red)] shrink-0">
                        <AlertCircle className="w-3 h-3" />
                        überfällig
                    </span>
                )}
            </div>

            {/* Row 2: Title / Employee (prototype kanban-card-name) */}
            <p className="text-sm font-bold text-[var(--text-primary)] truncate leading-snug">
                {card.title || card.employee_name || "Dokument"}
            </p>
            {card.employee_name && card.title && (
                <p className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">
                    {card.employee_name}
                </p>
            )}

            {/* Row 3: Date + Due date + Delete (prototype kanban-card-footer) */}
            <div className="flex items-center gap-3 mt-2.5 text-[12px] text-[var(--text-muted)]">
                {card.created_at && (
                    <span>{formatDistanceToNow(card.created_at)}</span>
                )}
                {card.next_due_date && (
                    <span className={`flex items-center gap-0.5 ${overdue ? "text-red-600 dark:text-red-400 font-medium" : ""}`}>
                        <Clock className="w-3 h-3" />
                        {formatDueDate(card.next_due_date)}
                    </span>
                )}
                {isDraft && onDelete && (
                    <button
                        className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(Math.abs(card.id));
                        }}
                        title="Entwurf löschen"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}
