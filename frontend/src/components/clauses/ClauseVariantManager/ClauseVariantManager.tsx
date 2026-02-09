/**
 * ClauseVariantManager - Verwaltung von Textbaustein-Varianten
 *
 * v4.2 Feature (Kapitel 16.13):
 * - Varianten-Gruppen erstellen und verwalten
 * - Mehrere Varianten eines Textbausteins definieren
 * - Standard-Variante festlegen
 * - Bedingungen für automatische Auswahl
 *
 * Beispiel: Kündigungsfristen
 * - Variante A: 3 Monate (Standard für normale Mitarbeiter)
 * - Variante B: 6 Monate (Führungskräfte)
 * - Variante C: 12 Monate (Geschäftsführung)
 */

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Layers,
    Plus,
    Trash2,
    MoreVertical,
    FileText,
    Loader2,
    Search,
    Filter,
    HelpCircle,
    ChevronRight,
    Edit,
    Link2,
    Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { ClauseVariantManagerProps, VariantGroup } from "./types";
import { useVariantGroups } from "./useVariantGroups";
import { CreateGroupDialog } from "./CreateGroupDialog";
import { AddVariantDialog } from "./AddVariantDialog";
import { AssignDocumentTypesDialog } from "./AssignDocumentTypesDialog";
import { VariantCard } from "./VariantCard";

const API_BASE = "/api/v1";

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
                        Textbaustein-Varianten
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Verwalten Sie alternative Versionen von Textbausteine
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
                                    eines Textbausteins zu definieren. Beispiel: Eine Gruppe "Kündigungsfristen" enthält
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
                        <div className="px-3 py-2 bg-warm-50 border-b">
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
                                            : "hover:bg-warm-50 border-l-4 border-l-transparent"
                                    )}
                                >
                                    <div className={cn(
                                        "p-2 rounded-lg",
                                        effectiveSelectedGroup?.id === group.id
                                            ? "bg-primary/20"
                                            : "bg-warm-100"
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
                                <div className="px-4 py-3 bg-warm-50 border-b">
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
                                        <div className="text-center py-8 text-muted-foreground bg-warm-50 rounded-lg">
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
