/**
 * Repository Page - Meine Dokumente (Unified View)
 *
 * UX-Refactoring: Zeigt Entwürfe UND fertige Dokumente in einer Liste
 * - Klare Status-Unterscheidung (🟡 Entwurf / ✅ Fertig)
 * - TTL-Warnung für Entwürfe
 * - Einfache Suche
 */

import { useState, useMemo } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
// Card imports removed - using direct div styling for SimpleDocs design
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
    useRepository,
    useRepositoryStats,
    useDocumentTypes,
    useBulkAction,
    useDrafts,
    type RepositoryFilters,
} from "@/hooks/useApi";
import {
    Search,
    Filter,
    FileText,
    Download,
    Trash2,
    Archive,
    ChevronLeft,
    ChevronRight,
    Loader2,
    User,
    Clock,
    Edit3,
    X,
    PlusCircle,
    FileCheck,
    AlertTriangle,
    Play,
} from "lucide-react";
import { DocumentCorrectionDialog } from "@/components/documents/DocumentCorrectionDialog";
import { useFeatureEnabled } from "@/hooks/useFeatureSettings";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useUndo } from "@/hooks/useUndo";
import { formatDistanceToNow } from "@/lib/dateUtils";

export const RepositoryPage = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const undo = useUndo();

    // Feature toggle check
    const isEnabled = useFeatureEnabled("show_documents_overview");
    const [filters, setFilters] = useState<RepositoryFilters>({
        page: 1,
        page_size: 20,
        sort_by: "created_at",
        sort_order: "desc",
    });
    const [showFilters, setShowFilters] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [correctionDocId, setCorrectionDocId] = useState<number | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [pendingAction, setPendingAction] = useState<"delete" | "archive" | null>(null);
    const [activeFilter, setActiveFilter] = useState<"all" | "draft" | "completed" | "corrections">("all");

    const { data: repository, isLoading: loadingDocs, refetch } = useRepository(filters);
    const { data: stats } = useRepositoryStats();
    const { data: documentTypes } = useDocumentTypes();
    const { data: drafts, isLoading: loadingDrafts } = useDrafts();
    const bulkAction = useBulkAction();

    const isLoading = loadingDocs || loadingDrafts;
    const documents = repository?.documents || [];

    // Unified View: Entwürfe + fertige Dokumente kombinieren
    type UnifiedItem = {
        id: number;
        type: "draft" | "document";
        name: string;
        document_type_name?: string | null;
        employee_name?: string | null;
        updated_at?: string;
        created_at?: string;
        days_remaining?: number;
        file_path?: string | null;
        is_correctable?: boolean;
        version_count?: number;
        current_version?: number;
    };

    const unifiedItems = useMemo((): UnifiedItem[] => {
        const items: UnifiedItem[] = [];

        // Entwürfe hinzufügen (oben, da wichtiger)
        if (drafts && Array.isArray(drafts)) {
            drafts.forEach((draft: any) => {
                items.push({
                    id: draft.id,
                    type: "draft",
                    name: draft.name || "Unbenannter Entwurf",
                    document_type_name: draft.document_type_name,
                    updated_at: draft.updated_at,
                    days_remaining: draft.days_remaining,
                });
            });
        }

        // Fertige Dokumente hinzufügen
        documents.forEach((doc) => {
            items.push({
                id: doc.id,
                type: "document",
                name: doc.title || doc.document_type_name || "Dokument",
                document_type_name: doc.document_type_name,
                employee_name: doc.employee_name,
                created_at: doc.created_at,
                file_path: doc.file_path,
                is_correctable: doc.is_correctable,
                version_count: doc.version_count,
                current_version: doc.current_version,
            });
        });

        return items;
    }, [drafts, documents]);

    // Filter by active status card
    const filteredItems = useMemo(() => {
        switch (activeFilter) {
            case "draft": return unifiedItems.filter(i => i.type === "draft");
            case "completed": return unifiedItems.filter(i => i.type === "document");
            case "corrections": return unifiedItems.filter(i => i.type === "document" && i.is_correctable);
            default: return unifiedItems;
        }
    }, [unifiedItems, activeFilter]);

    // Toggle selection
    const toggleSelect = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === documents.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(documents.map((d) => d.id));
        }
    };

    // Update filter
    const updateFilter = (key: keyof RepositoryFilters, value: unknown) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value,
            page: key === "page" ? (value as number) : 1, // Reset to page 1 on filter change
        }));
        setSelectedIds([]);
    };

    // Clear filters
    const clearFilters = () => {
        setFilters({
            page: 1,
            page_size: 20,
            sort_by: "created_at",
            sort_order: "desc",
        });
        setSelectedIds([]);
    };


    // Bulk actions
    const handleBulkAction = async (action: "delete" | "archive" | "export") => {
        if (selectedIds.length === 0) return;

        // Show confirmation dialog for destructive actions
        if (action === "delete" || action === "archive") {
            setPendingAction(action);
            setShowDeleteDialog(true);
            return;
        }

        await executeBulkAction(action);
    };

    const executeBulkAction = async (action: "delete" | "archive" | "export") => {
        const count = selectedIds.length;
        const affectedIds = [...selectedIds];

        try {
            await bulkAction.mutateAsync({
                document_ids: selectedIds,
                action,
            });
            setSelectedIds([]);
            setShowDeleteDialog(false);
            setPendingAction(null);
            refetch();

            // Success feedback with Undo for destructive actions
            const messages: Record<string, string> = {
                delete: `${count} Dokument(e) gelöscht`,
                archive: `${count} Dokument(e) archiviert`,
                export: `Export von ${count} Dokument(en) gestartet`,
            };

            if (action === "delete" || action === "archive") {
                // Register undo action
                undo.registerUndo(
                    messages[action],
                    async () => {
                        try {
                            // Undo: restore deleted or unarchive
                            await bulkAction.mutateAsync({
                                document_ids: affectedIds,
                                action: action === "delete" ? "restore" : "unarchive",
                            });
                            refetch();
                            toast.success("Rückgängig gemacht", `${count} Dokument(e) wiederhergestellt`);
                        } catch (err) {
                            toast.error("Fehler", "Rückgängig machen fehlgeschlagen");
                        }
                    },
                    5000
                );
            } else {
                toast.success("Aktion erfolgreich", messages[action]);
            }
        } catch (error) {
            console.error("Bulk action failed:", error);
            toast.error("Fehler", "Die Aktion konnte nicht ausgeführt werden");
        }
    };

    const confirmBulkAction = () => {
        if (pendingAction) {
            executeBulkAction(pendingAction);
        }
    };


    const hasActiveFilters = !!(
        filters.search ||
        filters.document_type_id ||
        filters.employee_name ||
        filters.date_from ||
        filters.date_to ||
        filters.has_corrections !== undefined
    );

    // Feature disabled state - redirect to dashboard
    if (!isEnabled) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground">Meine Dokumente</h1>
                    <p className="text-muted-foreground mt-1">
                        {drafts?.length ? `${drafts.length} Entwürfe, ` : ""}
                        {stats ? `${stats.total_documents} fertige Dokumente` : "Alle Ihre Dokumente"}
                    </p>
                </div>
                <Link to="/generate">
                    <Button className="h-9 gap-2 btn-primary-soft">
                        <PlusCircle className="w-4 h-4" />
                        Neues Dokument
                    </Button>
                </Link>
            </div>

            {/* Status Filter Cards - EPL Style */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                {[
                    { key: "all" as const, label: "Gesamt", count: (stats?.total_documents ?? 0) + (drafts?.length ?? 0), icon: FileText, color: "text-primary" },
                    { key: "draft" as const, label: "Entwürfe", count: drafts?.length ?? 0, icon: Edit3, color: "text-amber-500" },
                    { key: "completed" as const, label: "Fertig", count: stats?.total_documents ?? 0, icon: FileCheck, color: "text-green-500" },
                    { key: "corrections" as const, label: "Mit Korrekturen", count: stats?.documents_with_corrections ?? 0, icon: AlertTriangle, color: "text-orange-500" },
                ].map(card => (
                    <button
                        key={card.key}
                        onClick={() => setActiveFilter(card.key)}
                        className={`status-card text-left ${activeFilter === card.key ? 'active' : ''}`}
                    >
                        <div className="flex items-center gap-3">
                            <card.icon className={`w-5 h-5 ${card.color}`} />
                            <div>
                                <p className="text-2xl font-bold text-foreground">{card.count}</p>
                                <p className="text-xs text-muted-foreground">{card.label}</p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Search - SimpleDocs Style */}
            <div className="card-soft p-4">
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Dokument suchen..."
                            value={filters.search || ""}
                            onChange={(e) => updateFilter("search", e.target.value || undefined)}
                            className="pl-10 h-10 input-soft"
                        />
                    </div>
                    <Button
                        variant={showFilters ? "default" : "outline"}
                        className="h-10"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter className="w-4 h-4 mr-2" />
                        Filter
                    </Button>
                    {hasActiveFilters && (
                        <Button variant="ghost" className="h-10" onClick={clearFilters}>
                            <X className="w-4 h-4 mr-2" />
                            Zurücksetzen
                        </Button>
                    )}
                </div>

                {/* Erweiterte Filter */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-sm font-medium text-foreground mb-1 block">
                                Dokumenttyp
                            </label>
                            <select
                                value={filters.document_type_id || ""}
                                onChange={(e) =>
                                    updateFilter(
                                        "document_type_id",
                                        e.target.value ? Number(e.target.value) : undefined
                                    )
                                }
                                className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm"
                            >
                                <option value="">Alle Typen</option>
                                {(documentTypes || []).map((dt: { id: number; name: string }) => (
                                    <option key={dt.id} value={dt.id}>
                                        {dt.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground mb-1 block">
                                Von Datum
                            </label>
                            <Input
                                type="date"
                                value={filters.date_from || ""}
                                onChange={(e) =>
                                    updateFilter("date_from", e.target.value || undefined)
                                }
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground mb-1 block">
                                Bis Datum
                            </label>
                            <Input
                                type="date"
                                value={filters.date_to || ""}
                                onChange={(e) =>
                                    updateFilter("date_to", e.target.value || undefined)
                                }
                            />
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                    checked={filters.has_corrections === true}
                                    onCheckedChange={(checked) =>
                                        updateFilter(
                                            "has_corrections",
                                            checked ? true : undefined
                                        )
                                    }
                                />
                                <span className="text-sm">Nur mit Korrekturen</span>
                            </label>
                        </div>
                    </div>
                )}
            </div>

            {/* Bulk Actions - SimpleDocs Style */}
            {selectedIds.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                            {selectedIds.length} ausgewählt
                        </span>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => handleBulkAction("export")}
                                disabled={bulkAction.isPending}
                            >
                                <Download className="w-4 h-4 mr-1" />
                                Export
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => handleBulkAction("archive")}
                                disabled={bulkAction.isPending}
                            >
                                <Archive className="w-4 h-4 mr-1" />
                                Archiv
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                className="h-8"
                                onClick={() => handleBulkAction("delete")}
                                disabled={bulkAction.isPending}
                            >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Löschen
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Document List - SimpleDocs Style */}
            <div className="card-soft">
                <div className="flex items-center justify-between px-4 py-3 border-b info-card-header">
                    <h3 className="font-medium text-foreground">
                        {filteredItems.length} Einträge
                        {activeFilter === "all" && drafts?.length ? ` (${drafts.length} Entwürfe)` : ""}
                    </h3>
                    {documents.length > 0 && (
                        <button
                            onClick={toggleSelectAll}
                            className="text-xs text-primary hover:underline"
                        >
                            {selectedIds.length === documents.length ? "Auswahl aufheben" : "Alle"}
                        </button>
                    )}
                </div>
                <div className="p-2">
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-20 w-full" />
                            ))}
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                                <FileText className="w-8 h-8 text-muted-foreground" />
                            </div>
                            {hasActiveFilters ? (
                                <>
                                    <h3 className="text-lg font-medium mb-2">Keine Treffer</h3>
                                    <p className="text-muted-foreground mb-4">
                                        Versuchen Sie andere Suchkriterien.
                                    </p>
                                    <Button variant="outline" onClick={clearFilters}>
                                        Filter zurücksetzen
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <h3 className="text-lg font-medium mb-2">Noch keine Dokumente</h3>
                                    <p className="text-muted-foreground mb-4">
                                        Erstellen Sie Ihr erstes Dokument.
                                    </p>
                                    <Button onClick={() => navigate("/generate")}>
                                        <PlusCircle className="w-4 h-4 mr-2" />
                                        Dokument erstellen
                                    </Button>
                                </>
                            )}
                        </div>
                    ) : (
                        /* Unified View: Entwürfe + Dokumente */
                        <div className="space-y-2">
                            {filteredItems.map((item) => (
                                <div
                                    key={`${item.type}-${item.id}`}
                                    className={`flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer group ${item.type === "draft"
                                            ? "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-300 dark:hover:border-amber-700"
                                            : "hover:bg-warm-50 hover:border-primary/30"
                                        }`}
                                    onClick={() =>
                                        item.type === "draft"
                                            ? navigate(`/generate?draft=${item.id}`)
                                            : navigate(`/documents/${item.id}`)
                                    }
                                >
                                    {/* Checkbox - nur für fertige Dokumente */}
                                    {item.type === "document" ? (
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedIds.includes(item.id)}
                                                onCheckedChange={() => toggleSelect(item.id)}
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-5" /> // Platzhalter für Alignment
                                    )}

                                    {/* Status-Icon */}
                                    <div className={`p-2 rounded-lg transition-colors ${item.type === "draft"
                                            ? "bg-amber-100 dark:bg-amber-900/40 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/60"
                                            : "bg-green-50 dark:bg-green-950/30 group-hover:bg-green-100 dark:group-hover:bg-green-900/40"
                                        }`}>
                                        {item.type === "draft" ? (
                                            <Edit3 className="w-5 h-5 text-amber-600" />
                                        ) : (
                                            <FileCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            {/* Status Badge */}
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.type === "draft"
                                                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                                                    : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                                                }`}>
                                                {item.type === "draft" ? "Entwurf" : "Fertig"}
                                            </span>
                                            <p className="font-medium truncate" title={item.name}>{item.name}</p>
                                            {item.version_count && item.version_count > 1 && (
                                                <span className="text-xs bg-warm-100 text-warm-600 px-2 py-0.5 rounded-full">
                                                    v{item.current_version}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            {item.document_type_name && (
                                                <span>{item.document_type_name}</span>
                                            )}
                                            {item.employee_name && (
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {item.employee_name}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {item.type === "draft" && item.updated_at
                                                    ? formatDistanceToNow(item.updated_at)
                                                    : item.created_at
                                                        ? formatDistanceToNow(item.created_at)
                                                        : ""}
                                            </span>
                                            {/* TTL-Warnung für Entwürfe */}
                                            {item.type === "draft" && item.days_remaining !== undefined && item.days_remaining <= 7 && (
                                                <span className="flex items-center gap-1 text-amber-600 font-medium">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    {item.days_remaining === 0
                                                        ? "Läuft heute ab!"
                                                        : `Noch ${item.days_remaining} Tage`}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                        {item.type === "draft" ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1"
                                                onClick={() => navigate(`/generate?draft=${item.id}`)}
                                            >
                                                <Play className="w-4 h-4" />
                                                Fortsetzen
                                            </Button>
                                        ) : (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => item.file_path && window.open(item.file_path, "_blank")}
                                                >
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                                {item.is_correctable && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setCorrectionDocId(item.id)}
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {repository && repository.total_pages > 1 && (
                        <div className="flex items-center justify-between mt-6 pt-4 border-t">
                            <p className="text-sm text-muted-foreground">
                                Seite {repository.page} von {repository.total_pages}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={repository.page <= 1}
                                    onClick={() => updateFilter("page", repository.page - 1)}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={repository.page >= repository.total_pages}
                                    onClick={() => updateFilter("page", repository.page + 1)}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Correction Dialog */}
            {correctionDocId && (
                <DocumentCorrectionDialog
                    documentId={correctionDocId}
                    open={!!correctionDocId}
                    onOpenChange={(open) => !open && setCorrectionDocId(null)}
                    onSuccess={() => {
                        refetch();
                        setCorrectionDocId(null);
                    }}
                />
            )}

            {/* Delete Confirmation */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {pendingAction === "delete" ? "Dokumente löschen?" : "Dokumente archivieren?"}
                        </DialogTitle>
                        <DialogDescription>
                            {pendingAction === "delete" ? (
                                <>
                                    <strong>{selectedIds.length}</strong> Dokument(e) werden unwiderruflich gelöscht.
                                </>
                            ) : (
                                <>
                                    <strong>{selectedIds.length}</strong> Dokument(e) werden archiviert.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowDeleteDialog(false);
                                setPendingAction(null);
                            }}
                        >
                            Abbrechen
                        </Button>
                        <Button
                            variant={pendingAction === "delete" ? "destructive" : "default"}
                            onClick={confirmBulkAction}
                            disabled={bulkAction.isPending}
                        >
                            {bulkAction.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {pendingAction === "delete" ? "Löschen" : "Archivieren"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

