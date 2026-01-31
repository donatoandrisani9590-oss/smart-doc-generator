"""
Stammdaten-Verwaltung API (v4.2 Feature: Kapitel 15.5.7)

Zentrale Firmendaten für automatisches Ausfüllen:
- Firmenname, Adresse, Geschäftsführer
- Standard-Werte für Verträge (Probezeit, Urlaub, etc.)
"""
from __future__ import annotations
from typing import Any, Annotated, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, ConfigDict

from app.db import get_db
from app.api import deps
from app.models.documents import CompanySettings

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════
class CompanySettingsUpdate(BaseModel):
    # Unternehmensdaten
    company_name: Optional[str] = None
    street: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    managing_director: Optional[str] = None
    commercial_register: Optional[str] = None
    tax_id: Optional[str] = None

    # Standard-Werte
    default_probation_months: Optional[int] = None
    default_notice_period: Optional[str] = None
    default_vacation_days: Optional[int] = None
    default_weekly_hours: Optional[int] = None


class CompanySettingsResponse(BaseModel):
    id: int
    country_code: str

    # Unternehmensdaten
    company_name: Optional[str]
    street: Optional[str]
    postal_code: Optional[str]
    city: Optional[str]
    managing_director: Optional[str]
    commercial_register: Optional[str]
    tax_id: Optional[str]

    # Standard-Werte
    default_probation_months: int
    default_notice_period: str
    default_vacation_days: int
    default_weekly_hours: int

    # Metadata
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CompanySettingsAutofill(BaseModel):
    """Struktur für Autofill-Daten im Formular."""
    # Unternehmensdaten als Platzhalter-Werte
    firma_name: Optional[str] = None
    firma_strasse: Optional[str] = None
    firma_plz: Optional[str] = None
    firma_ort: Optional[str] = None
    firma_adresse: Optional[str] = None  # Kombiniert
    geschaeftsfuehrer: Optional[str] = None
    handelsregister: Optional[str] = None
    ust_idnr: Optional[str] = None

    # Standard-Werte
    probezeit_monate: int = 6
    kuendigungsfrist: str = "4 Wochen zum Monatsende"
    urlaubstage: int = 30
    wochenstunden: int = 40


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/{country_code}", response_model=CompanySettingsResponse)
async def get_company_settings(
    country_code: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_user)],
) -> Any:
    """
    Stammdaten für ein Land abrufen.
    """
    country_code = country_code.upper()
    if country_code not in ("DE", "IT"):
        raise HTTPException(status_code=400, detail="Ungültiger Ländercode")

    query = select(CompanySettings).where(CompanySettings.country_code == country_code)
    result = await db.execute(query)
    settings = result.scalar_one_or_none()

    if not settings:
        # Erstelle leere Settings
        settings = CompanySettings(
            country_code=country_code,
            default_probation_months=6,
            default_notice_period="4 Wochen zum Monatsende" if country_code == "DE" else "30 giorni",
            default_vacation_days=30,
            default_weekly_hours=40,
        )
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return settings


@router.put("/{country_code}", response_model=CompanySettingsResponse)
async def update_company_settings(
    country_code: str,
    settings_in: CompanySettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_active_admin)],
) -> Any:
    """
    Stammdaten aktualisieren (nur Admin).
    """
    country_code = country_code.upper()
    if country_code not in ("DE", "IT"):
        raise HTTPException(status_code=400, detail="Ungültiger Ländercode")

    query = select(CompanySettings).where(CompanySettings.country_code == country_code)
    result = await db.execute(query)
    settings = result.scalar_one_or_none()

    if not settings:
        # Erstelle neue Settings
        settings = CompanySettings(country_code=country_code)
        db.add(settings)

    # Update Felder
    update_data = settings_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    settings.updated_at = datetime.utcnow().isoformat()
    settings.updated_by = getattr(current_user, "full_name", "Admin")

    await db.commit()
    await db.refresh(settings)
    return settings


@router.get("/{country_code}/autofill", response_model=CompanySettingsAutofill)
async def get_autofill_data(
    country_code: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Any, Depends(deps.get_current_user)],
) -> Any:
    """
    Autofill-Daten für Dokumentformulare.

    Diese Daten werden automatisch in neue Dokumente eingefügt,
    wenn das Formular geöffnet wird.
    """
    country_code = country_code.upper()
    if country_code not in ("DE", "IT"):
        raise HTTPException(status_code=400, detail="Ungültiger Ländercode")

    query = select(CompanySettings).where(CompanySettings.country_code == country_code)
    result = await db.execute(query)
    settings = result.scalar_one_or_none()

    if not settings:
        # Return defaults
        return CompanySettingsAutofill()

    # Adresse kombinieren
    address_parts = []
    if settings.street:
        address_parts.append(settings.street)
    if settings.postal_code or settings.city:
        address_parts.append(f"{settings.postal_code or ''} {settings.city or ''}".strip())
    combined_address = ", ".join(address_parts) if address_parts else None

    return CompanySettingsAutofill(
        firma_name=settings.company_name,
        firma_strasse=settings.street,
        firma_plz=settings.postal_code,
        firma_ort=settings.city,
        firma_adresse=combined_address,
        geschaeftsfuehrer=settings.managing_director,
        handelsregister=settings.commercial_register,
        ust_idnr=settings.tax_id,
        probezeit_monate=settings.default_probation_months,
        kuendigungsfrist=settings.default_notice_period,
        urlaubstage=settings.default_vacation_days,
        wochenstunden=settings.default_weekly_hours,
    )
