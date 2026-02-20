/**
 * KanbanColumn — Droppable column for the Kanban board.
 *
 * Shows: header with icon + label + count, droppable area, list of KanbanCards.
 * Archiv column is collapsible (collapsed by default).
 */

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
    Edit3,
    ShieldCheck,
    Send,
    RotateCcw,
    CheckCircle,
    Archive,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { KanbanCard } from "./KanbanCard";
import {
    STAGE_COLORS,
    type PipelineStage,
    type KanbanCardItem,
} from "@/hooks/api/useKanbanQueries";

// ── Stage icons ─────────────────────────────────────────────────────────
const STAGE_ICONS: Record<PipelineStage, React.ElementType> = {
    entwurf: Edit3,
    freigabe: ShieldCheck,
    versendet: Send,
    ruecklauf: RotateCcw,
    abgeschlossen: CheckCircle,
    archiv: Archive,
};

// ═══════════════════════════════════════════════════════════════════════════

interface KanbanColumnProps {
    stage: PipelineStage;
    label: string;
    count: number;
    documents: KanbanCardItem[];
    defaultCollapsed?: boolean;
    onCardClick?: (id: number) => void;
}

export function KanbanColumn({
    stage,
    label,
    count,
    documents,
    defaultCollapsed = false,
    onCardClick,
}: KanbanColumnProps) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);
    const { isOver, setNodeRef } = useDroppable({
        id: `column-${stage}`,
        data: { stage },
    });

    const colors = STAGE_COLORS[stage];
    const Icon = STAGE_ICONS[stage];

    return (
        <div
            className={`flex flex-col rounded-xl ${colors.bg} ${colors.border} border min-w-[260px] w-[260px] shrink-0 transition-shadow ${
                isOver ? "ring-2 ring-primary/40 shadow-lg" : ""
            }`}
        >
            {/* Column Header */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center gap-2 px-3 py-2.5 select-none"
            >
                <Icon className={`w-4 h-4 ${colors.icon} shrink-0`} />
                <span className={`text-sm font-semibold ${colors.text} truncate`}>
                    {label}
                </span>
                <span className={`ml-auto text-xs font-medium ${colors.text} opacity-70 tabular-nums`}>
                    {count}
                </span>
                {stage === "archiv" && (
                    collapsed
                        ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
            </button>

            {/* Droppable Card Area */}
            {!collapsed && (
                <div
                    ref={setNodeRef}
                    className={`flex-1 px-2 pb-2 space-y-2 min-h-[80px] transition-colors rounded-b-xl ${
                        isOver ? "bg-primary/5" : ""
                    }`}
                >
                    {documents.length === 0 ? (
                        <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/50 italic">
                            Keine Dokumente
                        </div>
                    ) : (
                        documents.map((card) => (
                            <KanbanCard
                                key={card.id}
                                card={card}
                                onClick={onCardClick}
                            />
                        ))
                    )}
                    {count > documents.length && (
                        <div className="text-center py-1">
                            <span className="text-[11px] text-muted-foreground/60">
                                +{count - documents.length} weitere
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
