"""
Onboarding Package Definitions — predefined document bundles.

Each package maps to a set of DocumentType names and shared fields
that are auto-populated across all documents in the package.
"""
from typing import Dict, List, Any

# Package key → definition
ONBOARDING_PACKAGES: Dict[str, Dict[str, Any]] = {
    "onboarding": {
        "name": "Onboarding",
        "description": "Neuen Mitarbeiter einstellen",
        "document_types": ["Arbeitsvertrag", "Verschwiegenheit", "Homeoffice"],
        "shared_fields": [
            "vorname", "nachname", "position", "gehalt", "eintrittsdatum",
            "strasse", "plz", "ort", "geburtsdatum",
        ],
    },
    "kuendigung": {
        "name": "Kündigung",
        "description": "Mitarbeiter kündigen",
        "document_types": ["Kündigung", "Freistellung", "Zeugnis"],
        "shared_fields": [
            "vorname", "nachname", "position",
            "strasse", "plz", "ort",
        ],
    },
    "befoerderung": {
        "name": "Beförderung",
        "description": "Mitarbeiter befördern",
        "document_types": ["Beförderung", "Gehaltserhöhung", "Nachtrag"],
        "shared_fields": [
            "vorname", "nachname", "position",
        ],
    },
}

# Keywords that trigger package detection from user input
PACKAGE_KEYWORDS: Dict[str, List[str]] = {
    "onboarding": ["onboarding", "einstellen", "einstellung", "neuer mitarbeiter", "neue mitarbeiterin", "neueinstellung"],
    "kuendigung": ["kündigung", "kündigen", "entlassen", "entlassung", "trennung"],
    "befoerderung": ["beförderung", "befördern", "aufstieg", "promotion"],
}


def detect_package_from_text(text: str) -> str | None:
    """Detect package key from user message text. Returns None if no match."""
    text_lower = text.lower()
    for key, keywords in PACKAGE_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return key
    return None


def get_package(key: str) -> Dict[str, Any] | None:
    """Get package definition by key."""
    return ONBOARDING_PACKAGES.get(key)
