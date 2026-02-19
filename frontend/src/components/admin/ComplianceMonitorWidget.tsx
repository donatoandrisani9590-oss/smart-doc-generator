/**
 * ComplianceMonitorWidget - Dashboard Widget for Legal Audit Status
 *
 * Self-contained card for the admin dashboard showing:
 * - Stacked compliance status bar (ok/warning/deprecated/unchecked)
 * - Critical items list (max 5, sorted by severity)
 * - "Alle prüfen" action button
 *
 * Admin-only component.
 */

'use client'

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api, isApiError } from "@/lib/api-client";
import { Shield, Loader2, ChevronRight, RefreshCw } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface ComplianceStats {
    total_checked: number;
    ok_count: number;
    warning_count: number;
    deprecated_count: number;
    unchecked_count: number;
}

interface CriticalItem {
    id: number;
    clause_title: string;
    status: "warning" | "deprecated";
    risk_level?: string;
    affected_law?: string;
    reasoning?: string;
}

interface AuditResult {
    id: number;
    clause_id: number;
    clause_title: string;
    status: string;
    risk_level?: string;
    affected_law?: string;
    reasoning?: string;
    suggestion?: string;
}

interface AuditResultsResponse {
    items: AuditResult[];
    total: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Status visual config
// ═══════════════════════════════════════════════════════════════════════════

const statusVisuals: Record<string, { color: string; dot: string; label: string }> = {
    ok: {
        color: "bg-green-500",
        dot: "bg-green-500",
        label: "Aktuell",
    },
    warning: {
        color: "bg-amber-500",
        dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]",
        label: "Warnung",
    },
    deprecated: {
        color: "bg-red-500",
        dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]",
        label: "Veraltet",
    },
    unchecked: {
        color: "bg-warm-300",
        dot: "bg-warm-300",
        label: "Ungeprüft",
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export function ComplianceMonitorWidget({ className }: { className?: string }) {
    const [stats, setStats] = useState<ComplianceStats | null>(null);
    const [criticalItems, setCriticalItems] = useState<CriticalItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const [statsRes, criticalRes] = await Promise.all([
                api.get<ComplianceStats>("/api/v1/admin/legal-audit/stats"),
                api.get<AuditResultsResponse>(
                    "/api/v1/admin/legal-audit/results?status=warning&status=deprecated&limit=5"
                ),
            ]);

            setStats(statsRes.data);
            setCriticalItems(
                criticalRes.data.items.map(item => ({
                    id: item.id,
                    clause_title: item.clause_title,
                    status: item.status as "warning" | "deprecated",
                    risk_level: item.risk_level,
                    affected_law: item.affected_law,
                    reasoning: item.reasoning,
                }))
            );
            setError(null);
        } catch (err) {
            if (isApiError(err)) {
                setError(err.message);
            } else {
                setError("Daten konnten nicht geladen werden");
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRunAudit = useCallback(async () => {
        setIsRunning(true);
        try {
            await api.post("/api/v1/admin/legal-audit/run");
            // Reload data after audit completes
            await loadData();
        } catch (err) {
            if (isApiError(err)) {
                setError(err.message);
            } else {
                setError("Prüfung konnte nicht gestartet werden");
            }
        } finally {
            setIsRunning(false);
        }
    }, [loadData]);

    // ───────────────────────────────────────────────────────────────────────
    // Loading skeleton
    // ───────────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <Card className={cn("shadow-[var(--shadow-elevated)]", className)}>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-5 w-40" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-2 w-full rounded-full" />
                    <div className="flex gap-4">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    // ───────────────────────────────────────────────────────────────────────
    // Error state
    // ───────────────────────────────────────────────────────────────────────

    if (error && !stats) {
        return (
            <Card className={cn("shadow-[var(--shadow-elevated)]", className)}>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="w-4 h-4 text-muted-foreground/50" />
                        Rechtliche Aktualität
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-[13px] text-muted-foreground/60 text-center py-4">
                        {error}
                    </p>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2"
                        onClick={loadData}
                    >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Erneut versuchen
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!stats) return null;

    // ───────────────────────────────────────────────────────────────────────
    // Stacked bar calculations
    // ───────────────────────────────────────────────────────────────────────

    const total = stats.ok_count + stats.warning_count + stats.deprecated_count + stats.unchecked_count;
    const pct = (count: number) => total > 0 ? (count / total) * 100 : 0;

    return (
        <Card className={cn("shadow-[var(--shadow-elevated)]", className)}>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary/60" />
                    Rechtliche Aktualität
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Stacked status bar */}
                <div className="space-y-2">
                    <div className="h-2 rounded-full overflow-hidden flex bg-warm-100">
                        {stats.ok_count > 0 && (
                            <div
                                className="bg-green-500 transition-all duration-500"
                                style={{ width: `${pct(stats.ok_count)}%` }}
                            />
                        )}
                        {stats.warning_count > 0 && (
                            <div
                                className="bg-amber-500 transition-all duration-500"
                                style={{ width: `${pct(stats.warning_count)}%` }}
                            />
                        )}
                        {stats.deprecated_count > 0 && (
                            <div
                                className="bg-red-500 transition-all duration-500"
                                style={{ width: `${pct(stats.deprecated_count)}%` }}
                            />
                        )}
                        {stats.unchecked_count > 0 && (
                            <div
                                className="bg-warm-300 transition-all duration-500"
                                style={{ width: `${pct(stats.unchecked_count)}%` }}
                            />
                        )}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {[
                            { key: "ok", count: stats.ok_count },
                            { key: "warning", count: stats.warning_count },
                            { key: "deprecated", count: stats.deprecated_count },
                            { key: "unchecked", count: stats.unchecked_count },
                        ].map(({ key, count }) => (
                            <div key={key} className="flex items-center gap-1.5">
                                <span className={cn("w-2 h-2 rounded-full shrink-0", statusVisuals[key].color)} />
                                <span className="text-[11px] text-muted-foreground/60">
                                    {count} {statusVisuals[key].label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Critical items list */}
                {criticalItems.length > 0 && (
                    <div className="space-y-1">
                        {criticalItems.map((item) => {
                            const visual = statusVisuals[item.status];
                            return (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-foreground/[0.02] transition-colors group"
                                >
                                    <span
                                        className={cn(
                                            "w-1.5 h-1.5 rounded-full shrink-0",
                                            visual.dot
                                        )}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[12px] font-medium text-foreground/80 truncate block">
                                            {item.clause_title}
                                        </span>
                                        {item.affected_law && (
                                            <span className="text-[11px] text-muted-foreground/50 truncate block">
                                                {item.affected_law}
                                            </span>
                                        )}
                                    </div>
                                    <ChevronRight className="w-3.5 h-3.5 text-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Empty state for critical items */}
                {criticalItems.length === 0 && total > 0 && stats.warning_count === 0 && stats.deprecated_count === 0 && (
                    <div className="text-center py-3">
                        <p className="text-[12px] text-muted-foreground/50">
                            Keine kritischen Befunde
                        </p>
                    </div>
                )}

                {/* Actions */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-[12px] text-primary/70 hover:text-primary"
                    onClick={handleRunAudit}
                    disabled={isRunning}
                >
                    {isRunning ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            Prüfung läuft...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                            Alle prüfen
                        </>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}

export default ComplianceMonitorWidget;
