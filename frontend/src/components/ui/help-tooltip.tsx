/**
 * HelpTooltip Component
 *
 * Kontextsensitive Hilfe-Tooltips für Formularfelder und UI-Elemente.
 * Zeigt hilfreiche Informationen beim Hover über das Fragezeichen-Icon.
 */

import * as React from "react";
import { HelpCircle, Info, Lightbulb } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface HelpTooltipProps {
    /** Der Hilfetext, der angezeigt wird */
    content: string;
    /** Optionaler Titel für den Tooltip */
    title?: string;
    /** Optionaler Tipp/Best Practice */
    tip?: string;
    /** Icon-Variante: "help" (Standard), "info", oder "tip" */
    variant?: "help" | "info" | "tip";
    /** Position des Tooltips */
    side?: "top" | "right" | "bottom" | "left";
    /** Größe des Icons */
    size?: "sm" | "md" | "lg";
    /** Zusätzliche CSS-Klassen */
    className?: string;
}

const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
};

const IconComponent = {
    help: HelpCircle,
    info: Info,
    tip: Lightbulb,
};

export const HelpTooltip = ({
    content,
    title,
    tip,
    variant = "help",
    side = "top",
    size = "sm",
    className,
}: HelpTooltipProps) => {
    const Icon = IconComponent[variant];

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            "inline-flex items-center justify-center rounded-full",
                            "text-muted-foreground hover:text-primary transition-colors",
                            "focus:outline-none focus:ring-2 focus:ring-primary/20",
                            "cursor-help",
                            className
                        )}
                        aria-label="Hilfe anzeigen"
                    >
                        <Icon className={iconSizes[size]} />
                    </button>
                </TooltipTrigger>
                <TooltipContent
                    side={side}
                    className="max-w-xs bg-slate-900 text-white p-3 shadow-lg"
                >
                    <div className="space-y-1.5">
                        {title && (
                            <p className="font-semibold text-sm">{title}</p>
                        )}
                        <p className="text-xs leading-relaxed opacity-90">
                            {content}
                        </p>
                        {tip && (
                            <div className="pt-1.5 mt-1.5 border-t border-white/20">
                                <p className="text-xs text-amber-300 flex items-start gap-1.5">
                                    <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                    <span>{tip}</span>
                                </p>
                            </div>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

/**
 * Vordefinierte Hilfetexte für häufige Formularfelder
 */
// eslint-disable-next-line react-refresh/only-export-components
export const HELP_TEXTS = {
    vorname: {
        content: "Der Vorname des Mitarbeiters, wie er im Vertrag erscheinen soll.",
        tip: "Achte auf korrekte Schreibweise mit Umlauten.",
    },
    nachname: {
        content: "Der Nachname des Mitarbeiters für die Vertragsunterzeichnung.",
    },
    geburtsdatum: {
        content: "Das Geburtsdatum wird für die Personaldaten benötigt.",
        tip: "Format: TT.MM.JJJJ",
    },
    eintrittsdatum: {
        content: "Der erste Arbeitstag des Mitarbeiters. Ab diesem Datum gilt der Vertrag.",
        title: "Eintrittsdatum",
        tip: "Das Datum sollte in der Zukunft oder am heutigen Tag liegen.",
    },
    position: {
        content: "Die offizielle Stellenbezeichnung gemäß Arbeitsvertrag.",
        tip: "Verwende die interne Stellenbezeichnung.",
    },
    gehalt: {
        content: "Das monatliche Bruttogehalt in Euro.",
        title: "Bruttogehalt",
        tip: "Nur Zahlen eingeben, ohne Währungssymbol.",
    },
    wochenstunden: {
        content: "Die vereinbarte wöchentliche Arbeitszeit in Stunden.",
        tip: "Standard: 40 Stunden (Vollzeit) oder 20 Stunden (Teilzeit).",
    },
    probezeit: {
        content: "Die Dauer der Probezeit in Monaten.",
        title: "Probezeit",
        tip: "Maximal 6 Monate gesetzlich zulässig.",
    },
    firmenwagen: {
        content: "Aktiviere diese Option, wenn dem Mitarbeiter ein Firmenwagen zur Verfügung gestellt wird.",
        title: "Firmenwagen",
    },
    homeoffice: {
        content: "Aktiviere diese Option, wenn eine Home-Office-Vereinbarung Teil des Vertrags ist.",
        title: "Home-Office",
    },
    signatory_name: {
        content: "Name der Person, die den Vertrag für das Unternehmen unterzeichnet.",
        title: "Unterzeichner",
        tip: "In der Regel der Geschäftsführer oder ein bevollmächtigter Vertreter.",
    },
    mitarbeiter_adresse: {
        content: "Die Wohnadresse des Mitarbeiters (Straße und Hausnummer).",
    },
    plz_ort: {
        content: "Postleitzahl und Ort der Wohnadresse.",
        tip: "Format: 12345 Musterstadt",
    },
    document_type: {
        content: "Wähle den Vertragstyp aus, den du erstellen möchtest.",
        title: "Dokumenttyp",
        tip: "Du kannst eigene Vorlagen über 'Word importieren' hinzufügen.",
    },
};

/**
 * FormFieldWithHelp - Ein Wrapper für Formularfelder mit integrierter Hilfe
 */
interface FormFieldWithHelpProps {
    label: string;
    helpKey?: keyof typeof HELP_TEXTS;
    customHelp?: HelpTooltipProps;
    required?: boolean;
    children: React.ReactNode;
    className?: string;
}

export const FormFieldWithHelp = ({
    label,
    helpKey,
    customHelp,
    required,
    children,
    className,
}: FormFieldWithHelpProps) => {
    const helpProps = helpKey ? HELP_TEXTS[helpKey] : customHelp;

    return (
        <div className={cn("space-y-1.5", className)}>
            <div className="flex items-center gap-1.5">
                <label className="text-sm font-medium text-foreground">
                    {label}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {helpProps && (
                    <HelpTooltip
                        content={helpProps.content}
                        title={"title" in helpProps ? (helpProps.title as string | undefined) : undefined}
                        tip={"tip" in helpProps ? (helpProps.tip as string | undefined) : undefined}
                    />
                )}
            </div>
            {children}
        </div>
    );
};

export default HelpTooltip;
