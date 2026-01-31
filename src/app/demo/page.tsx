/**
 * Demo Page: Pflichtfeld-Kennzeichnung
 * PROJ-001
 *
 * Zeigt die Integration aller Komponenten:
 * - useFormValidation Hook
 * - RequiredFieldLabel, FieldError, FormField
 * - Deaktivierter Button bei ungültigem Formular
 */

'use client';

import React, { useState } from 'react';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FormField } from '@/components/generator/FormField';
import type { FormField as FormFieldType } from '@/types/form';

// Example form fields (simulating API response)
const exampleFields: FormFieldType[] = [
  {
    id: 1,
    field_name: 'vorname',
    field_label: 'Vorname',
    field_type: 'text',
    is_required: true,
    placeholder_text: 'Max',
    display_order: 1,
  },
  {
    id: 2,
    field_name: 'nachname',
    field_label: 'Nachname',
    field_type: 'text',
    is_required: true,
    placeholder_text: 'Mustermann',
    display_order: 2,
  },
  {
    id: 3,
    field_name: 'email',
    field_label: 'E-Mail',
    field_type: 'email',
    is_required: false,
    placeholder_text: 'max@example.com',
    display_order: 3,
  },
  {
    id: 4,
    field_name: 'eintrittsdatum',
    field_label: 'Eintrittsdatum',
    field_type: 'date',
    is_required: true,
    display_order: 4,
  },
  {
    id: 5,
    field_name: 'monatsgehalt',
    field_label: 'Monatsgehalt',
    field_type: 'number',
    is_required: true,
    suffix: '€',
    min_value: 1000,
    max_value: 100000,
    help_text: 'Bruttogehalt pro Monat',
    display_order: 5,
  },
  {
    id: 6,
    field_name: 'position',
    field_label: 'Position',
    field_type: 'select',
    is_required: true,
    options: JSON.stringify([
      { value: 'developer', label: 'Software-Entwickler' },
      { value: 'manager', label: 'Projekt-Manager' },
      { value: 'designer', label: 'UI/UX Designer' },
    ]),
    display_order: 6,
  },
  {
    id: 7,
    field_name: 'firmenwagen',
    field_label: 'Firmenwagen',
    field_type: 'checkbox',
    is_required: false,
    display_order: 7,
  },
  {
    id: 8,
    field_name: 'firmenwagen_kennzeichen',
    field_label: 'Firmenwagen Kennzeichen',
    field_type: 'text',
    is_required: true, // Required only when firmenwagen = true
    placeholder_text: 'ABC-123',
    display_order: 8,
    // Conditional: only show when firmenwagen = true
    show_condition: JSON.stringify({
      type: 'simple',
      field: 'firmenwagen',
      operator: '=',
      value: true,
    }),
  },
  {
    id: 9,
    field_name: 'signatory_name',
    field_label: 'Unterzeichner',
    field_type: 'text',
    is_required: false, // Will be hardcoded as required by hook
    placeholder_text: 'Geschäftsführer Name',
    help_text: 'Name der unterzeichnenden Person (Pflichtfeld)',
    display_order: 9,
  },
  {
    id: 10,
    field_name: 'bemerkungen',
    field_label: 'Bemerkungen',
    field_type: 'textarea',
    is_required: false,
    placeholder_text: 'Zusätzliche Anmerkungen...',
    display_order: 10,
  },
];

export default function DemoPage() {
  // Form data state
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Use the validation hook
  const {
    isFormValid,
    getFieldError,
    setFieldTouched,
    isFieldRequired,
    isFieldVisible,
    validateAllFields,
  } = useFormValidation({
    fields: exampleFields,
    formData,
    locale: 'de',
  });

  // Handle field changes
  const handleChange = (fieldName: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  // Handle field blur (trigger validation)
  const handleBlur = (fieldName: string) => {
    setFieldTouched(fieldName);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields before submit
    const isValid = validateAllFields();

    if (isValid) {
      alert('Formular ist gültig! Dokument wird generiert...');
      console.log('Form Data:', formData);
    } else {
      alert('Bitte füllen Sie alle Pflichtfelder aus.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            PROJ-001: Pflichtfeld-Kennzeichnung Demo
          </h1>
          <p className="mt-2 text-gray-600">
            Diese Demo zeigt die Implementierung der Pflichtfeld-Kennzeichnung
            mit Echtzeit-Validierung.
          </p>
        </div>

        {/* Status Card */}
        <div
          className={`mb-6 p-4 rounded-lg border ${
            isFormValid
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <div className="flex items-center">
            <span
              className={`text-lg mr-2 ${
                isFormValid ? 'text-green-600' : 'text-yellow-600'
              }`}
            >
              {isFormValid ? '✓' : '!'}
            </span>
            <span
              className={`font-medium ${
                isFormValid ? 'text-green-800' : 'text-yellow-800'
              }`}
            >
              {isFormValid
                ? 'Formular ist vollständig'
                : 'Bitte füllen Sie alle Pflichtfelder aus'}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
          <div className="space-y-1">
            {exampleFields
              .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
              .map((field) => (
                <FormField
                  key={field.id}
                  field={field}
                  value={formData[field.field_name]}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  isRequired={isFieldRequired(field.field_name)}
                  error={getFieldError(field.field_name)}
                  isVisible={isFieldVisible(field.field_name)}
                />
              ))}
          </div>

          {/* Submit Button - AC2: Disabled when form is invalid */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={!isFormValid}
              className={`
                w-full py-3 px-4 rounded-lg font-medium
                transition-all duration-200
                ${
                  isFormValid
                    ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              {isFormValid ? 'Dokument generieren' : 'Bitte Pflichtfelder ausfüllen'}
            </button>
          </div>
        </form>

        {/* Feature Checklist */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Acceptance Criteria
          </h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center text-green-700">
              <span className="mr-2">✓</span>
              AC1: Rotes Sternchen (*) bei Pflichtfeldern
            </li>
            <li className="flex items-center text-green-700">
              <span className="mr-2">✓</span>
              AC2: Button deaktiviert bei ungültigem Formular
            </li>
            <li className="flex items-center text-green-700">
              <span className="mr-2">✓</span>
              AC3: Rote Umrandung + Fehlermeldung bei leeren Pflichtfeldern
            </li>
            <li className="flex items-center text-green-700">
              <span className="mr-2">✓</span>
              AC4: Echtzeit-Validierung on blur
            </li>
            <li className="flex items-center text-green-700">
              <span className="mr-2">✓</span>
              AC5: Bedingte Felder (Firmenwagen → Kennzeichen)
            </li>
            <li className="flex items-center text-green-700">
              <span className="mr-2">✓</span>
              AC6: signatory_name ist hartkodiertes Pflichtfeld
            </li>
            <li className="flex items-center text-green-700">
              <span className="mr-2">✓</span>
              AC7: is_required aus Felddefinition
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
