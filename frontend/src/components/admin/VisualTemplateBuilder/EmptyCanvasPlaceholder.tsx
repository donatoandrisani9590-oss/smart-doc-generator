"use client";

import { Plus, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EmptyCanvasPlaceholderProps } from "./types";

export const EmptyCanvasPlaceholder = ({ isOver, onAddSection }: EmptyCanvasPlaceholderProps) => {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg transition-all",
                isOver
                    ? "border-primary bg-primary/5 scale-[1.02]"
                    : "border-muted-foreground/30"
            )}
        >
            <div
                className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors",
                    isOver ? "bg-primary/20" : "bg-muted"
                )}
            >
                <Plus
                    className={cn(
                        "w-8 h-8 transition-colors",
                        isOver ? "text-primary" : "text-muted-foreground"
                    )}
                />
            </div>
            <p className="text-lg font-medium text-muted-foreground">
                {isOver ? "Textbaustein hier ablegen" : "Textbausteine hier ablegen"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
                Ziehe Textbausteine aus der Toolbox hierher
            </p>
            {onAddSection && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onAddSection}
                    className="mt-4 gap-1"
                >
                    <FolderPlus className="w-4 h-4" />
                    Section erstellen
                </Button>
            )}
        </div>
    );
};
