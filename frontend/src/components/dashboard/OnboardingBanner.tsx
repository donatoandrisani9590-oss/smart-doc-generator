/**
 * OnboardingBanner - Geführter Setup-Flow für neue Benutzer
 *
 * Zeigt einen Stepper-Banner an, wenn die Ersteinrichtung unvollständig ist:
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
import { Button } from "@/components/ui/button";
import {
    Building2,
    Palette,
    FileText,
    LayoutTemplate,
    CheckCircle2,
    ChevronRight,
    X,
    Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingStep {
    id: string;
    label: string;
    description: string;
    icon: React.ElementType;
    href: string;
    isComplete: boolean;
}

interface OnboardingBannerProps {
    /** Ob Klauseln vorhanden sind */
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
                description: "Name, Adresse, Handelsregister",
                icon: Building2,
                href: "/settings?tab=general",
                isComplete: hasCompanyData,
            },
            {
                id: "branding",
                label: "Branding",
                description: "Logo und Design einrichten",
                icon: Palette,
                href: "/settings?tab=design",
                isComplete: hasLogo,
            },
            {
                id: "clauses",
                label: "Textbausteine",
                description: "Klauseln und Paragraphen anlegen",
                icon: FileText,
                href: "/settings?tab=clauses",
                isComplete: clauseCount > 0,
            },
            {
                id: "templates",
                label: "Vorlage erstellen",
                description: "Ersten Dokumenttyp konfigurieren",
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
        <div className="bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 rounded-xl border border-primary/10 p-5 relative">
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            )}

            <div className="flex items-center gap-2 mb-4">
                <Rocket className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-sm">
                    Ersteinrichtung ({completedCount}/{steps.length})
                </h3>
                <span className="text-xs text-muted-foreground">
                    Richten Sie Ihr System in wenigen Schritten ein
                </span>
            </div>

            {/* Stepper */}
            <div className="grid grid-cols-4 gap-3">
                {steps.map((step, index) => {
                    const Icon = step.icon;
                    const isNext = step === nextStep;

                    return (
                        <Link
                            key={step.id}
                            to={step.href}
                            className={cn(
                                "flex flex-col items-center gap-2 p-3 rounded-lg transition-all text-center group",
                                step.isComplete
                                    ? "bg-secondary/10 border border-secondary/20"
                                    : isNext
                                      ? "bg-white border-2 border-primary/30 shadow-sm"
                                      : "bg-warm-50 border border-transparent hover:border-warm-200"
                            )}
                        >
                            <div className="relative">
                                {step.isComplete ? (
                                    <CheckCircle2 className="w-6 h-6 text-secondary" />
                                ) : (
                                    <Icon
                                        className={cn(
                                            "w-6 h-6",
                                            isNext
                                                ? "text-primary"
                                                : "text-muted-foreground"
                                        )}
                                    />
                                )}
                                <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-warm-100 text-[10px] font-bold flex items-center justify-center text-muted-foreground">
                                    {index + 1}
                                </span>
                            </div>
                            <div>
                                <p
                                    className={cn(
                                        "text-xs font-medium",
                                        step.isComplete
                                            ? "text-secondary"
                                            : isNext
                                              ? "text-primary"
                                              : "text-muted-foreground"
                                    )}
                                >
                                    {step.label}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                                    {step.description}
                                </p>
                            </div>
                            {isNext && (
                                <Button
                                    size="sm"
                                    variant="default"
                                    className="h-6 text-xs px-2 gap-1"
                                >
                                    Starten
                                    <ChevronRight className="w-3 h-3" />
                                </Button>
                            )}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
