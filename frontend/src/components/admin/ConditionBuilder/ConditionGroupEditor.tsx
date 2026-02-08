/**
 * ConditionGroupEditor - Group of conditions with AND/OR logic
 *
 * Renders a group of conditions with drag-and-drop sorting,
 * nested sub-groups, and add/remove functionality.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Trash2,
    Plus,
    ChevronDown,
    ChevronRight,
    Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { createEmptyCondition, createEmptyGroup, cloneConditionWithNewIds } from "./utils";
import { SortableConditionRow } from "./SortableConditionRow";
import type { ConditionGroupEditorProps, SimpleCondition, ConditionGroup } from "./types";

export const ConditionGroupEditor = ({
    group,
    onChange,
    onRemove,
    disabled = false,
    isRoot: _isRoot = false,
    depth = 0,
    fields,
    fieldSearch,
    availableClauses,
    availableVariants,
}: ConditionGroupEditorProps) => {
    void _isRoot;
    const [isCollapsed, setIsCollapsed] = useState(false);

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = group.conditions.findIndex(
                (c) => c.id === active.id
            );
            const newIndex = group.conditions.findIndex(
                (c) => c.id === over.id
            );

            if (oldIndex !== -1 && newIndex !== -1) {
                onChange({
                    ...group,
                    conditions: arrayMove(group.conditions, oldIndex, newIndex),
                });
            }
        }
    };

    const handleLogicChange = (logic: "and" | "or") => {
        onChange({ ...group, logic });
    };

    const handleConditionChange = (index: number, newCondition: SimpleCondition | ConditionGroup) => {
        const newConditions = [...group.conditions];
        newConditions[index] = newCondition;
        onChange({ ...group, conditions: newConditions });
    };

    const handleRemoveCondition = (index: number) => {
        const newConditions = group.conditions.filter((_, i) => i !== index);
        if (newConditions.length === 0) {
            newConditions.push(createEmptyCondition());
        }
        onChange({ ...group, conditions: newConditions });
    };

    const handleAddCondition = () => {
        onChange({
            ...group,
            conditions: [...group.conditions, createEmptyCondition()],
        });
    };

    const handleAddGroup = (logic: "and" | "or") => {
        onChange({
            ...group,
            conditions: [...group.conditions, createEmptyGroup(logic)],
        });
    };

    const handleDuplicateCondition = (index: number) => {
        const conditionToDuplicate = group.conditions[index];
        const newConditions = [...group.conditions];
        newConditions.splice(index + 1, 0, cloneConditionWithNewIds(conditionToDuplicate));
        onChange({ ...group, conditions: newConditions });
    };

    const borderColor = depth === 0
        ? "border-primary/20"
        : group.logic === "and"
            ? "border-blue-200 dark:border-blue-800"
            : "border-amber-200 dark:border-amber-800";

    const bgColor = depth === 0
        ? "bg-background"
        : group.logic === "and"
            ? "bg-blue-50/50 dark:bg-blue-950/20"
            : "bg-amber-50/50 dark:bg-amber-950/20";

    // Get sortable IDs (only simple conditions for now)
    const sortableIds = group.conditions.map((c) => c.id);

    return (
        <div className={cn(
            "rounded-lg border-2 border-dashed p-4 transition-all",
            borderColor,
            bgColor,
            depth > 0 && "ml-4"
        )}>
            {/* Group Header */}
            <div className="flex items-center gap-3 mb-3 flex-wrap">
                {/* Collapse Toggle */}
                {depth > 0 && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="h-6 w-6 text-muted-foreground"
                    >
                        {isCollapsed ? (
                            <ChevronRight className="w-4 h-4" />
                        ) : (
                            <ChevronDown className="w-4 h-4" />
                        )}
                    </Button>
                )}

                {/* Group Icon */}
                <div className={cn(
                    "flex items-center gap-2 px-2 py-1 rounded",
                    group.logic === "and" ? "bg-blue-100 dark:bg-blue-900" : "bg-amber-100 dark:bg-amber-900"
                )}>
                    <Layers className="w-4 h-4" />
                    <span className="text-sm font-medium">
                        {depth === 0 ? "Bedingungsgruppe" : "Untergruppe"}
                    </span>
                </div>

                {/* Logic Toggle */}
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                    <Button
                        variant={group.logic === "and" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => handleLogicChange("and")}
                        disabled={disabled}
                        className={cn(
                            "h-7 px-3 text-xs font-semibold",
                            group.logic === "and" && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        )}
                    >
                        UND
                    </Button>
                    <Button
                        variant={group.logic === "or" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => handleLogicChange("or")}
                        disabled={disabled}
                        className={cn(
                            "h-7 px-3 text-xs font-semibold",
                            group.logic === "or" && "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                        )}
                    >
                        ODER
                    </Button>
                </div>

                {/* Logic Explanation */}
                <span className="text-xs text-muted-foreground flex-1">
                    {group.logic === "and"
                        ? "Alle Bedingungen müssen erfüllt sein"
                        : "Mindestens eine Bedingung muss erfüllt sein"}
                </span>

                {/* Remove Group Button */}
                {depth > 0 && onRemove && (
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
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Gruppe entfernen</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>

            {/* Conditions */}
            {!isCollapsed && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={sortableIds}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-2">
                            {group.conditions.map((condition, index) => (
                                <div key={condition.id}>
                                    {/* Logic Connector */}
                                    {index > 0 && (
                                        <div className="flex items-center gap-2 py-1 pl-8">
                                            <Badge
                                                variant={group.logic === "and" ? "default" : "secondary"}
                                                className={cn(
                                                    "text-xs",
                                                    group.logic === "and"
                                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                                        : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                                                )}
                                            >
                                                {group.logic === "and" ? "UND" : "ODER"}
                                            </Badge>
                                            <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                                        </div>
                                    )}

                                    {/* Condition or Nested Group */}
                                    {condition.type === "simple" ? (
                                        <SortableConditionRow
                                            condition={condition}
                                            onChange={(newCond) => handleConditionChange(index, newCond)}
                                            onRemove={() => handleRemoveCondition(index)}
                                            onDuplicate={() => handleDuplicateCondition(index)}
                                            disabled={disabled}
                                            showRemove={group.conditions.length > 1}
                                            index={index}
                                            fields={fields}
                                            fieldSearch={fieldSearch}
                                            availableClauses={availableClauses}
                                            availableVariants={availableVariants}
                                        />
                                    ) : (
                                        <ConditionGroupEditor
                                            group={condition}
                                            onChange={(newGroup) => handleConditionChange(index, newGroup)}
                                            onRemove={() => handleRemoveCondition(index)}
                                            disabled={disabled}
                                            depth={depth + 1}
                                            fields={fields}
                                            fieldSearch={fieldSearch}
                                            availableClauses={availableClauses}
                                            availableVariants={availableVariants}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {/* Add Buttons */}
            {!isCollapsed && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed border-muted-foreground/20 flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddCondition}
                        disabled={disabled}
                        className="gap-1.5"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Bedingung
                    </Button>

                    {depth < 2 && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddGroup("and")}
                                disabled={disabled}
                                className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
                            >
                                <Layers className="w-3.5 h-3.5" />
                                UND-Gruppe
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddGroup("or")}
                                disabled={disabled}
                                className="gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950"
                            >
                                <Layers className="w-3.5 h-3.5" />
                                ODER-Gruppe
                            </Button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
