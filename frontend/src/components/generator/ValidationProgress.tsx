/**
 * ValidationProgress - Fortschritts-Ampel für Dokumentenerstellung
 *
 * v4.2 UX Feature:
 * - Zeigt Validierungsstatus als Ampel (rot/gelb/grün)
 * - Listet fehlende Pflichtfelder und Fehler auf
 * - Klick auf Fehler scrollt zum entsprechenden Feld
 * - Verhindert Export bei unvollständigen Dokumenten
 */

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    FileWarning,
    Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface ValidationIssue {
    type: "error" | "warning" | "missing";
    field: string;
    fieldId: string; // DOM ID für scroll-to
    label: string;
    message: string;
    group?: string;
}

export interface ValidationState {
    isValid: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    missingFields: ValidationIssue[];
    completedFields: number;
    totalRequiredFields: number;
}

interface ValidationProgressProps {
    validation: ValidationState;
    onScrollToField: (fieldId: string) => void;
    className?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// AMPEL STATUS
// ══════════════════════════════════════════════════════════════════════════════

type TrafficLightStatus = "red" | "yellow" | "green";

const getTrafficLightStatus = (validation: ValidationState): TrafficLightStatus => {
    if (validation.errors.length > 0 || validation.missingFields.length > 0) {
        return "red";
    }
    if (validation.warnings.length > 0) {
        return "yellow";
    }
    return "green";
};

const statusConfig = {
    red: {
        color: "bg-red-500",
        pulseColor: "bg-red-400",
        borderColor: "border-red-200",
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        icon: AlertCircle,
        label: "Noch nicht vollständig",
    },
    yellow: {
        color: "bg-amber-500",
        pulseColor: "bg-amber-400",
        borderColor: "border-amber-200",
        bgColor: "bg-amber-50",
        textColor: "text-amber-700",
        icon: AlertTriangle,
        label: "Warnungen",
    },
    green: {
        color: "bg-green-500",
        pulseColor: "bg-green-400",
        borderColor: "border-green-200",
        bgColor: "bg-green-50",
        textColor: "text-green-700",
        icon: CheckCircle2,
        label: "Bereit",
    },
};

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export const ValidationProgress = ({
    validation,
    onScrollToField,
    className,
}: ValidationProgressProps) => {
    const [isOpen, setIsOpen] = useState(false);

    const status = useMemo(() => getTrafficLightStatus(validation), [validation]);
    const config = statusConfig[status];
    const StatusIcon = config.icon;

    const totalIssues = validation.errors.length + validation.missingFields.length;
    const progress = validation.totalRequiredFields > 0
        ? Math.round((validation.completedFields / validation.totalRequiredFields) * 100)
        : 100;

    // Alle Issues gruppiert
    const allIssues = useMemo(() => {
        const grouped: Record<string, ValidationIssue[]> = {};

        [...validation.errors, ...validation.missingFields, ...validation.warnings].forEach((issue) => {
            const group = issue.group || "Allgemein";
            if (!grouped[group]) {
                grouped[group] = [];
            }
            grouped[group].push(issue);
        });

        return grouped;
    }, [validation]);

    const handleIssueClick = (issue: ValidationIssue) => {
        onScrollToField(issue.fieldId);
        setIsOpen(false);
    };

    return (
        <div className={cn("relative", className)}>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn(
                            "relative h-auto py-2 px-3 gap-3 transition-all",
                            config.borderColor,
                            config.bgColor,
                            "hover:shadow-md"
                        )}
                    >
                        {/* Ampel-Indikator */}
                        <div className="relative">
                            <div
                                className={cn(
                                    "w-3 h-3 rounded-full",
                                    config.color
                                )}
                            />
                            {status !== "green" && (
                                <div
                                    className={cn(
                                        "absolute inset-0 w-3 h-3 rounded-full animate-ping",
                                        config.pulseColor,
                                        "opacity-75"
                                    )}
                                />
                            )}
                        </div>

                        {/* Status Text */}
                        <div className="flex flex-col items-start">
                            <span className={cn("text-sm font-medium", config.textColor)}>
                                {config.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {status === "green" ? (
                                    "Dokument kann generiert werden"
                                ) : status === "yellow" ? (
                                    // Zeige die erste Warnung direkt an für bessere UX
                                    validation.warnings.length === 1 ? (
                                        <span title={validation.warnings[0].message}>
                                            {validation.warnings[0].label}: {validation.warnings[0].message}
                                        </span>
                                    ) : (
                                        `${validation.warnings.length} Warnungen - klicken für Details`
                                    )
                                ) : (
                                    <>
                                        {validation.missingFields.length > 0 && (
                                            <span>Bitte {validation.missingFields.length} Pflichtfeld{validation.missingFields.length !== 1 ? "er" : ""} ausfüllen</span>
                                        )}
                                        {validation.errors.length > 0 && validation.missingFields.length > 0 && " · "}
                                        {validation.errors.length > 0 && (
                                            <span>{validation.errors.length} Fehler</span>
                                        )}
                                        {(validation.errors.length > 0 || validation.missingFields.length > 0) && (
                                            <span className="ml-1 opacity-70">- klicken für Details</span>
                                        )}
                                    </>
                                )}
                            </span>
                        </div>

                        {/* Fortschrittsbalken */}
                        <div className="w-16 h-1.5 bg-warm-200 rounded-full overflow-hidden">
                            <motion.div
                                className={cn("h-full rounded-full", config.color)}
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>

                        {/* Badge mit Anzahl */}
                        {totalIssues > 0 && (
                            <Badge
                                variant="destructive"
                                className="absolute -top-2 -right-2 h-5 min-w-5 p-0 flex items-center justify-center text-xs"
                            >
                                {totalIssues}
                            </Badge>
                        )}
                    </Button>
                </PopoverTrigger>

                <PopoverContent
                    className="w-80 p-0"
                    align="end"
                    sideOffset={8}
                >
                    {/* Header */}
                    <div className={cn("p-3 border-b", config.bgColor)}>
                        <div className="flex items-center gap-2">
                            <StatusIcon className={cn("w-5 h-5", config.textColor)} />
                            <div>
                                <h4 className={cn("font-medium", config.textColor)}>
                                    {config.label}
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                    {validation.completedFields} von {validation.totalRequiredFields} Pflichtfeldern ausgefüllt
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Issues Liste */}
                    <div className="max-h-64 overflow-auto">
                        {Object.keys(allIssues).length === 0 ? (
                            <div className="p-4 text-center">
                                <Sparkles className="w-8 h-8 mx-auto mb-2 text-green-500" />
                                <p className="text-sm text-muted-foreground">
                                    Alle Pflichtfelder sind ausgefüllt!
                                </p>
                            </div>
                        ) : (
                            Object.entries(allIssues).map(([group, issues]) => (
                                <div key={group} className="border-b last:border-b-0">
                                    <div className="px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground">
                                        {group}
                                    </div>
                                    {issues.map((issue, idx) => (
                                        <button
                                            key={`${issue.fieldId}-${idx}`}
                                            onClick={() => handleIssueClick(issue)}
                                            className={cn(
                                                "w-full flex items-center gap-2 px-3 py-2 text-left",
                                                "hover:bg-muted/50 transition-colors",
                                                "focus:outline-none focus:bg-muted/50"
                                            )}
                                        >
                                            {issue.type === "error" && (
                                                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                            )}
                                            {issue.type === "missing" && (
                                                <FileWarning className="w-4 h-4 text-red-500 shrink-0" />
                                            )}
                                            {issue.type === "warning" && (
                                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {issue.label}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {issue.message}
                                                </p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer Hinweis */}
                    {totalIssues > 0 && (
                        <div className="p-2 border-t bg-muted/30 text-center">
                            <p className="text-xs text-muted-foreground">
                                Klicken Sie auf ein Feld um dorthin zu springen
                            </p>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// VALIDATION HELPER HOOK
// ══════════════════════════════════════════════════════════════════════════════

interface FieldDefinition {
    name: string;
    label: string;
    required: boolean;
    group?: string;
    validate?: (value: unknown) => string | null; // Returns error message or null
}

export const useValidationProgress = (
    formValues: Record<string, unknown>,
    fieldDefinitions: FieldDefinition[]
): ValidationState => {
    return useMemo(() => {
        const errors: ValidationIssue[] = [];
        const warnings: ValidationIssue[] = [];
        const missingFields: ValidationIssue[] = [];
        let completedFields = 0;

        const requiredFields = fieldDefinitions.filter((f) => f.required);

        for (const field of fieldDefinitions) {
            const value = formValues[field.name];
            const fieldId = `dynamic-field-${field.name}`;
            const isEmpty = value === undefined || value === null || value === "";

            // Check required fields
            if (field.required) {
                if (isEmpty) {
                    missingFields.push({
                        type: "missing",
                        field: field.name,
                        fieldId,
                        label: field.label,
                        message: "Pflichtfeld nicht ausgefüllt",
                        group: field.group,
                    });
                } else {
                    completedFields++;
                }
            }

            // Run custom validation if value exists
            if (!isEmpty && field.validate) {
                const errorMessage = field.validate(value);
                if (errorMessage) {
                    errors.push({
                        type: "error",
                        field: field.name,
                        fieldId,
                        label: field.label,
                        message: errorMessage,
                        group: field.group,
                    });
                }
            }
        }

        return {
            isValid: errors.length === 0 && missingFields.length === 0,
            errors,
            warnings,
            missingFields,
            completedFields,
            totalRequiredFields: requiredFields.length,
        };
    }, [formValues, fieldDefinitions]);
};

export default ValidationProgress;
