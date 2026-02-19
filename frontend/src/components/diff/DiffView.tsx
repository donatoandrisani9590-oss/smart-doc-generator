/**
 * DiffView - Inline Track-Changes-Style Diff View
 *
 * Human-readable diff view with inline redlining. Each change (insert/delete)
 * can be individually accepted or rejected. Provides summary stats and
 * bulk accept/reject actions.
 */

'use client'

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, X, CheckCheck, XCircle } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface DiffOperation {
    type: "equal" | "insert" | "delete";
    text: string;
}

export interface DiffStats {
    inserts: number;
    deletes: number;
    equal_count: number;
}

type ChangeDecision = "accepted" | "rejected" | "pending";

export interface DiffViewProps {
    operations: DiffOperation[];
    stats?: DiffStats;
    onAcceptChange?: (index: number) => void;
    onRejectChange?: (index: number) => void;
    showActions?: boolean;
    className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export function DiffView({
    operations,
    stats: propStats,
    onAcceptChange,
    onRejectChange,
    showActions = false,
    className,
}: DiffViewProps) {
    // Track decisions for each non-equal operation
    const [decisions, setDecisions] = useState<Record<number, ChangeDecision>>({});
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    // Compute stats from operations if not provided
    const stats = useMemo<DiffStats>(() => {
        if (propStats) return propStats;
        return {
            inserts: operations.filter(op => op.type === "insert").length,
            deletes: operations.filter(op => op.type === "delete").length,
            equal_count: operations.filter(op => op.type === "equal").length,
        };
    }, [operations, propStats]);

    // Count decided vs pending changes
    const changeCount = stats.inserts + stats.deletes;
    const acceptedCount = Object.values(decisions).filter(d => d === "accepted").length;
    const rejectedCount = Object.values(decisions).filter(d => d === "rejected").length;
    const pendingCount = changeCount - acceptedCount - rejectedCount;

    // Build change index map: maps operation index to a change-specific index
    const changeIndexMap = useMemo(() => {
        const map: Record<number, number> = {};
        let changeIdx = 0;
        operations.forEach((op, i) => {
            if (op.type !== "equal") {
                map[i] = changeIdx++;
            }
        });
        return map;
    }, [operations]);

    const handleAccept = useCallback((opIndex: number) => {
        const changeIdx = changeIndexMap[opIndex];
        setDecisions(prev => ({ ...prev, [changeIdx]: "accepted" }));
        onAcceptChange?.(opIndex);
    }, [changeIndexMap, onAcceptChange]);

    const handleReject = useCallback((opIndex: number) => {
        const changeIdx = changeIndexMap[opIndex];
        setDecisions(prev => ({ ...prev, [changeIdx]: "rejected" }));
        onRejectChange?.(opIndex);
    }, [changeIndexMap, onRejectChange]);

    const handleAcceptAll = useCallback(() => {
        const allDecisions: Record<number, ChangeDecision> = {};
        Object.values(changeIndexMap).forEach(idx => {
            allDecisions[idx] = "accepted";
        });
        setDecisions(allDecisions);
    }, [changeIndexMap]);

    const handleRejectAll = useCallback(() => {
        const allDecisions: Record<number, ChangeDecision> = {};
        Object.values(changeIndexMap).forEach(idx => {
            allDecisions[idx] = "rejected";
        });
        setDecisions(allDecisions);
    }, [changeIndexMap]);

    // Determine if an operation should be visible based on decisions
    const getOperationVisibility = useCallback((op: DiffOperation, opIndex: number): "visible" | "collapsed" | "hidden" => {
        if (op.type === "equal") return "visible";

        const changeIdx = changeIndexMap[opIndex];
        const decision = decisions[changeIdx];

        if (!decision || decision === "pending") return "visible";

        if (decision === "accepted") {
            // Accept: inserts become normal text, deletes disappear
            return op.type === "insert" ? "collapsed" : "hidden";
        }

        if (decision === "rejected") {
            // Reject: deletes become normal text, inserts disappear
            return op.type === "delete" ? "collapsed" : "hidden";
        }

        return "visible";
    }, [changeIndexMap, decisions]);

    if (!operations.length) {
        return (
            <div className={cn("rounded-2xl shadow-[var(--shadow-elevated)] bg-card/95 p-5", className)}>
                <p className="text-sm text-muted-foreground text-center py-4">
                    Keine Unterschiede gefunden
                </p>
            </div>
        );
    }

    return (
        <div className={cn("rounded-2xl shadow-[var(--shadow-elevated)] bg-card/95 overflow-hidden", className)}>
            {/* Header with stats */}
            <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <span className="text-[13px] font-medium text-foreground">
                        {changeCount} {changeCount === 1 ? "Änderung" : "Änderungen"}
                    </span>
                    <span className="text-[12px] text-muted-foreground/60">
                        {stats.inserts} {stats.inserts === 1 ? "Einfügung" : "Einfügungen"} · {stats.deletes} {stats.deletes === 1 ? "Löschung" : "Löschungen"}
                    </span>
                </div>

                {showActions && changeCount > 0 && (
                    <div className="flex items-center gap-3">
                        {/* Decision counter */}
                        {(acceptedCount > 0 || rejectedCount > 0) && (
                            <span className="text-[11px] text-muted-foreground/50">
                                {acceptedCount > 0 && <>{acceptedCount} übernommen</>}
                                {acceptedCount > 0 && pendingCount > 0 && " · "}
                                {pendingCount > 0 && <>{pendingCount} offen</>}
                            </span>
                        )}

                        {/* Bulk actions */}
                        <div className="flex items-center gap-1.5">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2.5 text-[12px] text-green-700/80 hover:text-green-700 hover:bg-green-50/50"
                                onClick={handleAcceptAll}
                            >
                                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                                Alle übernehmen
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2.5 text-[12px] text-red-600/80 hover:text-red-600 hover:bg-red-50/50"
                                onClick={handleRejectAll}
                            >
                                <XCircle className="w-3.5 h-3.5 mr-1" />
                                Alle ablehnen
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Diff content */}
            <div className="px-5 pb-5">
                <div className="text-[14px] leading-relaxed text-foreground/90">
                    {operations.map((op, index) => {
                        const visibility = getOperationVisibility(op, index);
                        if (visibility === "hidden") return null;

                        const changeIdx = changeIndexMap[index];
                        const decision = changeIdx !== undefined ? decisions[changeIdx] : undefined;
                        const isHovered = hoveredIndex === index;
                        const isChange = op.type !== "equal";
                        const showInlineActions = showActions && isChange && (!decision || decision === "pending");

                        // Collapsed = accepted/rejected, show as normal text
                        if (visibility === "collapsed") {
                            return (
                                <span key={index} className="transition-colors duration-300">
                                    {op.text}
                                </span>
                            );
                        }

                        if (op.type === "equal") {
                            return <span key={index}>{op.text}</span>;
                        }

                        if (op.type === "delete") {
                            return (
                                <span
                                    key={index}
                                    className="relative inline"
                                    onMouseEnter={() => showInlineActions && setHoveredIndex(index)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                >
                                    <span className="line-through text-red-600/80 bg-red-50/50 rounded px-0.5 transition-colors">
                                        {op.text}
                                    </span>
                                    {showInlineActions && isHovered && (
                                        <span className="inline-flex items-center gap-0.5 ml-0.5 align-middle">
                                            <button
                                                onClick={() => handleAccept(index)}
                                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500/10 hover:bg-green-500/20 text-green-600 transition-colors"
                                                title="Löschung übernehmen"
                                                aria-label="Löschung übernehmen"
                                            >
                                                <Check className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => handleReject(index)}
                                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-600 transition-colors"
                                                title="Löschung ablehnen"
                                                aria-label="Löschung ablehnen"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    )}
                                </span>
                            );
                        }

                        if (op.type === "insert") {
                            return (
                                <span
                                    key={index}
                                    className="relative inline"
                                    onMouseEnter={() => showInlineActions && setHoveredIndex(index)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                >
                                    <span className="text-green-700/80 bg-green-50/50 underline rounded px-0.5 transition-colors">
                                        {op.text}
                                    </span>
                                    {showInlineActions && isHovered && (
                                        <span className="inline-flex items-center gap-0.5 ml-0.5 align-middle">
                                            <button
                                                onClick={() => handleAccept(index)}
                                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500/10 hover:bg-green-500/20 text-green-600 transition-colors"
                                                title="Einfügung übernehmen"
                                                aria-label="Einfügung übernehmen"
                                            >
                                                <Check className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => handleReject(index)}
                                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-600 transition-colors"
                                                title="Einfügung ablehnen"
                                                aria-label="Einfügung ablehnen"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    )}
                                </span>
                            );
                        }

                        return null;
                    })}
                </div>
            </div>

            {/* Footer with summary */}
            {showActions && (acceptedCount > 0 || rejectedCount > 0) && (
                <div className="px-5 py-3 border-t border-foreground/[0.04] flex items-center gap-3">
                    {acceptedCount > 0 && (
                        <Badge variant="success" className="text-[11px]">
                            {acceptedCount} übernommen
                        </Badge>
                    )}
                    {rejectedCount > 0 && (
                        <Badge variant="destructive" className="text-[11px]">
                            {rejectedCount} abgelehnt
                        </Badge>
                    )}
                    {pendingCount > 0 && (
                        <Badge variant="muted" className="text-[11px]">
                            {pendingCount} offen
                        </Badge>
                    )}
                </div>
            )}
        </div>
    );
}

export default DiffView;
