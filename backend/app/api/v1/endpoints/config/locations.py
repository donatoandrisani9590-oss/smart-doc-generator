"""
Smart Document Generator - Locations API
=========================================
API-Endpoints für Standort-Verwaltung (Locations).
Ermöglicht Multi-Location-Support für verschiedene Niederlassungen.
"""

from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db import get_db
from app.models.core import Location, User
from app.api.deps import get_current_user, get_current_active_admin

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# Schemas
# ═══════════════════════════════════════════════════════════════════════════════

class LocationBase(BaseModel):
    """Basis-Schema für Location."""
    code: str = Field(..., max_length=20, description="Eindeutiger Code (z.B. DE_SULZ)")
    name: str = Field(..., max_length=100, description="Anzeigename")
    name_local: Optional[str] = Field(None, max_length=100, description="Lokaler Name")
    country_code: str = Field(..., max_length=2, description="Ländercode (ISO 3166-1)")

    street: Optional[str] = Field(None, max_length=200)
    postal_code: Optional[str] = Field(None, max_length=20)
    city: str = Field(..., max_length=100)
    region: Optional[str] = Field(None, max_length=100)

    legal_entity_name: Optional[str] = Field(None, max_length=200)
    tax_id: Optional[str] = Field(None, max_length=50)
    commercial_register: Optional[str] = Field(None, max_length=100)

    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=200)

    signature_city: Optional[str] = Field(None, max_length=100)
    default_signatory: Optional[str] = Field(None, max_length=200)

    is_headquarters: bool = False
    is_active: bool = True
    sort_order: int = 0


class LocationCreate(LocationBase):
    """Schema zum Erstellen einer Location."""
    pass


class LocationUpdate(BaseModel):
    """Schema zum Aktualisieren einer Location (alle Felder optional)."""
    name: Optional[str] = Field(None, max_length=100)
    name_local: Optional[str] = Field(None, max_length=100)
    street: Optional[str] = Field(None, max_length=200)
    postal_code: Optional[str] = Field(None, max_length=20)
    city: Optional[str] = Field(None, max_length=100)
    region: Optional[str] = Field(None, max_length=100)
    legal_entity_name: Optional[str] = Field(None, max_length=200)
    tax_id: Optional[str] = Field(None, max_length=50)
    commercial_register: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=200)
    signature_city: Optional[str] = Field(None, max_length=100)
    default_signatory: Optional[str] = Field(None, max_length=200)
    is_headquarters: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class LocationResponse(LocationBase):
    """Schema für Location-Response."""
    id: int

    class Config:
        from_attributes = True


class LocationListItem(BaseModel):
    """Kurzform für Listen und Dropdowns."""
    id: int
    code: str
    name: str
    city: str
    country_code: str
    is_headquarters: bool
    is_active: bool


class LocationsListResponse(BaseModel):
    """Antwort für Location-Liste."""
    locations: List[LocationListItem]
    total: int


# ═══════════════════════════════════════════════════════════════════════════════
# Public Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=LocationsListResponse)
async def list_locations(
    db: Annotated[AsyncSession, Depends(get_db)],
    country_code: Optional[str] = Query(None, description="Filter nach Ländercode"),
    active_only: bool = Query(True, description="Nur aktive Standorte")
):
    """
    Listet alle Standorte auf.

    Optional gefiltert nach Land und Aktivitätsstatus.
    """
    query = select(Location)

    if country_code:
        query = query.where(Location.country_code == country_code.upper())

    if active_only:
        query = query.where(Location.is_active == True)

    query = query.order_by(Location.sort_order, Location.name)
    result = await db.execute(query)
    locations = result.scalars().all()

    return LocationsListResponse(
        locations=[
            LocationListItem(
                id=loc.id,
                code=loc.code,
                name=loc.name,
                city=loc.city,
                country_code=loc.country_code,
                is_headquarters=loc.is_headquarters,
                is_active=loc.is_active
            )
            for loc in locations
        ],
        total=len(locations)
    )


@router.get("/by-country/{country_code}", response_model=List[LocationListItem])
async def get_locations_by_country(
    country_code: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    active_only: bool = Query(True)
):
    """
    Gibt alle Standorte für ein bestimmtes Land zurück.
    """
    query = select(Location).where(
        Location.country_code == country_code.upper()
    )

    if active_only:
        query = query.where(Location.is_active == True)

    query = query.order_by(Location.sort_order, Location.name)
    result = await db.execute(query)
    locations = result.scalars().all()

    return [
        LocationListItem(
            id=loc.id,
            code=loc.code,
            name=loc.name,
            city=loc.city,
            country_code=loc.country_code,
            is_headquarters=loc.is_headquarters,
            is_active=loc.is_active
        )
        for loc in locations
    ]


@router.get("/headquarters", response_model=List[LocationListItem])
async def get_headquarters(
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    Gibt alle Hauptstandorte (Headquarters) zurück.
    """
    query = select(Location).where(
        Location.is_headquarters == True,
        Location.is_active == True
    ).order_by(Location.sort_order)

    result = await db.execute(query)
    locations = result.scalars().all()

    return [
        LocationListItem(
            id=loc.id,
            code=loc.code,
            name=loc.name,
            city=loc.city,
            country_code=loc.country_code,
            is_headquarters=loc.is_headquarters,
            is_active=loc.is_active
        )
        for loc in locations
    ]


@router.get("/{location_code}", response_model=LocationResponse)
async def get_location(
    location_code: str,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    Gibt detaillierte Informationen zu einem Standort zurück.
    """
    query = select(Location).where(Location.code == location_code.upper())
    result = await db.execute(query)
    location = result.scalar_one_or_none()

    if not location:
        raise HTTPException(
            status_code=404,
            detail=f"Standort '{location_code}' nicht gefunden"
        )

    return location


@router.get("/{location_code}/signature-city", response_model=str)
async def get_signature_city(
    location_code: str,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    Gibt die Signatur-Stadt für Dokumente zurück.

    Wird für "Ort, Datum" auf Verträgen verwendet.
    """
    query = select(Location).where(Location.code == location_code.upper())
    result = await db.execute(query)
    location = result.scalar_one_or_none()

    if not location:
        raise HTTPException(
            status_code=404,
            detail=f"Standort '{location_code}' nicht gefunden"
        )

    return location.signature_city or location.city


# ═══════════════════════════════════════════════════════════════════════════════
# Admin Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("", response_model=LocationResponse)
async def create_location(
    location_data: LocationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_admin)]
):
    """
    Erstellt einen neuen Standort.

    Erfordert Admin-Berechtigung.
    """
    # Prüfe ob Code bereits existiert
    existing = await db.execute(
        select(Location).where(Location.code == location_data.code.upper())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Standort mit Code '{location_data.code}' existiert bereits"
        )

    location = Location(
        **location_data.model_dump(),
        code=location_data.code.upper()
    )
    db.add(location)
    await db.commit()
    await db.refresh(location)

    return location


@router.put("/{location_code}", response_model=LocationResponse)
async def update_location(
    location_code: str,
    location_data: LocationUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_admin)]
):
    """
    Aktualisiert einen Standort.

    Erfordert Admin-Berechtigung.
    """
    query = select(Location).where(Location.code == location_code.upper())
    result = await db.execute(query)
    location = result.scalar_one_or_none()

    if not location:
        raise HTTPException(
            status_code=404,
            detail=f"Standort '{location_code}' nicht gefunden"
        )

    # Aktualisiere nur übergebene Felder
    update_data = location_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(location, field, value)

    await db.commit()
    await db.refresh(location)

    return location


@router.delete("/{location_code}")
async def delete_location(
    location_code: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_admin)]
):
    """
    Löscht einen Standort.

    Erfordert Admin-Berechtigung.
    ACHTUNG: Dies kann Auswirkungen auf bestehende Dokumente haben!
    """
    query = select(Location).where(Location.code == location_code.upper())
    result = await db.execute(query)
    location = result.scalar_one_or_none()

    if not location:
        raise HTTPException(
            status_code=404,
            detail=f"Standort '{location_code}' nicht gefunden"
        )

    await db.delete(location)
    await db.commit()

    return {"message": f"Standort '{location_code}' wurde gelöscht"}


@router.post("/seed")
async def seed_locations_from_config(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_admin)]
):
    """
    Lädt Standorte aus der JSON-Konfigurationsdatei.

    Überspringt bereits existierende Standorte.
    Erfordert Admin-Berechtigung.
    """
    import json
    from pathlib import Path

    config_file = Path(__file__).parent.parent.parent.parent.parent / "storage" / "config" / "locations.json"

    if not config_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Konfigurationsdatei locations.json nicht gefunden"
        )

    with open(config_file, "r", encoding="utf-8") as f:
        config = json.load(f)

    created = 0
    skipped = 0

    for loc_data in config.get("locations", []):
        # Prüfe ob bereits existiert
        existing = await db.execute(
            select(Location).where(Location.code == loc_data["code"].upper())
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        location = Location(
            code=loc_data["code"].upper(),
            name=loc_data["name"],
            name_local=loc_data.get("name_local"),
            country_code=loc_data["country_code"],
            street=loc_data.get("street"),
            postal_code=loc_data.get("postal_code"),
            city=loc_data["city"],
            region=loc_data.get("region"),
            legal_entity_name=loc_data.get("legal_entity_name"),
            tax_id=loc_data.get("tax_id"),
            commercial_register=loc_data.get("commercial_register"),
            phone=loc_data.get("phone"),
            email=loc_data.get("email"),
            website=loc_data.get("website"),
            signature_city=loc_data.get("signature_city"),
            default_signatory=loc_data.get("default_signatory"),
            is_headquarters=loc_data.get("is_headquarters", False),
            is_active=loc_data.get("is_active", True),
            sort_order=loc_data.get("sort_order", 0)
        )
        db.add(location)
        created += 1

    await db.commit()

    return {
        "message": f"{created} Standorte erstellt, {skipped} übersprungen",
        "created": created,
        "skipped": skipped
    }
