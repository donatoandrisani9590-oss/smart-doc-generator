/**
 * Validation Messages (DE/IT)
 * PROJ-001: Pflichtfeld-Kennzeichnung
 */

export const validationMessages = {
  de: {
    required: 'Dieses Feld ist erforderlich',
    minLength: 'Mindestens {{min}} Zeichen erforderlich',
    maxLength: 'Maximal {{max}} Zeichen erlaubt',
    minValue: 'Mindestwert: {{min}}',
    maxValue: 'Maximalwert: {{max}}',
    pattern: 'Ungültiges Format',
    email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
    number: 'Bitte geben Sie eine gültige Zahl ein',
    date: 'Bitte geben Sie ein gültiges Datum ein',
  },
  it: {
    required: 'Questo campo è obbligatorio',
    minLength: 'Minimo {{min}} caratteri richiesti',
    maxLength: 'Massimo {{max}} caratteri consentiti',
    minValue: 'Valore minimo: {{min}}',
    maxValue: 'Valore massimo: {{max}}',
    pattern: 'Formato non valido',
    email: 'Inserisci un indirizzo email valido',
    number: 'Inserisci un numero valido',
    date: 'Inserisci una data valida',
  },
} as const;

export type ValidationKey = keyof typeof validationMessages.de;
export type Locale = 'de' | 'it';

/**
 * Get validation message for locale
 */
export function getValidationMessage(
  key: ValidationKey,
  locale: Locale = 'de',
  params?: Record<string, string | number>
): string {
  let message: string = validationMessages[locale][key];

  if (params) {
    Object.entries(params).forEach(([paramKey, value]) => {
      message = message.replace(`{{${paramKey}}}`, String(value));
    });
  }

  return message;
}
