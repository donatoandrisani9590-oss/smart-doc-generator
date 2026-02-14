/**
 * DocumentDesigner - Visueller Drag & Drop Dokumenten-Designer
 *
 * Implementiert Kapitel 3.3 der v4.2 Spezifikation:
 * - Visuelles Zusammenstellen von Dokumenttypen aus Textbausteine per Drag & Drop
 * - Textbausteine aus Bibliothek in Dokument ziehen
 * - Reihenfolge ändern per Drag & Drop
 * - Pflicht/Optional Toggle
 * - Bedingungen setzen (Conditional)
 * - Anlagen zuweisen
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Plus,
    Check,
    FileText,
    Save,
    ArrowLeft,
    Search,
    FolderOpen,
    Loader2,
    Paperclip,
    Layers,
    Play,
    Info,
    X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useVariantGroups, useTestPreview, useSyncFormFields, type VariantGroup, type SyncResult } from "@/hooks/useApi";
import { sanitizeHtml } from "@/utils/sanitize";
import "@/styles/preview.css";
import { RefreshCw, AlertTriangle } from "lucide-react";

import type { Clause, ClauseCondition, AssignedClause, Attachment, AssignedAttachment } from "./types";
import { listItemVariants, listTransition } from "./constants";
import { SortableClause } from "./SortableClause";
import { ConditionEditor } from "./ConditionEditor";

export const DocumentDesigner = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t: _t } = useTranslation();
    const isNewDocument = !id || id === "new";

    // Document Type State
    const [documentType, setDocumentType] = useState({
        name: "",
        description: "",
        category: "Verträge",
        country_code: "DE",
        is_active: true,
    });

    // Available clauses from library
    const [availableClauses, _setAvailableClauses] = useState<Clause[]>([
        { id: 101, title: "§1 Vertragsparteien", category: "Allgemein", version: "1.0", placeholders: ["mitarbeiter_vorname", "mitarbeiter_nachname", "company_name"] },
        { id: 102, title: "§2 Tätigkeit und Aufgaben", category: "Allgemein", version: "1.0", placeholders: ["position", "abteilung"] },
        { id: 103, title: "§3 Vergütung", category: "Vergütung", version: "2.1", placeholders: ["monatsgehalt", "zahlungstermin"] },
        { id: 104, title: "§4 Arbeitszeit", category: "Arbeitszeit", version: "1.0", placeholders: ["wochenstunden", "kernarbeitszeit"] },
        { id: 105, title: "§5 Urlaub", category: "Urlaub", version: "1.0", placeholders: ["urlaubstage"] },
        { id: 106, title: "§6 Firmenwagen", category: "Vergütung", version: "1.2", placeholders: ["fahrzeugklasse", "eigenanteil"] },
        { id: 107, title: "§7 Homeoffice-Regelung", category: "Arbeitszeit", version: "1.0", placeholders: ["homeoffice_tage", "ausstattung"] },
        { id: 108, title: "§8 Bonus und Prämien", category: "Vergütung", version: "1.0", placeholders: ["bonus_prozent", "zielvereinbarung"] },
        { id: 109, title: "§9 Probezeit", category: "Allgemein", version: "1.0", placeholders: ["probezeit_monate"] },
        { id: 110, title: "§10 Kündigung", category: "Beendigung", version: "1.0", placeholders: ["kuendigungsfrist"] },
        { id: 111, title: "§11 Geheimhaltung", category: "Sonstiges", version: "1.0", placeholders: [] },
        { id: 112, title: "§12 Schlussbestimmungen", category: "Sonstiges", version: "1.0", placeholders: [] },
    ]);

    // Assigned clauses (sortable)
    const [assignedClauses, setAssignedClauses] = useState<AssignedClause[]>([]);

    // Available attachments
    const [availableAttachments, _setAvailableAttachments] = useState<Attachment[]>([
        { id: 1, name: "Datenschutzvereinbarung", file_type: "pdf", page_count: 5 },
        { id: 2, name: "Hausordnung", file_type: "pdf", page_count: 3 },
        { id: 3, name: "Betriebsvereinbarung IT", file_type: "pdf", page_count: 8 },
    ]);

    // Assigned attachments
    const [assignedAttachments, setAssignedAttachments] = useState<AssignedAttachment[]>([]);

    // UI State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [activeId, setActiveId] = useState<string | null>(null);
    const [conditionDialogOpen, setConditionDialogOpen] = useState(false);
    const [editingClause, setEditingClause] = useState<AssignedClause | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(!isNewDocument);
    const [libraryTab, setLibraryTab] = useState<"clauses" | "variants">("clauses");
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);
    const [previewHtml, setPreviewHtml] = useState<string>("");

    // Variant Groups
    const { data: variantGroups = [], isLoading: isLoadingVariants } = useVariantGroups(documentType.country_code);

    // Form Field Sync
    const syncFormFieldsMutation = useSyncFormFields();
    const [showSyncResultDialog, setShowSyncResultDialog] = useState(false);
    const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

    // Test Preview Mutation
    const testPreviewMutation = useTestPreview();

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Load data from API
    useEffect(() => {
        const loadData = async () => {
            try {
                // In production, load from API
                // const clausesRes = await fetch(`/api/v1/clauses?country_code=${documentType.country_code}`);
                // if (clausesRes.ok) setAvailableClauses(await clausesRes.json());

                if (!isNewDocument && id) {
                    // Load document type details
                    // const dtRes = await fetch(`/api/v1/document-types/${id}`);
                    // Load assigned clauses
                    // const assignedRes = await fetch(`/api/v1/document-types/${id}/clauses`);
                }
            } catch (error) {
                console.error("Error loading data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [id, isNewDocument, documentType.country_code]);

    // Get unique categories
    const categories = ["all", ...new Set(availableClauses.map((c) => c.category).filter(Boolean))];

    // Filter clauses
    const filteredClauses = availableClauses.filter((clause) => {
        const matchesSearch =
            clause.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            clause.category?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === "all" || clause.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    // Collect all placeholders from assigned clauses
    const allPlaceholders = [
        ...new Set(assignedClauses.flatMap((ac) => ac.placeholders || [])),
    ];

    // DnD Handlers
    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            setAssignedClauses((items) => {
                const oldIndex = items.findIndex((i) => i.uniqueId === active.id);
                const newIndex = items.findIndex((i) => i.uniqueId === over.id);

                const newItems = arrayMove(items, oldIndex, newIndex);
                return newItems.map((item, idx) => ({ ...item, order: idx + 1 }));
            });
        }
    };

    // Add clause to document
    const handleAddClause = (clause: Clause) => {
        const newClause: AssignedClause = {
            ...clause,
            uniqueId: `clause-${clause.id}-${Date.now()}`,
            order: assignedClauses.length + 1,
            is_mandatory: true,
            condition: null,
        };
        setAssignedClauses([...assignedClauses, newClause]);
    };

    // Remove clause
    const handleRemoveClause = (uniqueId: string) => {
        setAssignedClauses((items) =>
            items
                .filter((i) => i.uniqueId !== uniqueId)
                .map((item, idx) => ({ ...item, order: idx + 1 }))
        );
    };

    // Toggle mandatory
    const handleToggleMandatory = (uniqueId: string) => {
        setAssignedClauses((items) =>
            items.map((item) =>
                item.uniqueId === uniqueId
                    ? { ...item, is_mandatory: !item.is_mandatory }
                    : item
            )
        );
    };

    // Edit condition
    const handleEditCondition = (clause: AssignedClause) => {
        setEditingClause(clause);
        setConditionDialogOpen(true);
    };

    // Save condition
    const handleSaveCondition = (condition: ClauseCondition | null) => {
        if (!editingClause) return;

        setAssignedClauses((items) =>
            items.map((item) =>
                item.uniqueId === editingClause.uniqueId ? { ...item, condition } : item
            )
        );
        setConditionDialogOpen(false);
        setEditingClause(null);
    };

    // Add variant group (as a clause with variant selection)
    const handleAddVariantGroup = (group: VariantGroup) => {
        // Get the default variant or first variant
        const defaultVariant = group.variants.find(v => v.is_default) || group.variants[0];
        if (!defaultVariant) return;

        const newClause: AssignedClause = {
            id: defaultVariant.clause_id,
            title: group.name,
            category: group.category || "Varianten",
            version: "1.0",
            placeholders: [],
            uniqueId: `variant-group-${group.id}-${Date.now()}`,
            order: assignedClauses.length + 1,
            is_mandatory: true,
            condition: null,
            variant_group_id: group.id,
            variant_group_name: group.name,
            clause_type: "variant",
        };
        setAssignedClauses([...assignedClauses, newClause]);
    };

    // Handle test preview
    const handleTestPreview = async () => {
        const clauseIds = assignedClauses.map(c => c.id);
        if (clauseIds.length === 0) {
            alert("Bitte fügen Sie mindestens einen Textbaustein hinzu");
            return;
        }

        try {
            const html = await testPreviewMutation.mutateAsync({
                clauseIds,
                useSampleData: true,
            });
            setPreviewHtml(html);
            setShowPreviewDialog(true);
        } catch (error) {
            console.error("Preview failed:", error);
        }
    };

    // Handle form field sync - extracts placeholders from clauses and creates form fields
    const handleSyncFormFields = async () => {
        if (!id || isNewDocument) {
            alert("Bitte speichern Sie den Dokumenttyp zuerst");
            return;
        }

        try {
            const result = await syncFormFieldsMutation.mutateAsync(parseInt(id));
            setSyncResult(result);
            setShowSyncResultDialog(true);
        } catch (error) {
            console.error("Sync failed:", error);
        }
    };

    // Toggle attachment
    const handleToggleAttachment = (attachment: Attachment) => {
        const existing = assignedAttachments.find((a) => a.id === attachment.id);
        if (existing) {
            setAssignedAttachments((items) => items.filter((a) => a.id !== attachment.id));
        } else {
            setAssignedAttachments([
                ...assignedAttachments,
                {
                    id: attachment.id,
                    attachment,
                    display_order: assignedAttachments.length + 1,
                    is_mandatory: false,
                    is_preselected: true,
                },
            ]);
        }
    };

    // Save document type
    const handleSave = async () => {
        setIsSaving(true);
        try {
            // TODO: Replace simulated save with real API call
            // const url = isNewDocument ? "/api/v1/document-types" : `/api/v1/document-types/${id}`;
            // const payload = {
            //     ...documentType,
            //     clauses: assignedClauses.map((ac) => ({
            //         clause_id: ac.id, display_order: ac.order,
            //         is_mandatory: ac.is_mandatory, condition: ac.condition,
            //     })),
            //     attachments: assignedAttachments.map((aa) => ({
            //         attachment_id: aa.id, display_order: aa.display_order,
            //         is_mandatory: aa.is_mandatory, is_preselected: aa.is_preselected,
            //     })),
            // };
            // await apiFetch(url, { method: isNewDocument ? "POST" : "PUT", body: JSON.stringify(payload) });
            await new Promise((r) => setTimeout(r, 1000)); // Simulate API call
            navigate("/admin/document-types");
        } catch (error) {
            console.error("Error saving:", error);
        } finally {
            setIsSaving(false);
        }
    };

    // IDs of already assigned clauses
    const assignedIds = new Set(assignedClauses.map((c) => c.id));

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate("/admin/document-types")}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">
                            {isNewDocument ? "Neuer Dokumenttyp" : "Dokumenten-Designer"}
                        </h1>
                        <p className="text-muted-foreground">
                            Textbausteine per Drag & Drop zusammenstellen
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    onClick={handleSyncFormFields}
                                    disabled={syncFormFieldsMutation.isPending || isNewDocument || assignedClauses.length === 0}
                                >
                                    {syncFormFieldsMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                    )}
                                    Felder sync
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>
                                    Extrahiert Platzhalter aus den Textbausteinen und erstellt automatisch
                                    die entsprechenden Formularfelder für die Dokumenterstellung.
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <Button
                        variant="outline"
                        onClick={handleTestPreview}
                        disabled={testPreviewMutation.isPending || assignedClauses.length === 0}
                    >
                        {testPreviewMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Play className="w-4 h-4 mr-2" />
                        )}
                        Vorschau testen
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        Speichern
                    </Button>
                </div>
            </div>

            {/* Document Type Info */}
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle>Dokumenttyp-Informationen</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={documentType.name}
                                onChange={(e) =>
                                    setDocumentType({ ...documentType, name: e.target.value })
                                }
                                placeholder="z.B. Arbeitsvertrag (Vollzeit)"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category">Kategorie</Label>
                            <Select
                                value={documentType.category}
                                onValueChange={(v) =>
                                    setDocumentType({ ...documentType, category: v })
                                }
                            >
                                <SelectTrigger id="category">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Verträge">Verträge</SelectItem>
                                    <SelectItem value="Briefe">Briefe</SelectItem>
                                    <SelectItem value="Bescheinigungen">Bescheinigungen</SelectItem>
                                    <SelectItem value="Änderungen">Änderungen</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="country">Land</Label>
                            <Select
                                value={documentType.country_code}
                                onValueChange={(v) =>
                                    setDocumentType({ ...documentType, country_code: v })
                                }
                            >
                                <SelectTrigger id="country">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DE">Deutschland (DE)</SelectItem>
                                    <SelectItem value="IT">Italien (IT)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <div className="flex items-center gap-2 h-10">
                                <Switch
                                    id="active"
                                    checked={documentType.is_active}
                                    onCheckedChange={(checked) =>
                                        setDocumentType({ ...documentType, is_active: checked })
                                    }
                                />
                                <Label htmlFor="active" className="font-normal">
                                    {documentType.is_active ? "Aktiv" : "Inaktiv"}
                                </Label>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-12 gap-6">
                {/* Left: Available Clauses Library */}
                <div className="col-span-4 space-y-4">
                    <Card className="sticky top-4">
                        <CardHeader className="pb-3">
                            <Tabs value={libraryTab} onValueChange={(v) => setLibraryTab(v as "clauses" | "variants")}>
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="clauses" className="flex items-center gap-2">
                                        <FolderOpen className="w-4 h-4" />
                                        Textbausteine
                                    </TabsTrigger>
                                    <TabsTrigger value="variants" className="flex items-center gap-2">
                                        <Layers className="w-4 h-4" />
                                        Varianten
                                        {variantGroups.length > 0 && (
                                            <Badge variant="secondary" className="ml-1 text-xs">
                                                {variantGroups.length}
                                            </Badge>
                                        )}
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {libraryTab === "clauses" ? (
                                <>
                                    {/* Search */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Textbaustein suchen..."
                                            className="pl-10"
                                        />
                                    </div>

                                    {/* Category Filter */}
                                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Alle Kategorien</SelectItem>
                                            {categories
                                                .filter((c) => c !== "all")
                                                .map((cat) => (
                                                    <SelectItem key={cat} value={cat}>
                                                        {cat}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>

                                    {/* Clauses List with Micro-interactions */}
                                    <div className="max-h-[45vh] overflow-y-auto space-y-2 pr-1">
                                        <AnimatePresence mode="popLayout">
                                            {filteredClauses.map((clause, index) => {
                                                const isAssigned = assignedIds.has(clause.id);
                                                return (
                                                    <motion.div
                                                        key={clause.id}
                                                        variants={listItemVariants}
                                                        initial="initial"
                                                        animate="animate"
                                                        exit="exit"
                                                        whileHover={!isAssigned ? "hover" : undefined}
                                                        whileTap={!isAssigned ? "tap" : undefined}
                                                        transition={{ ...listTransition, delay: index * 0.02 }}
                                                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                                                            isAssigned
                                                                ? "bg-secondary/10 border-secondary/30"
                                                                : "bg-muted/30 border-border cursor-pointer"
                                                        }`}
                                                        onClick={() => !isAssigned && handleAddClause(clause)}
                                                    >
                                                        <motion.div
                                                            className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center shrink-0"
                                                            whileHover={{ rotate: 5 }}
                                                        >
                                                            <FileText className="w-4 h-4 text-primary" />
                                                        </motion.div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="text-sm font-medium truncate" title={clause.title}>
                                                                {clause.title}
                                                            </h4>
                                                            <p className="text-xs text-muted-foreground">
                                                                {clause.category} • v{clause.version}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            variant={isAssigned ? "secondary" : "outline"}
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAddClause(clause);
                                                            }}
                                                            disabled={isAssigned}
                                                        >
                                                            {isAssigned ? (
                                                                <Check className="w-4 h-4" />
                                                            ) : (
                                                                <Plus className="w-4 h-4" />
                                                            )}
                                                        </Button>
                                                    </motion.div>
                                                );
                                            })}
                                        </AnimatePresence>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Variant Groups Info */}
                                    <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-blue-800">
                                            Varianten-Gruppen ermöglichen die Auswahl zwischen verschiedenen
                                            Textbaustein-Versionen bei der Dokumenterstellung.
                                        </p>
                                    </div>

                                    {/* Variant Groups List */}
                                    <div className="max-h-[45vh] overflow-y-auto space-y-2 pr-1">
                                        {isLoadingVariants ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                            </div>
                                        ) : variantGroups.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                                <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                <p className="text-sm">Keine Varianten-Gruppen vorhanden</p>
                                                <p className="text-xs mt-1">
                                                    Erstellen Sie Varianten in der Textbaustein-Verwaltung
                                                </p>
                                            </div>
                                        ) : (
                                            <AnimatePresence mode="popLayout">
                                                {variantGroups.map((group, index) => {
                                                    const isAssigned = assignedClauses.some(
                                                        (c) => c.variant_group_id === group.id
                                                    );
                                                    return (
                                                        <motion.div
                                                            key={group.id}
                                                            variants={listItemVariants}
                                                            initial="initial"
                                                            animate="animate"
                                                            exit="exit"
                                                            whileHover={!isAssigned ? "hover" : undefined}
                                                            whileTap={!isAssigned ? "tap" : undefined}
                                                            transition={{ ...listTransition, delay: index * 0.02 }}
                                                            className={`p-3 rounded-lg border ${
                                                                isAssigned
                                                                    ? "bg-purple-50 border-purple-200"
                                                                    : "bg-muted/30 border-border cursor-pointer hover:border-primary/50"
                                                            }`}
                                                            onClick={() => !isAssigned && handleAddVariantGroup(group)}
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center shrink-0">
                                                                    <Layers className="w-4 h-4 text-purple-600" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <h4 className="text-sm font-medium truncate" title={group.name}>
                                                                            {group.name}
                                                                        </h4>
                                                                        <Badge variant="outline" className="text-xs">
                                                                            {group.variants.length} Varianten
                                                                        </Badge>
                                                                    </div>
                                                                    {group.description && (
                                                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                                            {group.description}
                                                                        </p>
                                                                    )}
                                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                                        {group.variants.slice(0, 3).map((v) => (
                                                                            <span
                                                                                key={v.id}
                                                                                className={`text-xs px-2 py-0.5 rounded-full ${
                                                                                    v.is_default
                                                                                        ? "bg-green-100 text-green-700"
                                                                                        : "bg-warm-100 text-muted-foreground"
                                                                                }`}
                                                                            >
                                                                                {v.variant_name}
                                                                                {v.is_default && " ★"}
                                                                            </span>
                                                                        ))}
                                                                        {group.variants.length > 3 && (
                                                                            <span className="text-xs text-muted-foreground">
                                                                                +{group.variants.length - 3} mehr
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant={isAssigned ? "secondary" : "outline"}
                                                                    size="sm"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (!isAssigned) handleAddVariantGroup(group);
                                                                    }}
                                                                    disabled={isAssigned}
                                                                >
                                                                    {isAssigned ? (
                                                                        <Check className="w-4 h-4" />
                                                                    ) : (
                                                                        <Plus className="w-4 h-4" />
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </AnimatePresence>
                                        )}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Attachments Section with Micro-interactions */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Paperclip className="w-5 h-5" />
                                Anlagen zuweisen
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {availableAttachments.map((attachment, index) => {
                                    const isAssigned = assignedAttachments.some(
                                        (a) => a.id === attachment.id
                                    );
                                    return (
                                        <motion.div
                                            key={attachment.id}
                                            variants={listItemVariants}
                                            initial="initial"
                                            animate="animate"
                                            whileHover="hover"
                                            whileTap="tap"
                                            transition={{ ...listTransition, delay: index * 0.02 }}
                                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                                                isAssigned
                                                    ? "bg-secondary/10 border-secondary/30"
                                                    : "bg-muted/30 border-border"
                                            }`}
                                            onClick={() => handleToggleAttachment(attachment)}
                                        >
                                            <motion.div
                                                className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                                    isAssigned
                                                        ? "bg-secondary border-secondary text-white"
                                                        : "border-border"
                                                }`}
                                                animate={isAssigned ? { scale: [1, 1.2, 1] } : {}}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <AnimatePresence>
                                                    {isAssigned && (
                                                        <motion.div
                                                            initial={{ scale: 0, opacity: 0 }}
                                                            animate={{ scale: 1, opacity: 1 }}
                                                            exit={{ scale: 0, opacity: 0 }}
                                                        >
                                                            <Check className="w-3 h-3" />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                            <div className="flex-1">
                                                <span className="text-sm font-medium">
                                                    {attachment.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground ml-2">
                                                    {attachment.file_type.toUpperCase()}
                                                    {attachment.page_count && ` • ${attachment.page_count} Seiten`}
                                                </span>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Document Structure (Sortable) */}
                <div className="col-span-8 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between">
                                <span>Dokument-Struktur</span>
                                <span className="text-sm font-normal text-muted-foreground">
                                    {assignedClauses.length} Textbaustein
                                    {assignedClauses.length !== 1 ? "e" : ""}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {assignedClauses.length === 0 ? (
                                <div className="border-2 border-dashed border-border rounded-lg p-12 text-center drop-zone">
                                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                                    <h3 className="text-lg font-medium mb-2">
                                        Keine Textbausteine zugewiesen
                                    </h3>
                                    <p className="text-muted-foreground">
                                        Klicken Sie auf <Plus className="w-4 h-4 inline" /> bei einem
                                        Textbaustein links, um ihn hinzuzufügen.
                                    </p>
                                </div>
                            ) : (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                >
                                    <SortableContext
                                        items={assignedClauses.map((c) => c.uniqueId)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="space-y-2">
                                            {assignedClauses.map((clause) => (
                                                <SortableClause
                                                    key={clause.uniqueId}
                                                    clause={clause}
                                                    onRemove={handleRemoveClause}
                                                    onToggleMandatory={handleToggleMandatory}
                                                    onEditCondition={handleEditCondition}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>

                                    <DragOverlay>
                                        {activeId ? (
                                            <div className="p-4 bg-card border-2 border-primary rounded-lg shadow-lg">
                                                {
                                                    assignedClauses.find((c) => c.uniqueId === activeId)
                                                        ?.title
                                                }
                                            </div>
                                        ) : null}
                                    </DragOverlay>
                                </DndContext>
                            )}
                        </CardContent>
                    </Card>

                    {/* Detected Placeholders */}
                    {allPlaceholders.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">
                                    Erkannte Formularfelder ({allPlaceholders.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {allPlaceholders.map((placeholder) => (
                                        <span
                                            key={placeholder}
                                            className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-mono"
                                        >
                                            {"{{ "}
                                            {placeholder}
                                            {" }}"}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-sm text-muted-foreground mt-4">
                                    Diese Felder werden automatisch im Formular für Nutzer angezeigt.
                                    Sie können die Felder im{" "}
                                    <a
                                        href="/admin/form-fields"
                                        className="text-primary hover:underline"
                                    >
                                        Formularfeld-Manager
                                    </a>{" "}
                                    anpassen.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Assigned Attachments Summary */}
                    {assignedAttachments.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Paperclip className="w-5 h-5" />
                                    Zugewiesene Anlagen ({assignedAttachments.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {assignedAttachments.map((aa, idx) => (
                                        <div
                                            key={aa.id}
                                            className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                                        >
                                            <span className="text-sm font-medium">
                                                {idx + 1}. {aa.attachment.name}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {aa.attachment.page_count} Seiten
                                            </span>
                                            <div className="flex-1" />
                                            <div className="flex items-center gap-2">
                                                <Label
                                                    htmlFor={`att-mandatory-${aa.id}`}
                                                    className="text-xs"
                                                >
                                                    Pflicht
                                                </Label>
                                                <Switch
                                                    id={`att-mandatory-${aa.id}`}
                                                    checked={aa.is_mandatory}
                                                    onCheckedChange={(checked) => {
                                                        setAssignedAttachments((items) =>
                                                            items.map((item) =>
                                                                item.id === aa.id
                                                                    ? { ...item, is_mandatory: checked }
                                                                    : item
                                                            )
                                                        );
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Condition Editor Dialog */}
            <Dialog open={conditionDialogOpen} onOpenChange={setConditionDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Bedingung bearbeiten</DialogTitle>
                        <DialogDescription>
                            Legen Sie fest, wann der Textbaustein "{editingClause?.title}" angezeigt
                            werden soll.
                        </DialogDescription>
                    </DialogHeader>

                    {editingClause && (
                        <ConditionEditor
                            clause={editingClause}
                            placeholders={allPlaceholders}
                            onSave={handleSaveCondition}
                            onCancel={() => setConditionDialogOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Test Preview Dialog */}
            <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Play className="w-5 h-5 text-primary" />
                            Vorschau testen
                        </DialogTitle>
                        <DialogDescription>
                            Vorschau mit automatisch generierten Beispieldaten
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto border rounded-lg bg-white">
                        {previewHtml ? (
                            <div
                                className="document-preview p-6"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-64 text-muted-foreground">
                                <Loader2 className="w-8 h-8 animate-spin" />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Info className="w-4 h-4" />
                            <span>Die Beispieldaten werden automatisch generiert</span>
                        </div>
                        <Button onClick={() => setShowPreviewDialog(false)}>
                            <X className="w-4 h-4 mr-2" />
                            Schließen
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Form Field Sync Result Dialog */}
            <Dialog open={showSyncResultDialog} onOpenChange={setShowSyncResultDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <RefreshCw className="w-5 h-5 text-primary" />
                            Formularfelder synchronisiert
                        </DialogTitle>
                        <DialogDescription>
                            Die Platzhalter aus den Textbausteinen wurden analysiert und die Formularfelder aktualisiert.
                        </DialogDescription>
                    </DialogHeader>

                    {syncResult && (
                        <div className="space-y-4">
                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-3 bg-green-50 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-green-700">{syncResult.created}</div>
                                    <div className="text-xs text-green-600">Erstellt</div>
                                </div>
                                <div className="p-3 bg-red-50 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-red-700">{syncResult.removed}</div>
                                    <div className="text-xs text-red-600">Entfernt</div>
                                </div>
                                <div className="p-3 bg-blue-50 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-blue-700">{syncResult.fields_now}</div>
                                    <div className="text-xs text-blue-600">Gesamt</div>
                                </div>
                            </div>

                            {/* Details */}
                            {syncResult.details.length > 0 && (
                                <div className="max-h-48 overflow-y-auto">
                                    <div className="text-sm font-medium mb-2">Details:</div>
                                    <div className="space-y-1">
                                        {syncResult.details.map((detail, idx) => (
                                            <div key={idx} className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
                                                {detail}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {syncResult.created === 0 && syncResult.removed === 0 && (
                                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-amber-800 text-sm">
                                    <AlertTriangle className="w-4 h-4" />
                                    Keine Änderungen notwendig - Formularfelder sind bereits aktuell.
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button onClick={() => setShowSyncResultDialog(false)}>
                            Schließen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DocumentDesigner;
