/**
 * SortableConditionRow - Single draggable condition row
 *
 * Renders a single condition with field/clause/variant selector,
 * operator selector, value input, and action buttons.
 */

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectGroup,
    SelectLabel,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Trash2,
    GripVertical,
    HelpCircle,
    Layers,
    AlertCircle,
    CheckCircle2,
    Copy,
    GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { OPERATORS } from "./constants";
import { getFieldInfo, getOperatorsForField, groupFieldsByCategory } from "./utils";
import type {
    ConditionKind,
    FieldDefinition,
    SortableConditionRowProps,
    VariantReference,
} from "./types";

export const SortableConditionRow = ({
    condition,
    onChange,
    onRemove,
    onDuplicate,
    disabled = false,
    showRemove,
    index,
    fields,
    fieldSearch,
    availableClauses,
    availableVariants,
}: SortableConditionRowProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: condition.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 1,
    };

    // Determine condition kind (default to "field" for backwards compatibility)
    const conditionKind: ConditionKind = condition.conditionKind || "field";

    const fieldsByCategory = useMemo(() => groupFieldsByCategory(fields), [fields]);
    const fieldInfo = getFieldInfo(condition.field, fields);
    const fieldType = fieldInfo?.type || "text";
    const operators = getOperatorsForField(condition.field, fields);
    const selectedOperator = operators.find((o) => o.value === condition.operator);

    // Get clause/variant info
    const selectedClause = availableClauses.find(c => c.id === condition.clauseId);
    const selectedVariant = availableVariants.find(v => v.id === condition.variantId);

    // Filter fields based on search
    const filteredFieldsByCategory = useMemo(() => {
        if (!fieldSearch) return fieldsByCategory;
        const search = fieldSearch.toLowerCase();
        const result: Record<string, FieldDefinition[]> = {};
        Object.entries(fieldsByCategory).forEach(([category, categoryFields]) => {
            const filtered = categoryFields.filter(
                (f) =>
                    f.label.toLowerCase().includes(search) ||
                    f.name.toLowerCase().includes(search) ||
                    f.description?.toLowerCase().includes(search)
            );
            if (filtered.length > 0) {
                result[category] = filtered;
            }
        });
        return result;
    }, [fieldsByCategory, fieldSearch]);

    // Filter clauses based on search
    const filteredClauses = useMemo(() => {
        if (!fieldSearch) return availableClauses;
        const search = fieldSearch.toLowerCase();
        return availableClauses.filter(c => c.title.toLowerCase().includes(search));
    }, [availableClauses, fieldSearch]);

    // Filter variants based on search
    const filteredVariants = useMemo(() => {
        if (!fieldSearch) return availableVariants;
        const search = fieldSearch.toLowerCase();
        return availableVariants.filter(v =>
            v.title.toLowerCase().includes(search) ||
            v.clauseTitle?.toLowerCase().includes(search)
        );
    }, [availableVariants, fieldSearch]);

    // Group variants by clause
    const variantsByClause = useMemo(() => {
        const grouped: Record<number, { clauseTitle: string; variants: VariantReference[] }> = {};
        filteredVariants.forEach(v => {
            if (!grouped[v.clauseId]) {
                grouped[v.clauseId] = { clauseTitle: v.clauseTitle || `Klausel ${v.clauseId}`, variants: [] };
            }
            grouped[v.clauseId].variants.push(v);
        });
        return grouped;
    }, [filteredVariants]);

    const handleConditionKindChange = (newKind: ConditionKind) => {
        // Reset the condition when changing kind
        onChange({
            ...condition,
            conditionKind: newKind,
            field: "",
            clauseId: undefined,
            variantId: undefined,
            operator: newKind === "field" ? "" : "==",
            value: newKind === "field" ? "" : true,
        });
    };

    const handleFieldChange = (newField: string) => {
        const newFieldInfo = getFieldInfo(newField, fields);
        const newType = newFieldInfo?.type || "text";
        const newOperators = OPERATORS[newType] || OPERATORS.text;

        let defaultValue: string | number | boolean = "";
        if (newType === "boolean") {
            defaultValue = true;
        }

        onChange({
            ...condition,
            conditionKind: "field",
            field: newField,
            clauseId: undefined,
            variantId: undefined,
            operator: newOperators[0]?.value || "==",
            value: defaultValue,
        });
    };

    const handleClauseChange = (clauseId: string) => {
        onChange({
            ...condition,
            conditionKind: "clause_active",
            field: "",
            clauseId: parseInt(clauseId, 10),
            variantId: undefined,
            operator: "==",
            value: true,
        });
    };

    const handleVariantChange = (variantId: string) => {
        onChange({
            ...condition,
            conditionKind: "variant_selected",
            field: "",
            clauseId: undefined,
            variantId: parseInt(variantId, 10),
            operator: "==",
            value: true,
        });
    };

    const handleOperatorChange = (newOperator: string) => {
        const operator = operators.find((o) => o.value === newOperator);
        const newValue = operator?.requiresValue ? condition.value : "";
        onChange({
            ...condition,
            operator: newOperator,
            value: newValue,
        });
    };

    const handleValueChange = (newValue: string | number | boolean) => {
        onChange({
            ...condition,
            value: newValue,
        });
    };

    const renderValueInput = () => {
        if (selectedOperator && !selectedOperator.requiresValue) {
            return (
                <div className="flex items-center px-3 py-2 bg-muted/50 rounded-md text-sm text-muted-foreground italic">
                    — kein Wert erforderlich —
                </div>
            );
        }

        switch (fieldType) {
            case "boolean":
                return (
                    <Select
                        value={condition.value === true ? "true" : "false"}
                        onValueChange={(v) => handleValueChange(v === "true")}
                        disabled={disabled || !condition.field}
                    >
                        <SelectTrigger className="min-w-[150px]">
                            <SelectValue placeholder="W\u00E4hlen..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="true">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    Ja / Aktiviert
                                </div>
                            </SelectItem>
                            <SelectItem value="false">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                                    Nein / Deaktiviert
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                );

            case "select":
                return (
                    <Select
                        value={String(condition.value)}
                        onValueChange={handleValueChange}
                        disabled={disabled || !condition.field}
                    >
                        <SelectTrigger className="min-w-[150px]">
                            <SelectValue placeholder="Wert w\u00E4hlen..." />
                        </SelectTrigger>
                        <SelectContent>
                            {fieldInfo?.options?.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                    {opt}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );

            case "number":
                // Special handling for "between" operator
                if (condition.operator === "between") {
                    const parts = String(condition.value || "").split("-");
                    const minValue = parts[0] || "";
                    const maxValue = parts[1] || "";
                    return (
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                value={minValue}
                                onChange={(e) => handleValueChange(`${e.target.value}-${maxValue}`)}
                                placeholder="Von"
                                disabled={disabled || !condition.field}
                                className="w-24"
                            />
                            <span className="text-muted-foreground">—</span>
                            <Input
                                type="number"
                                value={maxValue}
                                onChange={(e) => handleValueChange(`${minValue}-${e.target.value}`)}
                                placeholder="Bis"
                                disabled={disabled || !condition.field}
                                className="w-24"
                            />
                            {fieldInfo?.unit && (
                                <span className="text-sm text-muted-foreground">
                                    {fieldInfo.unit}
                                </span>
                            )}
                        </div>
                    );
                }
                return (
                    <div className="relative">
                        <Input
                            type="number"
                            value={condition.value === "" ? "" : Number(condition.value)}
                            onChange={(e) => handleValueChange(e.target.value === "" ? "" : Number(e.target.value))}
                            placeholder={fieldInfo?.unit ? `z.B. 80000` : "Wert"}
                            disabled={disabled || !condition.field}
                            className="min-w-[120px] pr-12"
                        />
                        {fieldInfo?.unit && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                {fieldInfo.unit}
                            </span>
                        )}
                    </div>
                );

            default:
                return (
                    <Input
                        type="text"
                        value={String(condition.value)}
                        onChange={(e) => handleValueChange(e.target.value)}
                        placeholder="z.B. Manager"
                        disabled={disabled || !condition.field}
                        className="min-w-[150px]"
                    />
                );
        }
    };

    // Check if clause/variant conditions are available
    const hasClauseConditions = availableClauses.length > 0;
    const hasVariantConditions = availableVariants.length > 0;
    const showKindSelector = hasClauseConditions || hasVariantConditions;

    // Render the target selector based on condition kind
    const renderTargetSelector = () => {
        switch (conditionKind) {
            case "clause_active":
                return (
                    <Select
                        value={condition.clauseId?.toString() || ""}
                        onValueChange={handleClauseChange}
                        disabled={disabled}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Klausel w\u00E4hlen..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            {filteredClauses.map((clause) => (
                                <SelectItem key={clause.id} value={clause.id.toString()}>
                                    {clause.title}
                                </SelectItem>
                            ))}
                            {filteredClauses.length === 0 && (
                                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                    Keine Klauseln verf\u00FCgbar
                                </div>
                            )}
                        </SelectContent>
                    </Select>
                );

            case "variant_selected":
                return (
                    <Select
                        value={condition.variantId?.toString() || ""}
                        onValueChange={handleVariantChange}
                        disabled={disabled}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Variante w\u00E4hlen..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            {Object.entries(variantsByClause).map(([clauseId, { clauseTitle, variants }]) => (
                                <SelectGroup key={clauseId}>
                                    <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {clauseTitle}
                                    </SelectLabel>
                                    {variants.map((variant) => (
                                        <SelectItem key={variant.id} value={variant.id.toString()}>
                                            {variant.title}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            ))}
                            {Object.keys(variantsByClause).length === 0 && (
                                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                    Keine Varianten verf\u00FCgbar
                                </div>
                            )}
                        </SelectContent>
                    </Select>
                );

            default: // "field"
                return (
                    <Select
                        value={condition.field}
                        onValueChange={handleFieldChange}
                        disabled={disabled}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Feld w\u00E4hlen..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            {Object.entries(filteredFieldsByCategory).map(([category, categoryFields]) => (
                                <SelectGroup key={category}>
                                    <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {category}
                                    </SelectLabel>
                                    {categoryFields.map((field) => (
                                        <SelectItem key={field.name} value={field.name}>
                                            <div className="flex items-center gap-2">
                                                <span>{field.label}</span>
                                                {field.description && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {field.description}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            ))}
                        </SelectContent>
                    </Select>
                );
        }
    };

    // For clause_active and variant_selected, we show a simpler operator/value UI
    const renderClauseVariantOperator = () => (
        <Select
            value={condition.operator}
            onValueChange={(v) => onChange({ ...condition, operator: v })}
            disabled={disabled}
        >
            <SelectTrigger className="min-w-[120px]">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="==">ist</SelectItem>
                <SelectItem value="!=">ist nicht</SelectItem>
            </SelectContent>
        </Select>
    );

    const renderClauseVariantValue = () => (
        <Select
            value={condition.value === true ? "true" : "false"}
            onValueChange={(v) => handleValueChange(v === "true")}
            disabled={disabled}
        >
            <SelectTrigger className="min-w-[130px]">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="true">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        {conditionKind === "clause_active" ? "aktiv" : "gew\u00E4hlt"}
                    </div>
                </SelectItem>
                <SelectItem value="false">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-muted-foreground" />
                        {conditionKind === "clause_active" ? "nicht aktiv" : "nicht gew\u00E4hlt"}
                    </div>
                </SelectItem>
            </SelectContent>
        </Select>
    );

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "group flex items-center gap-2 p-3 rounded-lg border bg-card transition-all",
                "hover:border-primary/30 hover:shadow-sm",
                isDragging && "shadow-lg border-primary ring-2 ring-primary/20",
                disabled && "opacity-60"
            )}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none"
            >
                <GripVertical className="w-4 h-4" />
            </div>

            {/* Row Number */}
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                {index + 1}
            </div>

            {/* Condition Kind Selector - only shown if clauses/variants are available */}
            {showKindSelector && (
                <div className="flex-shrink-0 min-w-[130px]">
                    <Select
                        value={conditionKind}
                        onValueChange={(v) => handleConditionKindChange(v as ConditionKind)}
                        disabled={disabled}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="field">
                                <div className="flex items-center gap-2">
                                    <Layers className="w-4 h-4" />
                                    Feld
                                </div>
                            </SelectItem>
                            {hasClauseConditions && (
                                <SelectItem value="clause_active">
                                    <div className="flex items-center gap-2">
                                        <GitBranch className="w-4 h-4" />
                                        Klausel
                                    </div>
                                </SelectItem>
                            )}
                            {hasVariantConditions && (
                                <SelectItem value="variant_selected">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Variante
                                    </div>
                                </SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Target Selector (Field / Clause / Variant) */}
            <div className="flex-1 min-w-[180px]">
                {renderTargetSelector()}
            </div>

            {/* Operator & Value - different for field vs clause/variant */}
            {conditionKind === "field" ? (
                <>
                    {/* Operator Selector */}
                    <div className="flex-shrink-0 min-w-[140px]">
                        <Select
                            value={condition.operator}
                            onValueChange={handleOperatorChange}
                            disabled={disabled || !condition.field}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Bedingung..." />
                            </SelectTrigger>
                            <SelectContent>
                                {operators.map((op) => (
                                    <SelectItem key={op.value} value={op.value}>
                                        <div className="flex items-center gap-2">
                                            <span>{op.label}</span>
                                            {op.description && (
                                                <span className="text-xs text-muted-foreground">
                                                    ({op.description})
                                                </span>
                                            )}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Value Input */}
                    <div className="flex-shrink-0">
                        {renderValueInput()}
                    </div>
                </>
            ) : (
                <>
                    {/* Simplified Operator for Clause/Variant */}
                    <div className="flex-shrink-0">
                        {renderClauseVariantOperator()}
                    </div>

                    {/* Simplified Value for Clause/Variant */}
                    <div className="flex-shrink-0">
                        {renderClauseVariantValue()}
                    </div>

                    {/* Show selected item info */}
                    {conditionKind === "clause_active" && selectedClause && (
                        <Badge variant="outline" className="text-xs">
                            {selectedClause.title}
                        </Badge>
                    )}
                    {conditionKind === "variant_selected" && selectedVariant && (
                        <Badge variant="outline" className="text-xs">
                            {selectedVariant.title}
                        </Badge>
                    )}
                </>
            )}

            {/* Action Buttons */}
            <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onDuplicate && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onDuplicate}
                                    disabled={disabled}
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Bedingung duplizieren (Strg+D)</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {showRemove && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onRemove}
                                    disabled={disabled}
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Bedingung entfernen (Entf)</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </div>
    );
};
