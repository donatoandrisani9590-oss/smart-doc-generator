import type { CategoryOption, CountryOption } from "./types";

export const CATEGORIES: CategoryOption[] = [
    // Arbeitsvertrag-Kategorien
    { value: "Einleitung", label: "Einleitung", description: "Allgemeine Einleitungstexte", group: "Arbeitsvertrag" },
    { value: "Vertragsbeginn", label: "Vertragsbeginn / Probezeit", description: "Beginn, Befristung, Probezeit", group: "Arbeitsvertrag" },
    { value: "Arbeitszeit", label: "Arbeitszeit", description: "Regelungen zur Arbeitszeit", group: "Arbeitsvertrag" },
    { value: "Vergütung", label: "Vergütung", description: "Gehalt und Zusatzleistungen", group: "Arbeitsvertrag" },
    { value: "Nebenleistungen", label: "Nebenleistungen", description: "Firmenwagen, Benefits, Zusatzleistungen", group: "Arbeitsvertrag" },
    { value: "Urlaub", label: "Urlaub", description: "Urlaubsregelungen", group: "Arbeitsvertrag" },
    { value: "Pflichten", label: "Pflichten / Verhinderung", description: "Nebenpflichten, Krankmeldung, Verhinderung", group: "Arbeitsvertrag" },
    { value: "Kündigung", label: "Kündigung", description: "Kündigungsfristen und -bedingungen", group: "Arbeitsvertrag" },
    { value: "Geheimhaltung", label: "Geheimhaltung", description: "Vertraulichkeits-Textbausteine", group: "Arbeitsvertrag" },
    { value: "Nebentätigkeit", label: "Nebentätigkeit", description: "Regelungen zu Nebentätigkeiten", group: "Arbeitsvertrag" },
    { value: "Wettbewerb", label: "Wettbewerb", description: "Wettbewerbsverbote", group: "Arbeitsvertrag" },
    { value: "Ausschlussfristen", label: "Ausschlussfristen", description: "Verfall-Textbausteine und Ausschlussfristen", group: "Arbeitsvertrag" },
    { value: "Schlussbestimmungen", label: "Schlussbestimmungen", description: "Salvatorische Klausel, Schriftform, Gerichtsstand", group: "Arbeitsvertrag" },
    // HR-Korrespondenz-Kategorien
    { value: "Einladung", label: "Einladung", description: "Einladungsschreiben", group: "HR-Korrespondenz" },
    { value: "Mitteilung", label: "Mitteilung", description: "Allgemeine Mitteilungen", group: "HR-Korrespondenz" },
    { value: "Fürsorge", label: "Fürsorge", description: "Fürsorgegespräche, BEM", group: "HR-Korrespondenz" },
    { value: "Abmahnung", label: "Abmahnung", description: "Abmahnungen und Verwarnungen", group: "HR-Korrespondenz" },
    { value: "Zeugnis", label: "Zeugnis", description: "Arbeitszeugnisse", group: "HR-Korrespondenz" },
    // Allgemein
    { value: "Sonstiges", label: "Sonstiges", description: "Weitere Textbausteine", group: "Allgemein" },
];

export const COUNTRIES: CountryOption[] = [
    { value: "DE", label: "Deutschland", flag: "\u{1F1E9}\u{1F1EA}" },
    { value: "IT", label: "Italien", flag: "\u{1F1EE}\u{1F1F9}" },
];
