/**
 * ClauseBlock - Einzelne Klausel im Document Canvas
 *
 * Smart UX Konzept:
 * - Grüner Rand + 🔒 = Global (aus Bibliothek, schreibgeschützt)
 * - Blauer Rand + ✏️ = Local/Deviation (editierbar)
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { GripVertical, Lock, Edit3, Info, Trash2, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/utils/sanitize";
import type { ClauseInstance } from "./types";

interface ClauseBlockProps {
    clause: ClauseInstance;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onDeviate?: () => void;
    disabled?: boolean;
}

export const ClauseBlock = ({
    clause,
    isSelected,
    onSelect,
    onDelete,
    onDeviate,
    disabled = false,
}: ClauseBlockProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: clause.id,
        disabled,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const isGlobal = clause.origin === "global";
    const isDeviation = clause.origin === "deviation";
    const isLocal = clause.origin === "local";

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            className={cn(
                "clause-block relative p-4 rounded-lg border-2 cursor-pointer transition-all",
                "hover:shadow-md",
                isDragging && "opacity-50 shadow-xl z-50",
                isSelected && "ring-2 ring-primary ring-offset-2",
                // Farbcodierung nach Origin
                isGlobal && "border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-transparent",
                (isLocal || isDeviation) && "border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-transparent",
                !clause.is_condition_met && "opacity-50"
            )}
            onClick={onSelect}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
        >
            {/* Deviation Badge */}
            {isDeviation && (
                <div className="absolute -top-2 right-3">
                    <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                        Abgewandelt
                    </Badge>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {/* Drag Handle */}
                    <div
                        {...attributes}
                        {...listeners}
                        className={cn(
                            "p-1 rounded cursor-grab active:cursor-grabbing",
                            "hover:bg-muted text-muted-foreground",
                            disabled && "cursor-not-allowed opacity-50"
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Origin Icon */}
                    {isGlobal ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="p-1 rounded bg-green-100">
                                        <Lock className="w-4 h-4 text-green-600" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Standard-Klausel aus der Bibliothek</p>
                                    <p className="text-xs text-muted-foreground">
                                        Klicken Sie auf "Aufbrechen", um sie anzupassen
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="p-1 rounded bg-blue-100">
                                        <Edit3 className="w-4 h-4 text-blue-600" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{isDeviation ? "Angepasste Klausel" : "Individuelle Klausel"}</p>
                                    <p className="text-xs text-muted-foreground">Frei editierbar</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    {/* Title */}
                    <span className="font-medium text-sm">{clause.title}</span>

                    {/* Order Badge */}
                    <Badge variant="outline" className="text-xs ml-2">
                        #{clause.display_order + 1}
                    </Badge>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {/* Deviate Button (nur für Global) */}
                    {isGlobal && onDeviate && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={onDeviate}
                                    >
                                        <Unlock className="w-4 h-4 text-amber-600" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Schloss öffnen</p>
                                    <p className="text-xs text-muted-foreground">
                                        Klausel vom Standard abwandeln
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    {/* Delete Button */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-red-100 hover:text-red-600"
                                    onClick={onDelete}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Klausel entfernen</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            {/* Content Preview */}
            <div
                className={cn(
                    "text-sm text-muted-foreground line-clamp-3 pl-8",
                    isGlobal && "select-none"
                )}
                dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(clause.content_html || "<em>Kein Inhalt</em>"),
                }}
            />

            {/* Conditional Notice */}
            {!clause.is_condition_met && (
                <div className="mt-2 pl-8 flex items-center gap-1 text-xs text-amber-600">
                    <Info className="w-3 h-3" />
                    <span>Diese Klausel wird nur angezeigt, wenn die Bedingung erfüllt ist</span>
                </div>
            )}

            {/* Global Hint */}
            {isGlobal && isSelected && (
                <div className="mt-3 pl-8 p-2 bg-green-50 rounded text-xs text-green-700 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    <span>
                        Standard-Klausel. Um sie anzupassen, klicken Sie auf{" "}
                        <Unlock className="w-3 h-3 inline" /> "Aufbrechen".
                    </span>
                </div>
            )}
        </motion.div>
    );
};
