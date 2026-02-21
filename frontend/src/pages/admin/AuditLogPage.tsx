/**
 * AuditLogPage (15.5.5)
 *
 * Comprehensive audit log viewer for HR administrators.
 * Shows all system activities with filtering, search, and export capabilities.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    useAuditLogs,
    useAuditLogStats,
    useAuditLogActions,
    getAuditExportUrl,
    type AuditLogFilters,
    type AuditLogEntry,
} from "@/hooks/useApi";
import {
    FileText,
    Search,
    Filter,
    Download,
    Activity,
    AlertCircle,
    User,
    Calendar,
    Clock,
    FileCheck,
    Edit,
    Loader2,
    Shield,
    Users,
    Settings,
    X,
} from "lucide-react";
import { formatDistanceToNow } from "@/lib/dateUtils";

// Action category icons
const categoryIcons: Record<string, React.ElementType> = {
    document: FileText,
    clause: FileCheck,
    form_field: Edit,
    user: User,
    bulk: Users,
    system: Settings,
};

// Action type colors
const actionColors: Record<string, string> = {
    create: "bg-green-100 text-green-800",
    update: "bg-blue-100 text-blue-800",
    delete: "bg-red-100 text-red-800",
    export: "bg-purple-100 text-purple-800",
    login: "bg-cyan-100 text-cyan-800",
    correction: "bg-amber-100 text-amber-800",
};

const getActionColor = (action: string): string => {
    for (const [key, color] of Object.entries(actionColors)) {
        if (action.toLowerCase().includes(key)) return color;
    }
    return "bg-warm-100 text-warm-600";
};

export const AuditLogPage = () => {
    const [filters, setFilters] = useState<AuditLogFilters>({
        page: 1,
        page_size: 25,
    });
    const [showFilters, setShowFilters] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

    const { data: logs, isLoading: logsLoading } = useAuditLogs(filters);
    const { data: stats, isLoading: statsLoading } = useAuditLogStats();
    const { data: _actionTypes } = useAuditLogActions();

    const handleFilterChange = (key: keyof AuditLogFilters, value: string | number | undefined) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value || undefined,
            page: key !== "page" ? 1 : (value as number), // Reset page on filter change
        }));
    };

    const clearFilters = () => {
        setFilters({ page: 1, page_size: 25 });
    };

    const hasActiveFilters = Object.keys(filters).some(
        (k) => k !== "page" && k !== "page_size" && filters[k as keyof AuditLogFilters]
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">
                        Audit-Log
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Vollständige Protokollierung aller System-Aktivitäten
                    </p>
                </div>
                <div className="flex gap-2">
                    <a
                        href={getAuditExportUrl({
                            format: "csv",
                            ...filters,
                            limit: 10000,
                        })}
                        download
                    >
                        <Button variant="outline" className="gap-2">
                            <Download className="w-4 h-4" />
                            CSV Export
                        </Button>
                    </a>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gesamt</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                            <div className="text-2xl font-bold">
                                {stats?.total_entries?.toLocaleString() ?? 0}
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">Einträge insgesamt</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Heute</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                            <div className="text-2xl font-bold">{stats?.entries_today ?? 0}</div>
                        )}
                        <p className="text-xs text-muted-foreground">Aktionen heute</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Diese Woche</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                            <div className="text-2xl font-bold">{stats?.entries_this_week ?? 0}</div>
                        )}
                        <p className="text-xs text-muted-foreground">Aktionen diese Woche</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Fehler</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                            <div className="text-2xl font-bold text-red-600">
                                {stats?.recent_errors?.length ?? 0}
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">Fehlgeschlagene Aktionen</p>
                    </CardContent>
                </Card>
            </div>

            {/* Search and Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex gap-4 flex-wrap">
                        {/* Search */}
                        <div className="flex-1 min-w-[250px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Suche in Beschreibung, Benutzer, Entität..."
                                    value={filters.search || ""}
                                    onChange={(e) => handleFilterChange("search", e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        {/* Quick Filters */}
                        <Select
                            value={filters.action_category || "all"}
                            onValueChange={(v) => handleFilterChange("action_category", v === "all" ? "" : v)}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Alle Kategorien" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle Kategorien</SelectItem>
                                <SelectItem value="document">Dokumente</SelectItem>
                                <SelectItem value="clause">Textbausteine</SelectItem>
                                <SelectItem value="form_field">Formularfelder</SelectItem>
                                <SelectItem value="user">Benutzer</SelectItem>
                                <SelectItem value="bulk">Bulk-Operationen</SelectItem>
                                <SelectItem value="system">System</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select
                            value={filters.status || "all"}
                            onValueChange={(v) => handleFilterChange("status", v === "all" ? "" : v)}
                        >
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Alle Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle Status</SelectItem>
                                <SelectItem value="success">Erfolgreich</SelectItem>
                                <SelectItem value="failure">Fehlgeschlagen</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button
                            variant="outline"
                            onClick={() => setShowFilters(!showFilters)}
                            className={showFilters ? "bg-primary/10" : ""}
                        >
                            <Filter className="w-4 h-4 mr-2" />
                            Weitere Filter
                        </Button>

                        {hasActiveFilters && (
                            <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                                <X className="w-4 h-4 mr-2" />
                                Filter zurücksetzen
                            </Button>
                        )}
                    </div>

                    {/* Extended Filters */}
                    {showFilters && (
                        <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="text-xs font-medium text-foreground mb-1 block">
                                    Benutzer-ID
                                </label>
                                <Input
                                    placeholder="z.B. user@example.com"
                                    value={filters.user_id || ""}
                                    onChange={(e) => handleFilterChange("user_id", e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-foreground mb-1 block">
                                    Entitäts-Typ
                                </label>
                                <Select
                                    value={filters.entity_type || "__all__"}
                                    onValueChange={(val) => handleFilterChange("entity_type", val === "__all__" ? "" : val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__all__">Alle</SelectItem>
                                        <SelectItem value="document">Dokument</SelectItem>
                                        <SelectItem value="clause">Textbaustein</SelectItem>
                                        <SelectItem value="document_type">Dokumenttyp</SelectItem>
                                        <SelectItem value="form_field">Formularfeld</SelectItem>
                                        <SelectItem value="user">Benutzer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-foreground mb-1 block">
                                    Von Datum
                                </label>
                                <Input
                                    type="date"
                                    value={filters.date_from || ""}
                                    onChange={(e) => handleFilterChange("date_from", e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-foreground mb-1 block">
                                    Bis Datum
                                </label>
                                <Input
                                    type="date"
                                    value={filters.date_to || ""}
                                    onChange={(e) => handleFilterChange("date_to", e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Audit Log Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                        <span>Aktivitätsprotokoll</span>
                        <span className="text-sm font-normal text-muted-foreground">
                            {logs?.total?.toLocaleString() ?? 0} Einträge
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {logsLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : !logs?.items?.length ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Keine Audit-Log Einträge gefunden</p>
                        </div>
                    ) : (
                        <>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                                                Zeitstempel
                                            </th>
                                            <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                                                Benutzer
                                            </th>
                                            <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                                                Aktion
                                            </th>
                                            <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                                                Entität
                                            </th>
                                            <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                                                Beschreibung
                                            </th>
                                            <th className="text-left p-3 text-xs font-medium text-muted-foreground">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {logs.items.map((entry) => {
                                            const CategoryIcon =
                                                categoryIcons[entry.action_category] || Activity;
                                            return (
                                                <tr
                                                    key={entry.id}
                                                    className="hover:bg-muted/30 cursor-pointer"
                                                    onClick={() => setSelectedEntry(entry)}
                                                >
                                                    <td className="p-3 text-sm">
                                                        <div className="flex items-center gap-1 text-muted-foreground">
                                                            <Clock className="w-3 h-3" />
                                                            {entry.timestamp &&
                                                                formatDistanceToNow(entry.timestamp)}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {entry.timestamp &&
                                                                new Date(entry.timestamp).toLocaleString("de-DE")}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                                                <User className="w-3 h-3 text-primary" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium">
                                                                    {entry.user_name || entry.user_id}
                                                                </div>
                                                                {entry.user_email && (
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {entry.user_email}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <CategoryIcon className="w-4 h-4 text-muted-foreground" />
                                                            <span
                                                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(
                                                                    entry.action
                                                                )}`}
                                                            >
                                                                {entry.action}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-sm">
                                                        {entry.entity_name ? (
                                                            <div>
                                                                <div className="font-medium">
                                                                    {entry.entity_name}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {entry.entity_type} #{entry.entity_id}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">
                                                        {entry.description || "-"}
                                                    </td>
                                                    <td className="p-3 text-sm">
                                                        {entry.status === "success" ? (
                                                            <span className="inline-flex items-center gap-1 text-green-600">
                                                                <FileCheck className="w-3 h-3" />
                                                                OK
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-red-600">
                                                                <AlertCircle className="w-3 h-3" />
                                                                Fehler
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <Pagination
                                currentPage={logs.page}
                                totalPages={logs.total_pages}
                                onPageChange={(p) => handleFilterChange("page", p)}
                                className="mt-4"
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Detail Modal */}
            <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>Audit-Log Details</DialogTitle>
                    </DialogHeader>
                    {selectedEntry && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-foreground">
                                        Zeitstempel
                                    </label>
                                    <p className="text-sm">
                                        {selectedEntry.timestamp &&
                                            new Date(selectedEntry.timestamp).toLocaleString("de-DE")}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-foreground">
                                        Status
                                    </label>
                                    <p className="text-sm">
                                        {selectedEntry.status === "success" ? (
                                            <span className="text-green-600">Erfolgreich</span>
                                        ) : (
                                            <span className="text-red-600">Fehlgeschlagen</span>
                                        )}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-foreground">
                                        Benutzer
                                    </label>
                                    <p className="text-sm">
                                        {selectedEntry.user_name || selectedEntry.user_id}
                                    </p>
                                    {selectedEntry.user_email && (
                                        <p className="text-xs text-muted-foreground">
                                            {selectedEntry.user_email}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-foreground">
                                        Aktion
                                    </label>
                                    <p className="text-sm">
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(
                                                selectedEntry.action
                                            )}`}
                                        >
                                            {selectedEntry.action}
                                        </span>
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-foreground">
                                        Kategorie
                                    </label>
                                    <p className="text-sm capitalize">{selectedEntry.action_category}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-foreground">
                                        Land
                                    </label>
                                    <p className="text-sm">{selectedEntry.country_code || "-"}</p>
                                </div>
                            </div>

                            {selectedEntry.entity_name && (
                                <div>
                                    <label className="text-xs font-medium text-foreground">
                                        Entität
                                    </label>
                                    <p className="text-sm">
                                        {selectedEntry.entity_name} ({selectedEntry.entity_type} #
                                        {selectedEntry.entity_id})
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-medium text-foreground">
                                    Beschreibung
                                </label>
                                <p className="text-sm">{selectedEntry.description || "-"}</p>
                            </div>

                            {selectedEntry.old_value && (
                                <div>
                                    <label className="text-xs font-medium text-foreground">
                                        Vorheriger Wert
                                    </label>
                                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
                                        {JSON.stringify(selectedEntry.old_value, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {selectedEntry.new_value && (
                                <div>
                                    <label className="text-xs font-medium text-foreground">
                                        Neuer Wert
                                    </label>
                                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
                                        {JSON.stringify(selectedEntry.new_value, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};
