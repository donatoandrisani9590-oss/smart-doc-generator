/**
 * KanbanCard — Draggable card for the Kanban board.
 *
 * Shows: document type badge, employee name, relative date, due date indicator.
 * Left border colored by document type (hash-based).
 * Status indicators: red = overdue, purple = approval pending, amber = return pending.
 */

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Clock, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "@/lib/dateUtils";
import type { KanbanCardItem } from "@/hooks/api/useKanbanQueries";

// ── Document type color palette (matches Repository.tsx) ────────────────
const DOC_TYPE_COLORS = [
    "#243186", "#6EBD84", "#A8A2A0", "#4A5EB0", "#8B6EBD", "#BD6E6E",
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
}

export function KanbanCard({ card, onClick }: KanbanCardProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `card-${card.id}`,
        data: { documentId: card.id, currentStage: card.pipeline_stage },
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        borderLeftColor: getDocTypeColor(card.document_type_name),
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
                border-l-4 rounded-lg bg-background p-3 cursor-grab active:cursor-grabbing
                shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-elevated)]
                transition-shadow
                ${isDragging ? "opacity-50 ring-2 ring-primary/30" : ""}
            `}
        >
            {/* Row 1: Type badge + overdue indicator */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
                {card.document_type_name ? (
                    <span
                        className="text-[11px] font-medium px-1.5 py-0.5 rounded truncate max-w-[140px]"
                        style={{
                            backgroundColor: `${getDocTypeColor(card.document_type_name)}12`,
                            color: getDocTypeColor(card.document_type_name),
                        }}
                    >
                        {card.document_type_name}
                    </span>
                ) : (
                    <span />
                )}
                {overdue && (
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400 shrink-0">
                        <AlertCircle className="w-3 h-3" />
                        überfällig
                    </span>
                )}
            </div>

            {/* Row 2: Title / Employee */}
            <p className="text-sm font-medium text-foreground truncate leading-snug">
                {card.title || card.employee_name || "Dokument"}
            </p>
            {card.employee_name && card.title && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {card.employee_name}
                </p>
            )}

            {/* Row 3: Date + Due date */}
            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                {card.created_at && (
                    <span>{formatDistanceToNow(card.created_at)}</span>
                )}
                {card.next_due_date && (
                    <span className={`flex items-center gap-0.5 ${overdue ? "text-red-600 dark:text-red-400 font-medium" : ""}`}>
                        <Clock className="w-3 h-3" />
                        {formatDueDate(card.next_due_date)}
                    </span>
                )}
            </div>
        </div>
    );
}
