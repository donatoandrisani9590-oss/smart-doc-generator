/**
 * HelpTooltip - Kontextsensitive Hilfe
 *
 * v4.2 Feature (Kapitel 15.5.9):
 * - Inline-Hilfe für Formularfelder
 * - Hover oder Klick für Details
 * - Links zu weiterführender Dokumentation
 */

import { useState } from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { HelpCircle, ExternalLink, Lightbulb } from "lucide-react";

interface HelpTooltipProps {
    title?: string;
    content: string;
    example?: string;
    learnMoreUrl?: string;
    variant?: "icon" | "inline";
    side?: "top" | "bottom" | "left" | "right";
}

export function HelpTooltip({
    title,
    content,
    example,
    learnMoreUrl,
    variant = "icon",
    side = "top",
}: HelpTooltipProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Simple tooltip for short help
    if (!example && !learnMoreUrl && content.length < 100) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        {variant === "icon" ? (
                            <button
                                type="button"
                                className="inline-flex items-center justify-center w-4 h-4 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <HelpCircle className="w-4 h-4" />
                            </button>
                        ) : (
                            <span className="text-muted-foreground hover:text-foreground cursor-help underline decoration-dotted underline-offset-4">
                                Hilfe
                            </span>
                        )}
                    </TooltipTrigger>
                    <TooltipContent side={side} className="max-w-xs">
                        {title && <p className="font-medium mb-1">{title}</p>}
                        <p className="text-sm">{content}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    // Popover for detailed help
    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                {variant === "icon" ? (
                    <button
                        type="button"
                        className="inline-flex items-center justify-center w-4 h-4 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <HelpCircle className="w-4 h-4" />
                    </button>
                ) : (
                    <span className="text-muted-foreground hover:text-foreground cursor-help underline decoration-dotted underline-offset-4">
                        Hilfe
                    </span>
                )}
            </PopoverTrigger>
            <PopoverContent side={side} className="w-80">
                <div className="space-y-3">
                    {title && (
                        <h4 className="font-medium flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-500" />
                            {title}
                        </h4>
                    )}
                    <p className="text-sm text-muted-foreground">{content}</p>

                    {example && (
                        <div className="bg-muted/50 rounded p-2 text-sm">
                            <span className="font-medium text-xs uppercase text-muted-foreground">
                                Beispiel:
                            </span>
                            <p className="mt-1 font-mono text-xs">{example}</p>
                        </div>
                    )}

                    {learnMoreUrl && (
                        <Button
                            variant="link"
                            className="h-auto p-0 text-sm"
                            asChild
                        >
                            <a
                                href={learnMoreUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Mehr erfahren
                                <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                        </Button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

/**
 * FormFieldHelp - Spezialisierte Hilfe für Formularfelder
 */
interface FormFieldHelpProps {
    fieldKey: string;
}

const FIELD_HELP: Record<string, { title: string; content: string; example?: string }> = {
    employee_name: {
        title: "Mitarbeitername",
        content: "Vollständiger Name des Mitarbeiters wie im Personalausweis.",
        example: "Max Mustermann",
    },
    employee_address: {
        title: "Adresse",
        content: "Vollständige Anschrift inkl. Straße, PLZ und Ort.",
        example: "Musterstraße 123, 12345 Berlin",
    },
    start_date: {
        title: "Eintrittsdatum",
        content: "Der erste Arbeitstag. Bei Wochenende/Feiertag den nächsten Werktag wählen.",
    },
    salary: {
        title: "Gehalt",
        content: "Monatliches Bruttogehalt in Euro. Ohne Währungssymbol eingeben.",
        example: "4500",
    },
    working_hours: {
        title: "Arbeitszeit",
        content: "Wöchentliche Arbeitszeit in Stunden. Standard: 40h bei Vollzeit.",
        example: "40",
    },
    vacation_days: {
        title: "Urlaubstage",
        content: "Jährlicher Urlaubsanspruch in Arbeitstagen. Gesetzliches Minimum: 20 Tage bei 5-Tage-Woche.",
        example: "30",
    },
    probation_period: {
        title: "Probezeit",
        content: "Dauer der Probezeit in Monaten. Maximum gesetzlich: 6 Monate.",
        example: "6",
    },
    notice_period: {
        title: "Kündigungsfrist",
        content: "Kündigungsfrist während und nach der Probezeit. Gesetzliche Mindestfristen beachten.",
    },
    department: {
        title: "Abteilung",
        content: "Name der Abteilung, in der der Mitarbeiter tätig sein wird.",
        example: "IT-Entwicklung",
    },
    job_title: {
        title: "Stellenbezeichnung",
        content: "Offizielle Bezeichnung der Position wie im Organigramm.",
        example: "Senior Software Engineer",
    },
};

export function FormFieldHelp({ fieldKey }: FormFieldHelpProps) {
    const help = FIELD_HELP[fieldKey];
    if (!help) return null;

    return (
        <HelpTooltip
            title={help.title}
            content={help.content}
            example={help.example}
        />
    );
}
