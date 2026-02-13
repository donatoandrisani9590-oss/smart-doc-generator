/**
 * Intent Parser - Core Parser
 *
 * Hauptlogik für die Verarbeitung natürlicher Sprache.
 * Erkennt Intents, Dokumenttypen und extrahiert Daten.
 *
 * Datenschutz: Daten verlassen nie den Browser!
 */

import type { ParsedIntent } from './types';
import { DOCUMENT_TYPE_MAPPINGS } from './document-type-mappings';
import { PATTERNS } from './field-extraction-patterns';
import { generateSuggestions } from './suggestions';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sanitiert einen String gegen XSS-Angriffe
 * Entfernt HTML-Tags und gefährliche Zeichen
 * @public - Exportiert für Nutzung in anderen Modulen
 */
export function sanitizeInput(text: string): string {
  if (!text) return '';
  return text
    // HTML-Tags entfernen
    .replace(/<[^>]*>/g, '')
    // Script-Injections verhindern
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    // Gefährliche Zeichen escapen
    .replace(/[<>"'`]/g, (char) => {
      const escapeMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '`': '&#x60;',
      };
      return escapeMap[char] || char;
    })
    .trim();
}

/**
 * Normalisiert einen String für besseres Matching
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .trim();
}

/**
 * Extrahiert einen Wert mit einem Pattern
 */
function extractWithPattern(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Parst Gehalt in Zahl (Monatsgehalt)
 */
function parseSalary(salaryStr: string, isKNotation: boolean = false, isYearly: boolean = false): number | null {
  if (!salaryStr) return null;

  // Entferne Währungssymbole und Whitespace
  let cleaned = salaryStr.trim().replace(/[€\s]/gi, '');

  // k-Notation: "3,5k" oder "3.5k" -> 3500
  if (isKNotation || /k$/i.test(cleaned)) {
    cleaned = cleaned.replace(/k$/i, '');
    // Ersetze Komma durch Punkt für Dezimalzahlen
    cleaned = cleaned.replace(',', '.');
    const num = parseFloat(cleaned);
    const value = num ? num * 1000 : null;
    // Jahresgehalt zu Monatsgehalt konvertieren
    return value && isYearly ? Math.round(value / 12) : value;
  }

  // Tausender-Trennzeichen entfernen: "5.000" oder "5,000" -> "5000"
  // Aber "5,5" als 5.5 interpretieren (Dezimalkomma)
  if (/^\d{1,3}[.,]\d{3}$/.test(cleaned)) {
    // Das ist ein Tausender-Format: 5.000 oder 5,000
    cleaned = cleaned.replace(/[.,]/, '');
  } else if (/,\d{1,2}$/.test(cleaned)) {
    // Das ist ein Dezimalkomma: 5,5 oder 4500,50
    cleaned = cleaned.replace(',', '.');
  }

  const value = parseFloat(cleaned) || null;
  // Jahresgehalt zu Monatsgehalt konvertieren
  return value && isYearly ? Math.round(value / 12) : value;
}

/**
 * Erkennt Arbeitszeit-Typ (Vollzeit/Teilzeit)
 */
function detectWorkType(text: string): 'vollzeit' | 'teilzeit' | undefined {
  const normalizedText = normalize(text);

  if (/teilzeit|part[\s-]?time|halbtags/i.test(normalizedText)) {
    return 'teilzeit';
  }
  if (/vollzeit|full[\s-]?time|ganztags/i.test(normalizedText)) {
    return 'vollzeit';
  }

  // Ableitung aus Stundenzahl
  const hoursMatch = text.match(/(\d{1,2})\s*(?:stunden|h|std)/i);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1]);
    if (hours < 35) return 'teilzeit';
    if (hours >= 35) return 'vollzeit';
  }

  return undefined;
}

/**
 * Erkennt Befristungstyp
 * WICHTIG: "unbefristet" muss VOR "befristet" geprüft werden!
 */
function detectContractType(text: string): 'befristet' | 'unbefristet' | undefined {
  const normalizedText = normalize(text);

  // WICHTIG: Unbefristet zuerst prüfen, da "befristet" in "unbefristet" enthalten ist!
  if (/unbefristet|permanent|dauerhaft|fest\s*anstellung/i.test(normalizedText)) {
    return 'unbefristet';
  }
  if (/\bbefristet\b|zeitlich\s+begrenzt|auf\s+zeit|temporary/i.test(normalizedText)) {
    return 'befristet';
  }

  return undefined;
}

/**
 * Parst relatives Datum zu konkretem Datum
 */
function parseRelativeDate(text: string): string | null {
  const today = new Date();
  const normalizedText = text.toLowerCase();

  // "ab sofort" -> heute
  if (/ab\s+sofort|sofort|immediately/i.test(normalizedText)) {
    return formatDate(today);
  }

  // "nächsten Montag" etc.
  const dayMatch = normalizedText.match(/nächste[rn]?\s+(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)/i);
  if (dayMatch) {
    const days: Record<string, number> = {
      'montag': 1, 'dienstag': 2, 'mittwoch': 3, 'donnerstag': 4,
      'freitag': 5, 'samstag': 6, 'sonntag': 0
    };
    const targetDay = days[dayMatch[1].toLowerCase()];
    const currentDay = today.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysUntil);
    return formatDate(nextDate);
  }

  // "in X Tagen/Wochen/Monaten"
  const relativeMatch = normalizedText.match(/in\s+(\d+)\s+(tagen?|wochen?|monaten?)/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    const futureDate = new Date(today);

    if (unit.startsWith('tag')) {
      futureDate.setDate(today.getDate() + amount);
    } else if (unit.startsWith('woche')) {
      futureDate.setDate(today.getDate() + (amount * 7));
    } else if (unit.startsWith('monat')) {
      futureDate.setMonth(today.getMonth() + amount);
    }

    return formatDate(futureDate);
  }

  // "nächsten Monat"
  if (/nächste[rn]?\s+monat/i.test(normalizedText)) {
    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);
    nextMonth.setDate(1);
    return formatDate(nextMonth);
  }

  return null;
}

/**
 * Formatiert Datum als DD.MM.YYYY
 */
function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Erkennt den Dokumenttyp aus dem Text
 */
function detectDocumentType(text: string): { type: string; category: string; confidence: number } | null {
  const normalizedText = normalize(text);

  for (const mapping of DOCUMENT_TYPE_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      if (normalizedText.includes(normalize(keyword))) {
        // Höhere Konfidenz wenn mehrere Keywords matchen
        const matchCount = mapping.keywords.filter(kw =>
          normalizedText.includes(normalize(kw))
        ).length;

        return {
          type: mapping.documentType,
          category: mapping.category,
          confidence: Math.min(0.5 + (matchCount * 0.15), 0.95),
        };
      }
    }
  }

  return null;
}

/**
 * Erkennt den Intent-Typ
 */
function detectIntentType(text: string): 'create_document' | 'fill_field' | 'search' | 'unknown' {
  const normalizedText = normalize(text);
  const originalText = text;

  // Dokument erstellen - erweiterte Patterns
  const createPatterns = [
    /erstell/i,
    /generi/i,
    /mach.*(?:vertrag|dokument|zeugnis|kuendigung|kündigung)/i,
    /brauch.*(?:vertrag|dokument|zeugnis)/i,
    /neu(?:e[rn]?)?\s+(?:vertrag|dokument|arbeitsvertrag|zeugnis)/i,
    /create/i,
    // Dokumenttyp + "fuer" impliziert Erstellung
    /^(?:arbeitsvertrag|kuendigung|kündigung|zeugnis|arbeitszeugnis|abmahnung|homeoffice|firmenwagen|bonus|geheimhaltung|nda|einstellung|nachtrag|fortbildung)\s+(?:für|fuer)/i,
    // "Einstellung fuer..." impliziert Arbeitsvertrag
    /^einstellung\s+(?:für|fuer)\s+/i,
    // "Vertrag fuer..." impliziert Erstellung
    /vertrag\s+(?:für|fuer)\s+/i,
    // Dokumenttyp + "mit" impliziert Erstellung (z.B. "Arbeitsvertrag mit 30 Tage Urlaub")
    /^(?:arbeitsvertrag|kuendigung|kündigung|zeugnis|arbeitszeugnis|abmahnung|homeoffice|firmenwagen|bonus|geheimhaltung|nda)\s+mit\s+/i,
  ];

  if (createPatterns.some(p => p.test(normalizedText) || p.test(originalText))) {
    return 'create_document';
  }

  // Prüfe ob ein Dokumenttyp erkannt wird UND ein Name vorhanden ist -> wahrscheinlich Erstellung
  const hasDocType = DOCUMENT_TYPE_MAPPINGS.some(mapping =>
    mapping.keywords.some(kw => normalizedText.includes(normalize(kw)))
  );
  const hasName = /(?:für|fuer|herr|frau)\s+[A-ZÄÖÜ]/i.test(originalText);
  if (hasDocType && hasName) {
    return 'create_document';
  }

  // Feld ausfüllen
  const fillPatterns = [
    /(?:name|gehalt|position|adresse)\s*(?:ist|:)/i,
    /^[A-Z][a-zäöüß]+\s+[A-Z][a-zäöüß]+$/,  // Nur ein Name
    /^\d+\s*(?:€|euro|eur)$/i,  // Nur Gehalt
  ];

  if (fillPatterns.some(p => p.test(originalText))) {
    return 'fill_field';
  }

  // Suche
  const searchPatterns = [
    /such/i,
    /find/i,
    /zeig/i,
    /wo\s+ist/i,
    /search/i,
    /liste/i,
    /alle\s+/i,
  ];

  if (searchPatterns.some(p => p.test(normalizedText))) {
    return 'search';
  }

  return 'unknown';
}

// =============================================================================
// Main Parser Function
// =============================================================================

/**
 * Parst eine natürliche Spracheingabe und extrahiert Intent + Daten
 *
 * @example
 * parseIntent("Erstelle einen Arbeitsvertrag für Max Mueller, 5000EUR")
 * // Returns:
 * // {
 * //   intentType: 'create_document',
 * //   documentType: 'Arbeitsvertrag Vollzeit',
 * //   extractedData: { full_name: 'Max Mueller', salary: 5000 },
 * //   confidence: 0.85,
 * //   processedLocally: true
 * // }
 */
export function parseIntent(message: string): ParsedIntent {
  const result: ParsedIntent = {
    intentType: 'unknown',
    documentType: null,
    extractedData: {},
    confidence: 0,
    processedLocally: true,
    originalMessage: message,
  };

  if (!message || message.trim().length < 3) {
    return result;
  }

  // 1. Intent-Typ erkennen
  result.intentType = detectIntentType(message);

  // 2. Dokumenttyp erkennen
  const docType = detectDocumentType(message);
  if (docType) {
    result.documentType = docType.type;
    result.confidence = docType.confidence;
  }

  // 3. Daten extrahieren
  const extractedData: Record<string, string | number> = {};

  // Name (versuche verschiedene Patterns)
  let fullName = extractWithPattern(message, PATTERNS.fullName);

  // Fallback: Name mit Titel (Herr/Frau)
  if (!fullName) {
    fullName = extractWithPattern(message, PATTERNS.nameWithTitle);
  }

  if (fullName) {
    // Entferne "Herr/Frau/Mitarbeiter" Präfix falls vorhanden
    fullName = fullName.replace(/^(?:herr|frau|herrn|mitarbeiter)\s+/i, '').trim();
    // XSS-Sanitization für alle extrahierten Namen
    extractedData.full_name = sanitizeInput(fullName);

    // Versuche zu splitten (beachte "von", "van" etc.)
    const vonMatch = fullName.match(/^(.+?)\s+(von|van|de|der|zu|da|di|del|della)\s+(.+)$/i);
    if (vonMatch) {
      extractedData.first_name = sanitizeInput(vonMatch[1]);
      extractedData.last_name = sanitizeInput(`${vonMatch[2]} ${vonMatch[3]}`);
    } else {
      const nameParts = fullName.split(/\s+/);
      if (nameParts.length >= 2) {
        extractedData.first_name = sanitizeInput(nameParts[0]);
        extractedData.last_name = sanitizeInput(nameParts.slice(1).join(' '));
      }
    }
  } else {
    const firstName = extractWithPattern(message, PATTERNS.firstName);
    const lastName = extractWithPattern(message, PATTERNS.lastName);
    if (firstName) extractedData.first_name = sanitizeInput(firstName);
    if (lastName) extractedData.last_name = sanitizeInput(lastName);
  }

  // Gehalt - prüfe zuerst Jahresgehalt, dann k-Notation, dann normal (mit/ohne Leerzeichen)
  const yearlySalaryStr = extractWithPattern(message, PATTERNS.yearlySalary);
  if (yearlySalaryStr) {
    const isK = /k/i.test(yearlySalaryStr);
    const salary = parseSalary(yearlySalaryStr, isK, true);
    if (salary) {
      extractedData.salary = salary;
      extractedData.salary_type = 'monthly_from_yearly';
    }
  } else {
    const salaryKStr = extractWithPattern(message, PATTERNS.salaryK);
    if (salaryKStr) {
      const salary = parseSalary(salaryKStr, true, false);
      if (salary) extractedData.salary = salary;
    } else {
      // Versuche beide Patterns: mit und ohne Leerzeichen vor EUR
      const salaryStr = extractWithPattern(message, PATTERNS.salary)
        || extractWithPattern(message, PATTERNS.salaryWithSpace);
      if (salaryStr) {
        const salary = parseSalary(salaryStr, false, false);
        if (salary) extractedData.salary = salary;
      }
    }
  }

  // Position - prüfe "als X" Pattern zuerst (häufiger) - mit XSS-Sanitization
  const positionAls = extractWithPattern(message, PATTERNS.positionAls);
  if (positionAls) {
    extractedData.position = sanitizeInput(positionAls.trim());
  } else {
    const position = extractWithPattern(message, PATTERNS.position);
    if (position) extractedData.position = sanitizeInput(position.trim());
  }

  // Abteilung - mit XSS-Sanitization
  const department = extractWithPattern(message, PATTERNS.department);
  if (department) extractedData.department = sanitizeInput(department.trim());

  // Startdatum - zuerst konkret, dann relativ
  const startDate = extractWithPattern(message, PATTERNS.startDate);
  if (startDate) {
    extractedData.start_date = startDate;
  } else {
    // Relatives Datum prüfen
    const relativeMatch = message.match(PATTERNS.relativeDateKeywords);
    if (relativeMatch) {
      const parsedDate = parseRelativeDate(relativeMatch[0]);
      if (parsedDate) {
        extractedData.start_date = parsedDate;
        extractedData.start_date_source = 'relative';
      }
    }
  }

  // Arbeitszeit
  const workingHours = extractWithPattern(message, PATTERNS.workingHours);
  if (workingHours) extractedData.working_hours = parseInt(workingHours);

  // Urlaubstage
  const vacationDays = extractWithPattern(message, PATTERNS.vacationDays);
  if (vacationDays) extractedData.vacation_days = parseInt(vacationDays);

  // Probezeit
  const probationMonths = extractWithPattern(message, PATTERNS.probationMonths);
  if (probationMonths) extractedData.probation_months = parseInt(probationMonths);

  // E-Mail
  const email = extractWithPattern(message, PATTERNS.email);
  if (email) extractedData.email = email;

  // Telefon
  const phone = extractWithPattern(message, PATTERNS.phone);
  if (phone) extractedData.phone = phone.replace(/\s+/g, '');

  // Adresse - mit XSS-Sanitization
  const street = extractWithPattern(message, PATTERNS.street);
  if (street) extractedData.street = sanitizeInput(street);

  const postalCode = extractWithPattern(message, PATTERNS.postalCode);
  if (postalCode) extractedData.postal_code = postalCode; // Nur Zahlen, kein Sanitizing nötig

  const city = extractWithPattern(message, PATTERNS.city);
  if (city) extractedData.city = sanitizeInput(city);

  // ==========================================================================
  // ERWEITERTE FELDER FÜR HR-DOKUMENTE
  // ==========================================================================

  // Enddatum (für befristete Verträge, Elternzeit, Aufhebung)
  const endDate = extractWithPattern(message, PATTERNS.endDate);
  if (endDate) extractedData.end_date = endDate;

  // Beschäftigungszeitraum (für Zeugnisse)
  const periodMatch = message.match(PATTERNS.employmentPeriod);
  if (periodMatch) {
    extractedData.employment_start = periodMatch[1];
    extractedData.employment_end = periodMatch[2];
  }

  // Arbeitsort - mit XSS-Sanitization
  const workLocation = extractWithPattern(message, PATTERNS.workLocation);
  if (workLocation) extractedData.work_location = sanitizeInput(workLocation);

  // Kündigungsfrist
  const noticePeriodMatch = message.match(PATTERNS.noticePeriod);
  if (noticePeriodMatch) {
    extractedData.notice_period_value = parseInt(noticePeriodMatch[1]);
    extractedData.notice_period_unit = noticePeriodMatch[2];
  }

  // Abfindung
  const severance = extractWithPattern(message, PATTERNS.severance);
  if (severance) {
    const severanceNum = parseSalary(severance, false, false);
    if (severanceNum) extractedData.severance_amount = severanceNum;
  }

  // Bonus
  const bonusAmount = extractWithPattern(message, PATTERNS.bonusAmount);
  if (bonusAmount) {
    const bonusNum = parseSalary(bonusAmount, false, false);
    if (bonusNum) extractedData.bonus_amount = bonusNum;
  }

  // Zeugnisnote
  const zeugnisNote = extractWithPattern(message, PATTERNS.zeugnisNote);
  if (zeugnisNote) extractedData.zeugnis_note = zeugnisNote;

  // Vorfall-Datum (Abmahnung)
  const incidentDate = extractWithPattern(message, PATTERNS.incidentDate);
  if (incidentDate) extractedData.incident_date = incidentDate;

  // Vorfall-Beschreibung (Abmahnung) - mit XSS-Sanitization
  const incidentReason = extractWithPattern(message, PATTERNS.incidentReason);
  if (incidentReason) extractedData.incident_description = sanitizeInput(incidentReason.trim());

  // Original-Vertragsdatum (Nachträge)
  const originalContractDate = extractWithPattern(message, PATTERNS.originalContractDate);
  if (originalContractDate) extractedData.original_contract_date = originalContractDate;

  // Resturlaub
  const remainingVacation = extractWithPattern(message, PATTERNS.remainingVacation);
  if (remainingVacation) extractedData.remaining_vacation = parseInt(remainingVacation);

  // Überstunden (Pattern hat 2 Gruppen, prüfe beide)
  const overtimeMatch = message.match(PATTERNS.overtimeHours);
  if (overtimeMatch) {
    const hours = overtimeMatch[1] || overtimeMatch[2];
    if (hours) extractedData.overtime_hours = parseInt(hours);
  }

  // Fortbildung (Pattern hat 2 Gruppen, prüfe beide) - mit XSS-Sanitization
  const trainingMatch = message.match(PATTERNS.trainingDescription);
  if (trainingMatch) {
    const trainingDesc = trainingMatch[1] || trainingMatch[2];
    if (trainingDesc) extractedData.training_description = sanitizeInput(trainingDesc.trim());
  }

  // Freistellungsart
  const releaseType = message.match(PATTERNS.releaseType);
  if (releaseType) extractedData.release_type = releaseType[0].toLowerCase();

  result.extractedData = extractedData;

  // 4. Arbeitszeit-Typ und Befristung erkennen
  result.workType = detectWorkType(message);
  result.contractType = detectContractType(message);

  // Dokumenttyp anpassen basierend auf Arbeitszeit
  if (result.documentType === 'Arbeitsvertrag Vollzeit' && result.workType === 'teilzeit') {
    result.documentType = 'Arbeitsvertrag Teilzeit';
  }

  // 5. Konfidenz berechnen
  const dataPoints = Object.keys(extractedData).filter(k => !k.includes('_type') && !k.includes('_relative')).length;
  if (result.intentType !== 'unknown') {
    result.confidence = Math.min(
      result.confidence + (dataPoints * 0.1),
      0.95
    );
  }

  // Mindest-Konfidenz wenn Daten gefunden wurden
  if (dataPoints > 0 && result.confidence < 0.3) {
    result.confidence = 0.3 + (dataPoints * 0.1);
  }

  // 6. Intelligente Vorschläge generieren
  const { missingFields, suggestions } = generateSuggestions(result.documentType, extractedData);
  result.missingFields = missingFields;
  result.suggestions = suggestions;

  return result;
}

/**
 * Prüft ob die lokale Verarbeitung ausreicht oder Mistral benötigt wird
 */
export function needsMistralFallback(parsed: ParsedIntent): boolean {
  // Nutze Mistral wenn:
  // 1. Intent unklar (confidence < 0.5)
  // 2. Kein Dokumenttyp erkannt aber Erstellung gewünscht
  // 3. Komplexe Anfrage (sehr langer Text ohne klare Struktur)

  if (parsed.confidence < 0.5) return true;
  if (parsed.intentType === 'create_document' && !parsed.documentType) return true;
  if (parsed.intentType === 'unknown' && parsed.originalMessage.length > 100) return true;

  return false;
}

/**
 * Formatiert extrahierte Daten für die Anzeige
 */
export function formatExtractedData(data: Record<string, string | number>): string {
  const labels: Record<string, string> = {
    full_name: 'Name',
    first_name: 'Vorname',
    last_name: 'Nachname',
    salary: 'Gehalt',
    position: 'Position',
    department: 'Abteilung',
    start_date: 'Startdatum',
    working_hours: 'Arbeitszeit',
    vacation_days: 'Urlaubstage',
    probation_months: 'Probezeit',
    email: 'E-Mail',
    phone: 'Telefon',
    street: 'Straße',
    postal_code: 'PLZ',
    city: 'Ort',
  };

  return Object.entries(data)
    .map(([key, value]) => {
      const label = labels[key] || key;
      const formattedValue = key === 'salary'
        ? `${value.toLocaleString('de-DE')} €`
        : key === 'working_hours'
        ? `${value} Std/Woche`
        : key === 'vacation_days'
        ? `${value} Tage`
        : key === 'probation_months'
        ? `${value} Monate`
        : String(value);
      return `${label}: ${formattedValue}`;
    })
    .join('\n');
}

/**
 * Generiert Autocomplete-Vorschläge basierend auf teilweiser Eingabe
 */
export function getAutocompleteSuggestions(partialInput: string): string[] {
  const input = partialInput.toLowerCase().trim();

  if (input.length < 2) return [];

  const suggestions: string[] = [];

  // Dokumenttyp-Vorschläge
  if ('erstelle'.startsWith(input) || input.startsWith('erst')) {
    suggestions.push(
      'Erstelle einen Arbeitsvertrag für ',
      'Erstelle eine Kündigung für ',
      'Erstelle ein Arbeitszeugnis für ',
    );
  }

  // Nach "für" -> Namenvorschläge
  if (input.endsWith('für ') || input.endsWith('fuer ')) {
    suggestions.push(
      `${partialInput}[Name des Mitarbeiters]`,
    );
  }

  // Nach Name -> weitere Felder
  if (/für\s+[a-zäöüß]+\s+[a-zäöüß]+$/i.test(input)) {
    suggestions.push(
      `${partialInput}, 5000€ Gehalt`,
      `${partialInput} als [Position]`,
      `${partialInput}, ab [Datum]`,
    );
  }

  // Gehalt-Vorschläge
  if (input.includes('gehalt') && !input.match(/\d/)) {
    suggestions.push(
      `${partialInput} 4500€`,
      `${partialInput} 5000€`,
      `${partialInput} 60k jährlich`,
    );
  }

  // Datum-Vorschläge
  if (input.endsWith('ab ')) {
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);
    nextMonth.setDate(1);

    suggestions.push(
      `${partialInput}sofort`,
      `${partialInput}${formatDate(nextMonth)}`,
      `${partialInput}nächsten Montag`,
    );
  }

  return suggestions.slice(0, 5);
}

/**
 * Exportiert verfügbare Dokumenttypen für UI
 */
export function getAvailableDocumentTypes(): Array<{ type: string; category: string; keywords: string[] }> {
  return DOCUMENT_TYPE_MAPPINGS.map(m => ({
    type: m.documentType,
    category: m.category,
    keywords: m.keywords,
  }));
}
