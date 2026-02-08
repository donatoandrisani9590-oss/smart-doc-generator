/**
 * CommentSidebar - Kommentar-Panel für Document Generator
 *
 * Wird als Sidebar rechts neben dem Dokument angezeigt.
 * Features:
 * - Toggle-Button mit Badge (Kommentar-Count)
 * - Slide-in Animation
 * - Filtert nach resolved/unresolved
 *
 * Verwendung im DocumentGenerator:
 * <CommentSidebar
 *   anchorType="draft"
 *   anchorId={draftId}
 *   isOpen={showComments}
 *   onToggle={() => setShowComments(!showComments)}
 * />
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Filter, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CommentThread } from "./CommentThread";
import { useCommentCount } from "@/hooks/useComments";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface CommentSidebarProps {
    anchorType: "document" | "draft" | "clause_instance" | "clause";
    anchorId: number;
    isOpen: boolean;
    onToggle: () => void;
    className?: string;
    /** Breite der Sidebar */
    width?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOGGLE BUTTON
// ═══════════════════════════════════════════════════════════════════════════

export interface CommentToggleButtonProps {
    anchorType: "document" | "draft" | "clause_instance" | "clause";
    anchorId: number;
    isOpen: boolean;
    onClick: () => void;
    className?: string;
}

export const CommentToggleButton = ({
    anchorType,
    anchorId,
    isOpen,
    onClick,
    className,
}: CommentToggleButtonProps) => {
    const { total, unresolved } = useCommentCount(anchorType, anchorId);

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant={isOpen ? "default" : "outline"}
                        size="sm"
                        onClick={onClick}
                        className={cn("relative gap-2", className)}
                    >
                        <MessageSquare className="w-4 h-4" />
                        <span className="hidden sm:inline">Kommentare</span>

                        {/* Badge */}
                        {unresolved > 0 && (
                            <Badge
                                variant="destructive"
                                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
                            >
                                {unresolved > 9 ? "9+" : unresolved}
                            </Badge>
                        )}

                        {/* Resolved indicator */}
                        {unresolved === 0 && total > 0 && (
                            <Badge
                                variant="secondary"
                                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-green-100 text-green-600"
                            >
                                <CheckCircle2 className="w-3 h-3" />
                            </Badge>
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    {total === 0
                        ? "Keine Kommentare"
                        : unresolved > 0
                            ? `${unresolved} offene Kommentare`
                            : `${total} Kommentare (alle gelöst)`}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════

export const CommentSidebar = ({
    anchorType,
    anchorId,
    isOpen,
    onToggle,
    className,
    width = 380,
}: CommentSidebarProps) => {
    const [showResolved, setShowResolved] = useState(true);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop for mobile */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
                        onClick={onToggle}
                    />

                    {/* Sidebar */}
                    <motion.div
                        initial={{ x: width, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: width, opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        style={{ width }}
                        className={cn(
                            "fixed right-0 top-0 h-full z-50",
                            "bg-white dark:bg-warm-50 border-l shadow-xl",
                            "flex flex-col",
                            "lg:relative lg:z-0",
                            className
                        )}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b">
                            <div className="flex items-center gap-3">
                                <MessageSquare className="w-5 h-5 text-primary" />
                                <h3 className="font-semibold">Kommentare</h3>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Filter Toggle */}
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant={showResolved ? "ghost" : "secondary"}
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => setShowResolved(!showResolved)}
                                            >
                                                <Filter className="w-4 h-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {showResolved
                                                ? "Gelöste ausblenden"
                                                : "Alle anzeigen"}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                {/* Close Button */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={onToggle}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Comment Thread */}
                        <div className="flex-1 overflow-hidden">
                            <CommentThread
                                anchorType={anchorType}
                                anchorId={anchorId}
                                className="h-full"
                            />
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default CommentSidebar;
