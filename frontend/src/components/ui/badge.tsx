import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Badge-Farbsystem für Niederwieser HR-Dokumentensystem
 *
 * STATUS-BADGES:
 * - success: Aktiv, Genehmigt, Erfolgreich (Niederwieser Grün)
 * - warning: Ausstehend, In Bearbeitung (Amber)
 * - destructive: Fehler, Abgelehnt, Inaktiv (Rot)
 * - muted: Inaktiv, Deaktiviert (Grau)
 *
 * KATEGORIE-BADGES:
 * - default: Standard-Kategorie (Niederwieser Blau)
 * - secondary: Sekundäre Kategorie (Niederwieser Grün)
 * - outline: Neutrale Kategorie (nur Border)
 *
 * LÄNDER-BADGES:
 * - countryDE: Deutschland
 * - countryIT: Italien
 *
 * VERSIONS-BADGES:
 * - version: Versionsnummer (dezent)
 */
const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                // === STATUS BADGES ===
                default:
                    "border-transparent bg-primary/10 text-primary",
                secondary:
                    "border-transparent bg-secondary/10 text-secondary",
                destructive:
                    "border-transparent bg-destructive/10 text-destructive",
                success:
                    "border-transparent bg-secondary/10 text-secondary",
                warning:
                    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
                muted:
                    "border-transparent bg-muted text-muted-foreground",

                // === KATEGORIE BADGES ===
                outline:
                    "border-border bg-transparent text-foreground",
                category:
                    "border-transparent bg-primary/10 text-primary",

                // === LÄNDER BADGES ===
                countryDE:
                    "border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
                countryIT:
                    "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",

                // === VERSIONS BADGE ===
                version:
                    "border-border bg-transparent text-muted-foreground font-mono",

                // === PRIORITY BADGES ===
                priority:
                    "border-transparent bg-primary text-primary-foreground",
                priorityLow:
                    "border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
                priorityMedium:
                    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
                priorityHigh:
                    "border-transparent bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
