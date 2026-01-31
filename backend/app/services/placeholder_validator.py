"""
Placeholder validation service for clause content.

Validates that placeholders used in clause HTML match known system placeholders
and suggests corrections for typos using Levenshtein distance.
"""

import re
from typing import List, Optional
from dataclasses import dataclass


@dataclass
class PlaceholderInfo:
    """Information about a known placeholder."""
    name: str
    label: str
    type: str  # text, date, currency, number, select, boolean
    category: str
    example_value: Optional[str] = None


@dataclass
class PlaceholderValidationResult:
    """Result of placeholder validation."""
    is_valid: bool
    unknown_placeholders: List[dict]  # [{name, suggestions, line_position}]
    known_placeholders_used: List[str]


# All known system placeholders
KNOWN_PLACEHOLDERS: List[PlaceholderInfo] = [
    # Mitarbeiterdaten
    PlaceholderInfo("mitarbeiter_vorname", "Vorname", "text", "Mitarbeiter", "Max"),
    PlaceholderInfo("mitarbeiter_nachname", "Nachname", "text", "Mitarbeiter", "Müller"),
    PlaceholderInfo("mitarbeiter_name", "Voller Name", "text", "Mitarbeiter", "Max Müller"),
    PlaceholderInfo("mitarbeiter_adresse", "Adresse", "text", "Mitarbeiter", "Musterstraße 1, 80333 München"),
    PlaceholderInfo("mitarbeiter_geburtsdatum", "Geburtsdatum", "date", "Mitarbeiter", "01.01.1990"),
    PlaceholderInfo("mitarbeiter_anrede", "Anrede", "text", "Mitarbeiter", "Herr"),
    PlaceholderInfo("mitarbeiter_titel", "Titel", "text", "Mitarbeiter", "Dr."),
    PlaceholderInfo("personalnummer", "Personalnummer", "text", "Mitarbeiter", "P-1001"),

    # Vertragsdaten
    PlaceholderInfo("eintrittsdatum", "Eintrittsdatum", "date", "Vertrag", "01.03.2025"),
    PlaceholderInfo("austrittsdatum", "Austrittsdatum", "date", "Vertrag", "31.12.2025"),
    PlaceholderInfo("position", "Position/Stelle", "text", "Vertrag", "Senior Manager"),
    PlaceholderInfo("abteilung", "Abteilung", "text", "Vertrag", "Marketing"),
    PlaceholderInfo("arbeitsort", "Arbeitsort", "text", "Vertrag", "München"),
    PlaceholderInfo("wochenstunden", "Wochenstunden", "number", "Vertrag", "40"),
    PlaceholderInfo("probezeit_monate", "Probezeit (Monate)", "number", "Vertrag", "6"),
    PlaceholderInfo("probezeit_ende", "Probezeit-Ende", "date", "Vertrag", "31.08.2025"),
    PlaceholderInfo("befristung_bis", "Befristung bis", "date", "Vertrag", "31.12.2026"),
    PlaceholderInfo("kuendigungsfrist", "Kündigungsfrist", "text", "Vertrag", "4 Wochen zum Monatsende"),
    PlaceholderInfo("tarifvertrag", "Tarifvertrag", "text", "Vertrag", "TVöD"),
    PlaceholderInfo("entgeltgruppe", "Entgeltgruppe", "text", "Vertrag", "E13"),

    # Vergütung
    PlaceholderInfo("gehalt_brutto", "Bruttogehalt (jährlich)", "currency", "Vergütung", "55.000 €"),
    PlaceholderInfo("gehalt_brutto_monat", "Bruttogehalt (monatlich)", "currency", "Vergütung", "4.583,33 €"),
    PlaceholderInfo("gehalt_netto", "Nettogehalt (ca.)", "currency", "Vergütung", "2.800 €"),
    PlaceholderInfo("bonus_hoehe", "Bonushöhe", "currency", "Vergütung", "5.000 €"),
    PlaceholderInfo("bonus_prozent", "Bonus in Prozent", "number", "Vergütung", "10"),
    PlaceholderInfo("urlaubstage", "Urlaubstage", "number", "Vergütung", "30"),
    PlaceholderInfo("sonderzahlung", "Sonderzahlung", "currency", "Vergütung", "1.000 €"),
    PlaceholderInfo("altes_gehalt", "Altes Gehalt", "currency", "Vergütung", "50.000 €"),
    PlaceholderInfo("neues_gehalt", "Neues Gehalt", "currency", "Vergütung", "55.000 €"),
    PlaceholderInfo("gehaltsanpassung_prozent", "Gehaltsanpassung %", "number", "Vergütung", "10"),
    PlaceholderInfo("gueltig_ab", "Gültig ab", "date", "Vergütung", "01.04.2025"),

    # Benefits
    PlaceholderInfo("firmenwagen", "Firmenwagen (ja/nein)", "boolean", "Benefits", "ja"),
    PlaceholderInfo("firmenwagen_kategorie", "Firmenwagen Kategorie", "select", "Benefits", "Mittelklasse"),
    PlaceholderInfo("firmenwagen_modell", "Firmenwagen Modell", "text", "Benefits", "BMW 3er"),
    PlaceholderInfo("homeoffice", "Homeoffice (ja/nein)", "boolean", "Benefits", "ja"),
    PlaceholderInfo("homeoffice_tage", "Homeoffice Tage/Woche", "number", "Benefits", "2"),
    PlaceholderInfo("jobticket", "Jobticket (ja/nein)", "boolean", "Benefits", "ja"),
    PlaceholderInfo("betriebliche_altersvorsorge", "Betriebliche Altersvorsorge", "boolean", "Benefits", "ja"),
    PlaceholderInfo("bav_beitrag", "BAV Arbeitgeberbeitrag", "currency", "Benefits", "100 €"),

    # Unternehmensdaten
    PlaceholderInfo("firma_name", "Firmenname", "text", "Unternehmen", "Niederwieser GmbH"),
    PlaceholderInfo("firma_adresse", "Firmenadresse", "text", "Unternehmen", "Musterstraße 123, 80333 München"),
    PlaceholderInfo("firma_plz", "Firmen-PLZ", "text", "Unternehmen", "80333"),
    PlaceholderInfo("firma_ort", "Firmen-Ort", "text", "Unternehmen", "München"),
    PlaceholderInfo("geschaeftsfuehrer", "Geschäftsführer", "text", "Unternehmen", "Hans Niederwieser"),
    PlaceholderInfo("handelsregister", "Handelsregister", "text", "Unternehmen", "HRB 12345, AG München"),

    # Dokument/Unterschrift
    PlaceholderInfo("datum_heute", "Heutiges Datum", "date", "Dokument", "24.01.2025"),
    PlaceholderInfo("ort_unterschrift", "Ort der Unterschrift", "text", "Dokument", "München"),
    PlaceholderInfo("aktuelles_jahr", "Aktuelles Jahr", "text", "Dokument", "2025"),

    # Zeugnis-spezifisch
    PlaceholderInfo("zeugnis_art", "Zeugnisart", "select", "Zeugnis", "qualifiziertes Arbeitszeugnis"),
    PlaceholderInfo("beschaeftigung_von", "Beschäftigung von", "date", "Zeugnis", "01.01.2020"),
    PlaceholderInfo("beschaeftigung_bis", "Beschäftigung bis", "date", "Zeugnis", "31.12.2024"),
    PlaceholderInfo("aufgabenbeschreibung", "Aufgabenbeschreibung", "text", "Zeugnis", "Leitung des Marketing-Teams"),
    PlaceholderInfo("bewertung_leistung", "Leistungsbewertung", "text", "Zeugnis", "stets zu unserer vollsten Zufriedenheit"),
    PlaceholderInfo("bewertung_verhalten", "Verhaltensbewertung", "text", "Zeugnis", "war stets vorbildlich"),

    # Kündigung-spezifisch
    PlaceholderInfo("kuendigung_grund", "Kündigungsgrund", "text", "Kündigung", "betriebsbedingt"),
    PlaceholderInfo("letzter_arbeitstag", "Letzter Arbeitstag", "date", "Kündigung", "31.03.2025"),
    PlaceholderInfo("freistellung_ab", "Freistellung ab", "date", "Kündigung", "01.03.2025"),
    PlaceholderInfo("resturlaub_tage", "Resturlaub (Tage)", "number", "Kündigung", "5"),
    PlaceholderInfo("abfindung", "Abfindung", "currency", "Kündigung", "10.000 €"),
]

# Build a lookup dict for fast access
PLACEHOLDER_LOOKUP = {p.name: p for p in KNOWN_PLACEHOLDERS}
PLACEHOLDER_NAMES = set(PLACEHOLDER_LOOKUP.keys())


def levenshtein_distance(s1: str, s2: str) -> int:
    """Calculate the Levenshtein distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def find_similar_placeholders(unknown: str, max_suggestions: int = 3, max_distance: int = 4) -> List[str]:
    """Find placeholders similar to the unknown one based on Levenshtein distance."""
    suggestions = []
    for known in PLACEHOLDER_NAMES:
        distance = levenshtein_distance(unknown.lower(), known.lower())
        if distance <= max_distance:
            suggestions.append((known, distance))

    # Sort by distance (closest first)
    suggestions.sort(key=lambda x: x[1])
    return [s[0] for s in suggestions[:max_suggestions]]


def extract_placeholders_from_html(html_content: str) -> List[str]:
    """Extract all placeholder names from HTML content."""
    # Match {{ placeholder_name }} with optional whitespace
    pattern = r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}'
    matches = re.findall(pattern, html_content)
    return list(set(matches))  # Remove duplicates


def validate_placeholders(html_content: str) -> PlaceholderValidationResult:
    """
    Validate all placeholders in the HTML content.

    Returns a validation result containing:
    - is_valid: True if all placeholders are known
    - unknown_placeholders: List of unknown placeholders with suggestions
    - known_placeholders_used: List of valid placeholder names used
    """
    found_placeholders = extract_placeholders_from_html(html_content)

    unknown_placeholders = []
    known_placeholders_used = []

    for placeholder in found_placeholders:
        if placeholder in PLACEHOLDER_NAMES:
            known_placeholders_used.append(placeholder)
        else:
            suggestions = find_similar_placeholders(placeholder)
            unknown_placeholders.append({
                "name": placeholder,
                "suggestions": suggestions,
                "suggestion_labels": [
                    f"{s} ({PLACEHOLDER_LOOKUP[s].label})" for s in suggestions
                ] if suggestions else []
            })

    return PlaceholderValidationResult(
        is_valid=len(unknown_placeholders) == 0,
        unknown_placeholders=unknown_placeholders,
        known_placeholders_used=known_placeholders_used
    )


def get_all_placeholders() -> List[dict]:
    """Get all known placeholders as a list of dicts for API response."""
    return [
        {
            "name": p.name,
            "label": p.label,
            "type": p.type,
            "category": p.category,
            "example_value": p.example_value
        }
        for p in KNOWN_PLACEHOLDERS
    ]


def get_placeholders_by_category() -> dict:
    """Get all placeholders grouped by category."""
    result = {}
    for p in KNOWN_PLACEHOLDERS:
        if p.category not in result:
            result[p.category] = []
        result[p.category].append({
            "name": p.name,
            "label": p.label,
            "type": p.type,
            "example_value": p.example_value
        })
    return result
