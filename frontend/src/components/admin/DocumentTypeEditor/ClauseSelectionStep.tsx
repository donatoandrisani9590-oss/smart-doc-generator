import { useState } from "react";
import { motion } from "framer-motion";
import {
    SortableList,
    SortableItemWrapper,
    DragHandle,
} from "@/components/ui/drag-drop";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ConditionBuilder } from "@/components/admin/ConditionBuilder";
import type { ClauseCondition as BuilderCondition } from "@/components/admin/ConditionBuilder/types";
import { cn } from "@/lib/utils";
import type { Clause } from "@/hooks/useApi";
import {
    GripVertical,
    Plus,
    FileText,
    X,
    Settings2,
    AlertCircle,
    Loader2,
    Layers,
    GitBranch,
} from "lucide-react";
import type { ClauseSelection, VariantGroupSelection } from "./types";

interface ClauseSelectionStepProps {
    // Errors
    errors: Record<string, string>;
    setErrors: (errors: Record<string, string>) => void;

    // Clause data
    selectedClauses: ClauseSelection[];
    setSelectedClauses: (clauses: ClauseSelection[]) => void;
    groupedClauses: Record<string, Clause[]>;
    loadingClauses: boolean;

    // Clause actions
    addClause: (clause: Clause) => void;
    removeClause: (clauseId: number) => void;
    toggleMandatory: (clauseId: number) => void;
    setClauseCondition: (clauseId: number, condition: string | null) => void;
    reorderClauses: (newOrder: Array<ClauseSelection & { id: number | string }>) => void;

    // Variant groups
    selectedVariantGroups: VariantGroupSelection[];
    unselectedVariantGroups: Array<{
        id: number;
        name: string;
        description?: string;
        variants?: Array<{ id: number; variant_name: string; is_default: boolean }>;
    }>;
    loadingVariantGroups: boolean;
    addVariantGroup: (vg: {
        id: number;
        name: string;
        description?: string;
        variants?: Array<{ id: number; variant_name: string; is_default: boolean }>;
    }) => void;
    removeVariantGroup: (groupId: number) => void;
    toggleVariantGroupMandatory: (groupId: number) => void;
    setVariantGroupDefault: (groupId: number, variantId: number) => void;

    // Clause creator
    setShowClauseCreator: (show: boolean) => void;
}

export const ClauseSelectionStep = ({
    errors,
    setErrors: _setErrors,
    selectedClauses,
    setSelectedClauses: _setSelectedClauses,
    groupedClauses,
    loadingClauses,
    addClause,
    removeClause,
    toggleMandatory,
    setClauseCondition,
    reorderClauses,
    selectedVariantGroups,
    unselectedVariantGroups,
    loadingVariantGroups,
    addVariantGroup,
    removeVariantGroup,
    toggleVariantGroupMandatory,
    setVariantGroupDefault,
    setShowClauseCreator,
}: ClauseSelectionStepProps) => {
    const [conditionDialogOpen, setConditionDialogOpen] = useState(false);
    const [editingConditionForId, setEditingConditionForId] = useState<number | null>(null);
    const [editingCondition, setEditingCondition] = useState<BuilderCondition | null>(null);

    // Collect all placeholders from selected clauses to use as fields in ConditionBuilder
    const allPlaceholders = [
        ...new Set(selectedClauses.flatMap((sc) => sc.clause?.placeholders || [])),
    ];

    const handleOpenConditionEditor = (clauseId: number, currentCondition: any) => {
        setEditingConditionForId(clauseId);
        setEditingCondition(currentCondition ? JSON.parse(JSON.stringify(currentCondition)) : null);
        setConditionDialogOpen(true);
    };

    const handleSaveCondition = () => {
        if (editingConditionForId !== null) {
            setClauseCondition(editingConditionForId, editingCondition as unknown as string);
        }
        setConditionDialogOpen(false);
        setEditingConditionForId(null);
        setEditingCondition(null);
    };

    return (
        <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
        >
            {errors.clauses && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="text-sm">{errors.clauses}</span>
                </div>
            )}

            {/* Quick Action Button for new clause */}
            <div className="flex justify-end">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowClauseCreator(true)}
                    className="gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Neuen Textbaustein erstellen
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 h-[450px]">
                {/* Available Clauses */}
                <Card className="overflow-hidden">
                    <CardHeader className="py-3 bg-warm-50">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Verfügbare Textbausteine
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-y-auto h-[calc(100%-48px)]">
                        {loadingClauses ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                        ) : Object.keys(groupedClauses).length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground">
                                {selectedClauses.length === 0 ? (
                                    <>
                                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">Noch keine Textbausteine vorhanden</p>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="mt-2"
                                            onClick={() => setShowClauseCreator(true)}
                                        >
                                            <Plus className="w-4 h-4 mr-1" />
                                            Textbaustein erstellen
                                        </Button>
                                    </>
                                ) : (
                                    <>Alle Textbausteine wurden hinzugefügt</>
                                )}
                            </div>
                        ) : (
                            <div className="divide-y">
                                {Object.entries(groupedClauses).map(([cat, clauses]) => (
                                    <div key={cat}>
                                        <div className="px-3 py-2 bg-warm-50 text-xs font-medium text-muted-foreground uppercase">
                                            {cat}
                                        </div>
                                        {(clauses as Clause[]).map((clause) => (
                                            <div
                                                key={clause.id}
                                                className="flex items-center justify-between p-3 hover:bg-warm-50 cursor-pointer group"
                                                onClick={() => addClause(clause)}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">
                                                        {clause.title}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        v{clause.version}
                                                    </p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="opacity-0 group-hover:opacity-100"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Selected Clauses */}
                <Card className="overflow-hidden">
                    <CardHeader className="py-3 bg-primary/5">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Settings2 className="w-4 h-4" />
                            Ausgewählte Textbausteine ({selectedClauses.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-y-auto h-[calc(100%-48px)]">
                        {selectedClauses.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground">
                                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Keine Textbausteine ausgewählt</p>
                                <p className="text-xs">
                                    Klicke links auf einen Textbaustein, um ihn hinzuzufügen
                                </p>
                            </div>
                        ) : (
                            <SortableList
                                items={selectedClauses.map((sc) => ({
                                    ...sc,
                                    id: sc.clause_id,
                                }))}
                                onReorder={(newOrder) => {
                                    reorderClauses(newOrder);
                                }}
                                className="divide-y"
                                renderItem={(item, index) => (
                                    <SortableItemWrapper
                                        id={item.id}
                                        className="bg-white hover:bg-warm-50"
                                    >
                                        <div className="flex items-center gap-2 p-3">
                                            <DragHandle className="w-6 h-6" />
                                            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                                                {index + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {item.clause?.title || `Textbaustein ${item.clause_id}`}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleMandatory(item.clause_id)}
                                                    className={cn(
                                                        "px-2 py-1 text-xs rounded transition-colors",
                                                        item.is_mandatory
                                                            ? "bg-secondary/20 text-secondary"
                                                            : "bg-warm-100 text-muted-foreground"
                                                    )}
                                                >
                                                    {item.is_mandatory ? "Pflicht" : "Optional"}
                                                </button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleOpenConditionEditor(item.clause_id, item.condition)}
                                                    className={cn("px-2 py-1 h-7 text-xs rounded transition-colors", item.condition ? "bg-blue-100 text-blue-700" : "text-muted-foreground")}
                                                    title="Bedingung hinzufügen"
                                                >
                                                    {item.condition ? "Bedingt" : "Bedingung"}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => removeClause(item.clause_id)}
                                                >
                                                    <X className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </div>
                                    </SortableItemWrapper>
                                )}
                                renderDragOverlay={(item) => (
                                    <div className="flex items-center gap-2 p-3 bg-white border rounded-lg shadow-lg">
                                        <GripVertical className="w-4 h-4 text-warm-400" />
                                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                                            {selectedClauses.findIndex(sc => sc.clause_id === item.id) + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {item.clause?.title || `Textbaustein ${item.clause_id}`}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            />
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Variant Groups Section */}
            <div className="mt-6 border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-purple-600" />
                        <span className="font-medium text-sm">Varianten-Gruppen</span>
                        <span className="text-xs text-muted-foreground">
                            (optional)
                        </span>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                    Varianten-Gruppen ermöglichen es dem Benutzer im Generator zwischen verschiedenen Textbaustein-Varianten zu wählen (z.B. verschiedene Kündigungsfristen).
                </p>

                <div className="grid grid-cols-2 gap-4 h-[250px]">
                    {/* Available Variant Groups */}
                    <Card className="overflow-hidden border-purple-200">
                        <CardHeader className="py-2 bg-purple-50">
                            <CardTitle className="text-sm flex items-center gap-2 text-purple-800">
                                <Layers className="w-4 h-4" />
                                Verfügbare Gruppen
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 overflow-y-auto h-[calc(100%-40px)]">
                            {loadingVariantGroups ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                </div>
                            ) : unselectedVariantGroups.length === 0 ? (
                                <div className="p-3 text-center text-muted-foreground text-xs">
                                    Keine weiteren Varianten-Gruppen verfügbar
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {unselectedVariantGroups.map((vg) => (
                                        <div
                                            key={vg.id}
                                            className="flex items-center justify-between p-2 hover:bg-purple-50 cursor-pointer group"
                                            onClick={() => addVariantGroup(vg)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{vg.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {vg.variants?.length || 0} Varianten
                                                </p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0"
                                            >
                                                <Plus className="w-4 h-4 text-purple-600" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Selected Variant Groups */}
                    <Card className="overflow-hidden border-purple-200">
                        <CardHeader className="py-2 bg-purple-100/50">
                            <CardTitle className="text-sm flex items-center gap-2 text-purple-800">
                                <GitBranch className="w-4 h-4" />
                                Zugeordnete Gruppen ({selectedVariantGroups.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 overflow-y-auto h-[calc(100%-40px)]">
                            {selectedVariantGroups.length === 0 ? (
                                <div className="p-3 text-center text-muted-foreground">
                                    <Layers className="w-6 h-6 mx-auto mb-1 opacity-50" />
                                    <p className="text-xs">Keine Varianten-Gruppen zugeordnet</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {selectedVariantGroups.map((vg) => (
                                        <div
                                            key={vg.variant_group_id}
                                            className="p-2 bg-white hover:bg-warm-50"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">
                                                        {vg.name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {vg.variant_count || vg.variants?.length || 0} Varianten
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => toggleVariantGroupMandatory(vg.variant_group_id)}
                                                    className={cn(
                                                        "px-2 py-0.5 text-xs rounded",
                                                        vg.is_mandatory
                                                            ? "bg-purple-100 text-purple-700"
                                                            : "bg-warm-100 text-muted-foreground"
                                                    )}
                                                >
                                                    {vg.is_mandatory ? "Pflicht" : "Optional"}
                                                </button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 w-7 p-0"
                                                    onClick={() => removeVariantGroup(vg.variant_group_id)}
                                                >
                                                    <X className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </div>
                                            {/* Default variant selection */}
                                            {vg.variants && vg.variants.length > 0 && (
                                                <div className="mt-2">
                                                    <Select
                                                        value={String(vg.default_variant_id || "")}
                                                        onValueChange={(val) => setVariantGroupDefault(vg.variant_group_id, parseInt(val))}
                                                    >
                                                        <SelectTrigger className="h-7 text-xs">
                                                            <SelectValue placeholder="Standard-Variante wählen" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {vg.variants.map((v) => (
                                                                <SelectItem key={v.id} value={String(v.id)}>
                                                                    {v.variant_name} {v.is_default && "(Gruppen-Standard)"}
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
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Condition Dialog */}
            <Dialog open={conditionDialogOpen} onOpenChange={setConditionDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Bedingung für Textbaustein</DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto py-2">
                        <ConditionBuilder
                            condition={editingCondition as BuilderCondition}
                            onChange={setEditingCondition}
                            fields={allPlaceholders.map(p => ({
                                name: p,
                                label: p,
                                category: "Platzhalter",
                                type: "text"
                            }))}
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setConditionDialogOpen(false);
                            setEditingCondition(null);
                            setEditingConditionForId(null);
                        }}>
                            Abbrechen
                        </Button>
                        <Button onClick={handleSaveCondition}>
                            Übernehmen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
};
