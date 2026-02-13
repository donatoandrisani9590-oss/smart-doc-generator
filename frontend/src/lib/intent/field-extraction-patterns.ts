/**
 * Intent Parser - Field Extraction Patterns
 *
 * Alle Regex-Patterns für die Extraktion von Feldern aus natürlicher Sprache.
 */

// =============================================================================
// Extraction Patterns
// =============================================================================

export const PATTERNS = {
  // Namen: "Max Mueller", "Hans-Peter Schmidt", "Maria von Trapp", "O'Connor", "Jose Garcia"
  // Matcht: für/name/mitarbeiter + optionales Herr/Frau + Vorname + Nachname
  // Unterstützt: Apostrophe, Akzente, Bindestriche, Adelstitel
  // Stoppt bei: Komma, "als", "mit", Zahl, @, oder Ende
  fullName: /(?:für|name|mitarbeiter)\s*:?\s*(?:(?:herr|frau|herrn)\s+)?([A-ZÄÖÜÉÈÊËÁÀÂÃÅÇÑa-zäöüßéèêëáàâãåçñ][a-zäöüßéèêëáàâãåçñ']+(?:-[A-ZÄÖÜÉÈÊËÁÀÂÃÅÇÑa-zäöüßéèêëáàâãåçñ]?[a-zäöüßéèêëáàâãåçñ']+)*(?:\s+(?:von|van|de|der|zu|da|di|del|della))?\s+[A-ZÄÖÜÉÈÊËÁÀÂÃÅÇÑa-zäöüßéèêëáàâãåçñ][a-zäöüßéèêëáàâãåçñ']+(?:-[A-ZÄÖÜÉÈÊËÁÀÂÃÅÇÑa-zäöüßéèêëáàâãåçñ]?[a-zäöüßéèêëáàâãåçñ']+)*)(?:\s*(?:,|als|mit|in\s+der|ab\s+|\d|@)|$)/i,

  // Herr/Frau Präfix separat für bessere Erkennung (mit erweiterten Zeichen)
  nameWithTitle: /(?:herr|frau|herrn)\s+([A-ZÄÖÜÉÈÊËÁÀÂÃÅÇÑa-zäöüßéèêëáàâãåçñ][a-zäöüßéèêëáàâãåçñ']+(?:-[A-ZÄÖÜÉÈÊËÁÀÂÃÅÇÑa-zäöüßéèêëáàâãåçñ]?[a-zäöüßéèêëáàâãåçñ']+)*(?:\s+(?:von|van|de|der|zu|da|di|del|della))?\s+[A-ZÄÖÜÉÈÊËÁÀÂÃÅÇÑa-zäöüßéèêëáàâãåçñ][a-zäöüßéèêëáàâãåçñ']+(?:-[A-ZÄÖÜÉÈÊËÁÀÂÃÅÇÑa-zäöüßéèêëáàâãåçñ]?[a-zäöüßéèêëáàâãåçñ']+)*)/i,

  // Vorname/Nachname separat
  firstName: /(?:vorname|first\s*name)\s*:?\s*([A-ZÄÖÜ][a-zäöüß]+)/i,
  lastName: /(?:nachname|last\s*name|familienname)\s*:?\s*([A-ZÄÖÜ][a-zäöüß]+)/i,

  // Gehalt: "5000EUR", "5.000 Euro", "4500 EUR", "3,5k", "3.5k", "5000 EUR" (mit Leerzeichen)
  // Verbessert: k-Notation, Tausender-Trennzeichen, optionales Leerzeichen vor Währung
  salary: /(\d{1,3}(?:[.,]\d{3})*|\d+[.,]?\d*)\s*(?:€|euro|eur|k)(?:\s|,|$)/i,
  salaryWithSpace: /(\d{1,3}(?:[.,]\d{3})*|\d+[.,]?\d*)\s+(?:€|euro|eur)(?:\s|,|$)/i,
  salaryK: /(\d+[.,]?\d*)\s*k(?:\s|,|$)/i,

  // Position: "als Manager", "Position: Entwickler"
  // WICHTIG: Nur nach explizitem "als" oder "Position:", nicht nach Namen
  position: /(?:position|stelle|job|rolle)\s*:?\s*([A-ZÄÖÜa-zäöüß][\w\s-]{2,30}?)(?=\s*(?:,|in|bei|mit|\.|$))/i,
  positionAls: /\s+als\s+([A-ZÄÖÜa-zäöüß][\w\s-]{2,35}?)(?=\s*(?:,|in\s+der|bei|mit|\.|$|\d))/i,

  // Abteilung - verbessert für "in der Abteilung X" und "Abteilung: X"
  department: /(?:in\s+der\s+)?(?:abteilung|department|bereich)\s*:?\s*([A-ZÄÖÜa-zäöüß][\w\s-]{1,25}?)(?=\s*(?:,|\.|$|\d))/i,

  // Startdatum: "ab 01.03.2024", "ab dem 01.03.2024", "Start: März 2024", "01-03-2024"
  // Unterstützt: Punkt, Schrägstrich, Bindestrich als Trennzeichen
  startDate: /(?:ab(?:\s+dem)?|start|beginn|von|seit|zum)\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}\.\s*(?:januar|februar|m[aä]rz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*\d{4})/i,

  // Relative Datumsangaben: "nächsten Montag", "in 2 Wochen", "ab sofort"
  relativeDateKeywords: /(?:ab\s+)?(?:sofort|nächste[rn]?\s+(?:montag|dienstag|mittwoch|donnerstag|freitag|monat|woche)|in\s+\d+\s+(?:tagen?|wochen?|monaten?))/i,

  // Jahresgehalt erkennen: "60.000EUR jährlich", "60k p.a.", "Jahresgehalt 72.000"
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

  // Enddatum: "bis 31.12.2024", "Ende: 30.06.2025", "befristet bis", "31-12-2024"
  // Unterstützt: Punkt, Schrägstrich, Bindestrich als Trennzeichen
  endDate: /(?:bis(?:\s+zum)?|ende|endet|befristet\s+bis|auslaufen)\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}\.\s*(?:januar|februar|m[aä]rz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*\d{4})/i,

  // Kündigungsfrist: "mit einer Frist von 4 Wochen", "Kündigungsfrist 3 Monate"
  noticePeriod: /(?:kündigungsfrist|frist\s+von)\s*:?\s*(\d+)\s*(wochen?|monate?|tage?)/i,

  // Abfindung: "Abfindung 20.000EUR", "Abfindungssumme von 3 Monatsgehältern"
  severance: /(?:abfindung|abfindungssumme|ausgleich)\s*:?\s*(?:von\s+)?(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(?:€|euro|monatsgehälter?|gehälter?)?/i,

  // Bonus/Prämie: "Bonus von 5000EUR", "Prämie: 10%"
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
