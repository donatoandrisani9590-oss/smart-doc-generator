/**
 * ClauseVariantManager - Verwaltung von Klausel-Varianten
 *
 * v4.2 Feature (Kapitel 16.13):
 * - Varianten-Gruppen erstellen und verwalten
 * - Mehrere Varianten einer Klausel definieren
 * - Standard-Variante festlegen
 * - Bedingungen für automatische Auswahl
 *
 * Beispiel: Kündigungsfristen
 * - Variante A: 3 Monate (Standard für normale Mitarbeiter)
 * - Variante B: 6 Monate (Führungskräfte)
 * - Variante C: 12 Monate (Geschäftsführung)
 */

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
// Accordion imports removed - unused
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Layers,
    Plus,
    Trash2,
    Star,
    MoreVertical,
    FileText,
    Loader2,
    AlertCircle,
    GripVertical,

    Eye,
    Link2,
    Building2,
    Check,
    Search,
    Filter,
    HelpCircle,
    ChevronRight,
    Edit,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useClauses, type Clause } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════
interface ClauseVariant {
    id: number;
    group_id: number;
    clause_id: number;
    variant_name: string;
    variant_code?: string;
    description?: string;
    auto_select_condition?: string;
    sort_order: number;
    is_default: boolean;
    is_active: boolean;
    clause_title?: string;
    clause_content_preview?: string;
}

interface VariantGroup {
    id: number;
    name: string;
    description?: string;
    category?: string;
    country_code: string;
    base_clause_id?: number;
    is_active: boolean;
    created_at?: string;
    variants: ClauseVariant[];
}

interface ClauseVariantManagerProps {
    countryCode?: string;
    onVariantSelect?: (groupId: number, variantId: number, clauseId: number) => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// API HOOKS (inline für diese Komponente)
// ══════════════════════════════════════════════════════════════════════════════
const API_BASE = "/api/v1";

const useVariantGroups = (countryCode?: string) => {
    const [data, setData] = useState<VariantGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const url = countryCode
                    ? `${API_BASE}/clause-variants/groups?country_code=${countryCode}`
                    : `${API_BASE}/clause-variants/groups`;
                const res = await apiFetch(url);
                if (!res.ok) throw new Error("Failed to fetch variant groups");
                const groups = await res.json();
                setData(groups);
            } catch (err) {
                setError(err as Error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchGroups();
    }, [countryCode]);

    const refetch = async () => {
        setIsLoading(true);
        try {
            const url = countryCode
                ? `${API_BASE}/clause-variants/groups?country_code=${countryCode}`
                : `${API_BASE}/clause-variants/groups`;
            const res = await apiFetch(url);
            if (!res.ok) throw new Error("Failed to fetch variant groups");
            const groups = await res.json();
            setData(groups);
        } catch (err) {
            setError(err as Error);
        } finally {
            setIsLoading(false);
        }
    };

    return { data, isLoading, error, refetch };
};

// ══════════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// Dialog zum Erstellen einer neuen Varianten-Gruppe
const CreateGroupDialog = ({
    open,
    onOpenChange,
    countryCode,
    onSuccess,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    countryCode: string;
    onSuccess: () => void;
}) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!name.trim()) {
            setError("Name ist erforderlich");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const res = await apiFetch(`${API_BASE}/clause-variants/groups`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    description,
                    category,
                    country_code: countryCode,
                }),
            });

            if (!res.ok) {
                throw new Error("Fehler beim Erstellen der Gruppe");
            }

            setName("");
            setDescription("");
            setCategory("");
            onSuccess();
            onOpenChange(false);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary" />
                        Neue Varianten-Gruppe
                    </DialogTitle>
                    <DialogDescription>
                        Gruppieren Sie ähnliche Klauseln mit unterschiedlichen Ausprägungen
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name der Gruppe *</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="z.B. Kündigungsfristen"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Beschreibung</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Wann werden welche Varianten verwendet?"
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">Kategorie</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="Kategorie wählen" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Arbeitsrecht">Arbeitsrecht</SelectItem>
                                <SelectItem value="Vergütung">Vergütung</SelectItem>
                                <SelectItem value="Arbeitszeit">Arbeitszeit</SelectItem>
                                <SelectItem value="Kündigung">Kündigung</SelectItem>
                                <SelectItem value="Benefits">Benefits</SelectItem>
                                <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4 mr-2" />
                        )}
                        Gruppe erstellen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Dialog zum Hinzufügen einer Variante zu einer Gruppe
const AddVariantDialog = ({
    open,
    onOpenChange,
    group,
    countryCode,
    onSuccess,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    group: VariantGroup | null;
    countryCode: string;
    onSuccess: () => void;
}) => {
    const [variantName, setVariantName] = useState("");
    const [variantCode, setVariantCode] = useState("");
    const [description, setDescription] = useState("");
    const [selectedClauseId, setSelectedClauseId] = useState<number | null>(null);
    const [isDefault, setIsDefault] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { data: clauses } = useClauses(countryCode);

    // Bereits verwendete Klauseln in dieser Gruppe ausfiltern
    const availableClauses = clauses?.filter(
        (c: Clause) => !group?.variants.some((v) => v.clause_id === c.id)
    );

    const handleSubmit = async () => {
        if (!variantName.trim() || !selectedClauseId || !group) {
            setError("Name und Klausel sind erforderlich");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const res = await apiFetch(
                `${API_BASE}/clause-variants/groups/${group.id}/variants`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        clause_id: selectedClauseId,
                        variant_name: variantName,
                        variant_code: variantCode || undefined,
                        description: description || undefined,
                        is_default: isDefault,
                        sort_order: group.variants.length,
                    }),
                }
            );

            if (!res.ok) {
                throw new Error("Fehler beim Hinzufügen der Variante");
            }

            // Reset form
            setVariantName("");
            setVariantCode("");
            setDescription("");
            setSelectedClauseId(null);
            setIsDefault(false);
            onSuccess();
            onOpenChange(false);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!group) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="w-5 h-5 text-primary" />
                        Variante hinzufügen
                    </DialogTitle>
                    <DialogDescription>
                        Fügen Sie eine Klausel als Variante zu "{group.name}" hinzu
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="clause">Klausel auswählen *</Label>
                        <Select
                            value={selectedClauseId?.toString() || ""}
                            onValueChange={(v) => setSelectedClauseId(parseInt(v))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Klausel wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableClauses?.map((clause: Clause) => (
                                    <SelectItem key={clause.id} value={clause.id.toString()}>
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-muted-foreground" />
                                            <span>{clause.title}</span>
                                            <Badge variant="outline" className="text-xs">
                                                {clause.category}
                                            </Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="variantName">Varianten-Name *</Label>
                            <Input
                                id="variantName"
                                value={variantName}
                                onChange={(e) => setVariantName(e.target.value)}
                                placeholder="z.B. 3 Monate (Standard)"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="variantCode">Kürzel</Label>
                            <Input
                                id="variantCode"
                                value={variantCode}
                                onChange={(e) => setVariantCode(e.target.value)}
                                placeholder="z.B. A, B, C"
                                maxLength={5}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="variantDesc">Beschreibung</Label>
                        <Textarea
                            id="variantDesc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Wann wird diese Variante verwendet? (z.B. für Führungskräfte)"
                            rows={2}
                        />
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                        <input
                            type="checkbox"
                            id="isDefault"
                            checked={isDefault}
                            onChange={(e) => setIsDefault(e.target.checked)}
                            className="w-4 h-4 rounded border-border"
                        />
                        <div>
                            <Label htmlFor="isDefault" className="font-medium cursor-pointer">
                                Als Standard-Variante festlegen
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Diese Variante wird automatisch vorausgewählt
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !selectedClauseId || !variantName.trim()}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4 mr-2" />
                        )}
                        Variante hinzufügen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Dialog zum Zuordnen der Varianten-Gruppe zu Dokumenttypen
const AssignDocumentTypesDialog = ({
    open,
    onOpenChange,
    group,
    countryCode: _countryCode,
    onSuccess,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    group: VariantGroup | null;
    countryCode: string;
    onSuccess: () => void;
}) => {
    const [assignments, setAssignments] = useState<{
        document_type_id: number;
        document_type_name: string;
        document_type_category?: string;
        is_assigned: boolean;
        is_mandatory: boolean;
        default_variant_id: number | null;
    }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Lade Dokumenttypen-Zuordnungen beim Öffnen
    useEffect(() => {
        if (open && group) {
            setIsLoading(true);
            setError(null);
            apiFetch(`${API_BASE}/clause-variants/groups/${group.id}/document-types`)
                .then(res => {
                    if (!res.ok) throw new Error("Fehler beim Laden der Zuordnungen");
                    return res.json();
                })
                .then(data => {
                    // Zusammenführen: zugeordnete + verfügbare
                    const assigned = data.assignments || [];
                    const available = data.available_document_types || [];

                    const combined = [
                        ...assigned.map((a: { document_type_id: number; document_type_name: string; document_type_category?: string; is_mandatory: boolean; default_variant_id?: number }) => ({
                            document_type_id: a.document_type_id,
                            document_type_name: a.document_type_name,
                            document_type_category: a.document_type_category,
                            is_assigned: true,
                            is_mandatory: a.is_mandatory,
                            default_variant_id: a.default_variant_id || null,
                        })),
                        ...available.map((dt: { id: number; name: string; category?: string }) => ({
                            document_type_id: dt.id,
                            document_type_name: dt.name,
                            document_type_category: dt.category,
                            is_assigned: false,
                            is_mandatory: true,
                            default_variant_id: group.variants.find(v => v.is_default)?.id || null,
                        })),
                    ];
                    setAssignments(combined);
                })
                .catch(err => setError(err.message))
                .finally(() => setIsLoading(false));
        }
    }, [open, group]);

    const toggleAssignment = (docTypeId: number) => {
        setAssignments(prev =>
            prev.map(a =>
                a.document_type_id === docTypeId
                    ? { ...a, is_assigned: !a.is_assigned }
                    : a
            )
        );
    };

    const toggleMandatory = (docTypeId: number) => {
        setAssignments(prev =>
            prev.map(a =>
                a.document_type_id === docTypeId
                    ? { ...a, is_mandatory: !a.is_mandatory }
                    : a
            )
        );
    };

    const setDefaultVariant = (docTypeId: number, variantId: number) => {
        setAssignments(prev =>
            prev.map(a =>
                a.document_type_id === docTypeId
                    ? { ...a, default_variant_id: variantId }
                    : a
            )
        );
    };

    const handleSave = async () => {
        if (!group) return;

        setIsSaving(true);
        setError(null);

        try {
            const assignedDocs = assignments
                .filter(a => a.is_assigned)
                .map(a => ({
                    document_type_id: a.document_type_id,
                    is_mandatory: a.is_mandatory,
                    default_variant_id: a.default_variant_id,
                    display_order: 0,
                }));

            const res = await apiFetch(`${API_BASE}/clause-variants/groups/${group.id}/document-types`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assignments: assignedDocs }),
            });

            if (!res.ok) throw new Error("Fehler beim Speichern der Zuordnungen");

            onSuccess();
            onOpenChange(false);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!group) return null;

    const assignedCount = assignments.filter(a => a.is_assigned).length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-purple-600" />
                        Dokumenttypen zuordnen
                    </DialogTitle>
                    <DialogDescription>
                        Ordnen Sie die Varianten-Gruppe "{group.name}" den gewünschten Dokumenttypen zu.
                        Bei der Dokumenterstellung erscheint dann eine Auswahl für die Varianten.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : error ? (
                        <div className="flex items-center gap-2 text-red-600 p-4 bg-red-50 rounded-lg">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    ) : assignments.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Keine Dokumenttypen gefunden
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {assignments.map(a => (
                                <div
                                    key={a.document_type_id}
                                    className={cn(
                                        "flex items-center gap-4 p-3 rounded-lg border transition-colors",
                                        a.is_assigned
                                            ? "border-purple-300 bg-purple-50"
                                            : "border-border hover:border-purple-200"
                                    )}
                                >
                                    <Checkbox
                                        checked={a.is_assigned}
                                        onCheckedChange={() => toggleAssignment(a.document_type_id)}
                                    />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium">{a.document_type_name}</span>
                                            {a.document_type_category && (
                                                <Badge variant="outline" className="text-xs">
                                                    {a.document_type_category}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {a.is_assigned && (
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleMandatory(a.document_type_id)}
                                                className={cn(
                                                    "px-2 py-1 text-xs rounded transition-colors",
                                                    a.is_mandatory
                                                        ? "bg-purple-200 text-purple-800"
                                                        : "bg-gray-100 text-gray-600"
                                                )}
                                            >
                                                {a.is_mandatory ? "Pflicht" : "Optional"}
                                            </button>

                                            <Select
                                                value={String(a.default_variant_id || "")}
                                                onValueChange={(val) => setDefaultVariant(a.document_type_id, parseInt(val))}
                                            >
                                                <SelectTrigger className="h-8 w-[160px] text-xs">
                                                    <SelectValue placeholder="Standard-Variante" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {group.variants.map(v => (
                                                        <SelectItem key={v.id} value={String(v.id)}>
                                                            {v.variant_name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t pt-4">
                    <div className="flex items-center justify-between w-full">
                        <span className="text-sm text-muted-foreground">
                            {assignedCount} Dokumenttyp{assignedCount !== 1 ? "en" : ""} zugeordnet
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Abbrechen
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-purple-600 hover:bg-purple-700"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Check className="w-4 h-4 mr-2" />
                                )}
                                Speichern
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Hilfsfunktion zum Kürzen und Bereinigen von HTML-Inhalten
const truncateContent = (html: string | undefined, maxLength: number = 300): string => {
    if (!html) return "Kein Inhalt verfügbar";
    const text = html.replace(/<[^>]*>/g, "").trim();
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
};

// Varianten-Karte mit Hover-Vorschau
const VariantCard = ({
    variant,
    onSetDefault,
    onDelete,
}: {
    variant: ClauseVariant;
    onSetDefault: () => void;
    onDelete: () => void;
}) => {
    return (
        <div
            className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-all",
                variant.is_default
                    ? "border-[#6EBD84] bg-secondary/5"
                    : "border-border hover:border-primary/30"
            )}
        >
            <div className="mt-1 text-muted-foreground cursor-grab">
                <GripVertical className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    {variant.variant_code && (
                        <Badge variant="outline" className="text-xs font-mono">
                            {variant.variant_code}
                        </Badge>
                    )}
                    <span className="font-medium text-foreground">{variant.variant_name}</span>
                    {variant.is_default && (
                        <Badge className="bg-secondary/10 text-secondary text-xs">
                            <Star className="w-3 h-3 mr-1 fill-current" />
                            Standard
                        </Badge>
                    )}
                </div>

                {variant.clause_title && (
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1 cursor-help hover:text-primary transition-colors">
                                    <FileText className="w-3 h-3" />
                                    <span className="truncate">{variant.clause_title}</span>
                                    <Eye className="w-3 h-3 ml-1 opacity-50" />
                                </p>
                            </TooltipTrigger>
                            <TooltipContent
                                side="right"
                                className="max-w-md p-3 text-sm"
                                sideOffset={5}
                            >
                                <div className="space-y-2">
                                    <div className="font-medium text-foreground border-b pb-1">
                                        {variant.clause_title}
                                    </div>
                                    <p className="text-muted-foreground leading-relaxed">
                                        {truncateContent(variant.clause_content_preview)}
                                    </p>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {variant.description && (
                    <p className="text-xs text-muted-foreground mt-1 italic">{variant.description}</p>
                )}
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {!variant.is_default && (
                        <DropdownMenuItem onClick={onSetDefault}>
                            <Star className="w-4 h-4 mr-2" />
                            Als Standard festlegen
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Entfernen
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT - Master-Detail Layout (UX-Verbesserung)
// ══════════════════════════════════════════════════════════════════════════════
export const ClauseVariantManager = ({
    countryCode = "DE",
    onVariantSelect: _onVariantSelect,
}: ClauseVariantManagerProps) => {
    const { data: groups, isLoading, error: _error, refetch } = useVariantGroups(countryCode);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [showAddVariant, setShowAddVariant] = useState(false);
    const [showAssignDocTypes, setShowAssignDocTypes] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<VariantGroup | null>(null);

    // UX-Verbesserung: Filter und Suche
    const [searchQuery, setSearchQuery] = useState("");
    const [filterMode, setFilterMode] = useState<"all" | "with-docs" | "without-docs">("all");
    const [showOnboarding, setShowOnboarding] = useState(() => {
        // Zeige Onboarding nur beim ersten Besuch
        return !localStorage.getItem("variant-manager-onboarding-dismissed");
    });

    // Gefilterte Gruppen
    const filteredGroups = groups?.filter(group => {
        // Suchfilter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (!group.name.toLowerCase().includes(query) &&
                !group.description?.toLowerCase().includes(query)) {
                return false;
            }
        }
        // TODO: Dokumenttyp-Filter würde Backend-Erweiterung erfordern
        return true;
    }) || [];

    // Auto-select first group wenn noch keine ausgewählt
    const effectiveSelectedGroup = selectedGroup || (filteredGroups.length > 0 ? filteredGroups[0] : null);

    const handleSelectGroup = (group: VariantGroup) => {
        setSelectedGroup(group);
    };

    const handleAddVariant = (group: VariantGroup) => {
        setSelectedGroup(group);
        setShowAddVariant(true);
    };

    const handleAssignDocTypes = (group: VariantGroup) => {
        setSelectedGroup(group);
        setShowAssignDocTypes(true);
    };

    const handleSetDefault = async (_groupId: number, variantId: number) => {
        try {
            await apiFetch(`${API_BASE}/clause-variants/variants/${variantId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_default: true }),
            });
            refetch();
        } catch (err) {
            console.error("Failed to set default:", err);
        }
    };

    const handleDeleteVariant = async (variantId: number) => {
        try {
            await apiFetch(`${API_BASE}/clause-variants/variants/${variantId}`, {
                method: "DELETE",
            });
            refetch();
        } catch (err) {
            console.error("Failed to delete variant:", err);
        }
    };

    const dismissOnboarding = () => {
        localStorage.setItem("variant-manager-onboarding-dismissed", "true");
        setShowOnboarding(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary" />
                        Klausel-Varianten
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Verwalten Sie alternative Versionen von Klauseln
                    </p>
                </div>
                <Button
                    onClick={() => setShowCreateGroup(true)}
                    className="bg-primary hover:bg-primary/90"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Neue Gruppe
                </Button>
            </div>

            {/* Onboarding-Tooltip (UX-Verbesserung) */}
            {showOnboarding && (
                <Card className="bg-gradient-to-r from-primary/10 to-purple-50 border-primary/30">
                    <CardContent className="py-4 px-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-primary/20 rounded-lg">
                                <HelpCircle className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-medium text-foreground mb-1">
                                    Was sind Varianten-Gruppen?
                                </h3>
                                <p className="text-sm text-muted-foreground mb-3">
                                    <strong>Varianten-Gruppen</strong> ermöglichen es, verschiedene Versionen
                                    einer Klausel zu definieren. Beispiel: Eine Gruppe "Kündigungsfristen" enthält
                                    Varianten für 3, 6 oder 12 Monate. Bei der Dokumenterstellung kann der Benutzer
                                    dann die passende Variante auswählen.
                                </p>
                                <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">1</span>
                                        <span>Gruppe erstellen</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">2</span>
                                        <span>Varianten hinzufügen</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">3</span>
                                        <span>Dokumenttypen zuordnen</span>
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={dismissOnboarding}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Verstanden
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Search & Filter Bar (UX-Verbesserung) */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Gruppen durchsuchen..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={filterMode} onValueChange={(v) => setFilterMode(v as typeof filterMode)}>
                    <SelectTrigger className="w-[180px]">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Alle Gruppen</SelectItem>
                        <SelectItem value="with-docs">Mit Dokumenttypen</SelectItem>
                        <SelectItem value="without-docs">Nicht zugeordnet</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Master-Detail Layout (UX-Verbesserung) */}
            {filteredGroups.length > 0 ? (
                <div className="grid grid-cols-5 gap-4 min-h-[500px]">
                    {/* Master Panel - Gruppen-Liste */}
                    <div className="col-span-2 border rounded-lg overflow-hidden bg-white">
                        <div className="px-3 py-2 bg-gray-50 border-b">
                            <span className="text-sm font-medium text-foreground">
                                Gruppen ({filteredGroups.length})
                            </span>
                        </div>
                        <div className="overflow-y-auto max-h-[450px]">
                            {filteredGroups.map((group) => (
                                <div
                                    key={group.id}
                                    onClick={() => handleSelectGroup(group)}
                                    className={cn(
                                        "flex items-center gap-3 p-3 cursor-pointer border-b transition-colors",
                                        effectiveSelectedGroup?.id === group.id
                                            ? "bg-primary/10 border-l-4 border-l-primary"
                                            : "hover:bg-gray-50 border-l-4 border-l-transparent"
                                    )}
                                >
                                    <div className={cn(
                                        "p-2 rounded-lg",
                                        effectiveSelectedGroup?.id === group.id
                                            ? "bg-primary/20"
                                            : "bg-gray-100"
                                    )}>
                                        <Layers className={cn(
                                            "w-4 h-4",
                                            effectiveSelectedGroup?.id === group.id
                                                ? "text-primary"
                                                : "text-muted-foreground"
                                        )} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm text-foreground truncate">
                                            {group.name}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {group.category && (
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                    {group.category}
                                                </Badge>
                                            )}
                                            <span className="text-[10px] text-muted-foreground">
                                                {group.variants.length} Var.
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Detail Panel - Ausgewählte Gruppe */}
                    <div className="col-span-3 border rounded-lg overflow-hidden bg-white">
                        {effectiveSelectedGroup ? (
                            <>
                                {/* Detail Header */}
                                <div className="px-4 py-3 bg-gray-50 border-b">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold text-foreground">
                                                {effectiveSelectedGroup.name}
                                            </h3>
                                            {effectiveSelectedGroup.description && (
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {effectiveSelectedGroup.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {effectiveSelectedGroup.category && (
                                                <Badge variant="outline">
                                                    {effectiveSelectedGroup.category}
                                                </Badge>
                                            )}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem>
                                                        <Edit className="w-4 h-4 mr-2" />
                                                        Gruppe bearbeiten
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-red-600">
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Gruppe löschen
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </div>

                                {/* Varianten Liste */}
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-medium text-foreground">
                                            Varianten ({effectiveSelectedGroup.variants.length})
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleAddVariant(effectiveSelectedGroup)}
                                        >
                                            <Plus className="w-4 h-4 mr-1" />
                                            Variante
                                        </Button>
                                    </div>

                                    {effectiveSelectedGroup.variants.length > 0 ? (
                                        <div className="space-y-2">
                                            {effectiveSelectedGroup.variants.map((variant) => (
                                                <VariantCard
                                                    key={variant.id}
                                                    variant={variant}
                                                    onSetDefault={() => handleSetDefault(effectiveSelectedGroup.id, variant.id)}
                                                    onDelete={() => handleDeleteVariant(variant.id)}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground bg-gray-50 rounded-lg">
                                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">Noch keine Varianten</p>
                                            <Button
                                                size="sm"
                                                variant="link"
                                                onClick={() => handleAddVariant(effectiveSelectedGroup)}
                                                className="mt-1"
                                            >
                                                Erste Variante hinzufügen
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Dokumenttypen-Zuordnung */}
                                <div className="px-4 pb-4">
                                    <div className="border-t pt-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm font-medium text-purple-800 flex items-center gap-2">
                                                <Link2 className="w-4 h-4" />
                                                Dokumenttypen-Zuordnung
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-purple-300 text-purple-700 hover:bg-purple-50"
                                                onClick={() => handleAssignDocTypes(effectiveSelectedGroup)}
                                            >
                                                <Building2 className="w-4 h-4 mr-1" />
                                                Zuordnen
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Ordnen Sie diese Varianten-Gruppe Dokumenttypen zu, damit Benutzer
                                            bei der Dokumenterstellung die passende Variante auswählen können.
                                        </p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                <div className="text-center">
                                    <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p>Wählen Sie eine Gruppe aus</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Layers className="w-12 h-12 mx-auto text-border mb-4" />
                        <p className="text-lg font-medium text-foreground">
                            {searchQuery ? "Keine Gruppen gefunden" : "Keine Varianten-Gruppen vorhanden"}
                        </p>
                        <p className="text-muted-foreground mb-4">
                            {searchQuery
                                ? "Passen Sie Ihre Suche an"
                                : "Erstellen Sie Ihre erste Varianten-Gruppe"
                            }
                        </p>
                        {!searchQuery && (
                            <Button
                                onClick={() => setShowCreateGroup(true)}
                                className="bg-primary hover:bg-primary/90"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Erste Gruppe erstellen
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Dialogs */}
            <CreateGroupDialog
                open={showCreateGroup}
                onOpenChange={setShowCreateGroup}
                countryCode={countryCode}
                onSuccess={refetch}
            />

            <AddVariantDialog
                open={showAddVariant}
                onOpenChange={setShowAddVariant}
                group={selectedGroup}
                countryCode={countryCode}
                onSuccess={refetch}
            />

            <AssignDocumentTypesDialog
                open={showAssignDocTypes}
                onOpenChange={setShowAssignDocTypes}
                group={selectedGroup}
                countryCode={countryCode}
                onSuccess={refetch}
            />
        </div>
    );
};
