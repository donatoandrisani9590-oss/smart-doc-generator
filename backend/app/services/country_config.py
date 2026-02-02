"""
Smart Document Generator - Country Configuration Service
========================================================
Lädt und verwaltet Länderkonfigurationen aus externer JSON-Datei.
Ermöglicht das Hinzufügen neuer Länder ohne Code-Deployment.

v3.1 Update: Länderkonfiguration aus storage/config/countries.json
"""

import json
from pathlib import Path
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from fastapi import HTTPException

# Pfade
BASE_DIR = Path(__file__).parent.parent.parent
CONFIG_DIR = BASE_DIR / "storage" / "config"
COUNTRIES_CONFIG_FILE = CONFIG_DIR / "countries.json"


class LegalStandards(BaseModel):
    """Rechtliche Standards eines Landes."""
    document_standard: str = Field(..., description="Dokumentenstandard (z.B. DIN 5008)")
    labor_law: str = Field(..., description="Arbeitsrechtsgrundlagen")


class CountryConfig(BaseModel):
    """Konfiguration für ein Land."""
    code: str = Field(..., pattern="^[A-Z]{2}$", description="ISO 3166-1 alpha-2 Code")
    name: str = Field(..., description="Name in Deutsch")
    name_en: str = Field(..., description="Name in Englisch")
    name_local: str = Field(..., description="Name in Landessprache")
    flag: str = Field(..., description="Flaggen-Emoji")
    currency: str = Field(..., pattern="^[A-Z]{3}$", description="ISO 4217 Währungscode")
    locale: str = Field(..., description="BCP 47 Locale Tag")
    date_format: str = Field(..., description="Datumsformat")
    legal_standards: LegalStandards = Field(..., description="Rechtliche Standards")
    month_names: List[str] = Field(..., min_length=12, max_length=12, description="Monatsnamen")
    is_active: bool = Field(True, description="Land ist aktiviert")
    sort_order: int = Field(0, description="Sortierreihenfolge")

    class Config:
        from_attributes = True


class CountriesConfig(BaseModel):
    """Gesamtkonfiguration aller Länder."""
    countries: Dict[str, CountryConfig]
    default_country: str = Field(..., pattern="^[A-Z]{2}$")


# Cache
_countries_config_cache: Optional[CountriesConfig] = None


def _load_countries_config() -> CountriesConfig:
    """
    Lädt die Länderkonfiguration aus der JSON-Datei.
    Verwendet Caching für Performance.

    Returns:
        CountriesConfig Objekt

    Raises:
        HTTPException: Wenn Konfiguration nicht geladen werden kann
    """
    global _countries_config_cache

    if _countries_config_cache is not None:
        return _countries_config_cache

    if not COUNTRIES_CONFIG_FILE.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Länderkonfiguration nicht gefunden: {COUNTRIES_CONFIG_FILE}"
        )

    try:
        with open(COUNTRIES_CONFIG_FILE, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        # Entferne Meta-Felder vor Pydantic-Validierung
        countries_data = {}
        for code, country_info in raw_data.get("countries", {}).items():
            countries_data[code] = CountryConfig(**country_info)

        _countries_config_cache = CountriesConfig(
            countries=countries_data,
            default_country=raw_data.get("default_country", "DE")
        )
        return _countries_config_cache
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ungültige Länderkonfiguration: {e}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Laden der Länderkonfiguration: {e}"
        )


def reload_countries_config() -> CountriesConfig:
    """
    Erzwingt das Neuladen der Länderkonfiguration.

    Returns:
        Neu geladene Konfiguration
    """
    global _countries_config_cache
    _countries_config_cache = None
    return _load_countries_config()


def get_all_countries(active_only: bool = True) -> List[CountryConfig]:
    """
    Gibt alle Länder zurück, sortiert nach sort_order.

    Args:
        active_only: Nur aktive Länder zurückgeben

    Returns:
        Liste von CountryConfig Objekten
    """
    config = _load_countries_config()
    countries = list(config.countries.values())

    if active_only:
        countries = [c for c in countries if c.is_active]

    return sorted(countries, key=lambda x: x.sort_order)


def get_country(country_code: str) -> CountryConfig:
    """
    Gibt die Konfiguration für ein bestimmtes Land zurück.

    Args:
        country_code: ISO 3166-1 alpha-2 Code (z.B. "DE")

    Returns:
        CountryConfig Objekt

    Raises:
        HTTPException: Wenn Land nicht gefunden
    """
    config = _load_countries_config()
    country = config.countries.get(country_code.upper())

    if not country:
        raise HTTPException(
            status_code=404,
            detail=f"Land '{country_code}' nicht konfiguriert"
        )

    return country


def get_country_codes(active_only: bool = True) -> List[str]:
    """
    Gibt alle Ländercodes zurück.

    Args:
        active_only: Nur aktive Länder

    Returns:
        Liste von Ländercodes
    """
    countries = get_all_countries(active_only=active_only)
    return [c.code for c in countries]


def get_default_country() -> str:
    """
    Gibt den Standard-Ländercode zurück.

    Returns:
        Ländercode (z.B. "DE")
    """
    config = _load_countries_config()
    return config.default_country


def get_month_name(country_code: str, month: int) -> str:
    """
    Gibt den lokalisierten Monatsnamen zurück.

    Args:
        country_code: Ländercode
        month: Monatsnummer (1-12)

    Returns:
        Lokalisierter Monatsname

    Raises:
        ValueError: Wenn Monat ungültig
    """
    if not 1 <= month <= 12:
        raise ValueError(f"Ungültiger Monat: {month}. Muss zwischen 1 und 12 liegen.")

    country = get_country(country_code)
    return country.month_names[month - 1]


def get_date_format(country_code: str) -> str:
    """
    Gibt das Datumsformat für ein Land zurück.

    Args:
        country_code: Ländercode

    Returns:
        Datumsformat-String
    """
    country = get_country(country_code)
    return country.date_format


def is_country_active(country_code: str) -> bool:
    """
    Prüft ob ein Land aktiv ist.

    Args:
        country_code: Ländercode

    Returns:
        True wenn aktiv
    """
    try:
        country = get_country(country_code)
        return country.is_active
    except HTTPException:
        return False


def get_countries_for_dropdown() -> List[Dict[str, Any]]:
    """
    Gibt Länder im Format für UI-Dropdowns zurück.

    Returns:
        Liste mit {code, name, flag, is_active}
    """
    countries = get_all_countries(active_only=False)
    return [
        {
            "code": c.code,
            "name": c.name,
            "flag": c.flag,
            "is_active": c.is_active
        }
        for c in countries
    ]
