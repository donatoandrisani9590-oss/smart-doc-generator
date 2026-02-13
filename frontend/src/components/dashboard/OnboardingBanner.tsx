/**
 * OnboardingBanner - Kompakte Setup-Leiste
 *
 * Zeigt eine einzeilige Stepper-Bar an, wenn die Ersteinrichtung unvollständig ist:
 * 1. Firmendaten pflegen
 * 2. Branding/Logo setzen
 * 3. Textbausteine anlegen
 * 4. Erste Vorlage erstellen
 *
 * Verschwindet automatisch wenn alle Schritte erledigt sind.
 * Kann vom Benutzer manuell ausgeblendet werden.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Building2,
    Palette,
    FileText,
    LayoutTemplate,
    Check,
    ChevronRight,
    X,
    Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingStep {
    id: string;
    label: string;
    icon: React.ElementType;
    href: string;
    isComplete: boolean;
}

interface OnboardingBannerProps {
    /** Ob Textbausteine vorhanden sind */
    clauseCount?: number;
    /** Ob Dokumenttypen vorhanden sind */
    documentTypeCount?: number;
    /** Ob Firmendaten gepflegt sind (company_name gesetzt) */
    hasCompanyData?: boolean;
    /** Ob ein Logo vorhanden ist */
    hasLogo?: boolean;
    /** Callback zum Ausblenden */
    onDismiss?: () => void;
}

export function OnboardingBanner({
    clauseCount = 0,
    documentTypeCount = 0,
    hasCompanyData = false,
    hasLogo = false,
    onDismiss,
}: OnboardingBannerProps) {
    const steps: OnboardingStep[] = useMemo(
        () => [
            {
                id: "company",
                label: "Firmendaten",
                icon: Building2,
                href: "/settings?tab=general",
                isComplete: hasCompanyData,
            },
            {
                id: "branding",
                label: "Branding",
                icon: Palette,
                href: "/settings?tab=design",
                isComplete: hasLogo,
            },
            {
                id: "clauses",
                label: "Textbausteine",
                icon: FileText,
                href: "/settings?tab=clauses",
                isComplete: clauseCount > 0,
            },
            {
                id: "templates",
                label: "Vorlage erstellen",
                icon: LayoutTemplate,
                href: "/settings?tab=templates",
                isComplete: documentTypeCount > 0,
            },
        ],
        [hasCompanyData, hasLogo, clauseCount, documentTypeCount]
    );

    const completedCount = steps.filter((s) => s.isComplete).length;
    const allComplete = completedCount === steps.length;
    const nextStep = steps.find((s) => !s.isComplete);

    // Nicht anzeigen wenn alles erledigt
    if (allComplete) return null;

    return (
        <div className="bg-warm-50/70 dark:bg-warm-800/20 rounded-lg border border-warm-200 dark:border-warm-700 px-4 py-3 relative">
            <div className="flex items-center gap-4">
                {/* Label */}
                <div className="flex items-center gap-2 shrink-0">
                    <Rocket className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                        Einrichtung
                    </span>
                    <span className="text-xs text-muted-foreground bg-warm-100 dark:bg-warm-700 px-1.5 py-0.5 rounded">
                        {completedCount}/{steps.length}
                    </span>
                </div>

                {/* Separator */}
                <div className="w-px h-5 bg-warm-200 dark:bg-warm-600 shrink-0" />

                {/* Steps inline */}
                <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        const isNext = step === nextStep;

                        return (
                            <div key={step.id} className="flex items-center shrink-0">
                                {index > 0 && (
                                    <div className={cn(
                                        "w-4 h-px mx-1",
                                        step.isComplete || steps[index - 1]?.isComplete
                                            ? "bg-secondary/40"
                                            : "bg-warm-200 dark:bg-warm-600"
                                    )} />
                                )}
                                <Link
                                    to={step.href}
                                    className={cn(
                                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                                        step.isComplete
                                            ? "text-secondary bg-secondary/10"
                                            : isNext
                                              ? "text-primary bg-primary/10 ring-1 ring-primary/20"
                                              : "text-muted-foreground hover:text-foreground hover:bg-warm-100 dark:hover:bg-warm-700"
                                    )}
                                >
                                    {step.isComplete ? (
                                        <Check className="w-3.5 h-3.5" />
                                    ) : (
                                        <Icon className="w-3.5 h-3.5" />
                                    )}
                                    <span className="hidden sm:inline">{step.label}</span>
                                    {isNext && (
                                        <ChevronRight className="w-3 h-3 hidden sm:block" />
                                    )}
                                </Link>
                            </div>
                        );
                    })}
                </div>

                {/* Dismiss */}
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-warm-100 dark:hover:bg-warm-700"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}
