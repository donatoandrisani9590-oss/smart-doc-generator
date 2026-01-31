/**
 * UndoRedoToolbar Component
 *
 * Zeigt Undo/Redo-Buttons mit Tastaturkürzel-Hinweisen.
 */

import { Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface UndoRedoToolbarProps {
    /** Kann Undo ausgeführt werden? */
    canUndo: boolean;
    /** Kann Redo ausgeführt werden? */
    canRedo: boolean;
    /** Undo-Funktion */
    onUndo: () => void;
    /** Redo-Funktion */
    onRedo: () => void;
    /** Anzahl der Undo-Schritte (optional) */
    undoCount?: number;
    /** Anzahl der Redo-Schritte (optional) */
    redoCount?: number;
    /** Zusätzliche CSS-Klassen */
    className?: string;
    /** Kompakte Ansicht ohne Text */
    compact?: boolean;
}

export const UndoRedoToolbar = ({
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    undoCount,
    redoCount,
    className,
    compact = false,
}: UndoRedoToolbarProps) => {
    // Detect OS for keyboard shortcut display
    const isMac =
        typeof navigator !== "undefined" &&
        navigator.platform.toLowerCase().includes("mac");
    const modKey = isMac ? "⌘" : "Strg";

    return (
        <TooltipProvider delayDuration={300}>
            <div
                className={cn(
                    "flex items-center gap-1 bg-muted/50 rounded-lg p-1",
                    className
                )}
            >
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onUndo}
                            disabled={!canUndo}
                            className={cn(
                                "h-8 gap-1.5",
                                compact ? "w-8 p-0" : "px-2"
                            )}
                            aria-label="Rückgängig"
                        >
                            <Undo2 className="w-4 h-4" />
                            {!compact && (
                                <span className="text-xs">Rückgängig</span>
                            )}
                            {undoCount !== undefined && undoCount > 0 && (
                                <span className="text-[10px] text-muted-foreground bg-background rounded px-1">
                                    {undoCount}
                                </span>
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <div className="text-center">
                            <p className="font-medium">Rückgängig</p>
                            <p className="text-xs opacity-70">{modKey}+Z</p>
                        </div>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onRedo}
                            disabled={!canRedo}
                            className={cn(
                                "h-8 gap-1.5",
                                compact ? "w-8 p-0" : "px-2"
                            )}
                            aria-label="Wiederherstellen"
                        >
                            <Redo2 className="w-4 h-4" />
                            {!compact && (
                                <span className="text-xs">Wiederherstellen</span>
                            )}
                            {redoCount !== undefined && redoCount > 0 && (
                                <span className="text-[10px] text-muted-foreground bg-background rounded px-1">
                                    {redoCount}
                                </span>
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <div className="text-center">
                            <p className="font-medium">Wiederherstellen</p>
                            <p className="text-xs opacity-70">
                                {modKey}+{isMac ? "⇧+Z" : "Y"}
                            </p>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    );
};

export default UndoRedoToolbar;
