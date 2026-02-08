import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GripVertical, Trash2, Settings, Layers } from "lucide-react";
import type { AssignedClause } from "./types";

interface SortableClauseProps {
    clause: AssignedClause;
    onRemove: (uniqueId: string) => void;
    onToggleMandatory: (uniqueId: string) => void;
    onEditCondition: (clause: AssignedClause) => void;
}

// Sortable Item Component with enhanced features
export const SortableClause = ({
    clause,
    onRemove,
    onToggleMandatory,
    onEditCondition,
}: SortableClauseProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: clause.uniqueId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-3 p-4 bg-card border rounded-lg shadow-soft-sm transition-all ${
                isDragging ? "border-primary shadow-lg ring-2 ring-primary/20" : "border-border"
            }`}
        >
            {/* Drag Handle */}
            <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded text-muted-foreground"
            >
                <GripVertical className="w-5 h-5" />
            </button>

            {/* Order Number */}
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                {clause.order}
            </div>

            {/* Clause Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h4 className="font-medium truncate">{clause.title}</h4>
                    {clause.clause_type === "variant" && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                                        <Layers className="w-3 h-3 mr-1" />
                                        Variante
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Bei der Dokumenterstellung kann eine Variante gewählt werden</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                    {clause.variant_group_name || clause.category}
                    {clause.version && !clause.variant_group_name && ` • v${clause.version}`}
                </p>
            </div>

            {/* Mandatory/Optional Toggle */}
            <div className="flex items-center gap-2 shrink-0">
                <span
                    className={`text-xs font-medium ${
                        clause.is_mandatory ? "text-primary" : "text-muted-foreground"
                    }`}
                >
                    {clause.is_mandatory ? "Pflicht" : "Optional"}
                </span>
                <Switch
                    checked={clause.is_mandatory}
                    onCheckedChange={() => onToggleMandatory(clause.uniqueId)}
                    className="data-[state=checked]:bg-secondary"
                />
            </div>

            {/* Condition Badge */}
            {clause.condition && (
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full shrink-0">
                    Bedingt
                </span>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEditCondition(clause)}
                    title="Bedingung bearbeiten"
                >
                    <Settings className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(clause.uniqueId)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Entfernen"
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};
