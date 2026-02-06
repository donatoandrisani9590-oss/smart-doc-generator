"use client";

import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "./constants";
import type { ToolboxClauseItemProps } from "./types";

export const ToolboxClauseItem = ({ clause }: ToolboxClauseItemProps) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `toolbox-${clause.id}`,
        data: {
            type: "toolbox-clause",
            clause,
        },
    });

    const style = transform
        ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
              zIndex: isDragging ? 999 : undefined,
          }
        : undefined;

    const IconComponent = getCategoryIcon(clause.category);

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={cn(
                "flex items-center gap-2 p-2.5 rounded-md bg-white border cursor-grab",
                "hover:border-primary hover:shadow-sm transition-all",
                "active:cursor-grabbing",
                isDragging && "opacity-50 shadow-lg ring-2 ring-primary"
            )}
        >
            <div className="p-1.5 bg-green-100 rounded shrink-0">
                <IconComponent className="w-3.5 h-3.5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{clause.title}</p>
                {clause.preview && (
                    <p className="text-xs text-muted-foreground truncate">{clause.preview}</p>
                )}
            </div>
            {clause.hasVariants && (
                <Badge variant="secondary" className="text-xs shrink-0">
                    {clause.variantCount}
                </Badge>
            )}
            {clause.isRequired && (
                <Badge variant="destructive" className="text-xs shrink-0">
                    Pflicht
                </Badge>
            )}
        </div>
    );
};
