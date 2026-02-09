/**
 * Intent Parser Test Suite
 *
 * Testet alle Regex-Patterns gegen realistische HR-Anwendungsfälle
 */

import { parseIntent, type ParsedIntent } from '../intent-parser';

// =============================================================================
// Test Helper
// =============================================================================

function testCase(
  description: string,
  input: string,
  expected: Partial<ParsedIntent>
) {
  const result = parseIntent(input);
  const errors: string[] = [];

  // Check each expected field
  if (expected.intentType !== undefined && result.intentType !== expected.intentType) {
    errors.push(`intentType: expected "${expected.intentType}", got "${result.intentType}"`);
  }
  if (expected.documentType !== undefined && result.documentType !== expected.documentType) {
    errors.push(`documentType: expected "${expected.documentType}", got "${result.documentType}"`);
  }
  if (expected.confidence !== undefined) {
    if (typeof expected.confidence === 'number') {
      if (Math.abs(result.confidence - expected.confidence) > 0.1) {
        errors.push(`confidence: expected ~${expected.confidence}, got ${result.confidence}`);
      }
    }
  }
  if (expected.extractedData !== undefined) {
    for (const [key, value] of Object.entries(expected.extractedData)) {
      if (result.extractedData[key] !== value) {
        errors.push(`extractedData.${key}: expected "${value}", got "${result.extractedData[key]}"`);
      }
    }
  }

  return {
    description,
    input,
    result,
    expected,
    passed: errors.length === 0,
    errors,
  };
}

// =============================================================================
// TEST CASES
// =============================================================================

const testCases = [
  // =========================================================================
  // ARBEITSVERTRAG ERSTELLUNG
  // =========================================================================

  // Basis-Fälle
  testCase(
    "Einfacher Arbeitsvertrag",
    "Erstelle einen Arbeitsvertrag",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Vollzeit',
    }
  ),

  testCase(
    "Arbeitsvertrag mit Name (für)",
    "Erstelle einen Arbeitsvertrag für Max Müller",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Vollzeit',
      extractedData: { first_name: 'Max', last_name: 'Müller' },
    }
  ),

  testCase(
    "Arbeitsvertrag mit Name und Gehalt",
    "Erstelle einen Arbeitsvertrag für Max Müller, 5000€",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Vollzeit',
      extractedData: { first_name: 'Max', last_name: 'Müller', salary: 5000 },
    }
  ),

  testCase(
    "Arbeitsvertrag mit vollem Gehalt-Format",
    "Neuer Arbeitsvertrag für Anna Schmidt mit 4.500 Euro Gehalt",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Vollzeit',
      extractedData: { first_name: 'Anna', last_name: 'Schmidt', salary: 4500 },
    }
  ),

  testCase(
    "Arbeitsvertrag mit k-Notation",
    "Arbeitsvertrag erstellen für Peter Weber, 3,5k",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Vollzeit',
      extractedData: { first_name: 'Peter', last_name: 'Weber', salary: 3500 },
    }
  ),

  // Komplexe Namen
  testCase(
    "Doppelname mit Bindestrich",
    "Erstelle Arbeitsvertrag für Hans-Peter Schmidt",
    {
      intentType: 'create_document',
      extractedData: { first_name: 'Hans-Peter', last_name: 'Schmidt' },
    }
  ),

  testCase(
    "Adelsname (von)",
    "Arbeitsvertrag für Maria von Trapp",
    {
      intentType: 'create_document',
      extractedData: { full_name: 'Maria von Trapp' },
    }
  ),

  testCase(
    "Niederländischer Name (van)",
    "Neuer Vertrag für Jan van der Berg",
    {
      intentType: 'create_document',
    }
  ),

  // Mit Position
  testCase(
    "Mit Position (als)",
    "Erstelle Arbeitsvertrag für Lisa Braun als Senior Developer",
    {
      intentType: 'create_document',
      extractedData: { position: 'Senior Developer' },
    }
  ),

  testCase(
    "Mit Position und Abteilung",
    "Arbeitsvertrag für Tom Fischer als Projektmanager in der Abteilung IT",
    {
      intentType: 'create_document',
      extractedData: { position: 'Projektmanager', department: 'IT' },
    }
  ),

  // Mit Datum
  testCase(
    "Mit Startdatum (dd.mm.yyyy)",
    "Erstelle Arbeitsvertrag für Klaus Meier ab 01.03.2024",
    {
      intentType: 'create_document',
      extractedData: { start_date: '01.03.2024' },
    }
  ),

  testCase(
    "Mit Startdatum (Monat ausgeschrieben)",
    "Neuer Vertrag ab 15. März 2024",
    {
      intentType: 'create_document',
      extractedData: { start_date: '15. März 2024' },
    }
  ),

  // Mit Arbeitszeit
  testCase(
    "Vollzeit mit Stunden",
    "Arbeitsvertrag für Sarah Klein, 40 Stunden pro Woche",
    {
      intentType: 'create_document',
      extractedData: { working_hours: 40 },
    }
  ),

  testCase(
    "Teilzeit",
    "Erstelle Teilzeit-Arbeitsvertrag für Emma Schulz, 20h",
    {
      intentType: 'create_document',
      extractedData: { working_hours: 20 },
    }
  ),

  // Mit Urlaub und Probezeit
  testCase(
    "Mit Urlaubstagen",
    "Arbeitsvertrag mit 30 Tage Urlaub",
    {
      intentType: 'create_document',
      extractedData: { vacation_days: 30 },
    }
  ),

  testCase(
    "Mit Probezeit",
    "Neuer Vertrag mit Probezeit 6 Monate",
    {
      intentType: 'create_document',
      extractedData: { probation_months: 6 },
    }
  ),

  // Komplexe Kombination
  testCase(
    "Vollständige Anfrage",
    "Erstelle einen Arbeitsvertrag für Max Müller als Software Engineer in der Abteilung Development, 5500€ Gehalt, ab 01.04.2024, 40 Stunden, 30 Tage Urlaub",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Vollzeit',
      extractedData: {
        first_name: 'Max',
        last_name: 'Müller',
        position: 'Software Engineer',
        department: 'Development',
        salary: 5500,
        start_date: '01.04.2024',
        working_hours: 40,
        vacation_days: 30,
      },
    }
  ),

  // =========================================================================
  // KÜNDIGUNG
  // =========================================================================

  testCase(
    "Einfache Kündigung",
    "Erstelle eine Kündigung",
    {
      intentType: 'create_document',
      documentType: 'Kündigung',
    }
  ),

  testCase(
    "Kündigung für Mitarbeiter",
    "Kündigung für Mitarbeiter Hans Weber",
    {
      intentType: 'create_document',
      documentType: 'Kündigung',
      extractedData: { first_name: 'Hans', last_name: 'Weber' },
    }
  ),

  testCase(
    "Kündigung mit Datum",
    "Erstelle Kündigung ab 31.03.2024",
    {
      intentType: 'create_document',
      documentType: 'Kündigung',
    }
  ),

  // =========================================================================
  // ARBEITSZEUGNIS
  // =========================================================================

  testCase(
    "Einfaches Zeugnis",
    "Erstelle ein Arbeitszeugnis",
    {
      intentType: 'create_document',
      documentType: 'Arbeitszeugnis Qualifiziert',
    }
  ),

  testCase(
    "Zeugnis für Mitarbeiter",
    "Arbeitszeugnis für Frau Maria Schneider",
    {
      intentType: 'create_document',
      documentType: 'Arbeitszeugnis Qualifiziert',
      extractedData: { full_name: 'Maria Schneider' },
    }
  ),

  testCase(
    "Zeugnis mit Position",
    "Erstelle Zeugnis für Klaus Fischer als Abteilungsleiter",
    {
      intentType: 'create_document',
      documentType: 'Arbeitszeugnis Qualifiziert',
      extractedData: { position: 'Abteilungsleiter' },
    }
  ),

  // =========================================================================
  // ANDERE DOKUMENTTYPEN
  // =========================================================================

  testCase(
    "Homeoffice-Vereinbarung",
    "Erstelle eine Homeoffice-Vereinbarung für Lisa Bauer",
    {
      intentType: 'create_document',
      documentType: 'Homeoffice-Vereinbarung',
    }
  ),

  testCase(
    "Firmenwagen Vertrag",
    "Neuer Firmenwagen-Vertrag für Herrn Thomas Lang",
    {
      intentType: 'create_document',
      documentType: 'Firmenwagen-Vereinbarung',
    }
  ),

  testCase(
    "Bonusvereinbarung",
    "Erstelle eine Bonusvereinbarung mit 5000€ Prämie",
    {
      intentType: 'create_document',
      documentType: 'Bonusvereinbarung',
      extractedData: { salary: 5000 },
    }
  ),

  testCase(
    "Abmahnung",
    "Erstelle eine Abmahnung für Mitarbeiter Peter Schulz",
    {
      intentType: 'create_document',
      documentType: 'Abmahnung',
    }
  ),

  testCase(
    "NDA / Geheimhaltung",
    "Neue Geheimhaltungsvereinbarung erstellen",
    {
      intentType: 'create_document',
      documentType: 'Verschwiegenheitserklärung',
    }
  ),

  // =========================================================================
  // KONTAKTDATEN
  // =========================================================================

  testCase(
    "Mit E-Mail",
    "Arbeitsvertrag für Max Müller, max.mueller@firma.de",
    {
      intentType: 'create_document',
      extractedData: { email: 'max.mueller@firma.de' },
    }
  ),

  testCase(
    "Mit Telefonnummer",
    "Vertrag für Anna Schmidt, Tel: +49 170 1234567",
    {
      intentType: 'create_document',
      extractedData: { phone: '+491701234567' },
    }
  ),

  testCase(
    "Mit Adresse",
    "Arbeitsvertrag für Lisa Braun, Straße: Hauptstraße 15, 80331 München",
    {
      intentType: 'create_document',
      extractedData: {
        street: 'Hauptstraße 15',
        postal_code: '80331',
      },
    }
  ),

  // =========================================================================
  // ALTERNATIVE FORMULIERUNGEN
  // =========================================================================

  testCase(
    "Generiere statt Erstelle",
    "Generiere einen Arbeitsvertrag für Max Müller",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Vollzeit',
    }
  ),

  testCase(
    "Ich brauche...",
    "Ich brauche einen Arbeitsvertrag für den neuen Mitarbeiter Hans Weber",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Vollzeit',
    }
  ),

  testCase(
    "Mach mir...",
    "Mach mir bitte einen Arbeitsvertrag",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Vollzeit',
    }
  ),

  testCase(
    "Neuer Vertrag...",
    "Neuer Vertrag für Anna Müller",
    {
      intentType: 'create_document',
    }
  ),

  // =========================================================================
  // FELD AUSFÜLLEN (fill_field)
  // =========================================================================

  testCase(
    "Name ist...",
    "Name ist Max Müller",
    {
      intentType: 'fill_field',
    }
  ),

  testCase(
    "Gehalt ist...",
    "Gehalt ist 4500€",
    {
      intentType: 'fill_field',
      extractedData: { salary: 4500 },
    }
  ),

  testCase(
    "Nur Gehalt",
    "5000€",
    {
      intentType: 'fill_field',
      extractedData: { salary: 5000 },
    }
  ),

  // =========================================================================
  // SUCHE
  // =========================================================================

  testCase(
    "Suche nach...",
    "Suche nach Homeoffice-Textbausteine",
    {
      intentType: 'search',
    }
  ),

  testCase(
    "Finde...",
    "Finde alle Arbeitsverträge",
    {
      intentType: 'search',
    }
  ),

  testCase(
    "Zeige mir...",
    "Zeige mir die letzte Kündigung",
    {
      intentType: 'search',
    }
  ),

  // =========================================================================
  // EDGE CASES
  // =========================================================================

  testCase(
    "Leere Eingabe",
    "",
    {
      intentType: 'unknown',
      confidence: 0,
    }
  ),

  testCase(
    "Zu kurze Eingabe",
    "Hi",
    {
      intentType: 'unknown',
      confidence: 0,
    }
  ),

  testCase(
    "Unklare Anfrage",
    "Bitte helfen Sie mir",
    {
      intentType: 'unknown',
    }
  ),

  testCase(
    "Nur Zahlen",
    "12345",
    {
      intentType: 'unknown',
      extractedData: { postal_code: '12345' },
    }
  ),

  // =========================================================================
  // UMLAUTE UND SONDERZEICHEN
  // =========================================================================

  testCase(
    "Umlaute im Namen",
    "Erstelle Arbeitsvertrag für Jürgen Schröder",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Vollzeit',
    }
  ),

  testCase(
    "ß im Namen",
    "Vertrag für Herr Groß",
    {
      intentType: 'create_document',
    }
  ),

  testCase(
    "Kündigung ohne Umlaut",
    "Erstelle eine Kuendigung",
    {
      intentType: 'create_document',
      documentType: 'Kündigung',
    }
  ),

  // =========================================================================
  // ZUSÄTZLICHE EDGE CASES
  // =========================================================================

  testCase(
    "Mehrere Gehälter - nimmt erstes",
    "Arbeitsvertrag für Max Müller, 5000€ brutto, 4000€ netto",
    {
      intentType: 'create_document',
      extractedData: { salary: 5000 },
    }
  ),

  testCase(
    "Gehalt mit Punkt-Tausender",
    "Arbeitsvertrag mit 6.500€ Gehalt",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Vollzeit',
      extractedData: { salary: 6500 },
    }
  ),

  testCase(
    "Gehalt EUR statt €",
    "Arbeitsvertrag für Lisa Braun, 4800 EUR",
    {
      intentType: 'create_document',
      extractedData: { salary: 4800 },
    }
  ),

  testCase(
    "Name mit drei Teilen",
    "Vertrag für Anna Maria Schmidt",
    {
      intentType: 'create_document',
    }
  ),

  testCase(
    "Komplette Adresse inline",
    "Arbeitsvertrag für Max Müller, Straße: Musterstraße 42, 12345 Berlin",
    {
      intentType: 'create_document',
      extractedData: {
        postal_code: '12345',
      },
    }
  ),

  testCase(
    "Teilzeit explizit",
    "Erstelle einen Teilzeit-Arbeitsvertrag für Lisa Klein",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Teilzeit',  // Jetzt korrekt als Teilzeit erkannt
    }
  ),

  testCase(
    "Remote/Homeoffice Vereinbarung",
    "Neue Remote-Arbeitsvereinbarung für Peter Lang",
    {
      intentType: 'create_document',
      documentType: 'Homeoffice-Vereinbarung',
    }
  ),

  testCase(
    "NDA Englisch",
    "Create NDA for John Smith",
    {
      intentType: 'create_document',
      documentType: 'Verschwiegenheitserklärung',
    }
  ),

  testCase(
    "Befristeter Vertrag",
    "Erstelle einen befristeten Arbeitsvertrag für Maria Weber ab 01.06.2024",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Befristet',  // Jetzt korrekt als befristet erkannt
      extractedData: { start_date: '01.06.2024' },
    }
  ),

  testCase(
    "Position mit Senior/Junior",
    "Arbeitsvertrag für Tom Fischer als Junior Developer",
    {
      intentType: 'create_document',
      extractedData: { position: 'Junior Developer' },
    }
  ),

  testCase(
    "Deutsche Telefonnummer Format",
    "Vertrag für Max Müller, Telefon: 089 / 12345678",
    {
      intentType: 'create_document',
    }
  ),

  testCase(
    "Sehr langer Text - sollte trotzdem funktionieren",
    "Ich möchte bitte einen neuen Arbeitsvertrag erstellen für unseren neuen Mitarbeiter Hans Müller, der ab dem 01.04.2024 bei uns als Senior Software Engineer in der Abteilung Technology & Innovation anfangen wird. Das Gehalt beträgt 6500€ brutto pro Monat.",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Vollzeit',
      extractedData: {
        position: 'Senior Software Engineer',
        start_date: '01.04.2024',
        salary: 6500,
      },
    }
  ),

  // =========================================================================
  // NEUE FEATURES: JAHRESGEHALT, TEILZEIT, BEFRISTUNG, RELATIVE DATEN
  // =========================================================================

  testCase(
    "Jahresgehalt zu Monatsgehalt",
    "Arbeitsvertrag für Max Müller mit 60.000€ jährlich",
    {
      intentType: 'create_document',
      extractedData: { salary: 5000 },  // 60000 / 12
    }
  ),

  testCase(
    "Jahresgehalt k-Notation",
    "Vertrag für Anna Schmidt, 72k p.a.",
    {
      intentType: 'create_document',
      extractedData: { salary: 6000 },  // 72000 / 12
    }
  ),

  testCase(
    "Teilzeit explizit erkannt",
    "Erstelle einen Teilzeit-Arbeitsvertrag für Lisa Klein, 20 Stunden",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Teilzeit',
      extractedData: { working_hours: 20 },
    }
  ),

  testCase(
    "Befristeter Vertrag erkannt",
    "Erstelle einen befristeten Arbeitsvertrag für Maria Weber",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Befristet',  // Parser erkennt jetzt korrekt "befristet"
    }
  ),

  testCase(
    "Unbefristeter Vertrag erkannt",
    "Erstelle einen unbefristeten Arbeitsvertrag für Tom Fischer",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Vollzeit',
    }
  ),

  testCase(
    "Aufhebungsvertrag",
    "Erstelle einen Aufhebungsvertrag für Hans Müller",
    {
      intentType: 'create_document',
      documentType: 'Aufhebungsvertrag',
    }
  ),

  testCase(
    "Synonym: Einstellung",
    "Einstellung für Max Müller als Developer",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Vollzeit',
    }
  ),

  testCase(
    "Synonym: Trennung für Kündigung",
    "Trennungsvereinbarung für Lisa Schmidt",
    {
      intentType: 'create_document',
    }
  ),

  testCase(
    "Synonym: Mobiles Arbeiten",
    "Vereinbarung für mobiles Arbeiten für Peter Lang",
    {
      intentType: 'create_document',
    }
  ),

  // =========================================================================
  // PHASE 1: EINSTELLUNG & ONBOARDING
  // =========================================================================

  testCase(
    "Minijob-Vertrag",
    "Erstelle einen Minijob-Vertrag für Anna Müller, 520€",
    {
      intentType: 'create_document',
      documentType: 'Arbeitsvertrag Minijob',
      extractedData: { salary: 520 },
    }
  ),

  testCase(
    "Einstellungszusage",
    "Erstelle eine Einstellungszusage für Max Schmidt als Developer, 5500€",
    {
      intentType: 'create_document',
      documentType: 'Einstellungszusage',
      extractedData: { salary: 5500 },
    }
  ),

  testCase(
    "Absageschreiben",
    "Absage für Bewerber Thomas Klein",
    {
      intentType: 'create_document',
      documentType: 'Absageschreiben',
    }
  ),

  testCase(
    "Datenschutzverpflichtung",
    "Erstelle eine Datenschutzverpflichtung für Lisa Braun",
    {
      intentType: 'create_document',
      documentType: 'Verschwiegenheitserklärung',
    }
  ),

  // =========================================================================
  // PHASE 2: LAUFENDES ARBEITSVERHÄLTNIS
  // =========================================================================

  testCase(
    "Nachtrag zum Arbeitsvertrag",
    "Nachtrag zum Arbeitsvertrag vom 01.01.2023 für Max Müller",
    {
      intentType: 'create_document',
      documentType: 'Nachtrag zum Arbeitsvertrag',
      extractedData: { original_contract_date: '01.01.2023' },
    }
  ),

  testCase(
    "Gehaltserhöhung",
    "Gehaltserhöhungsschreiben für Anna Schmidt, neues Gehalt 6000€",
    {
      intentType: 'create_document',
      documentType: 'Gehaltserhöhungsschreiben',
      extractedData: { salary: 6000 },
    }
  ),

  testCase(
    "Beförderung",
    "Beförderungsschreiben für Tom Fischer als Senior Manager",
    {
      intentType: 'create_document',
      documentType: 'Beförderungsschreiben',
      extractedData: { position: 'Senior Manager' },
    }
  ),

  testCase(
    "Elternzeit-Bestätigung",
    "Elternzeit-Bestätigung für Lisa Braun von 01.03.2024 bis 28.02.2025",
    {
      intentType: 'create_document',
      documentType: 'Elternzeit-Bestätigung',
    }
  ),

  testCase(
    "Abmahnung mit Vorfall",
    "Abmahnung für Peter Weber wegen unentschuldigtem Fehlen am 15.03.2024",
    {
      intentType: 'create_document',
      documentType: 'Abmahnung',
      extractedData: { incident_date: '15.03.2024' },
    }
  ),

  testCase(
    "Fortbildungsvereinbarung",
    "Fortbildungsvereinbarung für Max Müller, Schulung: SAP Grundlagen",
    {
      intentType: 'create_document',
      documentType: 'Fortbildungsvereinbarung',
      extractedData: { training_description: 'SAP Grundlagen' },
    }
  ),

  // =========================================================================
  // PHASE 3: BEENDIGUNG
  // =========================================================================

  testCase(
    "Fristlose Kündigung",
    "Erstelle eine fristlose Kündigung für Hans Müller",
    {
      intentType: 'create_document',
      documentType: 'Fristlose Kündigung',
    }
  ),

  testCase(
    "Kündigungsbestätigung",
    "Kündigungsbestätigung für Anna Schmidt, Kündigung eingegangen am 15.02.2024",
    {
      intentType: 'create_document',
      documentType: 'Kündigungsbestätigung',
    }
  ),

  testCase(
    "Aufhebungsvertrag mit Abfindung",
    "Aufhebungsvertrag für Max Weber mit Abfindung 20.000€",
    {
      intentType: 'create_document',
      documentType: 'Aufhebungsvertrag',
      extractedData: { severance_amount: 20000 },
    }
  ),

  testCase(
    "Qualifiziertes Arbeitszeugnis",
    "Qualifiziertes Arbeitszeugnis für Lisa Müller, beschäftigt vom 01.01.2020 bis 31.12.2024",
    {
      intentType: 'create_document',
      documentType: 'Arbeitszeugnis Qualifiziert',
      extractedData: { employment_start: '01.01.2020', employment_end: '31.12.2024' },
    }
  ),

  testCase(
    "Zwischenzeugnis",
    "Zwischenzeugnis für Peter Schmidt als Projektleiter",
    {
      intentType: 'create_document',
      documentType: 'Zwischenzeugnis',
      extractedData: { position: 'Projektleiter' },
    }
  ),

  testCase(
    "Freistellung",
    "Freistellungserklärung für Hans Weber, bezahlte Freistellung ab 01.03.2024",
    {
      intentType: 'create_document',
      documentType: 'Freistellungserklärung',
    }
  ),

  // =========================================================================
  // SONSTIGE
  // =========================================================================

  testCase(
    "Arbeitszeitänderung",
    "Arbeitszeitänderung für Lisa Braun, neue Arbeitszeit 30 Stunden",
    {
      intentType: 'create_document',
      documentType: 'Arbeitszeitänderung',
      extractedData: { working_hours: 30 },
    }
  ),

  testCase(
    "Überstundenvereinbarung",
    "Überstundenvereinbarung für Max Müller mit 50 Überstunden",
    {
      intentType: 'create_document',
      documentType: 'Überstundenvereinbarung',
      extractedData: { overtime_hours: 50 },
    }
  ),
];

// =============================================================================
// RUN TESTS
// =============================================================================

console.log('\n' + '='.repeat(80));
console.log('INTENT PARSER TEST SUITE');
console.log('='.repeat(80) + '\n');

let passed = 0;
let failed = 0;

for (const test of testCases) {
  if (test.passed) {
    passed++;
    console.log(`✅ ${test.description}`);
  } else {
    failed++;
    console.log(`❌ ${test.description}`);
    console.log(`   Input: "${test.input}"`);
    for (const error of test.errors) {
      console.log(`   Error: ${error}`);
    }
    console.log(`   Full result:`, JSON.stringify(test.result, null, 2));
  }
}

console.log('\n' + '='.repeat(80));
console.log(`RESULTS: ${passed} passed, ${failed} failed (${Math.round(passed / (passed + failed) * 100)}%)`);
console.log('='.repeat(80) + '\n');

// Export for programmatic use
export const testResults = {
  passed,
  failed,
  total: passed + failed,
  successRate: passed / (passed + failed),
  cases: testCases,
};
