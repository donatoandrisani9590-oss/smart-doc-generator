/**
 * Intent Parser - Validation
 *
 * Validiert extrahierte Daten und gibt Warnungen zurueck.
 */

/**
 * Validiert extrahierte Daten und gibt Warnungen zurueck
 */
export function validateExtractedData(
  data: Record<string, string | number>,
  documentType?: string | null
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Minijob-Erkennung fuer spezielle Validierungsregeln
  const isMinijob = documentType?.toLowerCase().includes('minijob') ||
    documentType?.toLowerCase().includes('geringfügig');

  // Gehalt-Validierung (mit Minijob-Ausnahme)
  if (typeof data.salary === 'number') {
    // Minijobs haben niedrigere Gehaelter - das ist normal
    if (data.salary < 500 && !isMinijob) {
      warnings.push('Gehalt erscheint sehr niedrig. Meinten Sie ein Jahresgehalt?');
    }
    // Bei Minijobs max 520EUR (Stand 2024)
    if (isMinijob && data.salary > 520) {
      warnings.push('Minijob-Gehalt überschreitet die 520€-Grenze');
    }
    if (data.salary > 50000 && !isMinijob) {
      warnings.push('Gehalt erscheint sehr hoch. Ist das ein Monatsgehalt?');
    }
  }

  // Arbeitszeit-Validierung
  if (typeof data.working_hours === 'number') {
    if (data.working_hours > 48) {
      warnings.push('Wochenstunden überschreiten das gesetzliche Maximum (48h)');
    }
    if (data.working_hours < 8) {
      warnings.push('Sehr geringe Wochenstunden - ist das korrekt?');
    }
  }

  // Urlaubstage-Validierung
  if (typeof data.vacation_days === 'number') {
    if (data.vacation_days < 20) {
      warnings.push('Urlaubstage unter gesetzlichem Minimum (20 Tage bei 5-Tage-Woche)');
    }
  }

  // Probezeit-Validierung
  if (typeof data.probation_months === 'number') {
    if (data.probation_months > 6) {
      warnings.push('Probezeit überschreitet das gesetzliche Maximum (6 Monate)');
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
