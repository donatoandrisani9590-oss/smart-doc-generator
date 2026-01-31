/**
 * useFormValidation - Form-Validierung mit Zod
 *
 * Einfache Integration von Zod-Schemas in React-Formulare.
 * Bietet Echtzeit-Validierung und Fehlermeldungen.
 */

import { useState, useCallback } from "react";
import { z, ZodError } from "zod";
import type { ZodSchema } from "zod";

// ============================================================================
// Types
// ============================================================================

interface FieldError {
    message: string;
    path: string[];
}

interface FormState<T> {
    values: T;
    errors: Record<string, string>;
    touched: Record<string, boolean>;
    isValid: boolean;
    isSubmitting: boolean;
    isDirty: boolean;
}

interface UseFormValidationReturn<T> {
    /** Current form values */
    values: T;
    /** Field errors */
    errors: Record<string, string>;
    /** Touched fields */
    touched: Record<string, boolean>;
    /** Is the form valid */
    isValid: boolean;
    /** Is the form submitting */
    isSubmitting: boolean;
    /** Has the form been modified */
    isDirty: boolean;
    /** Set a single field value */
    setValue: <K extends keyof T>(field: K, value: T[K]) => void;
    /** Set multiple values */
    setValues: (values: Partial<T>) => void;
    /** Mark a field as touched */
    setTouched: (field: keyof T) => void;
    /** Validate a single field */
    validateField: (field: keyof T) => boolean;
    /** Validate the entire form */
    validate: () => boolean;
    /** Reset the form */
    reset: (values?: T) => void;
    /** Get error for a field */
    getError: (field: keyof T) => string | undefined;
    /** Check if field has error */
    hasError: (field: keyof T) => boolean;
    /** Get field props for easy binding */
    getFieldProps: (field: keyof T) => {
        value: T[keyof T];
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
        onBlur: () => void;
        "aria-invalid": boolean;
        "aria-describedby": string | undefined;
    };
    /** Handle form submission */
    handleSubmit: (onSubmit: (values: T) => Promise<void> | void) => (e: React.FormEvent) => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function useFormValidation<T extends Record<string, unknown>>(
    schema: ZodSchema<T>,
    initialValues: T
): UseFormValidationReturn<T> {
    const [state, setState] = useState<FormState<T>>({
        values: initialValues,
        errors: {},
        touched: {},
        isValid: false,
        isSubmitting: false,
        isDirty: false,
    });

    // Validate values against schema
    const validateValues = useCallback(
        (values: T): Record<string, string> => {
            try {
                schema.parse(values);
                return {};
            } catch (err) {
                if (err instanceof ZodError) {
                    const errors: Record<string, string> = {};
                    err.issues.forEach((issue) => {
                        const path = issue.path.map(String).join(".");
                        if (!errors[path]) {
                            errors[path] = issue.message;
                        }
                    });
                    return errors;
                }
                return {};
            }
        },
        [schema]
    );

    // Set a single field value
    const setValue = useCallback(
        <K extends keyof T>(field: K, value: T[K]) => {
            setState((prev) => {
                const newValues = { ...prev.values, [field]: value };
                const errors = validateValues(newValues);
                return {
                    ...prev,
                    values: newValues,
                    errors,
                    isValid: Object.keys(errors).length === 0,
                    isDirty: true,
                };
            });
        },
        [validateValues]
    );

    // Set multiple values
    const setValues = useCallback(
        (values: Partial<T>) => {
            setState((prev) => {
                const newValues = { ...prev.values, ...values };
                const errors = validateValues(newValues);
                return {
                    ...prev,
                    values: newValues,
                    errors,
                    isValid: Object.keys(errors).length === 0,
                    isDirty: true,
                };
            });
        },
        [validateValues]
    );

    // Mark field as touched
    const setTouched = useCallback((field: keyof T) => {
        setState((prev) => ({
            ...prev,
            touched: { ...prev.touched, [field as string]: true },
        }));
    }, []);

    // Validate single field
    const validateField = useCallback(
        (field: keyof T): boolean => {
            const errors = validateValues(state.values);
            const fieldKey = field as string;
            return !errors[fieldKey];
        },
        [state.values, validateValues]
    );

    // Validate entire form
    const validate = useCallback((): boolean => {
        const errors = validateValues(state.values);
        const isValid = Object.keys(errors).length === 0;

        // Mark all fields as touched
        const allTouched: Record<string, boolean> = {};
        Object.keys(state.values).forEach((key) => {
            allTouched[key] = true;
        });

        setState((prev) => ({
            ...prev,
            errors,
            touched: allTouched,
            isValid,
        }));

        return isValid;
    }, [state.values, validateValues]);

    // Reset form
    const reset = useCallback(
        (values?: T) => {
            setState({
                values: values ?? initialValues,
                errors: {},
                touched: {},
                isValid: false,
                isSubmitting: false,
                isDirty: false,
            });
        },
        [initialValues]
    );

    // Get error for field
    const getError = useCallback(
        (field: keyof T): string | undefined => {
            const fieldKey = field as string;
            return state.touched[fieldKey] ? state.errors[fieldKey] : undefined;
        },
        [state.errors, state.touched]
    );

    // Check if field has error
    const hasError = useCallback(
        (field: keyof T): boolean => {
            const fieldKey = field as string;
            return state.touched[fieldKey] && !!state.errors[fieldKey];
        },
        [state.errors, state.touched]
    );

    // Get field props
    const getFieldProps = useCallback(
        (field: keyof T) => {
            const fieldKey = field as string;
            const error = hasError(field);

            return {
                value: state.values[field],
                onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
                    const value = e.target.type === "checkbox"
                        ? (e.target as HTMLInputElement).checked
                        : e.target.value;
                    setValue(field, value as T[keyof T]);
                },
                onBlur: () => setTouched(field),
                "aria-invalid": error,
                "aria-describedby": error ? `${fieldKey}-error` : undefined,
            };
        },
        [state.values, hasError, setValue, setTouched]
    );

    // Handle form submission
    const handleSubmit = useCallback(
        (onSubmit: (values: T) => Promise<void> | void) => {
            return async (e: React.FormEvent) => {
                e.preventDefault();

                if (!validate()) {
                    return;
                }

                setState((prev) => ({ ...prev, isSubmitting: true }));

                try {
                    await onSubmit(state.values);
                } finally {
                    setState((prev) => ({ ...prev, isSubmitting: false }));
                }
            };
        },
        [state.values, validate]
    );

    return {
        values: state.values,
        errors: state.errors,
        touched: state.touched,
        isValid: state.isValid,
        isSubmitting: state.isSubmitting,
        isDirty: state.isDirty,
        setValue,
        setValues,
        setTouched,
        validateField,
        validate,
        reset,
        getError,
        hasError,
        getFieldProps,
        handleSubmit,
    };
}

// ============================================================================
// Helper Component for Error Messages
// ============================================================================

interface FieldErrorProps {
    name: string;
    error: string | undefined;
    className?: string;
}

export function FieldError({ name, error, className = "" }: FieldErrorProps) {
    if (!error) return null;

    return (
        <p
            id={`${name}-error`}
            className={`text-sm text-destructive mt-1 ${className}`}
            role="alert"
        >
            {error}
        </p>
    );
}

// ============================================================================
// Pre-built Form Field Components
// ============================================================================

interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    name: string;
    error?: string;
    touched?: boolean;
}

export function ValidatedInput({
    label,
    name,
    error,
    touched,
    className = "",
    ...props
}: ValidatedInputProps) {
    const showError = touched && error;

    return (
        <div className="space-y-1">
            <label htmlFor={name} className="text-sm font-medium">
                {label}
                {props.required && <span className="text-destructive ml-1">*</span>}
            </label>
            <input
                id={name}
                name={name}
                className={`w-full px-3 py-2 border rounded-md transition-colors
                    ${showError
                        ? "border-destructive focus:ring-destructive"
                        : "border-input focus:ring-ring"
                    }
                    focus:outline-none focus:ring-2 focus:ring-offset-2
                    ${className}`}
                aria-invalid={showError ? "true" : undefined}
                aria-describedby={showError ? `${name}-error` : undefined}
                {...props}
            />
            <FieldError name={name} error={showError ? error : undefined} />
        </div>
    );
}

// ============================================================================
// Schema Utilities
// ============================================================================

/**
 * Create a partial schema (all fields optional)
 */
export function createPartialSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
    return schema.partial();
}

/**
 * Create a pick schema (only specified fields)
 */
export function createPickSchema<
    T extends z.ZodRawShape,
    K extends keyof T
>(schema: z.ZodObject<T>, keys: K[]) {
    const picked: Partial<T> = {};
    keys.forEach((key) => {
        picked[key] = schema.shape[key];
    });
    return z.object(picked as Pick<T, K>);
}

/**
 * Merge two schemas
 */
export function mergeSchemas<
    A extends z.ZodRawShape,
    B extends z.ZodRawShape
>(schemaA: z.ZodObject<A>, schemaB: z.ZodObject<B>) {
    return schemaA.merge(schemaB);
}
