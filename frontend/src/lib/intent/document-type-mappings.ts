/**
 * Intent Parser - Document Type Mappings
 *
 * Keyword-Mappings fuer Dokumenttyp-Erkennung,
 * erforderliche Felder pro Dokumenttyp und Feld-Labels.
 */

import type { DocumentTypeMapping } from './types';

// =============================================================================
// Document Type Mappings
// =============================================================================

export const DOCUMENT_TYPE_MAPPINGS: DocumentTypeMapping[] = [
  // ==========================================================================
  // PHASE 1: EINSTELLUNG & ONBOARDING
  // WICHTIG: Spezifischere Keywords ZUERST, da wir beim ersten Match aufhoeren!
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
  // WICHTIG: Nachtrag MUSS vor generischem Arbeitsvertrag kommen, da "Nachtrag zum Arbeitsvertrag" auch "Arbeitsvertrag" enthaelt!
  {
    keywords: ['nachtrag', 'änderungsvereinbarung', 'vertragsänderung', 'änderung zum vertrag', 'ergänzung', 'zusatzvereinbarung', 'nachtrag zum arbeitsvertrag'],
    documentType: 'Nachtrag zum Arbeitsvertrag',
    category: 'Vertragsänderung',
  },
  // Generischer Arbeitsvertrag zuletzt
  // WICHTIG: "einstellung" hier als Synonym fuer Arbeitsvertrag
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
  // WICHTIG: Spezifischere Kuendigungstypen ZUERST
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
  // Generische Kuendigung zuletzt
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

export const REQUIRED_FIELDS: Record<string, string[]> = {
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

// Feld-Labels fuer Vorschlaege
export const FIELD_LABELS: Record<string, string> = {
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
