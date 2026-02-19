/**
 * LegalAuditPage - Rechtliche Prüfung (Legal Watchdog)
 *
 * Full admin page for managing legal audits of clauses.
 * Shows stats overview, filterable results table, and
 * actions for individual/bulk audit operations.
 *
 * Mounted at SettingsHub tab: "legal-audit"
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api, isApiError } from "@/lib/api-client";
import {
    Shield,
    Sparkles,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    HelpCircle,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Scale,
    Zap,
} from "lucide-react";

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

interface AuditResult {
    id: number;
    clause_id: number;
    clause_title: string;
    status: string;
    risk_level: string;
    affected_law: string | null;
    reasoning: string | null;
    suggestion: string | null;
    checked_at: string | null;
}

interface AuditResultsResponse {
    items: AuditResult[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Status configuration
// ═══════════════════════════════════════════════════════════════════════════

const statusConfig: Record<string, {
    dot: string;
    badge: string;
    label: string;
    icon: typeof CheckCircle2;
}> = {
    ok: {
        dot: "bg-green-500",
        badge: "bg-green-500/10 text-green-700 border-transparent",
        label: "Aktuell",
        icon: CheckCircle2,
    },
    warning: {
        dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]",
        badge: "bg-amber-500/10 text-amber-700 border-transparent",
        label: "Warnung",
        icon: AlertTriangle,
    },
    deprecated: {
        dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]",
        badge: "bg-red-500/10 text-red-700 border-transparent",
        label: "Veraltet",
        icon: XCircle,
    },
    unchecked: {
        dot: "bg-warm-300",
        badge: "bg-warm-200 text-warm-600 border-transparent",
        label: "Ungeprüft",
        icon: HelpCircle,
    },
};

const riskLabels: Record<string, string> = {
    low: "Niedrig",
    medium: "Mittel",
    high: "Hoch",
    critical: "Kritisch",
};

const riskBadgeClass: Record<string, string> = {
    low: "bg-green-500/10 text-green-700 border-transparent",
    medium: "bg-amber-500/10 text-amber-700 border-transparent",
    high: "bg-red-500/10 text-red-700 border-transparent",
    critical: "bg-red-600/15 text-red-800 border-transparent",
};

// ═══════════════════════════════════════════════════════════════════════════
// Stats Card
// ═══════════════════════════════════════════════════════════════════════════

function StatCard({
    label,
    count,
    icon: Icon,
    dotClass,
}: {
    label: string;
    count: number;
    icon: typeof CheckCircle2;
    dotClass: string;
}) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                        {label}
                    </span>
                    <Icon className="w-4 h-4 text-muted-foreground/40" />
                </div>
                <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", dotClass)} />
                    <span className="text-2xl font-bold tabular-nums text-foreground">
                        {count.toLocaleString("de-DE")}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export function LegalAuditPage() {
    const [stats, setStats] = useState<ComplianceStats | null>(null);
    const [results, setResults] = useState<AuditResultsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [isRunningAll, setIsRunningAll] = useState(false);
    const [fixingId, setFixingId] = useState<number | null>(null);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ status: "", risk_level: "" });

    // ───────────────────────────────────────────────────────────────────────
    // Data loading
    // ───────────────────────────────────────────────────────────────────────

    const loadStats = useCallback(async () => {
        try {
            const { data } = await api.get<ComplianceStats>("/api/v1/admin/legal-audit/stats");
            setStats(data);
        } catch {
            // Stats load silently fails, empty state shown
        }
    }, []);

    const loadResults = useCallback(async () => {
        setResultsLoading(true);
        const params = new URLSearchParams({ page: String(page), page_size: "20" });
        if (filters.status) params.set("status", filters.status);
        if (filters.risk_level) params.set("risk_level", filters.risk_level);

        try {
            const { data } = await api.get<AuditResultsResponse>(
                `/api/v1/admin/legal-audit/results?${params}`
            );
            setResults(data);
        } catch {
            // Results load silently fails
        } finally {
            setResultsLoading(false);
        }
    }, [page, filters]);

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            await Promise.all([loadStats(), loadResults()]);
            setIsLoading(false);
        };
        init();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        loadResults();
    }, [loadResults]);

    // ───────────────────────────────────────────────────────────────────────
    // Actions
    // ───────────────────────────────────────────────────────────────────────

    const handleRunAll = useCallback(async () => {
        setIsRunningAll(true);
        try {
            await api.post("/api/v1/admin/legal-audit/run");
            await Promise.all([loadStats(), loadResults()]);
        } catch (err) {
            if (isApiError(err)) {
                console.error("Audit run failed:", err.message);
            }
        } finally {
            setIsRunningAll(false);
        }
    }, [loadStats, loadResults]);

    const handleAutoFix = useCallback(async (resultId: number) => {
        setFixingId(resultId);
        try {
            await api.post(`/api/v1/admin/legal-audit/results/${resultId}/auto-fix`);
            await Promise.all([loadStats(), loadResults()]);
        } catch (err) {
            if (isApiError(err)) {
                console.error("Auto-fix failed:", err.message);
            }
        } finally {
            setFixingId(null);
        }
    }, [loadStats, loadResults]);

    const handleMarkResolved = useCallback(async (resultId: number) => {
        try {
            await api.patch(`/api/v1/admin/legal-audit/results/${resultId}`, { status: "ok" });
            await Promise.all([loadStats(), loadResults()]);
        } catch (err) {
            if (isApiError(err)) {
                console.error("Mark resolved failed:", err.message);
            }
        }
    }, [loadStats, loadResults]);

    const handleFilterChange = (key: string, value: string) => {
        setPage(1);
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // ───────────────────────────────────────────────────────────────────────
    // Loading state
    // ───────────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // ───────────────────────────────────────────────────────────────────────
    // Render
    // ───────────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary/60" />
                        Rechtliche Prüfung
                        <Sparkles className="w-4 h-4 text-amber-500/60" />
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Automatische Prüfung von Textbausteinen auf rechtliche Aktualität
                    </p>
                </div>

                <Button
                    onClick={handleRunAll}
                    disabled={isRunningAll}
                    className="gap-2"
                    size="sm"
                >
                    {isRunningAll ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Prüfung läuft...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="w-4 h-4" />
                            Alle prüfen
                        </>
                    )}
                </Button>
            </div>

            {/* Stats cards */}
            {stats && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="Aktuell"
                        count={stats.ok_count}
                        icon={CheckCircle2}
                        dotClass="bg-green-500"
                    />
                    <StatCard
                        label="Warnung"
                        count={stats.warning_count}
                        icon={AlertTriangle}
                        dotClass="bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                    />
                    <StatCard
                        label="Veraltet"
                        count={stats.deprecated_count}
                        icon={XCircle}
                        dotClass="bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                    />
                    <StatCard
                        label="Ungeprüft"
                        count={stats.unchecked_count}
                        icon={HelpCircle}
                        dotClass="bg-warm-300"
                    />
                </div>
            )}

            {/* Filters + Results table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                        <span>Prüfergebnisse</span>
                        <span className="text-sm font-normal text-muted-foreground">
                            {results?.total?.toLocaleString("de-DE") ?? 0} Textbausteine
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 mb-4">
                        <Select
                            value={filters.status || "all"}
                            onValueChange={(v) => handleFilterChange("status", v === "all" ? "" : v)}
                        >
                            <SelectTrigger className="w-44">
                                <SelectValue placeholder="Alle Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle Status</SelectItem>
                                <SelectItem value="ok">Aktuell</SelectItem>
                                <SelectItem value="warning">Warnung</SelectItem>
                                <SelectItem value="deprecated">Veraltet</SelectItem>
                                <SelectItem value="unchecked">Ungeprüft</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select
                            value={filters.risk_level || "all"}
                            onValueChange={(v) => handleFilterChange("risk_level", v === "all" ? "" : v)}
                        >
                            <SelectTrigger className="w-44">
                                <SelectValue placeholder="Alle Risikostufen" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle Risikostufen</SelectItem>
                                <SelectItem value="low">Niedrig</SelectItem>
                                <SelectItem value="medium">Mittel</SelectItem>
                                <SelectItem value="high">Hoch</SelectItem>
                                <SelectItem value="critical">Kritisch</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Table */}
                    {resultsLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : !results?.items?.length ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Scale className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Keine Ergebnisse für die gewählten Filter</p>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-muted/30">
                                            <tr>
                                                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                                    Textbaustein
                                                </th>
                                                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                                    Status
                                                </th>
                                                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                                    Risiko
                                                </th>
                                                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                                    Betroffenes Gesetz
                                                </th>
                                                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                                    Empfehlung
                                                </th>
                                                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                                    Aktion
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-foreground/[0.04]">
                                            {results.items.map((item) => {
                                                const config = statusConfig[item.status] ?? statusConfig.unchecked;
                                                const riskClass = riskBadgeClass[item.risk_level] ?? riskBadgeClass.low;

                                                return (
                                                    <tr
                                                        key={item.id}
                                                        className="hover:bg-foreground/[0.015] transition-colors"
                                                    >
                                                        {/* Clause title */}
                                                        <td className="p-3">
                                                            <div className="flex items-center gap-2">
                                                                <span
                                                                    className={cn(
                                                                        "w-1.5 h-1.5 rounded-full shrink-0",
                                                                        config.dot
                                                                    )}
                                                                />
                                                                <span className="text-[13px] font-medium text-foreground max-w-[200px] truncate">
                                                                    {item.clause_title}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* Status badge */}
                                                        <td className="p-3">
                                                            <Badge
                                                                variant="outline"
                                                                className={cn("text-[11px]", config.badge)}
                                                            >
                                                                {config.label}
                                                            </Badge>
                                                        </td>

                                                        {/* Risk level */}
                                                        <td className="p-3">
                                                            {item.risk_level ? (
                                                                <Badge
                                                                    variant="outline"
                                                                    className={cn("text-[11px]", riskClass)}
                                                                >
                                                                    {riskLabels[item.risk_level] ?? item.risk_level}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-[12px] text-muted-foreground/40">
                                                                    --
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Affected law */}
                                                        <td className="p-3">
                                                            <span className="text-[12px] text-muted-foreground max-w-[180px] truncate block">
                                                                {item.affected_law || "--"}
                                                            </span>
                                                        </td>

                                                        {/* Recommendation */}
                                                        <td className="p-3">
                                                            <span className="text-[12px] text-foreground/60 max-w-[200px] truncate block">
                                                                {item.suggestion || item.reasoning || "--"}
                                                            </span>
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="p-3 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                {(item.status === "warning" || item.status === "deprecated") && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 px-2 text-[11px] gap-1"
                                                                        onClick={() => handleAutoFix(item.id)}
                                                                        disabled={fixingId === item.id}
                                                                    >
                                                                        {fixingId === item.id ? (
                                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                                        ) : (
                                                                            <Zap className="w-3 h-3" />
                                                                        )}
                                                                        KI-Fix
                                                                    </Button>
                                                                )}
                                                                {item.status !== "ok" && item.status !== "unchecked" && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 px-2 text-[11px] gap-1 text-green-700/70 hover:text-green-700"
                                                                        onClick={() => handleMarkResolved(item.id)}
                                                                    >
                                                                        <CheckCircle2 className="w-3 h-3" />
                                                                        Erledigt
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Pagination */}
                            {results.total_pages > 1 && (
                                <div className="flex items-center justify-between mt-4">
                                    <div className="text-sm text-muted-foreground">
                                        Seite {results.page} von {results.total_pages}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page <= 1}
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page >= results.total_pages}
                                            onClick={() => setPage(p => p + 1)}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default LegalAuditPage;
