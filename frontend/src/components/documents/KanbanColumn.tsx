/**
 * KanbanColumn — Droppable column for the Kanban board.
 *
 * Shows: header with icon + label + count, droppable area, list of KanbanCards.
 * Archiv column is collapsible (collapsed by default).
 */

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { KanbanCard } from "./KanbanCard";
import {
    STAGE_COLORS,
    type PipelineStage,
    type KanbanCardItem,
} from "@/hooks/api/useKanbanQueries";

// ═══════════════════════════════════════════════════════════════════════════

interface KanbanColumnProps {
    stage: PipelineStage;
    label: string;
    count: number;
    documents: KanbanCardItem[];
    defaultCollapsed?: boolean;
    onCardClick?: (id: number) => void;
    onDeleteDraft?: (draftId: number) => void;
}

export function KanbanColumn({
    stage,
    label,
    count,
    documents,
    defaultCollapsed = false,
    onCardClick,
    onDeleteDraft,
}: KanbanColumnProps) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);
    const { isOver, setNodeRef } = useDroppable({
        id: `column-${stage}`,
        data: { stage },
    });

    const colors = STAGE_COLORS[stage];

    return (
        <div
            className={`flex flex-col bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-lg)] min-w-[260px] w-[260px] shrink-0 transition-shadow shadow-sm min-h-[400px] ${
                isOver ? "ring-2 ring-primary/40 shadow-lg" : ""
            }`}
        >
            {/* Column Header (Prototype kanban-col-header with status dot) */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center justify-between px-5 py-4 select-none"
            >
                <div className="flex items-center gap-2">
                    <span className={`w-[9px] h-[9px] rounded-full ${colors.icon?.replace('text-', 'bg-') || 'bg-[var(--nw-blue)]'}`}
                          style={{ background: `var(--color-${stage === 'entwurf' ? 'draft' : stage === 'abgeschlossen' ? 'done' : stage === 'versendet' ? 'sent' : stage === 'ruecklauf' ? 'return' : stage === 'freigabe' ? 'review' : 'archived'})` }}
                    />
                    <span className="text-sm font-bold text-[var(--text-primary)] truncate">
                        {label}
                    </span>
                </div>
                <span className="text-[13px] font-semibold text-[var(--text-tertiary)] tabular-nums">
                    {count}
                </span>
                {stage === "archiv" && (
                    collapsed
                        ? <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 ml-1" />
                        : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 ml-1" />
                )}
            </button>

            {/* Droppable Card Area */}
            {!collapsed && (
                <div
                    ref={setNodeRef}
                    className={`flex-1 px-3 pb-3 space-y-2.5 min-h-[80px] transition-colors rounded-b-[var(--radius-lg)] ${
                        isOver ? "bg-primary/5" : ""
                    }`}
                >
                    {documents.length === 0 ? (
                        <div className="flex items-center justify-center h-20 text-xs text-[var(--text-muted)] italic">
                            Keine Dokumente
                        </div>
                    ) : (
                        documents.map((card) => (
                            <KanbanCard
                                key={card.id}
                                card={card}
                                onClick={onCardClick}
                                onDelete={onDeleteDraft}
                            />
                        ))
                    )}
                    {count > documents.length && (
                        <div className="text-center py-1">
                            <span className="text-[11px] text-[var(--text-muted)]">
                                +{count - documents.length} weitere
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
