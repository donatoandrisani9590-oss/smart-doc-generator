/**
 * Intent Parser - Suggestions & Missing Fields
 *
 * Generiert intelligente Vorschlaege und ermittelt fehlende Felder.
 */

import { REQUIRED_FIELDS, FIELD_LABELS } from './document-type-mappings';

/**
 * Ermittelt fehlende Felder fuer einen Dokumenttyp
 */
export function getMissingFields(
  documentType: string | null,
  extractedData: Record<string, string | number>
): string[] {
  if (!documentType) return [];

  const requiredFields = REQUIRED_FIELDS[documentType] || [];
  return requiredFields.filter(field => {
    // Pruefe ob das Feld fehlt (beachte full_name -> first_name + last_name)
    if (field === 'first_name' || field === 'last_name') {
      return !extractedData.full_name && !extractedData[field];
    }
    return !extractedData[field];
  });
}

/**
 * Generiert intelligente Vorschlaege basierend auf fehlenden Feldern
 */
export function generateSuggestions(
  documentType: string | null,
  extractedData: Record<string, string | number>
): { missingFields: string[]; suggestions: string[] } {
  if (!documentType) {
    return {
      missingFields: [],
      suggestions: [
        'Arbeitsvertrag für [Name]',
        'Kündigung für [Name]',
        'Zeugnis für [Name]',
      ],
    };
  }

  const missingFields = getMissingFields(documentType, extractedData);

  const suggestions: string[] = [];

  // Generiere kontextbasierte Vorschlaege
  if (missingFields.includes('first_name') || missingFields.includes('last_name')) {
    if (extractedData.position) {
      suggestions.push(`Für wen ist die ${extractedData.position}-Stelle?`);
    } else {
      suggestions.push('Name des Mitarbeiters hinzufügen (z.B. "für Max Müller")');
    }
  }

  if (missingFields.includes('salary')) {
    suggestions.push('Gehalt angeben (z.B. "5000€" oder "60k jährlich")');
  }

  if (missingFields.includes('position')) {
    suggestions.push('Position angeben (z.B. "als Software Developer")');
  }

  if (missingFields.includes('start_date')) {
    suggestions.push('Startdatum angeben (z.B. "ab 01.04.2024" oder "ab sofort")');
  }

  if (missingFields.includes('working_hours')) {
    suggestions.push('Wochenstunden angeben (z.B. "20 Stunden")');
  }

  return {
    missingFields: missingFields.map(f => FIELD_LABELS[f] || f),
    suggestions,
  };
}
