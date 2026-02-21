/**
 * LLMUsagePage - KI-Nutzungsstatistiken und Log-Viewer
 *
 * Zeigt Gesamtstatistiken (Aufrufe, Tokens, Latenz, Fehlerrate),
 * Aufschluesselung nach Feature/Provider als CSS-Balkendiagramme,
 * und eine filterbare Log-Tabelle mit Pagination.
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Activity,
    Zap,
    Clock,
    AlertCircle,
    Loader2,
    BarChart3,
} from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { api } from "@/lib/api-client";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface LLMUsageStats {
    total_calls: number;
    calls_today: number;
    calls_this_week: number;
    total_tokens: number;
    tokens_today: number;
    avg_latency_ms: number;
    error_rate: number;
    by_provider: Array<{ provider: string; count: number; tokens: number }>;
    by_feature: Array<{ feature: string; count: number; tokens: number }>;
}

interface LLMLogEntry {
    id: number;
    created_at: string;
    user_id: string | null;
    feature: string;
    provider: string;
    model: string | null;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    latency_ms: number;
    status: string;
    error_message: string | null;
    country_code: string | null;
}

interface LLMLogListResponse {
    items: LLMLogEntry[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const FEATURE_LABELS: Record<string, string> = {
    refine: "KI-Textoptimierung",
    compliance: "Compliance-Prüfung",
    chat: "Chat-Assistent",
    smart_mode: "Smart Mode",
    clause_ai: "Textbaustein-KI",
    consistency: "Konsistenzprüfung",
    document_upload: "Dokumentenanalyse",
};

const PROVIDER_COLORS: Record<string, string> = {
    groq: "bg-blue-500",
    mistral: "bg-purple-500",
    ollama: "bg-green-500",
};

const getFeatureLabel = (feature: string): string =>
    FEATURE_LABELS[feature] || feature;

const getProviderColor = (provider: string): string =>
    PROVIDER_COLORS[provider.toLowerCase()] || "bg-warm-400";

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export function LLMUsagePage() {
    const [stats, setStats] = useState<LLMUsageStats | null>(null);
    const [logs, setLogs] = useState<LLMLogListResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [logsLoading, setLogsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ feature: "", provider: "", status: "" });

    const loadStats = useCallback(async () => {
        try {
            const { data } = await api.get<LLMUsageStats>("/api/v1/admin/llm-usage/stats");
            setStats(data);
        } catch {
            // Silently handled - empty state shown when stats is null
        }
    }, []);

    const loadLogs = useCallback(async () => {
        setLogsLoading(true);
        const params = new URLSearchParams({ page: String(page), page_size: "25" });
        if (filters.feature) params.set("feature", filters.feature);
        if (filters.provider) params.set("provider", filters.provider);
        if (filters.status) params.set("status", filters.status);

        try {
            const { data } = await api.get<LLMLogListResponse>(
                `/api/v1/admin/llm-usage/logs?${params}`
            );
            setLogs(data);
        } catch {
            // Silently handled - empty state shown when logs is null
        } finally {
            setLogsLoading(false);
        }
    }, [page, filters]);

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            await Promise.all([loadStats(), loadLogs()]);
            setIsLoading(false);
        };
        init();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    const handleFilterChange = (key: string, value: string) => {
        setPage(1);
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    // ───────────────────────────────────────────────────────────────────────
    // Loading State
    // ───────────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // ───────────────────────────────────────────────────────────────────────
    // Empty State
    // ───────────────────────────────────────────────────────────────────────

    if (!stats || stats.total_calls === 0) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">KI-Nutzung</h2>
                    <p className="text-sm text-muted-foreground">
                        Übersicht aller KI-Aufrufe und Token-Verbrauch
                    </p>
                </div>
                <div className="text-center py-20 text-muted-foreground">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Noch keine KI-Aufrufe protokolliert</p>
                </div>
            </div>
        );
    }

    // ───────────────────────────────────────────────────────────────────────
    // Chart Helpers
    // ───────────────────────────────────────────────────────────────────────

    const maxFeatureCount = Math.max(...(stats.by_feature.map((f) => f.count) || [1]), 1);
    const maxProviderCount = Math.max(...(stats.by_provider.map((p) => p.count) || [1]), 1);

    // ───────────────────────────────────────────────────────────────────────
    // Render
    // ───────────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">KI-Nutzung</h2>
                    <p className="text-sm text-muted-foreground">
                        Übersicht aller KI-Aufrufe und Token-Verbrauch
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gesamtaufrufe</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.total_calls.toLocaleString("de-DE")}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            +{stats.calls_today.toLocaleString("de-DE")} heute
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tokens gesamt</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.total_tokens.toLocaleString("de-DE")}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            +{stats.tokens_today.toLocaleString("de-DE")} heute
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ø Latenz</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {Math.round(stats.avg_latency_ms).toLocaleString("de-DE")}ms
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Durchschnittliche Antwortzeit
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Fehlerrate</CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.error_rate.toLocaleString("de-DE", {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                            })}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Fehlgeschlagene Aufrufe
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Feature Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Aufrufe nach Feature</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats.by_feature.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                                Keine Daten vorhanden
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {stats.by_feature.map((item) => (
                                    <div key={item.feature} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-foreground font-medium truncate mr-2">
                                                {getFeatureLabel(item.feature)}
                                            </span>
                                            <span className="text-muted-foreground tabular-nums shrink-0">
                                                {item.count.toLocaleString("de-DE")}
                                            </span>
                                        </div>
                                        <div className="h-2.5 bg-warm-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${(item.count / maxFeatureCount) * 100}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Provider Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Aufrufe nach Provider</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats.by_provider.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                                Keine Daten vorhanden
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {stats.by_provider.map((item) => (
                                    <div key={item.provider} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-foreground font-medium truncate mr-2 capitalize">
                                                {item.provider}
                                            </span>
                                            <span className="text-muted-foreground tabular-nums shrink-0">
                                                {item.count.toLocaleString("de-DE")}
                                            </span>
                                        </div>
                                        <div className="h-2.5 bg-warm-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${getProviderColor(item.provider)}`}
                                                style={{
                                                    width: `${(item.count / maxProviderCount) * 100}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Log Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                        <span>Aufruf-Protokoll</span>
                        <span className="text-sm font-normal text-muted-foreground">
                            {logs?.total?.toLocaleString("de-DE") ?? 0} Einträge
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 mb-4">
                        <Select
                            value={filters.feature || "all"}
                            onValueChange={(v) => handleFilterChange("feature", v === "all" ? "" : v)}
                        >
                            <SelectTrigger className="w-44">
                                <SelectValue placeholder="Alle Features" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle Features</SelectItem>
                                {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filters.provider || "all"}
                            onValueChange={(v) => handleFilterChange("provider", v === "all" ? "" : v)}
                        >
                            <SelectTrigger className="w-44">
                                <SelectValue placeholder="Alle Provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle Provider</SelectItem>
                                <SelectItem value="groq">Groq</SelectItem>
                                <SelectItem value="mistral">Mistral</SelectItem>
                                <SelectItem value="ollama">Ollama</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select
                            value={filters.status || "all"}
                            onValueChange={(v) => handleFilterChange("status", v === "all" ? "" : v)}
                        >
                            <SelectTrigger className="w-44">
                                <SelectValue placeholder="Alle Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle Status</SelectItem>
                                <SelectItem value="success">Erfolgreich</SelectItem>
                                <SelectItem value="error">Fehler</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Table */}
                    {logsLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : !logs?.items?.length ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Keine Einträge für die gewählten Filter</p>
                        </div>
                    ) : (
                        <>
                            <div className="border rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                                    Zeitpunkt
                                                </th>
                                                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                                    Feature
                                                </th>
                                                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                                    Provider
                                                </th>
                                                <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                                    Modell
                                                </th>
                                                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                                    Tokens
                                                </th>
                                                <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                                    Latenz
                                                </th>
                                                <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                                    Status
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {logs.items.map((entry) => (
                                                <tr
                                                    key={entry.id}
                                                    className="hover:bg-muted/30"
                                                >
                                                    <td className="p-3 text-sm whitespace-nowrap">
                                                        <div className="text-foreground">
                                                            {new Date(entry.created_at).toLocaleDateString("de-DE")}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {new Date(entry.created_at).toLocaleTimeString("de-DE")}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-sm">
                                                        <span className="font-medium text-foreground">
                                                            {getFeatureLabel(entry.feature)}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-sm">
                                                        <span className="capitalize text-foreground">
                                                            {entry.provider}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-sm text-muted-foreground">
                                                        {entry.model || "-"}
                                                    </td>
                                                    <td className="p-3 text-sm text-right tabular-nums text-foreground">
                                                        {entry.total_tokens.toLocaleString("de-DE")}
                                                    </td>
                                                    <td className="p-3 text-sm text-right tabular-nums text-muted-foreground">
                                                        {entry.latency_ms.toLocaleString("de-DE")}ms
                                                    </td>
                                                    <td className="p-3 text-sm text-center">
                                                        {entry.status === "success" ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="bg-secondary/10 text-secondary border-secondary/30"
                                                            >
                                                                OK
                                                            </Badge>
                                                        ) : (
                                                            <Badge
                                                                variant="outline"
                                                                className="bg-destructive/10 text-destructive border-destructive/30"
                                                            >
                                                                Fehler
                                                            </Badge>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Pagination */}
                            <Pagination
                                currentPage={logs.page}
                                totalPages={logs.total_pages}
                                onPageChange={setPage}
                                className="mt-4"
                            />
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default LLMUsagePage;
