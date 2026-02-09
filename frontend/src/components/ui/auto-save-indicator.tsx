/**
 * AutoSaveIndicator - Visual feedback fuer Auto-Save Status
 *
 * Zeigt den aktuellen Speicherstatus an:
 * - Idle: Keine Aenderungen
 * - Pending: Aenderungen erkannt, warte auf Speicherung
 * - Saving: Speichervorgang laeuft
 * - Saved: Erfolgreich gespeichert
 * - Error: Speicherfehler aufgetreten
 * - Offline: Lokal gespeichert (Netzwerk nicht verfuegbar)
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Cloud,
    Loader2,
    Check,
    AlertCircle,
    Clock,
    WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SaveStatus } from "@/hooks/useAutoSave";

// ============================================================================
// PROPS
// ============================================================================

export interface AutoSaveIndicatorProps {
    /** Current save status */
    status: SaveStatus;
    /** Human-readable last saved text */
    lastSavedText?: string;
    /** Whether there are unsaved changes */
    hasUnsavedChanges?: boolean;
    /** Error message if status is 'error' */
    errorMessage?: string;
    /** Size variant */
    size?: "sm" | "md" | "lg";
    /** Show as compact icon only */
    compact?: boolean;
    /** Additional className */
    className?: string;
    /** Callback when clicked (e.g., to retry save) */
    onClick?: () => void;
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

interface StatusConfig {
    icon: React.ElementType;
    label: string;
    description: string;
    color: string;
    bgColor: string;
    animate?: boolean;
}

const statusConfig: Record<SaveStatus, StatusConfig> = {
    idle: {
        icon: Cloud,
        label: "Gespeichert",
        description: "Alle Änderungen sind gespeichert",
        color: "text-muted-foreground",
        bgColor: "bg-muted/50",
    },
    pending: {
        icon: Clock,
        label: "Änderungen",
        description: "Änderungen werden bald gespeichert...",
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-950/30",
    },
    saving: {
        icon: Loader2,
        label: "Speichern...",
        description: "Daten werden gespeichert...",
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-950/30",
        animate: true,
    },
    saved: {
        icon: Check,
        label: "Gespeichert",
        description: "Erfolgreich gespeichert",
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-950/30",
    },
    error: {
        icon: AlertCircle,
        label: "Fehler",
        description: "Speichern fehlgeschlagen",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/30",
    },
    offline: {
        icon: WifiOff,
        label: "Offline",
        description: "Lokal gespeichert (keine Verbindung)",
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-950/30",
    },
};

// ============================================================================
// SIZE CONFIG
// ============================================================================

const sizeConfig = {
    sm: {
        iconSize: "h-3.5 w-3.5",
        textSize: "text-xs",
        padding: "px-2 py-1",
        gap: "gap-1.5",
    },
    md: {
        iconSize: "h-4 w-4",
        textSize: "text-sm",
        padding: "px-3 py-1.5",
        gap: "gap-2",
    },
    lg: {
        iconSize: "h-5 w-5",
        textSize: "text-base",
        padding: "px-4 py-2",
        gap: "gap-2.5",
    },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function AutoSaveIndicator({
    status,
    lastSavedText,
    hasUnsavedChanges: _hasUnsavedChanges, // Available for future tooltip enhancement
    errorMessage,
    size = "md",
    compact = false,
    className,
    onClick,
}: AutoSaveIndicatorProps) {
    const config = statusConfig[status];
    const sizes = sizeConfig[size];
    // Prefix unused variable to suppress warning
    void _hasUnsavedChanges;

    // For 'saved' status, show checkmark briefly then return to idle appearance
    const [showSavedState, setShowSavedState] = useState(false);

    useEffect(() => {
        if (status === "saved") {
            // Use setTimeout to avoid synchronous setState warning
            const showTimer = setTimeout(() => setShowSavedState(true), 0);
            const hideTimer = setTimeout(() => setShowSavedState(false), 2000);
            return () => {
                clearTimeout(showTimer);
                clearTimeout(hideTimer);
            };
        }
    }, [status]);

    const displayConfig = showSavedState ? statusConfig.saved : config;
    const DisplayIcon = displayConfig.icon;

    const tooltipContent = (
        <div className="space-y-1">
            <p className="font-medium">{displayConfig.label}</p>
            <p className="text-xs opacity-80">
                {errorMessage && status === "error" ? errorMessage : displayConfig.description}
            </p>
            {lastSavedText && (
                <p className="text-xs opacity-60">{lastSavedText}</p>
            )}
        </div>
    );

    // Compact mode - just icon
    if (compact) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <motion.button
                            type="button"
                            onClick={onClick}
                            disabled={!onClick}
                            className={cn(
                                "rounded-full p-1.5 transition-colors",
                                displayConfig.bgColor,
                                onClick && "hover:opacity-80 cursor-pointer",
                                !onClick && "cursor-default",
                                className
                            )}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            whileHover={onClick ? { scale: 1.05 } : undefined}
                        >
                            <DisplayIcon
                                className={cn(
                                    sizes.iconSize,
                                    displayConfig.color,
                                    displayConfig.animate && "animate-spin"
                                )}
                            />
                        </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{tooltipContent}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    // Full mode with label
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <motion.button
                        type="button"
                        onClick={onClick}
                        disabled={!onClick}
                        className={cn(
                            "inline-flex items-center rounded-full transition-colors",
                            sizes.padding,
                            sizes.gap,
                            displayConfig.bgColor,
                            onClick && "hover:opacity-80 cursor-pointer",
                            !onClick && "cursor-default",
                            className
                        )}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.2 }}
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={status}
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.5, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                            >
                                <DisplayIcon
                                    className={cn(
                                        sizes.iconSize,
                                        displayConfig.color,
                                        displayConfig.animate && "animate-spin"
                                    )}
                                />
                            </motion.div>
                        </AnimatePresence>
                        <span className={cn(sizes.textSize, displayConfig.color, "font-medium")}>
                            {displayConfig.label}
                        </span>
                    </motion.button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{tooltipContent}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

// ============================================================================
// SIMPLE SAVE STATUS BADGE
// ============================================================================

export interface SaveStatusBadgeProps {
    /** Whether currently saving */
    isSaving: boolean;
    /** Last saved timestamp */
    lastSaved: Date | null;
    /** Whether there's an error */
    hasError?: boolean;
    /** Whether offline */
    isOffline?: boolean;
    /** Additional className */
    className?: string;
}

export function SaveStatusBadge({
    isSaving,
    lastSaved,
    hasError = false,
    isOffline = false,
    className,
}: SaveStatusBadgeProps) {
    const [timeAgo, setTimeAgo] = useState<string>("");

    useEffect(() => {
        const updateTimeAgo = () => {
            if (!lastSaved) {
                setTimeAgo("");
                return;
            }

            const now = new Date();
            const diffMs = now.getTime() - lastSaved.getTime();
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);

            if (diffSec < 5) {
                setTimeAgo("gerade eben");
            } else if (diffSec < 60) {
                setTimeAgo(`vor ${diffSec}s`);
            } else if (diffMin < 60) {
                setTimeAgo(`vor ${diffMin}min`);
            } else {
                setTimeAgo(
                    lastSaved.toLocaleTimeString("de-DE", {
                        hour: "2-digit",
                        minute: "2-digit",
                    })
                );
            }
        };

        updateTimeAgo();
        const interval = setInterval(updateTimeAgo, 10000);
        return () => clearInterval(interval);
    }, [lastSaved]);

    if (hasError) {
        return (
            <div className={cn("flex items-center gap-1.5 text-xs text-red-600", className)}>
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Speichern fehlgeschlagen</span>
            </div>
        );
    }

    if (isSaving) {
        return (
            <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Speichern...</span>
            </div>
        );
    }

    if (isOffline) {
        return (
            <div className={cn("flex items-center gap-1.5 text-xs text-amber-600", className)}>
                <WifiOff className="h-3.5 w-3.5" />
                <span>Offline gespeichert</span>
            </div>
        );
    }

    if (lastSaved) {
        return (
            <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
                <Cloud className="h-3.5 w-3.5" />
                <span>Gespeichert {timeAgo}</span>
            </div>
        );
    }

    return null;
}

export default AutoSaveIndicator;
