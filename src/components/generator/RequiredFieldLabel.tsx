/**
 * RequiredFieldLabel Component
 * PROJ-001: Pflichtfeld-Kennzeichnung
 *
 * Zeigt ein Label mit rotem Sternchen (*) für Pflichtfelder an.
 * AC1: Pflichtfelder zeigen ein rotes Sternchen (*) neben dem Label an
 */

import React from 'react';

interface RequiredFieldLabelProps {
  /** Label text */
  label: string;
  /** Whether the field is required */
  isRequired: boolean;
  /** HTML for attribute (links to input id) */
  htmlFor?: string;
  /** Additional help text below the label */
  helpText?: string;
  /** Additional CSS classes */
  className?: string;
}

export function RequiredFieldLabel({
  label,
  isRequired,
  htmlFor,
  helpText,
  className = '',
}: RequiredFieldLabelProps) {
  return (
    <div className={`mb-1 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {isRequired && (
          <span
            className="ml-1 text-red-500"
            aria-label="Pflichtfeld"
            title="Pflichtfeld"
          >
            *
          </span>
        )}
      </label>
      {helpText && (
        <p className="mt-0.5 text-xs text-gray-500">{helpText}</p>
      )}
    </div>
  );
}

export default RequiredFieldLabel;
