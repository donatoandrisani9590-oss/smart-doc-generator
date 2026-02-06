"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CanvasClauseCard } from "./CanvasClauseCard";
import { SortableSection } from "./SortableSection";
import { EmptyCanvasPlaceholder } from "./EmptyCanvasPlaceholder";
import { DropIndicator } from "./DropIndicator";
import type { CanvasProps, CanvasWithSectionsProps } from "./types";

// ============================================================================
// Canvas with Sections Support
// ============================================================================

export const CanvasWithSections = ({
    sections,
    onToggleCollapse,
    onTitleChange,
    onRemoveSection,
    onRemoveClause,
    onAddSection,
    isOver,
    overSectionId,
}: CanvasWithSectionsProps) => {
    const { setNodeRef } = useDroppable({
        id: "canvas-drop-zone",
    });

    const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);
    const totalClauses = useMemo(
        () => sections.reduce((sum, s) => sum + s.clauses.length, 0),
        [sections]
    );

    return (
        <div className="flex-1 bg-muted/20 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b bg-white flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-lg">Document Canvas</h2>
                    <p className="text-sm text-muted-foreground">
                        {sections.length} Section{sections.length !== 1 ? "s" : ""}, {totalClauses}{" "}
                        Klausel{totalClauses !== 1 ? "n" : ""}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onAddSection}
                        className="gap-1"
                    >
                        <FolderPlus className="w-4 h-4" />
                        Neue Section
                    </Button>
                    <Badge variant="outline">{totalClauses} Elemente</Badge>
                </div>
            </div>

            {/* Canvas Area */}
            <ScrollArea className="flex-1">
                <div
                    ref={setNodeRef}
                    className={cn(
                        "p-4 min-h-full transition-colors",
                        isOver && !overSectionId && "bg-primary/5"
                    )}
                >
                    {sections.length === 0 ? (
                        <EmptyCanvasPlaceholder isOver={isOver} onAddSection={onAddSection} />
                    ) : (
                        <SortableContext
                            items={sectionIds}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-4">
                                {sections.map((section) => (
                                    <SortableSection
                                        key={section.id}
                                        section={section}
                                        onToggleCollapse={onToggleCollapse}
                                        onTitleChange={onTitleChange}
                                        onRemoveSection={onRemoveSection}
                                        onRemoveClause={onRemoveClause}
                                        isOverSection={overSectionId === section.id}
                                    />
                                ))}

                                {/* Drop Indicator at Bottom */}
                                {isOver && !overSectionId && <DropIndicator isOver={true} />}
                            </div>
                        </SortableContext>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

// ============================================================================
// Legacy Canvas (for backward compatibility)
// ============================================================================

export const Canvas = ({ clauses, onRemove, isOver }: CanvasProps) => {
    const { setNodeRef } = useDroppable({
        id: "canvas-drop-zone",
    });

    const clauseIds = useMemo(() => clauses.map((c) => c.id), [clauses]);

    return (
        <div className="flex-1 bg-muted/20 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b bg-white flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-lg">Document Canvas</h2>
                    <p className="text-sm text-muted-foreground">
                        {clauses.length} Klausel{clauses.length !== 1 ? "n" : ""} ausgewaehlt
                    </p>
                </div>
                <Badge variant="outline">{clauses.length} Elemente</Badge>
            </div>

            {/* Canvas Area */}
            <ScrollArea className="flex-1">
                <div
                    ref={setNodeRef}
                    className={cn(
                        "p-4 min-h-full transition-colors",
                        isOver && "bg-primary/5"
                    )}
                >
                    {clauses.length === 0 ? (
                        <EmptyCanvasPlaceholder isOver={isOver} />
                    ) : (
                        <SortableContext
                            items={clauseIds}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-3">
                                {clauses.map((clause) => (
                                    <CanvasClauseCard
                                        key={clause.id}
                                        clause={clause}
                                        onRemove={onRemove}
                                    />
                                ))}

                                {/* Drop Indicator at Bottom */}
                                <DropIndicator isOver={isOver} />
                            </div>
                        </SortableContext>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};
