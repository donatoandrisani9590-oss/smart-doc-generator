/**
 * FormField Component
 * PROJ-001: Pflichtfeld-Kennzeichnung
 *
 * Einheitliche Formular-Feld-Komponente mit:
 * - RequiredFieldLabel (rotes Sternchen)
 * - Verschiedene Feldtypen (text, number, date, email, select, checkbox, textarea)
 * - Echtzeit-Validierung (on blur)
 * - FieldError Anzeige
 *
 * Erfüllt alle Acceptance Criteria:
 * - AC1: Rotes Sternchen für Pflichtfelder
 * - AC3: Rote Umrandung + Fehlermeldung
 * - AC4: Validierung on blur
 * - AC5: Progressive Disclosure (via isVisible prop)
 */

import React from 'react';
import { RequiredFieldLabel } from './RequiredFieldLabel';
import { FieldError } from './FieldError';
import type { FormField as FormFieldType, SelectOption } from '@/types/form';

interface FormFieldProps {
  /** Field configuration from API */
  field: FormFieldType;
  /** Current field value */
  value: unknown;
  /** Change handler */
  onChange: (fieldName: string, value: unknown) => void;
  /** Blur handler for validation */
  onBlur: (fieldName: string) => void;
  /** Whether field is required */
  isRequired: boolean;
  /** Error message (null if valid) */
  error: string | null;
  /** Whether field is visible (for conditional fields) */
  isVisible?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

export function FormField({
  field,
  value,
  onChange,
  onBlur,
  isRequired,
  error,
  isVisible = true,
  disabled = false,
}: FormFieldProps) {
  // AC5: Don't render hidden fields
  if (!isVisible) return null;

  const fieldId = `field-${field.field_name}`;
  const hasError = Boolean(error);

  // Base input classes with error state
  const baseInputClasses = `
    w-full px-3 py-2 rounded-md border
    focus:outline-none focus:ring-2 focus:ring-offset-0
    disabled:bg-gray-100 disabled:cursor-not-allowed
    transition-colors duration-200
    ${
      hasError
        ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
    }
  `;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const newValue =
      e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.value;
    onChange(field.field_name, newValue);
  };

  const handleBlur = () => {
    onBlur(field.field_name);
  };

  // Parse select options
  const getSelectOptions = (): SelectOption[] => {
    if (!field.options) return [];
    try {
      return JSON.parse(field.options);
    } catch {
      return [];
    }
  };

  const renderInput = () => {
    switch (field.field_type) {
      case 'textarea':
        return (
          <textarea
            id={fieldId}
            name={field.field_name}
            value={String(value ?? '')}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={field.placeholder_text}
            disabled={disabled}
            rows={4}
            className={baseInputClasses}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${fieldId}-error` : undefined}
          />
        );

      case 'select':
        return (
          <select
            id={fieldId}
            name={field.field_name}
            value={String(value ?? '')}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={disabled}
            className={baseInputClasses}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${fieldId}-error` : undefined}
          >
            <option value="">
              {field.placeholder_text || 'Bitte auswählen...'}
            </option>
            {getSelectOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              id={fieldId}
              name={field.field_name}
              checked={Boolean(value)}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={disabled}
              className={`
                h-4 w-4 rounded border-gray-300
                text-blue-600 focus:ring-blue-500
                disabled:cursor-not-allowed
                ${hasError ? 'border-red-500' : ''}
              `}
              aria-invalid={hasError}
              aria-describedby={hasError ? `${fieldId}-error` : undefined}
            />
            <label htmlFor={fieldId} className="ml-2 text-sm text-gray-700">
              {field.field_label}
              {isRequired && <span className="ml-1 text-red-500">*</span>}
            </label>
          </div>
        );

      case 'number':
        return (
          <div className="relative">
            {field.prefix && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                {field.prefix}
              </span>
            )}
            <input
              type="number"
              id={fieldId}
              name={field.field_name}
              value={value !== undefined && value !== null ? String(value) : ''}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder={field.placeholder_text}
              min={field.min_value}
              max={field.max_value}
              disabled={disabled}
              className={`
                ${baseInputClasses}
                ${field.prefix ? 'pl-8' : ''}
                ${field.suffix ? 'pr-12' : ''}
              `}
              aria-invalid={hasError}
              aria-describedby={hasError ? `${fieldId}-error` : undefined}
            />
            {field.suffix && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {field.suffix}
              </span>
            )}
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            id={fieldId}
            name={field.field_name}
            value={String(value ?? '')}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={disabled}
            className={baseInputClasses}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${fieldId}-error` : undefined}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            id={fieldId}
            name={field.field_name}
            value={String(value ?? '')}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={field.placeholder_text || 'email@example.com'}
            disabled={disabled}
            className={baseInputClasses}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${fieldId}-error` : undefined}
          />
        );

      case 'text':
      default:
        return (
          <div className="relative">
            {field.prefix && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                {field.prefix}
              </span>
            )}
            <input
              type="text"
              id={fieldId}
              name={field.field_name}
              value={String(value ?? '')}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder={field.placeholder_text}
              maxLength={field.max_length}
              disabled={disabled}
              className={`
                ${baseInputClasses}
                ${field.prefix ? 'pl-8' : ''}
                ${field.suffix ? 'pr-12' : ''}
              `}
              aria-invalid={hasError}
              aria-describedby={hasError ? `${fieldId}-error` : undefined}
            />
            {field.suffix && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {field.suffix}
              </span>
            )}
          </div>
        );
    }
  };

  // Checkbox has its own label handling
  if (field.field_type === 'checkbox') {
    return (
      <div className="mb-4">
        {renderInput()}
        <FieldError message={error} fieldId={fieldId} />
      </div>
    );
  }

  return (
    <div className="mb-4">
      <RequiredFieldLabel
        label={field.field_label}
        isRequired={isRequired}
        htmlFor={fieldId}
        helpText={field.help_text}
      />
      {renderInput()}
      <FieldError message={error} fieldId={fieldId} />
    </div>
  );
}

export default FormField;
