"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "./constants";
import type { CanvasClauseCardProps } from "./types";

export const CanvasClauseCard = ({ clause, onRemove, inSection = false }: CanvasClauseCardProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: clause.id,
        data: {
            type: "canvas-clause",
            clause,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const IconComponent = getCategoryIcon(clause.category);

    return (
        <Card
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative group transition-all",
                isDragging && "opacity-50 shadow-xl ring-2 ring-primary z-50",
                inSection && "border-l-4 border-l-blue-300"
            )}
        >
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    {/* Drag Handle */}
                    <button
                        type="button"
                        {...attributes}
                        {...listeners}
                        className={cn(
                            "flex items-center justify-center w-8 h-8 rounded text-muted-foreground",
                            "hover:text-foreground hover:bg-muted/50 cursor-grab",
                            "focus:outline-none focus:ring-2 focus:ring-primary",
                            isDragging && "cursor-grabbing"
                        )}
                        aria-label="Textbaustein verschieben"
                    >
                        <GripVertical className="w-4 h-4" />
                    </button>

                    {/* Icon */}
                    <div className="p-2 bg-green-100 rounded shrink-0">
                        {/* eslint-disable-next-line react-hooks/static-components -- dynamic component from lookup, not a nested component definition */}
                        <IconComponent className="w-4 h-4 text-green-600" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <p className="font-medium">{clause.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{clause.category}</p>
                    </div>

                    {/* Delete Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => onRemove(clause.id)}
                        aria-label={`${clause.title} entfernen`}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
