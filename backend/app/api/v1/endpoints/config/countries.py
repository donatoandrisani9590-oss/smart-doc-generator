"""
Smart Document Generator - Countries API
=========================================
API-Endpoints für Länderkonfigurationen.
Ermöglicht dynamisches Abrufen und (für Admins) Verwalten von Ländern.
"""

from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.models.core import User
from app.api import deps
from app.services.country_config import (
    get_all_countries,
    get_country,
    get_country_codes,
    get_default_country,
    get_month_name,
    get_date_format,
    get_countries_for_dropdown,
    reload_countries_config,
    CountryConfig,
)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# Response Schemas
# ═══════════════════════════════════════════════════════════════════════════════

class CountryListItem(BaseModel):
    """Kurzform für Listen und Dropdowns."""
    code: str
    name: str
    flag: str
    is_active: bool


class CountryDetailResponse(BaseModel):
    """Detaillierte Länderinformationen."""
    code: str
    name: str
    name_en: str
    name_local: str
    flag: str
    currency: str
    locale: str
    date_format: str
    document_standard: str
    labor_law: str
    month_names: List[str]
    is_active: bool

    @classmethod
    def from_country_config(cls, config: CountryConfig) -> "CountryDetailResponse":
        return cls(
            code=config.code,
            name=config.name,
            name_en=config.name_en,
            name_local=config.name_local,
            flag=config.flag,
            currency=config.currency,
            locale=config.locale,
            date_format=config.date_format,
            document_standard=config.legal_standards.document_standard,
            labor_law=config.legal_standards.labor_law,
            month_names=config.month_names,
            is_active=config.is_active,
        )


class MonthNameResponse(BaseModel):
    """Antwort für Monatsnamen."""
    month: int
    name: str
    country_code: str


class CountriesListResponse(BaseModel):
    """Antwort für Länderliste."""
    countries: List[CountryListItem]
    default_country: str
    total: int


# ═══════════════════════════════════════════════════════════════════════════════
# Public Endpoints (keine Authentifizierung erforderlich)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=CountriesListResponse)
async def list_countries(
    active_only: bool = Query(True, description="Nur aktive Länder zurückgeben")
):
    """
    Listet alle verfügbaren Länder auf.

    Gibt eine Liste aller konfigurierten Länder zurück, optional gefiltert
    nach aktiven Ländern. Nützlich für Dropdown-Menüs und Länderauswahl.
    """
    countries = get_all_countries(active_only=active_only)
    default = get_default_country()

    return CountriesListResponse(
        countries=[
            CountryListItem(
                code=c.code,
                name=c.name,
                flag=c.flag,
                is_active=c.is_active
            )
            for c in countries
        ],
        default_country=default,
        total=len(countries)
    )


@router.get("/codes", response_model=List[str])
async def list_country_codes(
    active_only: bool = Query(True, description="Nur aktive Länder")
):
    """
    Gibt nur die Ländercodes zurück.

    Nützlich für Validierung und einfache Listen.
    """
    return get_country_codes(active_only=active_only)


@router.get("/default", response_model=str)
async def get_default_country_code():
    """
    Gibt den Standard-Ländercode zurück.

    Der Standard-Ländercode wird für neue Benutzer verwendet.
    """
    return get_default_country()


@router.get("/{country_code}", response_model=CountryDetailResponse)
async def get_country_details(country_code: str):
    """
    Gibt detaillierte Informationen zu einem Land zurück.

    Enthält alle Konfigurationsdetails wie Monatsnamen,
    Datumsformat, rechtliche Standards etc.
    """
    config = get_country(country_code)
    return CountryDetailResponse.from_country_config(config)


@router.get("/{country_code}/months/{month}", response_model=MonthNameResponse)
async def get_localized_month_name(country_code: str, month: int):
    """
    Gibt den lokalisierten Monatsnamen zurück.

    Args:
        country_code: ISO 3166-1 alpha-2 Code (z.B. "DE")
        month: Monatsnummer (1-12)
    """
    if not 1 <= month <= 12:
        raise HTTPException(
            status_code=400,
            detail=f"Ungültiger Monat: {month}. Muss zwischen 1 und 12 liegen."
        )

    name = get_month_name(country_code, month)
    return MonthNameResponse(
        month=month,
        name=name,
        country_code=country_code.upper()
    )


@router.get("/{country_code}/date-format", response_model=str)
async def get_country_date_format(country_code: str):
    """
    Gibt das Datumsformat für ein Land zurück.
    """
    return get_date_format(country_code)


# ═══════════════════════════════════════════════════════════════════════════════
# Admin Endpoints (Authentifizierung erforderlich)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/reload", response_model=CountriesListResponse)
async def reload_country_configuration(
    current_user: Annotated[User, Depends(deps.get_current_active_admin)]
):
    """
    Lädt die Länderkonfiguration neu.

    Erfordert Admin-Berechtigung. Nützlich nach Änderungen an der
    countries.json Konfigurationsdatei.
    """
    reload_countries_config()
    countries = get_all_countries(active_only=False)
    default = get_default_country()

    return CountriesListResponse(
        countries=[
            CountryListItem(
                code=c.code,
                name=c.name,
                flag=c.flag,
                is_active=c.is_active
            )
            for c in countries
        ],
        default_country=default,
        total=len(countries)
    )
