"""
Smart Document Generator - Document Texts Service
==================================================
Lädt und verwaltet lokalisierte Dokumententexte aus externer JSON-Datei.
Ermöglicht das Hinzufügen neuer Sprachen ohne Code-Deployment.

v3.1 Update: Dokumententexte aus storage/config/document-texts.json
"""

import json
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

# Pfade
BASE_DIR = Path(__file__).parent.parent.parent
CONFIG_DIR = BASE_DIR / "storage" / "config"
DOCUMENT_TEXTS_FILE = CONFIG_DIR / "document-texts.json"

# Cache
_document_texts_cache: Optional[Dict[str, Any]] = None


def _load_document_texts() -> Dict[str, Any]:
    """
    Lädt die Dokumententexte aus der JSON-Datei.
    Verwendet Caching für Performance.

    Returns:
        Dictionary mit allen Dokumententexten

    Raises:
        HTTPException: Wenn Konfiguration nicht geladen werden kann
    """
    global _document_texts_cache

    if _document_texts_cache is not None:
        return _document_texts_cache

    if not DOCUMENT_TEXTS_FILE.exists():
        logger.warning(f"Document texts config not found: {DOCUMENT_TEXTS_FILE}")
        # Return hardcoded fallback
        return _get_fallback_texts()

    try:
        with open(DOCUMENT_TEXTS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        _document_texts_cache = data.get("document_texts", {})
        return _document_texts_cache
    except json.JSONDecodeError as e:
        logger.error(f"Invalid document texts config: {e}")
        return _get_fallback_texts()


def _get_fallback_texts() -> Dict[str, Any]:
    """Fallback texts in case config file is missing."""
    return {
        "DE": {
            "title": "Arbeitsvertrag",
            "between": "Zwischen",
            "and": "und",
            "employer_label": '– nachstehend "Arbeitgeber" genannt –',
            "employee_label": '– nachstehend "Arbeitnehmer" genannt –',
            "employee_prefix": "Herr/Frau",
            "signature_location": "Sulzberg",
            "date_placeholder": "______________",
        },
        "IT": {
            "title": "CONTRATTO DI LAVORO",
            "between": "Tra",
            "and": "e",
            "employer_label": '– di seguito denominato "Datore di Lavoro" –',
            "employee_label": '– di seguito denominato "Lavoratore/Lavoratrice" –',
            "employee_prefix": "Sig./Sig.ra",
            "signature_location": "Laives",
            "date_placeholder": "______________",
        }
    }


def reload_document_texts() -> Dict[str, Any]:
    """
    Erzwingt das Neuladen der Dokumententexte.

    Returns:
        Neu geladene Texte
    """
    global _document_texts_cache
    _document_texts_cache = None
    return _load_document_texts()


def get_document_texts(country_code: str) -> Dict[str, str]:
    """
    Gibt alle Dokumententexte für ein Land zurück.

    Args:
        country_code: ISO 3166-1 alpha-2 Code (z.B. "DE", "IT")

    Returns:
        Dictionary mit allen Texten für das Land

    Raises:
        HTTPException: Wenn Land nicht konfiguriert
    """
    texts = _load_document_texts()
    country_texts = texts.get(country_code.upper())

    if not country_texts:
        # Fallback auf DE
        logger.warning(f"No document texts for {country_code}, using DE fallback")
        country_texts = texts.get("DE", _get_fallback_texts()["DE"])

    return country_texts


def get_document_text(country_code: str, key: str, default: Optional[str] = None) -> str:
    """
    Gibt einen einzelnen Dokumententext zurück.

    Args:
        country_code: Ländercode
        key: Textschlüssel (z.B. "title", "between")
        default: Fallback-Wert wenn nicht gefunden

    Returns:
        Lokalisierter Text oder default
    """
    texts = get_document_texts(country_code)
    return texts.get(key, default or f"[{key}]")


def get_signature_location(country_code: str, location_code: Optional[str] = None) -> str:
    """
    Gibt die Signatur-Ortsangabe zurück.

    Args:
        country_code: Ländercode
        location_code: Optional spezifischer Standort-Code

    Returns:
        Ortsname für Signatur (z.B. "Sulzberg", "Laives")
    """
    # Wenn Standort-Code angegeben, versuche aus DB zu laden
    if location_code:
        try:
            from app.db import async_session_factory
            from app.models.core import Location
            from sqlalchemy import select
            import asyncio

            async def get_location_city():
                async with async_session_factory() as session:
                    result = await session.execute(
                        select(Location).where(Location.code == location_code.upper())
                    )
                    loc = result.scalar_one_or_none()
                    return loc.signature_city or loc.city if loc else None

            # Run async in sync context
            city = asyncio.run(get_location_city())
            if city:
                return city
        except Exception as e:
            logger.warning(f"Could not get location {location_code}: {e}")

    # Fallback auf Dokumententexte
    return get_document_text(country_code, "signature_location", "")


def get_all_document_texts() -> Dict[str, Dict[str, str]]:
    """
    Gibt alle Dokumententexte für alle Länder zurück.

    Returns:
        Dictionary mit country_code -> texts
    """
    return _load_document_texts()


def get_supported_document_text_countries() -> list[str]:
    """
    Gibt alle Ländercodes mit konfigurierten Dokumententexten zurück.

    Returns:
        Liste von Ländercodes
    """
    texts = _load_document_texts()
    return list(texts.keys())


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTION - Backwards Compatibility
# ═══════════════════════════════════════════════════════════════════════════════

def get_document_text_dict() -> Dict[str, Dict[str, str]]:
    """
    Backwards compatibility: Returns DOCUMENT_TEXT-like dictionary.

    Can be used as drop-in replacement for the old hardcoded DOCUMENT_TEXT.
    """
    return get_all_document_texts()


# Alias for import compatibility
DOCUMENT_TEXT = property(lambda self: get_document_text_dict())
