/**
 * DynamicFormFields - Dynamische Formularfelder basierend auf Textbausteine/Varianten
 *
 * v4.2 Feature:
 * - Lädt FormFields dynamisch vom Backend
 * - Zeigt Felder basierend auf aktivierten Textbausteine
 * - Unterstützt bedingte Sichtbarkeit (show_condition)
 * - Kaskadierender Flow: Klausel aktiviert -> Variante wählen -> Felder anzeigen
 *
 * v4.2.1: Inline-Validierung mit onBlur und Fehlermeldungen
 * v4.3: Erweitertes Condition Schema mit AND/OR-Logik
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, HelpCircle, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import { useTranslation } from "react-i18next";
import { evaluateShowCondition, type ConditionContext } from "@/lib/condition-evaluator";

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface FormFieldDefinition {
    id: number;
    document_type_id: number;
    field_name: string;
    field_label: string;
    field_type: string; // text, textarea, date, number, select, checkbox, email
    is_required: boolean;
    default_value?: string;
    options?: string; // JSON string for select options
    display_order?: number;
    display_group?: string;

    // HR customization fields
    help_text?: string;
    placeholder_text?: string;
    suffix?: string;
    prefix?: string;

    // Validation
    min_value?: number;
    max_value?: number;
    min_length?: number;
    max_length?: number;
    pattern?: string;
    pattern_error_message?: string;

    // Conditional visibility - unterstützt neues UND altes Format
    // Neues Format: { type: 'AND'|'OR', conditions: [...] } oder { type: 'field'|'clause_enabled'|'variant_selected', ... }
    // Legacy-Format: { clause_id?: number, variant_id?: number, field_conditions?: [...] }
    show_condition?: string;

    // Metadata
    is_system_field: boolean;
    source_clause_id?: number;
}

// Legacy ShowCondition interface entfernt - wird jetzt vom condition-evaluator gehandhabt
// Siehe: @/types/conditions und @/lib/condition-evaluator

interface DynamicFormFieldsProps {
    documentTypeId: number | null;
    /** Aktuell aktivierte Textbaustein-IDs */
    enabledClauseIds: number[];
    /** Aktuell ausgewählte Varianten-IDs */
    selectedVariantIds: number[];
    /** Formular-Werte */
    formValues: Record<string, string | number | boolean>;
    /** Callback bei Wert-Änderung */
    onValueChange: (fieldName: string, value: string | number | boolean) => void;
    /** Deaktiviert alle Felder */
    disabled?: boolean;
    /** CSS-Klasse */
    className?: string;
    /** Callback wenn sich Validierungs-Status ändert */
    onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export const DynamicFormFields = ({
    documentTypeId,
    enabledClauseIds,
    selectedVariantIds,
    formValues,
    onValueChange,
    disabled = false,
    className,
    onValidationChange,
}: DynamicFormFieldsProps) => {
    const { t } = useTranslation();
    const [fields, setFields] = useState<FormFieldDefinition[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // v4.2.1: Validierungs-State
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    // ══════════════════════════════════════════════════════════════════════════
    // LOAD FORM FIELDS
    // ══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!documentTypeId) {
            setFields([]);
            return;
        }

        const loadFields = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await api.get<FormFieldDefinition[]>(
                    `/api/v1/form-fields/document-type/${documentTypeId}`
                );
                setFields(response.data);
            } catch (err) {
                logError("Failed to load form fields", { err, documentTypeId });
                setError("Formularfelder konnten nicht geladen werden");
                setFields([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadFields();
    }, [documentTypeId]);

    // ══════════════════════════════════════════════════════════════════════════
    // CONDITION CONTEXT
    // ══════════════════════════════════════════════════════════════════════════
    const conditionContext: ConditionContext = useMemo(
        () => ({
            formData: formValues,
            enabledClauseIds,
            selectedVariantIds,
        }),
        [formValues, enabledClauseIds, selectedVariantIds]
    );

    // ══════════════════════════════════════════════════════════════════════════
    // CHECK FIELD VISIBILITY
    // ══════════════════════════════════════════════════════════════════════════
    const isFieldVisible = useCallback(
        (field: FormFieldDefinition): boolean => {
            // Nutze den neuen condition-evaluator
            // Unterstützt sowohl das alte als auch das neue Format
            return evaluateShowCondition(field.show_condition, conditionContext);
        },
        [conditionContext]
    );

    // ══════════════════════════════════════════════════════════════════════════
    // FIELD VALIDATION
    // ══════════════════════════════════════════════════════════════════════════
    const validateField = useCallback(
        (field: FormFieldDefinition, value: string | number | boolean | undefined): string | null => {
            const stringValue = String(value ?? "").trim();

            // Pflichtfeld-Prüfung
            if (field.is_required && stringValue === "") {
                return t("validation.required", "Dieses Feld ist erforderlich");
            }

            // Nur weiter validieren wenn Wert vorhanden
            if (stringValue === "") return null;

            // Email-Validierung
            if (field.field_type === "email") {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(stringValue)) {
                    return t("validation.email", "Bitte geben Sie eine gültige E-Mail-Adresse ein");
                }
            }

            // Min/Max Length
            if (field.min_length && stringValue.length < field.min_length) {
                return t("validation.minLength", { min: field.min_length, defaultValue: `Mindestens ${field.min_length} Zeichen erforderlich` });
            }
            if (field.max_length && stringValue.length > field.max_length) {
                return t("validation.maxLength", { max: field.max_length, defaultValue: `Maximal ${field.max_length} Zeichen erlaubt` });
            }

            // Min/Max Value (für number)
            if (field.field_type === "number") {
                const numValue = parseFloat(stringValue);
                if (!isNaN(numValue)) {
                    if (field.min_value !== undefined && numValue < field.min_value) {
                        return t("validation.minValue", { min: field.min_value, defaultValue: `Mindestwert: ${field.min_value}` });
                    }
                    if (field.max_value !== undefined && numValue > field.max_value) {
                        return t("validation.maxValue", { max: field.max_value, defaultValue: `Maximalwert: ${field.max_value}` });
                    }
                }
            }

            // Pattern-Validierung
            if (field.pattern) {
                try {
                    const regex = new RegExp(field.pattern);
                    if (!regex.test(stringValue)) {
                        return field.pattern_error_message || t("validation.pattern", "Ungültiges Format");
                    }
                } catch {
                    // Ungültiges Pattern ignorieren
                }
            }

            return null;
        },
        [t]
    );

    // Handler für onBlur - Validierung auslösen
    const handleFieldBlur = useCallback(
        (field: FormFieldDefinition) => {
            const fieldName = field.field_name;
            const value = formValues[fieldName];

            // Als touched markieren
            setTouched((prev) => ({ ...prev, [fieldName]: true }));

            // Validieren
            const error = validateField(field, value);
            setFieldErrors((prev) => {
                const newErrors = { ...prev };
                if (error) {
                    newErrors[fieldName] = error;
                } else {
                    delete newErrors[fieldName];
                }
                return newErrors;
            });
        },
        [formValues, validateField]
    );

    // Validierungs-Status berechnen und nach außen kommunizieren
    const visibleFields = useMemo(
        () => fields.filter(isFieldVisible),
        [fields, isFieldVisible]
    );

    useEffect(() => {
        if (!onValidationChange) return;

        // Nur sichtbare Pflichtfelder validieren
        const errors: Record<string, string> = {};
        let isValid = true;

        visibleFields.forEach((field) => {
            if (field.is_required) {
                const value = formValues[field.field_name];
                const error = validateField(field, value);
                if (error) {
                    errors[field.field_name] = error;
                    isValid = false;
                }
            }
        });

        onValidationChange(isValid, errors);
    }, [visibleFields, formValues, validateField, onValidationChange]);

    // ══════════════════════════════════════════════════════════════════════════
    // GROUP FIELDS BY DISPLAY GROUP
    // ══════════════════════════════════════════════════════════════════════════
    const groupedFields = visibleFields
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .reduce<Record<string, FormFieldDefinition[]>>((acc, field) => {
            const group = field.display_group || "Weitere Felder";
            if (!acc[group]) {
                acc[group] = [];
            }
            acc[group].push(field);
            return acc;
        }, {});

    // ══════════════════════════════════════════════════════════════════════════
    // RENDER FIELD
    // ══════════════════════════════════════════════════════════════════════════
    const renderField = (field: FormFieldDefinition) => {
        const value = formValues[field.field_name] ?? field.default_value ?? "";
        const fieldId = `dynamic-field-${field.id}`;
        const fieldName = field.field_name;
        const isTouched = touched[fieldName];
        const fieldError = isTouched ? fieldErrors[fieldName] : undefined;
        const hasError = !!fieldError;

        // Parse options für Select-Felder
        let selectOptions: Array<{ value: string; label: string }> = [];
        if (field.field_type === "select" && field.options) {
            try {
                selectOptions = JSON.parse(field.options);
            } catch {
                selectOptions = [];
            }
        }

        // Error-Styling Klasse
        const errorClass = hasError ? "border-destructive focus-visible:ring-destructive" : "";

        const renderInput = () => {
            switch (field.field_type) {
                case "checkbox":
                    return (
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id={fieldId}
                                checked={value === true || value === "true"}
                                onCheckedChange={(checked) =>
                                    onValueChange(field.field_name, !!checked)
                                }
                                disabled={disabled}
                            />
                            <Label htmlFor={fieldId} className="cursor-pointer">
                                {field.field_label}
                                {field.is_required && <span className="text-destructive ml-1">*</span>}
                            </Label>
                        </div>
                    );

                case "select":
                    return (
                        <Select
                            value={String(value)}
                            onValueChange={(v) => onValueChange(field.field_name, v)}
                            disabled={disabled}
                        >
                            <SelectTrigger
                                id={fieldId}
                                className={errorClass}
                                onBlur={() => handleFieldBlur(field)}
                            >
                                <SelectValue placeholder={field.placeholder_text || "Bitte wählen..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {selectOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    );

                case "textarea":
                    return (
                        <textarea
                            id={fieldId}
                            value={String(value)}
                            onChange={(e) => onValueChange(field.field_name, e.target.value)}
                            onBlur={() => handleFieldBlur(field)}
                            placeholder={field.placeholder_text}
                            disabled={disabled}
                            aria-invalid={hasError}
                            aria-describedby={hasError ? `${fieldId}-error` : undefined}
                            className={cn(
                                "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                                "ring-offset-background placeholder:text-muted-foreground",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                "disabled:cursor-not-allowed disabled:opacity-50",
                                errorClass
                            )}
                            minLength={field.min_length ?? undefined}
                            maxLength={field.max_length ?? undefined}
                        />
                    );

                case "number":
                    return (
                        <div className="relative">
                            {field.prefix && (
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                    {field.prefix}
                                </span>
                            )}
                            <Input
                                id={fieldId}
                                type="number"
                                value={String(value)}
                                onChange={(e) => onValueChange(field.field_name, e.target.value)}
                                onBlur={() => handleFieldBlur(field)}
                                placeholder={field.placeholder_text}
                                disabled={disabled}
                                min={field.min_value ?? undefined}
                                max={field.max_value ?? undefined}
                                aria-invalid={hasError}
                                aria-describedby={hasError ? `${fieldId}-error` : undefined}
                                className={cn(
                                    field.prefix && "pl-8",
                                    field.suffix && "pr-12",
                                    errorClass
                                )}
                            />
                            {field.suffix && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                    {field.suffix}
                                </span>
                            )}
                        </div>
                    );

                case "date":
                    return (
                        <Input
                            id={fieldId}
                            type="date"
                            value={String(value)}
                            onChange={(e) => onValueChange(field.field_name, e.target.value)}
                            onBlur={() => handleFieldBlur(field)}
                            disabled={disabled}
                            aria-invalid={hasError}
                            aria-describedby={hasError ? `${fieldId}-error` : undefined}
                            className={errorClass}
                        />
                    );

                case "email":
                    return (
                        <Input
                            id={fieldId}
                            type="email"
                            value={String(value)}
                            onChange={(e) => onValueChange(field.field_name, e.target.value)}
                            onBlur={() => handleFieldBlur(field)}
                            placeholder={field.placeholder_text || "name@firma.de"}
                            disabled={disabled}
                            aria-invalid={hasError}
                            aria-describedby={hasError ? `${fieldId}-error` : undefined}
                            className={errorClass}
                        />
                    );

                default: // text
                    return (
                        <div className="relative">
                            {field.prefix && (
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                    {field.prefix}
                                </span>
                            )}
                            <Input
                                id={fieldId}
                                type="text"
                                value={String(value)}
                                onChange={(e) => onValueChange(field.field_name, e.target.value)}
                                onBlur={() => handleFieldBlur(field)}
                                placeholder={field.placeholder_text}
                                disabled={disabled}
                                minLength={field.min_length ?? undefined}
                                maxLength={field.max_length ?? undefined}
                                pattern={field.pattern ?? undefined}
                                aria-invalid={hasError}
                                aria-describedby={hasError ? `${fieldId}-error` : undefined}
                                className={cn(
                                    field.prefix && "pl-8",
                                    field.suffix && "pr-12",
                                    errorClass
                                )}
                            />
                            {field.suffix && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                    {field.suffix}
                                </span>
                            )}
                        </div>
                    );
            }
        };

        // Fehlermeldung Komponente
        const renderError = () => {
            if (!hasError) return null;
            return (
                <p
                    id={`${fieldId}-error`}
                    className="text-xs text-destructive mt-1 flex items-center gap-1"
                    role="alert"
                >
                    <AlertCircle className="w-3 h-3" />
                    {fieldError}
                </p>
            );
        };

        // Für Checkbox wird das Label bereits im renderInput gehandhabt
        if (field.field_type === "checkbox") {
            return (
                <div key={field.id} className="space-y-2">
                    {renderInput()}
                    {field.help_text && (
                        <p className="text-xs text-muted-foreground ml-6">{field.help_text}</p>
                    )}
                    {renderError()}
                </div>
            );
        }

        return (
            <div key={field.id} className="space-y-2">
                <div className="flex items-center gap-2">
                    <Label htmlFor={fieldId} className="text-sm font-medium">
                        {field.field_label}
                        {field.is_required && (
                            <span className="text-destructive ml-1" aria-label="Pflichtfeld" title="Pflichtfeld">*</span>
                        )}
                    </Label>
                    {field.help_text && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                    <p>{field.help_text}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    {field.source_clause_id && enabledClauseIds.includes(field.source_clause_id) && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                            Textbaustein
                        </Badge>
                    )}
                </div>
                {renderInput()}
                {renderError()}
            </div>
        );
    };

    // ══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════════════════════

    if (isLoading) {
        return (
            <Card className={className}>
                <CardContent className="py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <p className="text-muted-foreground text-sm">Formularfelder werden geladen...</p>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className={cn("border-destructive/50", className)}>
                <CardContent className="py-6 text-center">
                    <p className="text-destructive text-sm">{error}</p>
                </CardContent>
            </Card>
        );
    }

    const groupNames = Object.keys(groupedFields);

    if (groupNames.length === 0) {
        return null; // Keine sichtbaren Felder
    }

    return (
        <div className={cn("space-y-6", className)}>
            {groupNames.map((groupName) => (
                <Card key={groupName}>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base">{groupName}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {groupedFields[groupName].map(renderField)}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

export default DynamicFormFields;
