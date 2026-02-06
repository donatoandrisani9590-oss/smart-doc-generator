"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronDown, ChevronRight, X, Pencil, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { CanvasClauseCard } from "./CanvasClauseCard";
import type { SortableSectionProps } from "./types";

export const SortableSection = ({
    section,
    onToggleCollapse,
    onTitleChange,
    onRemoveSection,
    onRemoveClause,
    isOverSection,
}: SortableSectionProps) => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState(section.title);
    const inputRef = useRef<HTMLInputElement>(null);

    const {
        attributes,
        listeners,
        setNodeRef: setSortableRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: section.id,
        data: {
            type: "section",
            section,
        },
    });

    const { setNodeRef: setDroppableRef } = useDroppable({
        id: `section-drop-${section.id}`,
        data: {
            type: "section-drop",
            sectionId: section.id,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const clauseIds = useMemo(() => section.clauses.map((c) => c.id), [section.clauses]);

    useEffect(() => {
        if (isEditingTitle && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditingTitle]);

    const handleTitleSubmit = () => {
        if (editedTitle.trim()) {
            onTitleChange(section.id, editedTitle.trim());
        } else {
            setEditedTitle(section.title);
        }
        setIsEditingTitle(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleTitleSubmit();
        } else if (e.key === "Escape") {
            setEditedTitle(section.title);
            setIsEditingTitle(false);
        }
    };

    return (
        <div
            ref={setSortableRef}
            style={style}
            className={cn(
                "rounded-lg border-2 transition-all",
                isDragging && "opacity-50 shadow-xl ring-2 ring-blue-500 z-50",
                isOverSection && "ring-2 ring-primary bg-primary/5"
            )}
        >
            <Collapsible open={!section.isCollapsed}>
                {/* Section Header */}
                <div
                    className={cn(
                        "flex items-center gap-2 p-3 rounded-t-lg",
                        "bg-slate-100 border-b"
                    )}
                >
                    {/* Drag Handle */}
                    <button
                        type="button"
                        {...attributes}
                        {...listeners}
                        className={cn(
                            "flex items-center justify-center w-6 h-6 rounded text-muted-foreground",
                            "hover:text-foreground hover:bg-muted cursor-grab",
                            "focus:outline-none focus:ring-2 focus:ring-primary",
                            isDragging && "cursor-grabbing"
                        )}
                        aria-label="Section verschieben"
                    >
                        <GripVertical className="w-4 h-4" />
                    </button>

                    {/* Collapse Toggle */}
                    <CollapsibleTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onToggleCollapse(section.id)}
                        >
                            {section.isCollapsed ? (
                                <ChevronRight className="w-4 h-4" />
                            ) : (
                                <ChevronDown className="w-4 h-4" />
                            )}
                        </Button>
                    </CollapsibleTrigger>

                    {/* Section Title */}
                    <div className="flex-1 min-w-0">
                        {isEditingTitle ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    ref={inputRef}
                                    value={editedTitle}
                                    onChange={(e) => setEditedTitle(e.target.value)}
                                    onBlur={handleTitleSubmit}
                                    onKeyDown={handleKeyDown}
                                    className="h-7 text-sm font-semibold"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={handleTitleSubmit}
                                >
                                    <Check className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-sm truncate">
                                    {section.title}
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
                                    onClick={() => setIsEditingTitle(true)}
                                >
                                    <Pencil className="w-3 h-3" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Clause Count */}
                    <Badge variant="secondary" className="text-xs">
                        {section.clauses.length} Klausel{section.clauses.length !== 1 ? "n" : ""}
                    </Badge>

                    {/* Delete Section */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemoveSection(section.id)}
                        aria-label="Section entfernen"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Section Content */}
                <CollapsibleContent>
                    <div
                        ref={setDroppableRef}
                        className={cn(
                            "p-3 min-h-[60px] bg-slate-50/50 rounded-b-lg",
                            isOverSection && "bg-primary/5"
                        )}
                    >
                        {section.clauses.length === 0 ? (
                            <div className="flex items-center justify-center h-12 border-2 border-dashed border-slate-300 rounded text-sm text-muted-foreground">
                                Klauseln hier ablegen
                            </div>
                        ) : (
                            <SortableContext
                                items={clauseIds}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-2">
                                    {section.clauses.map((clause) => (
                                        <CanvasClauseCard
                                            key={clause.id}
                                            clause={clause}
                                            onRemove={(id) => onRemoveClause(section.id, id)}
                                            inSection
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
};
