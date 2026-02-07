/**
 * Clause Management Page
 *
 * Admin page for managing document clauses:
 * - List all clauses by category
 * - Create, edit, delete clauses
 * - Version history
 * - Search and filter
 * - Bulk actions
 */

import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Plus,
    Search,
    FileText,
    Edit,
    Trash2,
    History,
    Filter,
    Loader2,
    FileUp,
    MoreVertical,
    Eye,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Sparkles,
    Layers,
    GitCompare,
    LayoutGrid,
    List,
    Copy,
} from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import {
    useClauses,
    useDeleteClause,
    useClauseVersions,
    useRestoreClauseVersion,
    useCreateClause,
    type Clause,
} from "@/hooks/useApi";
import { WordImportWizard } from "@/components/admin/WordImportWizard";
import { ClauseFormDialog } from "@/components/clauses/ClauseFormDialog";
import { ClauseVariantManager } from "@/components/clauses/ClauseVariantManager";
import { ClauseVersionDiff } from "@/components/clauses/ClauseVersionDiff";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { sanitizeHtml } from "@/utils/sanitize";

// Version History Dialog Component
const VersionHistoryDialog = ({
    open,
    onOpenChange,
    clause,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clause: Clause | null;
}) => {
    const { data: versions, isLoading } = useClauseVersions(clause?.id || 0);
    const restoreMutation = useRestoreClauseVersion();

    if (!clause) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="w-5 h-5 text-primary" />
                        Versionshistorie
                    </DialogTitle>
                    <DialogDescription>
                        {clause.title} - Alle Versionen
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : versions && versions.length > 0 ? (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {versions.map((version: any, index: number) => (
                                <div
                                    key={version.id}
                                    className={cn(
                                        "flex items-center justify-between p-3 rounded-lg border",
                                        index === 0 ? "bg-primary/5 border-primary/20" : "border-border"
                                    )}
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">Version {version.version}</span>
                                            {index === 0 && (
                                                <Badge className="bg-secondary/10 text-secondary text-xs">
                                                    Aktuell
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {new Date(version.created_at).toLocaleString("de-DE")}
                                        </p>
                                    </div>
                                    {index > 0 && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                restoreMutation.mutate({
                                                    clauseId: clause.id,
                                                    versionId: version.id,
                                                });
                                            }}
                                            disabled={restoreMutation.isPending}
                                        >
                                            {restoreMutation.isPending ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                "Wiederherstellen"
                                            )}
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>Keine Versionshistorie verfügbar</p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Schließen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Delete Confirmation Dialog with Impact Analysis
const DeleteConfirmDialog = ({
    open,
    onOpenChange,
    clause,
    onConfirm,
    isDeleting,
    usageCount = 0,
    usedInTypes = [],
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clause: Clause | null;
    onConfirm: () => void;
    isDeleting: boolean;
    usageCount?: number;
    usedInTypes?: string[];
}) => {
    if (!clause) return null;

    const hasUsage = usageCount > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md" aria-describedby="delete-clause-description">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                        Klausel löschen
                    </DialogTitle>
                    <DialogDescription id="delete-clause-description">
                        Diese Aktion kann nicht rückgängig gemacht werden.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-3">
                    {/* Impact Warning */}
                    {hasUsage && (
                        <Card className="border-amber-300 bg-amber-50">
                            <CardContent className="py-3">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                                    <div>
                                        <p className="text-sm font-medium text-amber-800">
                                            Diese Klausel wird verwendet
                                        </p>
                                        <p className="text-xs text-amber-700 mt-1">
                                            {usageCount} Dokumenttyp{usageCount !== 1 ? "en" : ""} verwenden diese Klausel:
                                        </p>
                                        {usedInTypes.length > 0 && (
                                            <ul className="text-xs text-amber-700 mt-1 list-disc list-inside">
                                                {usedInTypes.slice(0, 3).map((type, i) => (
                                                    <li key={i}>{type}</li>
                                                ))}
                                                {usedInTypes.length > 3 && (
                                                    <li>und {usedInTypes.length - 3} weitere...</li>
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Deletion Warning */}
                    <Card className="border-destructive/30 bg-destructive/5">
                        <CardContent className="py-3">
                            <p className="text-sm text-destructive">
                                Sind Sie sicher, dass Sie die Klausel{" "}
                                <strong>"{clause.title}"</strong> löschen möchten?
                            </p>
                            <p className="text-xs text-destructive/80 mt-2">
                                {hasUsage
                                    ? "Die Klausel wird aus allen oben genannten Dokumenttypen entfernt. Bestehende Dokumente sind nicht betroffen."
                                    : "Diese Klausel wird derzeit nicht verwendet."}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isDeleting}
                    >
                        Abbrechen
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        aria-label={`Klausel ${clause.title} endgültig löschen`}
                    >
                        {isDeleting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                        ) : (
                            <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
                        )}
                        Endgültig löschen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Clause Preview Dialog
const ClausePreviewDialog = ({
    open,
    onOpenChange,
    clause,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clause: Clause | null;
}) => {
    if (!clause) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-primary" />
                        {clause.title}
                    </DialogTitle>
                    <DialogDescription>
                        <div className="flex gap-2 mt-2">
                            <Badge className="bg-primary/10 text-primary">
                                {clause.category || "Allgemein"}
                            </Badge>
                            <Badge className="bg-secondary/10 text-secondary">
                                {clause.country_code === "DE" ? "🇩🇪 Deutschland" : "🇮🇹 Italien"}
                            </Badge>
                            <Badge variant="outline">v{clause.version || "1.0"}</Badge>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 overflow-y-auto max-h-[50vh]">
                    <div className="p-4 bg-background rounded-lg">
                        <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(clause.content || "") }}
                        />
                    </div>

                    {clause.placeholders && clause.placeholders.length > 0 && (
                        <div className="mt-4">
                            <p className="text-sm font-medium text-foreground mb-2">
                                Verwendete Platzhalter:
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {clause.placeholders.map((ph: string) => (
                                    <Badge
                                        key={ph}
                                        variant="outline"
                                        className="font-mono text-xs"
                                    >
                                        {`{{${ph}}}`}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Schließen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Kategorie-Farbzuordnung für visuelle Orientierung
const CATEGORY_COLORS: Record<string, string> = {
    'Einleitung': 'border-l-blue-500',
    'Vergütung': 'border-l-emerald-500',
    'Kündigung': 'border-l-red-500',
    'Arbeitszeit': 'border-l-amber-500',
    'Urlaub': 'border-l-cyan-500',
    'Nebentätigkeit': 'border-l-purple-500',
    'Geheimhaltung': 'border-l-slate-500',
    'Wettbewerb': 'border-l-orange-500',
    'Probezeit': 'border-l-lime-500',
    'Sonstiges': 'border-l-gray-400',
    'Allgemein': 'border-l-primary',
};

const getCategoryColor = (category: string | undefined): string => {
    if (!category) return CATEGORY_COLORS['Allgemein'];
    return CATEGORY_COLORS[category] || 'border-l-primary';
};

export const ClausesPage = () => {
    // View Mode State mit localStorage Persistenz
    const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('clauses-view-mode') as 'cards' | 'table') || 'cards';
        }
        return 'cards';
    });

    // Persist view mode to localStorage
    useEffect(() => {
        localStorage.setItem('clauses-view-mode', viewMode);
    }, [viewMode]);

    // Ref für Suchfeld (Keyboard Shortcut)
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Filter State mit localStorage Persistenz
    const [searchQuery, setSearchQuery] = useState("");
    const [countryFilter, setCountryFilter] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('clauses-country-filter') || 'all';
        }
        return 'all';
    });
    const [categoryFilter, setCategoryFilter] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('clauses-category-filter') || 'all';
        }
        return 'all';
    });
    const [statusFilter, setStatusFilter] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('clauses-status-filter') || 'all';
        }
        return 'all';
    });

    // Persist filters to localStorage
    useEffect(() => {
        localStorage.setItem('clauses-country-filter', countryFilter);
    }, [countryFilter]);

    useEffect(() => {
        localStorage.setItem('clauses-category-filter', categoryFilter);
    }, [categoryFilter]);

    useEffect(() => {
        localStorage.setItem('clauses-status-filter', statusFilter);
    }, [statusFilter]);

    // Dialog State
    const [showImportWizard, setShowImportWizard] = useState(false);
    const [showClauseForm, setShowClauseForm] = useState(false);
    const [editingClause, setEditingClause] = useState<Clause | null>(null);
    const [showVersionHistory, setShowVersionHistory] = useState(false);
    const [selectedClause, setSelectedClause] = useState<Clause | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [clauseToDelete, setClauseToDelete] = useState<Clause | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [previewClause, setPreviewClause] = useState<Clause | null>(null);

    // Toast Hook
    const toast = useToast();

    // API Hooks
    const { data: clauses, isLoading, refetch } = useClauses(
        countryFilter !== "all" ? countryFilter : undefined
    );
    const deleteMutation = useDeleteClause();
    const createMutation = useCreateClause();

    // Filter clauses
    const filteredClauses = useMemo(() => {
        return clauses?.filter((clause: Clause) => {
            const matchesSearch =
                searchQuery === "" ||
                clause.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                clause.content?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCategory =
                categoryFilter === "all" || clause.category === categoryFilter;

            const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "active" && clause.is_active) ||
                (statusFilter === "inactive" && !clause.is_active);

            return matchesSearch && matchesCategory && matchesStatus;
        }) ?? [];
    }, [clauses, searchQuery, categoryFilter, statusFilter]);

    // Get unique categories from clauses
    const categories = useMemo(() => {
        return Array.from(
            new Set(clauses?.map((c: Clause) => c.category).filter(Boolean) ?? [])
        );
    }, [clauses]);

    // Stats
    const stats = useMemo(() => ({
        total: clauses?.length || 0,
        active: clauses?.filter((c: Clause) => c.is_active).length || 0,
        inactive: clauses?.filter((c: Clause) => !c.is_active).length || 0,
        categories: categories.length,
    }), [clauses, categories]);

    // Handlers
    const handleCreateClause = () => {
        setEditingClause(null);
        setShowClauseForm(true);
    };

    const handleEditClause = (clause: Clause) => {
        setEditingClause(clause);
        setShowClauseForm(true);
    };

    const handleViewHistory = (clause: Clause) => {
        setSelectedClause(clause);
        setShowVersionHistory(true);
    };

    const handleDeleteClause = (clause: Clause) => {
        setClauseToDelete(clause);
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        if (!clauseToDelete) return;

        try {
            await deleteMutation.mutateAsync(clauseToDelete.id);
            setShowDeleteConfirm(false);
            setClauseToDelete(null);
            toast.success("Klausel gelöscht", `"${clauseToDelete.title}" wurde erfolgreich gelöscht`);
        } catch (error) {
            console.error("Delete failed:", error);
            toast.error("Löschen fehlgeschlagen", "Die Klausel konnte nicht gelöscht werden");
        }
    };

    // Duplikat-Handler
    const handleDuplicateClause = async (clause: Clause) => {
        try {
            const duplicateData = {
                title: `${clause.title} (Kopie)`,
                content_html: clause.content || "",
                country_code: clause.country_code || "DE",
                category: clause.category || "Sonstiges",
                is_active: true,
            };

            await createMutation.mutateAsync(duplicateData);
            toast.success("Klausel dupliziert", `Kopie von "${clause.title}" wurde erstellt`);
            refetch();
        } catch (error) {
            console.error("Duplicate failed:", error);
            toast.error("Duplizieren fehlgeschlagen", "Die Klausel konnte nicht kopiert werden");
        }
    };

    const handlePreviewClause = (clause: Clause) => {
        setPreviewClause(clause);
        setShowPreview(true);
    };

    const handleClauseFormSuccess = (clause: Clause) => {
        setShowClauseForm(false);
        const wasEditing = editingClause !== null;
        setEditingClause(null);
        refetch();

        // Toast-Feedback
        if (wasEditing) {
            toast.success("Klausel aktualisiert", `"${clause.title}" wurde gespeichert`);
        } else {
            toast.success("Klausel erstellt", `"${clause.title}" wurde erfolgreich erstellt`);
        }
    };

    // State für aktiven Tab
    const [activeTab, setActiveTab] = useState("clauses");

    // State für Versionsvergleich
    const [showVersionDiff, setShowVersionDiff] = useState(false);
    const [diffClause, setDiffClause] = useState<Clause | null>(null);

    const handleShowVersionDiff = (clause: Clause) => {
        setDiffClause(clause);
        setShowVersionDiff(true);
    };

    // Keyboard Shortcuts integrieren
    useKeyboardShortcuts({
        onSearch: () => searchInputRef.current?.focus(),
        onNewDocument: handleCreateClause,
    });

    // Anzahl aktiver Filter berechnen
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (countryFilter !== "all") count++;
        if (categoryFilter !== "all") count++;
        if (statusFilter !== "all") count++;
        if (searchQuery) count++;
        return count;
    }, [countryFilter, categoryFilter, statusFilter, searchQuery]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Textbausteine
                    </h1>
                    <p className="text-muted-foreground">
                        Verwalten Sie wiederverwendbare Textblöcke für Ihre Dokumente
                    </p>
                </div>
                <div className="flex gap-2">
                    {/* View Mode Toggle */}
                    <div className="flex border rounded-md">
                        <Button
                            variant={viewMode === 'cards' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-9 w-9 rounded-r-none"
                            onClick={() => setViewMode('cards')}
                            title="Karten-Ansicht"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'table' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-9 w-9 rounded-l-none border-l"
                            onClick={() => setViewMode('table')}
                            title="Tabellen-Ansicht"
                        >
                            <List className="w-4 h-4" />
                        </Button>
                    </div>
                    <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => setShowImportWizard(true)}
                    >
                        <FileUp className="w-4 h-4" />
                        <span className="hidden sm:inline">Word importieren</span>
                    </Button>
                    <Button
                        className="gap-2 bg-primary hover:bg-primary/90"
                        onClick={handleCreateClause}
                    >
                        <Plus className="w-4 h-4" />
                        Neuer Textbaustein
                    </Button>
                </div>
            </div>

            {/* Tabs für Textbausteine und Varianten */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="clauses" className="gap-2">
                        <FileText className="w-4 h-4" />
                        Textbausteine
                    </TabsTrigger>
                    <TabsTrigger value="variants" className="gap-2">
                        <Layers className="w-4 h-4" />
                        Varianten
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="clauses" className="mt-6 space-y-6">
                    {/* Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <FileText className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                                <p className="text-xs text-muted-foreground">Gesamt</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-secondary/10 rounded-lg">
                                <CheckCircle2 className="w-5 h-5 text-secondary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                                <p className="text-xs text-muted-foreground">Aktiv</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-border/30 rounded-lg">
                                <XCircle className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{stats.inactive}</p>
                                <p className="text-xs text-muted-foreground">Inaktiv</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-lg">
                                <Sparkles className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{stats.categories}</p>
                                <p className="text-xs text-muted-foreground">Kategorien</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    ref={searchInputRef}
                                    placeholder="Klauseln durchsuchen... (Strg+K)"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <Select value={countryFilter} onValueChange={setCountryFilter}>
                            <SelectTrigger className="w-[150px]">
                                <Filter className="w-4 h-4 mr-2" />
                                <SelectValue placeholder="Land" />
                                {activeFilterCount > 0 && (
                                    <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-primary">
                                        {activeFilterCount}
                                    </Badge>
                                )}
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle Länder</SelectItem>
                                <SelectItem value="DE">🇩🇪 Deutschland</SelectItem>
                                <SelectItem value="IT">🇮🇹 Italien</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Kategorie" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle Kategorien</SelectItem>
                                {categories.map((cat) => (
                                    <SelectItem key={cat as string} value={cat as string}>
                                        {cat as string}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle Status</SelectItem>
                                <SelectItem value="active">Aktiv</SelectItem>
                                <SelectItem value="inactive">Inaktiv</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Clauses List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : filteredClauses.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-16 text-center">
                        {/* Animated Icon */}
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/5 flex items-center justify-center">
                            <FileText className="w-10 h-10 text-primary/40" />
                        </div>

                        {searchQuery || categoryFilter !== "all" || statusFilter !== "all" ? (
                            // Filter aktiv - keine Ergebnisse
                            <>
                                <p className="text-lg font-medium text-foreground mb-2">
                                    Keine Textbausteine gefunden
                                </p>
                                <p className="text-muted-foreground mb-4">
                                    Versuchen Sie andere Filterkriterien oder erstellen Sie einen neuen Textbaustein.
                                </p>
                            </>
                        ) : (
                            // Keine Textbausteine vorhanden - Onboarding
                            <>
                                <p className="text-xl font-semibold text-foreground mb-2">
                                    Willkommen bei den Textbausteinen!
                                </p>
                                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                                    Textbausteine sind wiederverwendbare Absätze für Ihre Dokumente.
                                    Erstellen Sie z.B. Bausteine für <span className="font-medium">„Arbeitszeit"</span>,
                                    <span className="font-medium"> „Kündigungsfrist"</span> oder
                                    <span className="font-medium"> „Geheimhaltung"</span>.
                                </p>

                                {/* Visual Guide */}
                                <div className="flex justify-center gap-4 mb-6 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</div>
                                        <span>Baustein erstellen</span>
                                    </div>
                                    <span className="text-border">→</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</div>
                                        <span>In Vorlage einfügen</span>
                                    </div>
                                    <span className="text-border">→</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</div>
                                        <span>Dokument generieren</span>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleCreateClause}
                                    size="lg"
                                    className="bg-primary hover:bg-primary/90"
                                >
                                    <Plus className="w-5 h-5 mr-2" />
                                    Ersten Textbaustein erstellen
                                </Button>

                                <p className="text-xs text-muted-foreground mt-4">
                                    💡 Tipp: Sie können auch bestehende Word-Dokumente importieren
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>
            ) : viewMode === 'table' ? (
                /* Tabellen-Ansicht */
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[300px]">Titel</TableHead>
                                <TableHead>Kategorie</TableHead>
                                <TableHead>Land</TableHead>
                                <TableHead>Version</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aktionen</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredClauses.map((clause: Clause) => (
                                <TableRow
                                    key={clause.id}
                                    className={cn(
                                        "border-l-4",
                                        getCategoryColor(clause.category),
                                        !clause.is_active && "opacity-60"
                                    )}
                                >
                                    <TableCell className="font-medium">
                                        <button
                                            onClick={() => handlePreviewClause(clause)}
                                            className="text-left hover:text-primary hover:underline"
                                        >
                                            {clause.title}
                                        </button>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className="bg-primary/10 text-primary">
                                            {clause.category || "Allgemein"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {clause.country_code === "DE" ? "🇩🇪" : "🇮🇹"} {clause.country_code}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-muted-foreground">
                                            v{clause.version || "1.0"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {clause.is_active ? (
                                            <Badge className="bg-secondary/10 text-secondary">Aktiv</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground">Inaktiv</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleEditClause(clause)}
                                                title="Bearbeiten"
                                            >
                                                <Edit className="w-4 h-4 text-primary" />
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleEditClause(clause)}>
                                                        <Edit className="w-4 h-4 mr-2" />
                                                        Bearbeiten
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handlePreviewClause(clause)}>
                                                        <Eye className="w-4 h-4 mr-2" />
                                                        Vorschau
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDuplicateClause(clause)}>
                                                        <Copy className="w-4 h-4 mr-2" />
                                                        Duplizieren
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleViewHistory(clause)}>
                                                        <History className="w-4 h-4 mr-2" />
                                                        Versionshistorie
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleShowVersionDiff(clause)}>
                                                        <GitCompare className="w-4 h-4 mr-2" />
                                                        Versionen vergleichen
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => handleDeleteClause(clause)}
                                                        className="text-red-600 focus:text-red-600"
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Löschen
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            ) : (
                /* Karten-Ansicht */
                <div className="grid gap-4">
                    {filteredClauses.map((clause: Clause) => (
                        <Card
                            key={clause.id}
                            className={cn(
                                "hover:shadow-md transition-shadow border-l-4",
                                getCategoryColor(clause.category),
                                !clause.is_active && "opacity-60"
                            )}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <CardTitle className="text-lg text-foreground flex items-center gap-2">
                                            <span className="truncate">{clause.title}</span>
                                            {!clause.is_active && (
                                                <Badge variant="outline" className="text-muted-foreground shrink-0">
                                                    Inaktiv
                                                </Badge>
                                            )}
                                        </CardTitle>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <Badge className="bg-primary/10 text-primary">
                                                {clause.category || "Allgemein"}
                                            </Badge>
                                            <Badge className="bg-secondary/10 text-secondary">
                                                {clause.country_code === "DE" ? "🇩🇪" : "🇮🇹"} {clause.country_code}
                                            </Badge>
                                            <Badge variant="outline" className="text-muted-foreground">
                                                v{clause.version || "1.0"}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handlePreviewClause(clause)}
                                            title="Vorschau"
                                        >
                                            <Eye className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleViewHistory(clause)}
                                            title="Versionshistorie"
                                        >
                                            <History className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleEditClause(clause)}
                                            title="Bearbeiten"
                                        >
                                            <Edit className="w-4 h-4 text-primary" />
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEditClause(clause)}>
                                                    <Edit className="w-4 h-4 mr-2" />
                                                    Bearbeiten
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handlePreviewClause(clause)}>
                                                    <Eye className="w-4 h-4 mr-2" />
                                                    Vorschau
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDuplicateClause(clause)}>
                                                    <Copy className="w-4 h-4 mr-2" />
                                                    Duplizieren
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleViewHistory(clause)}>
                                                    <History className="w-4 h-4 mr-2" />
                                                    Versionshistorie
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleShowVersionDiff(clause)}>
                                                    <GitCompare className="w-4 h-4 mr-2" />
                                                    Versionen vergleichen
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => handleDeleteClause(clause)}
                                                    className="text-red-600 focus:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Löschen
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {clause.content?.replace(/<[^>]*>/g, "").slice(0, 200)}
                                    {(clause.content?.length || 0) > 200 ? "..." : ""}
                                </p>
                                {clause.placeholders && clause.placeholders.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1">
                                        {clause.placeholders.slice(0, 5).map((ph: string) => (
                                            <span
                                                key={ph}
                                                className="text-xs px-2 py-0.5 rounded bg-primary/5 text-primary font-mono"
                                            >
                                                {`{{${ph}}}`}
                                            </span>
                                        ))}
                                        {clause.placeholders.length > 5 && (
                                            <span className="text-xs text-muted-foreground px-2 py-0.5">
                                                +{clause.placeholders.length - 5} weitere
                                            </span>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
                </TabsContent>

                {/* Varianten Tab */}
                <TabsContent value="variants" className="mt-6">
                    <ClauseVariantManager
                        countryCode={countryFilter !== "all" ? countryFilter : "DE"}
                    />
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            <WordImportWizard
                open={showImportWizard}
                onOpenChange={setShowImportWizard}
                countryCode={countryFilter !== "all" ? countryFilter : "DE"}
                onImportComplete={() => {
                    refetch();
                    setShowImportWizard(false);
                }}
            />

            <ClauseFormDialog
                open={showClauseForm}
                onOpenChange={setShowClauseForm}
                editClause={editingClause}
                defaultCountryCode={countryFilter !== "all" ? countryFilter : "DE"}
                onSuccess={handleClauseFormSuccess}
            />

            <VersionHistoryDialog
                open={showVersionHistory}
                onOpenChange={setShowVersionHistory}
                clause={selectedClause}
            />

            <DeleteConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                clause={clauseToDelete}
                onConfirm={handleConfirmDelete}
                isDeleting={deleteMutation.isPending}
            />

            <ClausePreviewDialog
                open={showPreview}
                onOpenChange={setShowPreview}
                clause={previewClause}
            />

            {diffClause && (
                <ClauseVersionDiff
                    open={showVersionDiff}
                    onOpenChange={setShowVersionDiff}
                    clauseId={diffClause.id}
                    clauseTitle={diffClause.title}
                />
            )}
        </div>
    );
};
