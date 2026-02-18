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
        color: "bg-warm-300",
        pulseColor: "bg-warm-200",
        borderColor: "border-border/40",
        bgColor: "bg-card",
        textColor: "text-foreground/70",
        progressColor: "bg-primary/30",
        icon: AlertCircle,
        label: "Noch nicht vollständig",
    },
    yellow: {
        color: "bg-amber-400",
        pulseColor: "bg-amber-300",
        borderColor: "border-amber-200/50",
        bgColor: "bg-amber-50/50",
        textColor: "text-amber-700",
        progressColor: "bg-amber-400",
        icon: AlertTriangle,
        label: "Warnungen",
    },
    green: {
        color: "bg-green-500",
        pulseColor: "bg-green-400",
        borderColor: "border-green-200/50",
        bgColor: "bg-green-50/50",
        textColor: "text-green-700",
        progressColor: "bg-green-500",
        icon: CheckCircle2,
        label: "Exportbereit",
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
                    <button
                        type="button"
                        className={cn(
                            "relative w-full flex items-center gap-2 py-1.5 px-0.5 rounded-md transition-all duration-200",
                            "hover:opacity-80 cursor-pointer",
                            "focus:outline-none"
                        )}
                    >
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] text-muted-foreground/50">
                                    {validation.completedFields} von {validation.totalRequiredFields} Pflichtfeldern
                                </span>
                                <span className="text-[10px] text-muted-foreground/40">
                                    {status === "green" ? "✓ bereit" : `${progress}%`}
                                </span>
                            </div>
                            <div className="w-full h-[3px] bg-muted/60 rounded-full overflow-hidden">
                                <motion.div
                                    className={cn(
                                        "h-full rounded-full",
                                        status === "green" ? "bg-green-400/60" : "bg-primary/20"
                                    )}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                />
                            </div>
                        </div>
                    </button>
                </PopoverTrigger>

                <PopoverContent
                    className="w-80 p-0"
                    align="end"
                    sideOffset={8}
                >
                    {/* Header */}
                    <div className="p-3 border-b bg-muted/30">
                        <div className="flex items-center gap-2">
                            <StatusIcon className={cn("w-4 h-4", config.textColor)} />
                            <div>
                                <h4 className="text-sm font-medium text-foreground">
                                    {config.label}
                                </h4>
                                <p className="text-[11px] text-muted-foreground">
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

// eslint-disable-next-line react-refresh/only-export-components
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
