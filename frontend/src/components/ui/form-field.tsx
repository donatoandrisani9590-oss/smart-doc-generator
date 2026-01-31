/**
 * FormField Component
 *
 * Einheitlicher Wrapper für Formularfelder mit:
 * - Konsistentem Label-Styling
 * - Pflichtfeld-Markierung
 * - Hilfe-Tooltips
 * - Inline-Validierung (onBlur)
 * - Fehlermeldungen
 * - Charakter-Counter (optional)
 *
 * Verwendung im gesamten Niederwieser HR-Dokumentensystem.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { HelpTooltip, type HelpTooltipProps } from "@/components/ui/help-tooltip";
import { cn } from "@/lib/utils";

export type ValidationResult = string | null | undefined;
export type ValidateFn = (value: unknown) => ValidationResult | Promise<ValidationResult>;

export interface FormFieldProps {
    /** Feldname für Formular-State */
    name: string;
    /** Label-Text */
    label: string;
    /** Pflichtfeld markieren */
    required?: boolean;
    /** Hilfe-Tooltip Konfiguration */
    help?: string | HelpTooltipProps;
    /** Validierungsfunktion */
    validate?: ValidateFn;
    /** Validierung bei onBlur auslösen */
    validateOnBlur?: boolean;
    /** Validierung bei onChange auslösen */
    validateOnChange?: boolean;
    /** Externe Fehlermeldung (z.B. vom Server) */
    error?: string;
    /** Erfolgszustand anzeigen */
    success?: boolean;
    /** Maximale Zeichenanzahl (zeigt Counter) */
    maxLength?: number;
    /** Aktueller Wert (für Counter) */
    value?: string | number;
    /** Beschreibung unter dem Label */
    description?: string;
    /** Zusätzliche CSS-Klassen für Container */
    className?: string;
    /** Kind-Elemente (Input, Select, etc.) */
    children: React.ReactNode;
    /** Callback bei Validierungsänderung */
    onValidationChange?: (name: string, isValid: boolean, error?: string) => void;
}

const errorVariants = {
    hidden: { opacity: 0, height: 0, y: -5 },
    visible: {
        opacity: 1,
        height: "auto",
        y: 0,
        transition: { duration: 0.2, ease: "easeOut" },
    },
    exit: {
        opacity: 0,
        height: 0,
        y: -5,
        transition: { duration: 0.15 },
    },
};

export const FormField = ({
    name,
    label,
    required = false,
    help,
    validate,
    validateOnBlur = true,
    validateOnChange = false,
    error: externalError,
    success = false,
    maxLength,
    value,
    description,
    className,
    children,
    onValidationChange,
}: FormFieldProps) => {
    const [internalError, setInternalError] = React.useState<string | null>(null);
    const [touched, setTouched] = React.useState(false);
    const [isValidating, setIsValidating] = React.useState(false);

    // Use external error if provided, otherwise internal
    const displayError = externalError || internalError;
    const hasError = !!displayError;
    const showSuccess = success && touched && !hasError;

    // Character count for maxLength
    const currentLength = typeof value === "string" ? value.length : String(value || "").length;
    const isOverLimit = maxLength ? currentLength > maxLength : false;

    // Run validation
    const runValidation = React.useCallback(
        async (fieldValue: unknown) => {
            if (!validate) return;

            setIsValidating(true);
            try {
                const result = await validate(fieldValue);
                const errorMessage = result || null;
                setInternalError(errorMessage);
                onValidationChange?.(name, !errorMessage, errorMessage || undefined);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Validierungsfehler";
                setInternalError(errorMessage);
                onValidationChange?.(name, false, errorMessage);
            } finally {
                setIsValidating(false);
            }
        },
        [validate, name, onValidationChange]
    );

    // Handle blur event on children
    const handleBlur = React.useCallback(
        (e: React.FocusEvent) => {
            setTouched(true);
            if (validateOnBlur && validate) {
                const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
                runValidation(target.value);
            }
        },
        [validateOnBlur, validate, runValidation]
    );

    // Handle change event on children
    const handleChange = React.useCallback(
        (e: React.ChangeEvent) => {
            if (validateOnChange && validate && touched) {
                const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
                runValidation(target.value);
            }
        },
        [validateOnChange, validate, touched, runValidation]
    );

    // Clone children and add event handlers
    const enhancedChildren = React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;

        return React.cloneElement(child as React.ReactElement<{
            onBlur?: (e: React.FocusEvent) => void;
            onChange?: (e: React.ChangeEvent) => void;
            className?: string;
            "aria-invalid"?: boolean;
            "aria-describedby"?: string;
        }>, {
            onBlur: (e: React.FocusEvent) => {
                handleBlur(e);
                // Call original onBlur if exists
                const originalOnBlur = (child as React.ReactElement<{ onBlur?: (e: React.FocusEvent) => void }>).props.onBlur;
                if (originalOnBlur) originalOnBlur(e);
            },
            onChange: (e: React.ChangeEvent) => {
                handleChange(e);
                // Call original onChange if exists
                const originalOnChange = (child as React.ReactElement<{ onChange?: (e: React.ChangeEvent) => void }>).props.onChange;
                if (originalOnChange) originalOnChange(e);
            },
            className: cn(
                (child as React.ReactElement<{ className?: string }>).props.className,
                hasError && "border-destructive focus-visible:ring-destructive",
                showSuccess && "border-secondary focus-visible:ring-secondary"
            ),
            "aria-invalid": hasError,
            "aria-describedby": hasError ? `${name}-error` : undefined,
        });
    });

    // Parse help prop
    const helpProps: HelpTooltipProps | undefined =
        typeof help === "string" ? { content: help } : help;

    return (
        <div className={cn("space-y-1.5", className)}>
            {/* Label Row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <label
                        htmlFor={name}
                        className="text-sm font-medium text-foreground"
                    >
                        {label}
                        {required && (
                            <span className="text-destructive ml-0.5" aria-hidden="true">
                                *
                            </span>
                        )}
                    </label>
                    {helpProps && <HelpTooltip {...helpProps} />}
                </div>

                {/* Character Counter */}
                {maxLength && (
                    <span
                        className={cn(
                            "text-xs",
                            isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"
                        )}
                    >
                        {currentLength}/{maxLength}
                    </span>
                )}
            </div>

            {/* Description */}
            {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
            )}

            {/* Field Input */}
            <div className="relative">
                {enhancedChildren}

                {/* Status Icon */}
                {(hasError || showSuccess) && !isValidating && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        {hasError ? (
                            <AlertCircle className="w-4 h-4 text-destructive" aria-hidden="true" />
                        ) : showSuccess ? (
                            <CheckCircle2 className="w-4 h-4 text-secondary" aria-hidden="true" />
                        ) : null}
                    </div>
                )}
            </div>

            {/* Error Message */}
            <AnimatePresence mode="wait">
                {hasError && (
                    <motion.p
                        id={`${name}-error`}
                        className="text-xs text-destructive flex items-center gap-1"
                        variants={errorVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        role="alert"
                    >
                        <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                        {displayError}
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
};

/**
 * Vordefinierte Validierungsfunktionen
 */
export const validators = {
    /** Pflichtfeld */
    required: (message = "Dieses Feld ist erforderlich"): ValidateFn => (value) => {
        if (value === null || value === undefined || value === "") {
            return message;
        }
        return null;
    },

    /** Minimale Länge */
    minLength: (min: number, message?: string): ValidateFn => (value) => {
        const str = String(value || "");
        if (str.length < min) {
            return message || `Mindestens ${min} Zeichen erforderlich`;
        }
        return null;
    },

    /** Maximale Länge */
    maxLength: (max: number, message?: string): ValidateFn => (value) => {
        const str = String(value || "");
        if (str.length > max) {
            return message || `Maximal ${max} Zeichen erlaubt`;
        }
        return null;
    },

    /** E-Mail Format */
    email: (message = "Bitte geben Sie eine gültige E-Mail-Adresse ein"): ValidateFn => (value) => {
        const str = String(value || "");
        if (str && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
            return message;
        }
        return null;
    },

    /** Nur Zahlen */
    numeric: (message = "Bitte geben Sie nur Zahlen ein"): ValidateFn => (value) => {
        const str = String(value || "");
        if (str && !/^\d+$/.test(str)) {
            return message;
        }
        return null;
    },

    /** Datum Format (DD.MM.YYYY) */
    dateDE: (message = "Bitte geben Sie ein gültiges Datum ein (TT.MM.JJJJ)"): ValidateFn => (value) => {
        const str = String(value || "");
        if (str && !/^\d{2}\.\d{2}\.\d{4}$/.test(str)) {
            return message;
        }
        return null;
    },

    /** Kombiniere mehrere Validatoren */
    compose: (...fns: ValidateFn[]): ValidateFn => async (value) => {
        for (const fn of fns) {
            const result = await fn(value);
            if (result) return result;
        }
        return null;
    },
};

export default FormField;
