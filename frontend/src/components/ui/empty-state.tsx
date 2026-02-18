/**
 * EmptyState Component
 *
 * Einheitliche Darstellung für leere Zustände in Listen, Tabellen und Suchresultaten.
 * Verwendet im gesamten Niederwieser HR-Dokumentensystem.
 *
 * Varianten:
 * - default: Standard leerer Zustand mit optionaler Aktion
 * - search: Keine Suchergebnisse gefunden
 * - filter: Keine Ergebnisse nach Filterung
 * - error: Fehler beim Laden
 */

import { motion } from "framer-motion";
import { type LucideIcon, FileText, Search, Filter, AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateAction {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
    variant?: "default" | "outline" | "secondary";
}

export interface EmptyStateProps {
    /** Icon das angezeigt wird */
    icon?: LucideIcon;
    /** Hauptüberschrift */
    title: string;
    /** Beschreibender Text */
    description?: string;
    /** Primäre Aktion (z.B. "Neuer Textbaustein erstellen") */
    action?: EmptyStateAction;
    /** Sekundäre Aktion */
    secondaryAction?: EmptyStateAction;
    /** Variante für unterschiedliche Kontexte */
    variant?: "default" | "search" | "filter" | "error";
    /** Größe der Darstellung */
    size?: "sm" | "md" | "lg";
    /** Zusätzliche CSS-Klassen */
    className?: string;
    /** Kinder-Elemente für zusätzlichen Content */
    children?: React.ReactNode;
}

const variantConfig = {
    default: {
        icon: FileText,
        iconColor: "text-muted-foreground",
        bgColor: "bg-muted/30",
    },
    search: {
        icon: Search,
        iconColor: "text-muted-foreground",
        bgColor: "bg-muted/30",
    },
    filter: {
        icon: Filter,
        iconColor: "text-muted-foreground",
        bgColor: "bg-muted/30",
    },
    error: {
        icon: AlertCircle,
        iconColor: "text-destructive",
        bgColor: "bg-destructive/10",
    },
};

const sizeConfig = {
    sm: {
        container: "py-8",
        iconWrapper: "w-10 h-10",
        icon: "w-5 h-5",
        title: "text-sm font-medium",
        description: "text-xs",
        gap: "gap-2",
    },
    md: {
        container: "py-12",
        iconWrapper: "w-12 h-12",
        icon: "w-6 h-6",
        title: "text-base font-medium",
        description: "text-sm",
        gap: "gap-3",
    },
    lg: {
        container: "py-16",
        iconWrapper: "w-16 h-16",
        icon: "w-8 h-8",
        title: "text-lg font-semibold",
        description: "text-sm",
        gap: "gap-4",
    },
};

const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.3,
            ease: "easeOut",
        },
    },
};

const iconVariants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: {
        scale: 1,
        opacity: 1,
        transition: {
            delay: 0.1,
            duration: 0.3,
            ease: "easeOut",
        },
    },
};

export const EmptyState = ({
    icon,
    title,
    description,
    action,
    secondaryAction,
    variant = "default",
    size = "md",
    className,
    children,
}: EmptyStateProps) => {
    const variantStyles = variantConfig[variant];
    const sizeStyles = sizeConfig[size];

    // Use provided icon or fallback to variant default
    const IconComponent = icon || variantStyles.icon;

    return (
        <motion.div
            className={cn(
                "flex flex-col items-center justify-center text-center",
                sizeStyles.container,
                sizeStyles.gap,
                className
            )}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Icon */}
            <motion.div
                className={cn(
                    "flex items-center justify-center rounded-full",
                    sizeStyles.iconWrapper,
                    variantStyles.bgColor
                )}
                variants={iconVariants}
            >
                <IconComponent
                    className={cn(sizeStyles.icon, variantStyles.iconColor)}
                    aria-hidden="true"
                />
            </motion.div>

            {/* Text */}
            <div className="space-y-1">
                <p className={cn(sizeStyles.title, "text-foreground")}>
                    {title}
                </p>
                {description && (
                    <p className={cn(sizeStyles.description, "text-muted-foreground max-w-sm")}>
                        {description}
                    </p>
                )}
            </div>

            {/* Actions */}
            {(action || secondaryAction) && (
                <div className="flex items-center gap-3 mt-2">
                    {action && (
                        <Button
                            onClick={action.onClick}
                            variant={action.variant || "default"}
                            size={size === "sm" ? "sm" : "default"}
                            className="gap-2"
                        >
                            {action.icon ? (
                                <action.icon className="w-4 h-4" aria-hidden="true" />
                            ) : (
                                <Plus className="w-4 h-4" aria-hidden="true" />
                            )}
                            {action.label}
                        </Button>
                    )}
                    {secondaryAction && (
                        <Button
                            onClick={secondaryAction.onClick}
                            variant={secondaryAction.variant || "outline"}
                            size={size === "sm" ? "sm" : "default"}
                            className="gap-2"
                        >
                            {secondaryAction.icon && (
                                <secondaryAction.icon className="w-4 h-4" aria-hidden="true" />
                            )}
                            {secondaryAction.label}
                        </Button>
                    )}
                </div>
            )}

            {/* Additional Content */}
            {children}
        </motion.div>
    );
};

/**
 * Vordefinierte EmptyState-Presets für häufige Anwendungsfälle
 */
// eslint-disable-next-line react-refresh/only-export-components
export const EmptyStatePresets = {
    /** Keine Dokumente vorhanden */
    noDocuments: {
        icon: FileText,
        title: "Keine Dokumente vorhanden",
        description: "Erstellen Sie Ihr erstes Dokument, um loszulegen.",
        variant: "default" as const,
    },

    /** Keine Suchergebnisse */
    noSearchResults: {
        icon: Search,
        title: "Keine Ergebnisse gefunden",
        description: "Versuchen Sie andere Suchbegriffe oder Filter.",
        variant: "search" as const,
    },

    /** Keine Filterresultate */
    noFilterResults: {
        icon: Filter,
        title: "Keine Einträge gefunden",
        description: "Versuchen Sie andere Filterkriterien.",
        variant: "filter" as const,
    },

    /** Keine Textbausteine */
    noClauses: {
        icon: FileText,
        title: "Keine Textbausteine vorhanden",
        description: "Erstellen Sie Ihren ersten Textbaustein oder importieren Sie aus Word.",
        variant: "default" as const,
    },

    /** Keine Teams */
    noTeams: {
        icon: FileText,
        title: "Keine Teams vorhanden",
        description: "Erstellen Sie ein Team, um Dokumente zu teilen.",
        variant: "default" as const,
    },

    /** Ladefehler */
    loadError: {
        icon: AlertCircle,
        title: "Fehler beim Laden",
        description: "Die Daten konnten nicht geladen werden. Bitte versuchen Sie es erneut.",
        variant: "error" as const,
    },
};

export default EmptyState;
