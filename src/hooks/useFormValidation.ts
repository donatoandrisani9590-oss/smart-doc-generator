/**
 * useFormValidation Hook
 * PROJ-001: Pflichtfeld-Kennzeichnung
 *
 * Zentraler Hook für Formular-Validierung mit:
 * - Echtzeit-Validierung (on blur)
 * - Pflichtfeld-Tracking
 * - Bedingte Felder (show_condition)
 * - i18n Support (DE/IT)
 */

import { useState, useCallback, useMemo } from 'react';
import type { FormField, ValidationState } from '@/types/form';
import { getValidationMessage, type Locale } from '@/lib/i18n/validation';

interface UseFormValidationProps {
  fields: FormField[];
  formData: Record<string, unknown>;
  locale?: Locale;
}

interface UseFormValidationReturn extends ValidationState {
  validateField: (fieldName: string) => string | null;
  validateAllFields: () => boolean;
  setFieldTouched: (fieldName: string) => void;
  resetValidation: () => void;
  getFieldError: (fieldName: string) => string | null;
  isFieldRequired: (fieldName: string) => boolean;
  isFieldVisible: (fieldName: string) => boolean;
}

/**
 * Evaluates a show_condition JSON against form data
 */
function evaluateCondition(
  condition: string | undefined,
  formData: Record<string, unknown>
): boolean {
  if (!condition) return true;

  try {
    const parsed = JSON.parse(condition);

    if (parsed.type === 'simple') {
      const fieldValue = formData[parsed.field];
      const targetValue = parsed.value;

      switch (parsed.operator) {
        case '=':
        case '==':
          return fieldValue === targetValue;
        case '!=':
          return fieldValue !== targetValue;
        case '>':
          return Number(fieldValue) > Number(targetValue);
        case '>=':
          return Number(fieldValue) >= Number(targetValue);
        case '<':
          return Number(fieldValue) < Number(targetValue);
        case '<=':
          return Number(fieldValue) <= Number(targetValue);
        case 'contains':
          return String(fieldValue).includes(String(targetValue));
        case 'exists':
          return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
        case 'notExists':
          return fieldValue === undefined || fieldValue === null || fieldValue === '';
        default:
          return true;
      }
    }

    if (parsed.type === 'group') {
      const results = parsed.conditions.map((cond: { type: string; field: string; operator: string; value: unknown }) =>
        evaluateCondition(JSON.stringify(cond), formData)
      );

      return parsed.logic === 'and'
        ? results.every(Boolean)
        : results.some(Boolean);
    }

    return true;
  } catch {
    return true; // Fail-safe: show field if condition parsing fails
  }
}

/**
 * Validates a single field value
 */
function validateFieldValue(
  field: FormField,
  value: unknown,
  locale: Locale
): string | null {
  const stringValue = value !== undefined && value !== null ? String(value) : '';
  const isEmpty = stringValue.trim() === '';

  // Required check
  if (field.is_required && isEmpty) {
    return getValidationMessage('required', locale);
  }

  // Skip other validations if empty and not required
  if (isEmpty) return null;

  // Min length
  if (field.min_length && stringValue.length < field.min_length) {
    return getValidationMessage('minLength', locale, { min: field.min_length });
  }

  // Max length
  if (field.max_length && stringValue.length > field.max_length) {
    return getValidationMessage('maxLength', locale, { max: field.max_length });
  }

  // Number validations
  if (field.field_type === 'number') {
    const numValue = Number(value);
    if (isNaN(numValue)) {
      return getValidationMessage('number', locale);
    }
    if (field.min_value !== undefined && numValue < field.min_value) {
      return getValidationMessage('minValue', locale, { min: field.min_value });
    }
    if (field.max_value !== undefined && numValue > field.max_value) {
      return getValidationMessage('maxValue', locale, { max: field.max_value });
    }
  }

  // Email validation
  if (field.field_type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(stringValue)) {
      return getValidationMessage('email', locale);
    }
  }

  // Pattern validation
  if (field.pattern) {
    const regex = new RegExp(field.pattern);
    if (!regex.test(stringValue)) {
      return field.pattern_error_message || getValidationMessage('pattern', locale);
    }
  }

  return null;
}

export function useFormValidation({
  fields,
  formData,
  locale = 'de',
}: UseFormValidationProps): UseFormValidationReturn {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Hardcoded required fields (AC6: signatory_name)
  const hardcodedRequiredFields = ['signatory_name'];

  // Get visible fields based on show_condition
  const visibleFields = useMemo(() => {
    return fields.filter((field) =>
      evaluateCondition(field.show_condition, formData)
    );
  }, [fields, formData]);

  // Check if field is required (from DB or hardcoded)
  const isFieldRequired = useCallback(
    (fieldName: string): boolean => {
      if (hardcodedRequiredFields.includes(fieldName)) return true;
      const field = fields.find((f) => f.field_name === fieldName);
      return field?.is_required ?? false;
    },
    [fields]
  );

  // Check if field is visible
  const isFieldVisible = useCallback(
    (fieldName: string): boolean => {
      return visibleFields.some((f) => f.field_name === fieldName);
    },
    [visibleFields]
  );

  // Validate a single field
  const validateField = useCallback(
    (fieldName: string): string | null => {
      const field = fields.find((f) => f.field_name === fieldName);

      // Handle hardcoded required fields
      if (hardcodedRequiredFields.includes(fieldName)) {
        const value = formData[fieldName];
        const isEmpty =
          value === undefined || value === null || String(value).trim() === '';
        if (isEmpty) {
          return getValidationMessage('required', locale);
        }
        return null;
      }

      if (!field) return null;

      // Skip validation for hidden fields
      if (!evaluateCondition(field.show_condition, formData)) {
        return null;
      }

      const value = formData[fieldName];
      return validateFieldValue(field, value, locale);
    },
    [fields, formData, locale]
  );

  // Set field as touched and validate
  const setFieldTouched = useCallback(
    (fieldName: string) => {
      setTouched((prev) => ({ ...prev, [fieldName]: true }));

      const error = validateField(fieldName);
      setErrors((prev) => {
        if (error) {
          return { ...prev, [fieldName]: error };
        }
        const { [fieldName]: _, ...rest } = prev;
        return rest;
      });
    },
    [validateField]
  );

  // Get error for a field (only if touched)
  const getFieldError = useCallback(
    (fieldName: string): string | null => {
      if (!touched[fieldName]) return null;
      return errors[fieldName] || null;
    },
    [touched, errors]
  );

  // Validate all visible required fields
  const validateAllFields = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    const newTouched: Record<string, boolean> = {};

    // Validate visible fields
    visibleFields.forEach((field) => {
      newTouched[field.field_name] = true;
      const error = validateField(field.field_name);
      if (error) {
        newErrors[field.field_name] = error;
      }
    });

    // Validate hardcoded required fields
    hardcodedRequiredFields.forEach((fieldName) => {
      newTouched[fieldName] = true;
      const error = validateField(fieldName);
      if (error) {
        newErrors[fieldName] = error;
      }
    });

    setTouched((prev) => ({ ...prev, ...newTouched }));
    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }, [visibleFields, validateField]);

  // Reset validation state
  const resetValidation = useCallback(() => {
    setTouched({});
    setErrors({});
  }, []);

  // Calculate if form is valid (all visible required fields filled)
  const isFormValid = useMemo(() => {
    // Check hardcoded required fields
    for (const fieldName of hardcodedRequiredFields) {
      const value = formData[fieldName];
      if (value === undefined || value === null || String(value).trim() === '') {
        return false;
      }
    }

    // Check visible required fields
    for (const field of visibleFields) {
      if (field.is_required) {
        const value = formData[field.field_name];
        if (value === undefined || value === null || String(value).trim() === '') {
          return false;
        }
      }
    }

    // Check for any validation errors
    return Object.keys(errors).length === 0;
  }, [visibleFields, formData, errors]);

  return {
    errors,
    touched,
    isFormValid,
    validateField,
    validateAllFields,
    setFieldTouched,
    resetValidation,
    getFieldError,
    isFieldRequired,
    isFieldVisible,
  };
}
