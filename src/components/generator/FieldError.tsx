/**
 * FieldError Component
 * PROJ-001: Pflichtfeld-Kennzeichnung
 *
 * Zeigt eine animierte Fehlermeldung unter einem Formularfeld an.
 * AC3: Leere Pflichtfelder erhalten eine rote Umrandung + Fehlermeldung unter dem Feld
 */

import React from 'react';

interface FieldErrorProps {
  /** Error message to display */
  message: string | null;
  /** Field ID for accessibility */
  fieldId?: string;
  /** Additional CSS classes */
  className?: string;
}

export function FieldError({
  message,
  fieldId,
  className = '',
}: FieldErrorProps) {
  if (!message) return null;

  return (
    <p
      id={fieldId ? `${fieldId}-error` : undefined}
      role="alert"
      aria-live="polite"
      className={`
        mt-1 text-sm text-red-600
        animate-in fade-in slide-in-from-top-1 duration-200
        ${className}
      `}
    >
      {message}
    </p>
  );
}

export default FieldError;
