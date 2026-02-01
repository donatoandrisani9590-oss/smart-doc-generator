/**
 * Intent Parser - Lokale Regex/Rules Engine
 *
 * Extrahiert Intents und Daten aus natürlicher Sprache.
 * Verarbeitet 80% der Anfragen LOKAL ohne API-Call.
 *
 * Datenschutz: Daten verlassen nie den Browser!
 */

// =============================================================================
// Types
// =============================================================================

export interface ParsedIntent {
  /** Erkannter Intent-Typ */
  intentType: 'create_document' | 'fill_field' | 'search' | 'unknown';
  /** Erkannter Dokumenttyp (falls vorhanden) */
  documentType: string | null;
  /** Extrahierte Daten */
  extractedData: Record<string, string | number>;
  /** Konfidenz (0-1) */
  confidence: number;
  /** Wurde lokal verarbeitet? */
  processedLocally: boolean;
  /** Ursprüngliche Nachricht */
  originalMessage: string;
  /** Fehlende empfohlene Felder */
  missingFields?: string[];
  /** Intelligente Vorschläge für nächste Eingabe */
  suggestions?: string[];
  /** Arbeitszeit-Typ */
  workType?: 'vollzeit' | 'teilzeit';
  /** Befristung */
  contractType?: 'befristet' | 'unbefristet';
}

export interface DocumentTypeMapping {
  keywords: string[];
  documentType: string;
  category: string;
}

// =============================================================================
// Document Type Mappings
// =============================================================================

const DOCUMENT_TYPE_MAPPINGS: DocumentTypeMapping[] = [
  // ==========================================================================
  // PHASE 1: EINSTELLUNG & ONBOARDING
  // WICHTIG: Spezifischere Keywords ZUERST, da wir beim ersten Match aufhören!
  // ==========================================================================

  // Spezifische Dokumente zuerst
  {
    keywords: ['einstellungszusage', 'letter of intent', 'loi', 'zusage', 'jobangebot', 'stellenangebot'],
    documentType: 'Einstellungszusage',
    category: 'Einstellung',
  },
  {
    keywords: ['absage', 'absageschreiben', 'ablehnung', 'bewerber absage', 'bewerbung ablehnen'],
    documentType: 'Absageschreiben',
    category: 'Recruiting',
  },
  {
    keywords: ['geheimhaltung', 'nda', 'vertraulichkeit', 'confidentiality', 'verschwiegenheit', 'secret', 'datenschutzverpflichtung', 'datengeheimnis'],
    documentType: 'Verschwiegenheitserklärung',
    category: 'Einstellung',
  },
  {
    keywords: ['minijob', 'geringfügig', '450 euro', '520 euro', 'aushilfe', 'geringfügige beschäftigung'],
    documentType: 'Arbeitsvertrag Minijob',
    category: 'Einstellung',
  },
  {
    keywords: ['teilzeit', 'teilzeitvertrag', 'part-time', 'halbtags'],
    documentType: 'Arbeitsvertrag Teilzeit',
    category: 'Einstellung',
  },
  // WICHTIG: "unbefristet" muss VOR "befristet" kommen, da "befristet" in "unbefristet" enthalten ist!
  {
    keywords: ['unbefristet', 'unbefristeter vertrag', 'dauerhaft', 'festanstellung'],
    documentType: 'Arbeitsvertrag Vollzeit',
    category: 'Einstellung',
  },
  {
    keywords: ['befristet', 'befristung', 'zeitvertrag', 'befristeter vertrag', 'auf zeit'],
    documentType: 'Arbeitsvertrag Befristet',
    category: 'Einstellung',
  },
  // WICHTIG: Nachtrag MUSS vor generischem Arbeitsvertrag kommen, da "Nachtrag zum Arbeitsvertrag" auch "Arbeitsvertrag" enthält!
  {
    keywords: ['nachtrag', 'änderungsvereinbarung', 'vertragsänderung', 'änderung zum vertrag', 'ergänzung', 'zusatzvereinbarung', 'nachtrag zum arbeitsvertrag'],
    documentType: 'Nachtrag zum Arbeitsvertrag',
    category: 'Vertragsänderung',
  },
  // Generischer Arbeitsvertrag zuletzt
  // WICHTIG: "einstellung" hier als Synonym für Arbeitsvertrag
  {
    keywords: ['arbeitsvertrag', 'anstellungsvertrag', 'employment contract', 'vollzeit', 'vertrag mit gehalt', 'anstellung', 'neueinstellung', 'einstellung'],
    documentType: 'Arbeitsvertrag Vollzeit',
    category: 'Einstellung',
  },

  // ==========================================================================
  // PHASE 2: LAUFENDES ARBEITSVERHÄLTNIS
  // ==========================================================================
  {
    keywords: ['gehaltserhöhung', 'lohnerhöhung', 'gehaltsanpassung', 'gehalt erhöhen', 'raise', 'salary increase'],
    documentType: 'Gehaltserhöhungsschreiben',
    category: 'Vertragsänderung',
  },
  {
    keywords: ['beförderung', 'promotion', 'aufstieg', 'höhere position'],
    documentType: 'Beförderungsschreiben',
    category: 'Vertragsänderung',
  },
  {
    keywords: ['elternzeit', 'mutterschutz', 'vaterzeit', 'elternzeit bestätigung', 'elternzeitantrag'],
    documentType: 'Elternzeit-Bestätigung',
    category: 'Abwesenheit',
  },
  {
    keywords: ['abmahnung', 'warning', 'verwarnung', 'ermahnung', 'rüge', 'disziplinarisch'],
    documentType: 'Abmahnung',
    category: 'Disziplinar',
  },
  {
    keywords: ['versetzung', 'umsetzung', 'transfer', 'standortwechsel', 'abteilungswechsel'],
    documentType: 'Versetzungsschreiben',
    category: 'Vertragsänderung',
  },
  {
    keywords: ['homeoffice', 'remote', 'telearbeit', 'home office', 'heimarbeit', 'mobiles arbeiten', 'fernarbeit'],
    documentType: 'Homeoffice-Vereinbarung',
    category: 'Vereinbarung',
  },
  {
    keywords: ['bonus', 'prämie', 'praemie', 'sonderzahlung', 'gratifikation', 'tantieme', 'provision', 'zielvereinbarung'],
    documentType: 'Bonusvereinbarung',
    category: 'Vereinbarung',
  },
  {
    keywords: ['firmenwagen', 'dienstwagen', 'company car', 'kfz', 'fahrzeug', 'pkw überlassung'],
    documentType: 'Firmenwagen-Vereinbarung',
    category: 'Vereinbarung',
  },
  {
    keywords: ['überstunden', 'mehrarbeit', 'überstundenvereinbarung', 'überstundenregelung'],
    documentType: 'Überstundenvereinbarung',
    category: 'Vereinbarung',
  },
  {
    keywords: ['fortbildung', 'weiterbildung', 'schulung', 'fortbildungsvereinbarung', 'qualifizierung', 'rückzahlungsklausel', 'seminar', 'kurs'],
    documentType: 'Fortbildungsvereinbarung',
    category: 'Vereinbarung',
  },

  // ==========================================================================
  // PHASE 3: BEENDIGUNG / OFFBOARDING
  // ==========================================================================
  // WICHTIG: Spezifischere Kündigungstypen ZUERST
  {
    keywords: ['fristlose kündigung', 'außerordentliche kündigung', 'fristlos kündigen', 'fristlos', 'sofortige kündigung'],
    documentType: 'Fristlose Kündigung',
    category: 'Beendigung',
  },
  {
    keywords: ['kündigungsbestätigung', 'bestätigung kündigung', 'kündigung bestätigen', 'eingangsbestätigung kündigung', 'kündigung eingegangen'],
    documentType: 'Kündigungsbestätigung',
    category: 'Beendigung',
  },
  // Generische Kündigung zuletzt
  {
    keywords: ['kündigung', 'kuendigung', 'termination', 'entlassung', 'ordentliche kündigung', 'fristgerecht'],
    documentType: 'Kündigung',
    category: 'Beendigung',
  },
  {
    keywords: ['aufhebung', 'aufhebungsvertrag', 'auflösung', 'einvernehmlich', 'trennungsvereinbarung', 'abfindung'],
    documentType: 'Aufhebungsvertrag',
    category: 'Beendigung',
  },
  // WICHTIG: Spezifischere Zeugnistypen zuerst!
  {
    keywords: ['zwischenzeugnis', 'interim zeugnis', 'zwischen-zeugnis'],
    documentType: 'Zwischenzeugnis',
    category: 'Zeugnis',
  },
  {
    keywords: ['einfaches zeugnis', 'tätigkeitsnachweis', 'beschäftigungsnachweis'],
    documentType: 'Arbeitszeugnis Einfach',
    category: 'Beendigung',
  },
  {
    keywords: ['zeugnis', 'arbeitszeugnis', 'certificate', 'reference', 'qualifiziertes zeugnis'],
    documentType: 'Arbeitszeugnis Qualifiziert',
    category: 'Beendigung',
  },
  {
    keywords: ['freistellung', 'freistellungserklärung', 'von der arbeit freistellen'],
    documentType: 'Freistellungserklärung',
    category: 'Beendigung',
  },
  {
    keywords: ['arbeitsbescheinigung', 'bescheinigung für arbeitsamt', 'agentur für arbeit'],
    documentType: 'Arbeitsbescheinigung',
    category: 'Beendigung',
  },

  // ==========================================================================
  // SONSTIGE HR-DOKUMENTE
  // ==========================================================================
  {
    keywords: ['probezeit', 'probezeitverlängerung', 'probezeit bestanden'],
    documentType: 'Probezeitbestätigung',
    category: 'Bestätigung',
  },
  {
    keywords: ['arbeitszeitänderung', 'stundenreduzierung', 'stundenerhöhung', 'arbeitszeitanpassung'],
    documentType: 'Arbeitszeitänderung',
    category: 'Vertragsänderung',
  },
  {
    keywords: ['urlaubsantrag', 'urlaub beantragen', 'urlaubsgenehmigung'],
    documentType: 'Urlaubsantrag',
    category: 'Abwesenheit',
  },
  {
    keywords: ['dienstanweisung', 'arbeitsanweisung', 'betriebsanweisung'],
    documentType: 'Dienstanweisung',
    category: 'Anweisung',
  },
];

// =============================================================================
// Erforderliche Felder pro Dokumenttyp
// =============================================================================

const REQUIRED_FIELDS: Record<string, string[]> = {
  // EINSTELLUNG
  'Arbeitsvertrag Vollzeit': ['first_name', 'last_name', 'position', 'salary', 'start_date'],
  'Arbeitsvertrag Teilzeit': ['first_name', 'last_name', 'position', 'salary', 'start_date', 'working_hours'],
  'Arbeitsvertrag Minijob': ['first_name', 'last_name', 'position', 'salary', 'start_date'],
  'Arbeitsvertrag Befristet': ['first_name', 'last_name', 'position', 'salary', 'start_date', 'end_date'],
  'Verschwiegenheitserklärung': ['first_name', 'last_name'],
  'Einstellungszusage': ['first_name', 'last_name', 'position', 'salary', 'start_date'],
  'Absageschreiben': ['first_name', 'last_name'],

  // LAUFENDES ARBEITSVERHÄLTNIS
  'Nachtrag zum Arbeitsvertrag': ['first_name', 'last_name', 'original_contract_date'],
  'Gehaltserhöhungsschreiben': ['first_name', 'last_name', 'salary', 'effective_date'],
  'Beförderungsschreiben': ['first_name', 'last_name', 'position', 'effective_date'],
  'Elternzeit-Bestätigung': ['first_name', 'last_name', 'start_date', 'end_date'],
  'Abmahnung': ['first_name', 'last_name', 'incident_date', 'incident_description'],
  'Versetzungsschreiben': ['first_name', 'last_name', 'new_department', 'effective_date'],
  'Homeoffice-Vereinbarung': ['first_name', 'last_name'],
  'Bonusvereinbarung': ['first_name', 'last_name', 'bonus_amount'],
  'Firmenwagen-Vereinbarung': ['first_name', 'last_name'],
  'Überstundenvereinbarung': ['first_name', 'last_name'],
  'Fortbildungsvereinbarung': ['first_name', 'last_name', 'training_description'],

  // BEENDIGUNG
  'Kündigung': ['first_name', 'last_name', 'end_date'],
  'Fristlose Kündigung': ['first_name', 'last_name', 'termination_reason'],
  'Kündigungsbestätigung': ['first_name', 'last_name', 'resignation_date', 'end_date'],
  'Aufhebungsvertrag': ['first_name', 'last_name', 'end_date'],
  'Arbeitszeugnis Qualifiziert': ['first_name', 'last_name', 'position', 'employment_start', 'employment_end'],
  'Arbeitszeugnis Einfach': ['first_name', 'last_name', 'position', 'employment_start', 'employment_end'],
  'Zwischenzeugnis': ['first_name', 'last_name', 'position'],
  'Freistellungserklärung': ['first_name', 'last_name', 'start_date', 'end_date'],
  'Arbeitsbescheinigung': ['first_name', 'last_name'],

  // SONSTIGE
  'Probezeitbestätigung': ['first_name', 'last_name'],
  'Arbeitszeitänderung': ['first_name', 'last_name', 'working_hours', 'effective_date'],
  'Urlaubsantrag': ['first_name', 'last_name', 'start_date', 'end_date'],
  'Dienstanweisung': [],
};

// Feld-Labels für Vorschläge
const FIELD_LABELS: Record<string, string> = {
  first_name: 'Vorname',
  last_name: 'Nachname',
  position: 'Position/Stelle',
  salary: 'Gehalt',
  start_date: 'Startdatum',
  end_date: 'Enddatum',
  working_hours: 'Wochenstunden',
  department: 'Abteilung',
  vacation_days: 'Urlaubstage',
  email: 'E-Mail',
  probation_months: 'Probezeit',
  effective_date: 'Gültig ab',
  original_contract_date: 'Ursprünglicher Vertrag vom',
  incident_date: 'Datum des Vorfalls',
  incident_description: 'Beschreibung des Vorfalls',
  new_department: 'Neue Abteilung',
  bonus_amount: 'Bonusbetrag',
  training_description: 'Fortbildung/Schulung',
  termination_reason: 'Kündigungsgrund',
  resignation_date: 'Kündigungseingang',
  employment_start: 'Beschäftigt seit',
  employment_end: 'Beschäftigt bis',
  severance_amount: 'Abfindungsbetrag',
};

// =============================================================================
// Extraction Patterns
// =============================================================================

const PATTERNS = {
  // Namen: "Max Müller", "Hans-Peter Schmidt", "Maria von Trapp"
  // Matcht: für/name/mitarbeiter + optionales Herr/Frau + Vorname + Nachname
  // Stoppt bei: Komma, "als", "mit", Zahl, @, oder Ende
  fullName: /(?:für|name|mitarbeiter)\s*:?\s*(?:(?:herr|frau|herrn)\s+)?([A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ]?[a-zäöüß]+)?(?:\s+(?:von|van|de|der|zu))?\s+[A-ZÄÖÜ][a-zäöüß]+)(?:\s*(?:,|als|mit|in\s+der|ab\s+|\d|@)|$)/i,

  // Herr/Frau Präfix separat für bessere Erkennung
  nameWithTitle: /(?:herr|frau|herrn)\s+([A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ]?[a-zäöüß]+)?(?:\s+(?:von|van|de|der|zu))?\s+[A-ZÄÖÜ][a-zäöüß]+)/i,

  // Vorname/Nachname separat
  firstName: /(?:vorname|first\s*name)\s*:?\s*([A-ZÄÖÜ][a-zäöüß]+)/i,
  lastName: /(?:nachname|last\s*name|familienname)\s*:?\s*([A-ZÄÖÜ][a-zäöüß]+)/i,

  // Gehalt: "5000€", "5.000 Euro", "4500 EUR", "3,5k", "3.5k"
  // Verbessert: k-Notation und Tausender-Trennzeichen
  salary: /(\d{1,3}(?:[.,]\d{3})*|\d+[.,]?\d*)\s*(?:€|euro|eur|k)(?:\s|,|$)/i,
  salaryK: /(\d+[.,]?\d*)\s*k(?:\s|,|$)/i,

  // Position: "als Manager", "Position: Entwickler"
  // WICHTIG: Nur nach explizitem "als" oder "Position:", nicht nach Namen
  position: /(?:position|stelle|job|rolle)\s*:?\s*([A-ZÄÖÜa-zäöüß][\w\s-]{2,30}?)(?=\s*(?:,|in|bei|mit|\.|$))/i,
  positionAls: /\s+als\s+([A-ZÄÖÜa-zäöüß][\w\s-]{2,35}?)(?=\s*(?:,|in\s+der|bei|mit|\.|$|\d))/i,

  // Abteilung - verbessert für "in der Abteilung X" und "Abteilung: X"
  department: /(?:in\s+der\s+)?(?:abteilung|department|bereich)\s*:?\s*([A-ZÄÖÜa-zäöüß][\w\s-]{1,25}?)(?=\s*(?:,|\.|$|\d))/i,

  // Startdatum: "ab 01.03.2024", "ab dem 01.03.2024", "Start: März 2024"
  startDate: /(?:ab(?:\s+dem)?|start|beginn|von|seit|zum)\s*:?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{1,2}\.\s*(?:januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*\d{4})/i,

  // Relative Datumsangaben: "nächsten Montag", "in 2 Wochen", "ab sofort"
  relativeDateKeywords: /(?:ab\s+)?(?:sofort|nächste[rn]?\s+(?:montag|dienstag|mittwoch|donnerstag|freitag|monat|woche)|in\s+\d+\s+(?:tagen?|wochen?|monaten?))/i,

  // Jahresgehalt erkennen: "60.000€ jährlich", "60k p.a.", "Jahresgehalt 72.000"
  yearlySalary: /(\d{1,3}(?:[.,]\d{3})*k?|\d+[.,]?\d*k?)\s*(?:€|euro|eur)?\s*(?:jährlich|jahres|p\.?\s*a\.?|pro\s+jahr|im\s+jahr|annual)/i,

  // Arbeitszeit: "40 Stunden", "Teilzeit 20h"
  workingHours: /(\d{1,2})\s*(?:stunden|h|std)(?:\s*(?:pro\s*)?(?:woche)?)?/i,

  // Urlaubstage: "30 Tage Urlaub", "25 Urlaubstage"
  vacationDays: /(\d{1,2})\s*(?:tage?\s*)?(?:urlaub|vacation|urlaubstage)/i,

  // Probezeit: "6 Monate Probezeit", "Probezeit 3 Monate"
  probationMonths: /(?:probezeit|probation)\s*:?\s*(\d{1,2})\s*monat/i,

  // E-Mail
  email: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,

  // Telefon
  phone: /(?:tel|telefon|phone|mobil)\s*:?\s*([\d\s/+-]{8,20})/i,

  // Adresse - verbessert
  street: /(?:straße|strasse|str\.?)\s*:?\s*([A-ZÄÖÜa-zäöüß][a-zäöüßA-ZÄÖÜ\s.-]*\s+\d+\s*[a-zA-Z]?)/i,
  postalCode: /\b(\d{5})\b/,
  city: /(?:(?:ort|stadt|city)\s*:?\s*|(?:\d{5})\s+)([A-ZÄÖÜ][a-zäöüß]+(?:[\s-][A-ZÄÖÜa-zäöüß]+)*)/i,

  // ==========================================================================
  // NEUE PATTERNS FÜR ERWEITERTE HR-DOKUMENTE
  // ==========================================================================

  // Enddatum: "bis 31.12.2024", "Ende: 30.06.2025", "befristet bis"
  endDate: /(?:bis(?:\s+zum)?|ende|endet|befristet\s+bis|auslaufen)\s*:?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{1,2}\.\s*(?:januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*\d{4})/i,

  // Kündigungsfrist: "mit einer Frist von 4 Wochen", "Kündigungsfrist 3 Monate"
  noticePeriod: /(?:kündigungsfrist|frist\s+von)\s*:?\s*(\d+)\s*(wochen?|monate?|tage?)/i,

  // Abfindung: "Abfindung 20.000€", "Abfindungssumme von 3 Monatsgehältern"
  severance: /(?:abfindung|abfindungssumme|ausgleich)\s*:?\s*(?:von\s+)?(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(?:€|euro|monatsgehälter?|gehälter?)?/i,

  // Bonus/Prämie: "Bonus von 5000€", "Prämie: 10%"
  bonusAmount: /(?:bonus|prämie|praemie|sonderzahlung)\s*:?\s*(?:von\s+)?(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(?:€|euro|%|prozent)?/i,

  // Zeugnisgrad/Note: "Note 1", "sehr gut", "gut", "befriedigend"
  zeugnisNote: /(?:note|bewertung|beurteilung)\s*:?\s*(\d|sehr\s+gut|gut|befriedigend|ausreichend|mangelhaft)/i,

  // Arbeitsort: "Arbeitsort: München", "am Standort Berlin"
  workLocation: /(?:arbeitsort|standort|dienstort|einsatzort)\s*:?\s*([A-ZÄÖÜ][a-zäöüß]+(?:[\s-][A-ZÄÖÜa-zäöüß]+)*)/i,

  // Vorfall-Datum (für Abmahnung): "am 15.03.2024", "Vorfall vom"
  incidentDate: /(?:am|vorfall(?:\s+vom)?|ereignis(?:\s+vom)?|geschehen\s+am)\s*:?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,

  // Beschreibung (für Abmahnung): nach "weil", "wegen", "aufgrund"
  incidentReason: /(?:weil|wegen|aufgrund|grund)\s*:?\s*(.{10,100}?)(?:\.|$|,\s*(?:wir|dies|daher))/i,

  // Vertragsdatum (für Nachträge): "Vertrag vom 01.01.2023"
  originalContractDate: /(?:vertrag(?:\s+vom)?|arbeitsvertrag(?:\s+vom)?|ursprünglicher?\s+vertrag)\s*:?\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,

  // Beschäftigungszeitraum (für Zeugnisse): "von 01.01.2020 bis 31.12.2024"
  employmentPeriod: /(?:vom?|seit|beschäftigt)\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})\s*(?:bis|[-–])\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i,

  // Urlaubstage Rest: "noch 5 Urlaubstage", "Resturlaub 10 Tage"
  remainingVacation: /(?:rest(?:urlaub)?|noch|verbleibend)\s*:?\s*(\d{1,2})\s*(?:urlaubs?)?tage?/i,

  // Überstunden: "50 Überstunden", "Mehrarbeit von 30 Stunden", "mit 50 Überstunden"
  overtimeHours: /(\d{1,3})\s*(?:überstunden|mehrarbeit)|(?:überstunden|mehrarbeit)\s*:?\s*(?:von\s+)?(\d{1,3})/i,

  // Fortbildung/Schulung: "Schulung: SAP Grundlagen", "Fortbildung zum Projektmanager"
  // WICHTIG: Matcht nur nach ":" oder "zum/für/in" (nicht nur nach dem Dokumenttyp-Wort!)
  trainingDescription: /(?:schulung|kurs|seminar|weiterbildung)\s*:\s*([A-ZÄÖÜa-zäöüß][\w\s-]{2,50})|(?:fortbildung|weiterbildung|schulung)\s+(?:zum?|für|in|über)\s+([A-ZÄÖÜa-zäöüß][\w\s-]{2,50})/i,

  // Freistellung: "freigestellt ab", "bezahlte Freistellung"
  releaseType: /(?:bezahlte?|unbezahlte?|widerrufliche?|unwiderrufliche?)\s*freistellung/i,
};

// =============================================================================
// Helper Functions
// =============================================================================

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
 * Generiert intelligente Vorschläge basierend auf fehlenden Feldern
 */
function generateSuggestions(
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

  const requiredFields = REQUIRED_FIELDS[documentType] || [];
  const missingFields = requiredFields.filter(field => {
    // Prüfe ob das Feld fehlt (beachte full_name -> first_name + last_name)
    if (field === 'first_name' || field === 'last_name') {
      return !extractedData.full_name && !extractedData[field];
    }
    return !extractedData[field];
  });

  const suggestions: string[] = [];

  // Generiere kontextbasierte Vorschläge
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
    // Dokumenttyp + "für" impliziert Erstellung
    /^(?:arbeitsvertrag|kuendigung|kündigung|zeugnis|arbeitszeugnis|abmahnung|homeoffice|firmenwagen|bonus|geheimhaltung|nda|einstellung|nachtrag|fortbildung)\s+(?:für|fuer)/i,
    // "Einstellung für..." impliziert Arbeitsvertrag
    /^einstellung\s+(?:für|fuer)\s+/i,
    // "Vertrag für..." impliziert Erstellung
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
 * parseIntent("Erstelle einen Arbeitsvertrag für Max Müller, 5000€")
 * // Returns:
 * // {
 * //   intentType: 'create_document',
 * //   documentType: 'Arbeitsvertrag Vollzeit',
 * //   extractedData: { full_name: 'Max Müller', salary: 5000 },
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
    extractedData.full_name = fullName;

    // Versuche zu splitten (beachte "von", "van" etc.)
    const vonMatch = fullName.match(/^(.+?)\s+(von|van|de|der|zu)\s+(.+)$/i);
    if (vonMatch) {
      extractedData.first_name = vonMatch[1];
      extractedData.last_name = `${vonMatch[2]} ${vonMatch[3]}`;
    } else {
      const nameParts = fullName.split(/\s+/);
      if (nameParts.length >= 2) {
        extractedData.first_name = nameParts[0];
        extractedData.last_name = nameParts.slice(1).join(' ');
      }
    }
  } else {
    const firstName = extractWithPattern(message, PATTERNS.firstName);
    const lastName = extractWithPattern(message, PATTERNS.lastName);
    if (firstName) extractedData.first_name = firstName;
    if (lastName) extractedData.last_name = lastName;
  }

  // Gehalt - prüfe zuerst Jahresgehalt, dann k-Notation, dann normal
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
      const salaryStr = extractWithPattern(message, PATTERNS.salary);
      if (salaryStr) {
        const salary = parseSalary(salaryStr, false, false);
        if (salary) extractedData.salary = salary;
      }
    }
  }

  // Position - prüfe "als X" Pattern zuerst (häufiger)
  const positionAls = extractWithPattern(message, PATTERNS.positionAls);
  if (positionAls) {
    extractedData.position = positionAls.trim();
  } else {
    const position = extractWithPattern(message, PATTERNS.position);
    if (position) extractedData.position = position.trim();
  }

  // Abteilung
  const department = extractWithPattern(message, PATTERNS.department);
  if (department) extractedData.department = department.trim();

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

  // Adresse
  const street = extractWithPattern(message, PATTERNS.street);
  if (street) extractedData.street = street;

  const postalCode = extractWithPattern(message, PATTERNS.postalCode);
  if (postalCode) extractedData.postal_code = postalCode;

  const city = extractWithPattern(message, PATTERNS.city);
  if (city) extractedData.city = city;

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

  // Arbeitsort
  const workLocation = extractWithPattern(message, PATTERNS.workLocation);
  if (workLocation) extractedData.work_location = workLocation;

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

  // Vorfall-Beschreibung (Abmahnung)
  const incidentReason = extractWithPattern(message, PATTERNS.incidentReason);
  if (incidentReason) extractedData.incident_description = incidentReason.trim();

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

  // Fortbildung (Pattern hat 2 Gruppen, prüfe beide)
  const trainingMatch = message.match(PATTERNS.trainingDescription);
  if (trainingMatch) {
    const trainingDesc = trainingMatch[1] || trainingMatch[2];
    if (trainingDesc) extractedData.training_description = trainingDesc.trim();
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
 * Validiert extrahierte Daten und gibt Warnungen zurück
 */
export function validateExtractedData(
  data: Record<string, string | number>,
  _documentType?: string | null
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Gehalt-Validierung
  if (typeof data.salary === 'number') {
    if (data.salary < 500) {
      warnings.push('Gehalt erscheint sehr niedrig. Meinten Sie ein Jahresgehalt?');
    }
    if (data.salary > 50000) {
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

export default parseIntent;
