/**
 * ClauseAuditBadge - Inline Legal Status Indicator
 *
 * Small inline badge showing the legal audit status of a clause.
 * - ok / unchecked: No visible indicator
 * - warning: Amber dot with popover showing reasoning + affected law
 * - deprecated: Red dot with popover showing suggestion + replace action
 */

'use client'

import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Sparkles, AlertTriangle, Scale } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type AuditStatus = "ok" | "warning" | "deprecated" | "unchecked";

export interface ClauseAuditBadgeProps {
    status: AuditStatus;
    affectedLaw?: string;
    reasoning?: string;
    suggestion?: string;
    onRequestAudit?: () => void;
    onRequestAutoFix?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Status configuration
// ═══════════════════════════════════════════════════════════════════════════

const statusConfig: Record<AuditStatus, {
    dot: string;
    label: string;
    icon: typeof AlertTriangle;
}> = {
    ok: {
        dot: "bg-green-500",
        label: "Aktuell",
        icon: Scale,
    },
    warning: {
        dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]",
        label: "Überprüfung empfohlen",
        icon: AlertTriangle,
    },
    deprecated: {
        dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]",
        label: "Veraltet",
        icon: AlertTriangle,
    },
    unchecked: {
        dot: "bg-warm-300",
        label: "Nicht geprüft",
        icon: Scale,
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export function ClauseAuditBadge({
    status,
    affectedLaw,
    reasoning,
    suggestion,
    onRequestAudit,
    onRequestAutoFix,
}: ClauseAuditBadgeProps) {
    // ok and unchecked: no visible indicator
    if (status === "ok" || status === "unchecked") {
        return null;
    }

    const config = statusConfig[status];

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    className="inline-flex items-center justify-center p-0.5 rounded-full hover:bg-foreground/[0.04] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Rechtsstatus: ${config.label}`}
                >
                    <span
                        className={cn(
                            "w-2 h-2 rounded-full shrink-0 transition-all",
                            config.dot
                        )}
                    />
                </button>
            </PopoverTrigger>

            <PopoverContent
                side="bottom"
                align="start"
                className="w-72 p-0"
            >
                <div className="p-4 space-y-3">
                    {/* Status header */}
                    <div className="flex items-center gap-2">
                        <span
                            className={cn(
                                "w-2 h-2 rounded-full shrink-0",
                                config.dot
                            )}
                        />
                        <span className="text-[13px] font-medium text-foreground">
                            {config.label}
                        </span>
                    </div>

                    {/* Affected law */}
                    {affectedLaw && (
                        <div className="flex items-start gap-2">
                            <Scale className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                            <span className="text-[12px] text-muted-foreground">
                                {affectedLaw}
                            </span>
                        </div>
                    )}

                    {/* Reasoning */}
                    {reasoning && (
                        <p className="text-[12px] text-foreground/60 leading-relaxed">
                            {reasoning}
                        </p>
                    )}

                    {/* Suggestion (only for deprecated) */}
                    {status === "deprecated" && suggestion && (
                        <div className="p-2.5 rounded-xl bg-foreground/[0.02]">
                            <p className="text-[11px] font-medium text-foreground/40 mb-1">Empfohlener Ersatz</p>
                            <p className="text-[12px] text-foreground/70 leading-relaxed">
                                {suggestion}
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                        {status === "warning" && onRequestAudit && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2.5 text-[12px] gap-1.5"
                                onClick={onRequestAudit}
                            >
                                <Sparkles className="w-3 h-3" />
                                KI-Update anfordern
                            </Button>
                        )}

                        {status === "deprecated" && onRequestAutoFix && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2.5 text-[12px] gap-1.5 text-primary hover:text-primary"
                                onClick={onRequestAutoFix}
                            >
                                <Sparkles className="w-3 h-3" />
                                Ersetzen
                            </Button>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default ClauseAuditBadge;
