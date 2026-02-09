"""
Textbaustein-Varianten API

v4.2 Feature (Kapitel 16.13):
- Varianten-Gruppen verwalten (z.B. "Kündigungsfristen")
- Varianten eines Textbausteins definieren (3 Monate, 6 Monate, 12 Monate)
- Automatische Auswahl basierend auf Bedingungen
"""
from __future__ import annotations
from typing import Any, List, Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime

from app.db import get_db
from app.api import deps
from app.models import documents as models

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════
class ClauseVariantBase(BaseModel):
    variant_name: str
    variant_code: Optional[str] = None
    description: Optional[str] = None
    auto_select_condition: Optional[str] = None  # JSON string
    sort_order: int = 0
    is_default: bool = False


class ClauseVariantCreate(ClauseVariantBase):
    clause_id: int


class ClauseVariantUpdate(BaseModel):
    variant_name: Optional[str] = None
    variant_code: Optional[str] = None
    description: Optional[str] = None
    auto_select_condition: Optional[str] = None
    sort_order: Optional[int] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class ClauseVariantResponse(ClauseVariantBase):
    id: int
    group_id: int
    clause_id: int
    is_active: bool

    # Textbaustein-Details (für Anzeige)
    clause_title: Optional[str] = None
    clause_content_preview: Optional[str] = None

    class Config:
        from_attributes = True


class VariantGroupBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None


class VariantGroupCreate(VariantGroupBase):
    country_code: str = "DE"
    base_clause_id: Optional[int] = None


class VariantGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class VariantGroupResponse(VariantGroupBase):
    id: int
    country_code: str
    base_clause_id: Optional[int]
    is_active: bool
    created_at: Optional[str]
    variants: List[ClauseVariantResponse] = []

    class Config:
        from_attributes = True


# ══════════════════════════════════════════════════════════════════════════════
# VARIANTEN-GRUPPEN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/groups", response_model=List[VariantGroupResponse])
async def list_variant_groups(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
    country_code: Optional[str] = None,
    category: Optional[str] = None,
) -> Any:
    """Liste aller Varianten-Gruppen."""
    query = select(models.ClauseVariantGroup).options(
        selectinload(models.ClauseVariantGroup.variants)
    )

    if country_code:
        query = query.where(models.ClauseVariantGroup.country_code == country_code)
    if category:
        query = query.where(models.ClauseVariantGroup.category == category)

    query = query.where(models.ClauseVariantGroup.is_active == True)
    result = await db.execute(query)
    groups = result.scalars().all()

    # Varianten mit Klausel-Details anreichern
    response = []
    for group in groups:
        group_dict = {
            "id": group.id,
            "name": group.name,
            "description": group.description,
            "category": group.category,
            "country_code": group.country_code,
            "base_clause_id": group.base_clause_id,
            "is_active": group.is_active,
            "created_at": group.created_at,
            "variants": [],
        }

        for variant in group.variants:
            if variant.is_active:
                clause = await db.get(models.Clause, variant.clause_id)
                group_dict["variants"].append({
                    "id": variant.id,
                    "group_id": variant.group_id,
                    "clause_id": variant.clause_id,
                    "variant_name": variant.variant_name,
                    "variant_code": variant.variant_code,
                    "description": variant.description,
                    "auto_select_condition": variant.auto_select_condition,
                    "sort_order": variant.sort_order,
                    "is_default": variant.is_default,
                    "is_active": variant.is_active,
                    "clause_title": clause.title if clause else None,
                    "clause_content_preview": (
                        clause.content_html[:200] + "..." if clause and len(clause.content_html) > 200
                        else clause.content_html if clause else None
                    ),
                })

        response.append(group_dict)

    return response


@router.post("/groups", response_model=VariantGroupResponse)
async def create_variant_group(
    *,
    db: Annotated[AsyncSession, Depends(get_db)],
    group_in: VariantGroupCreate,
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """Neue Varianten-Gruppe erstellen."""
    group = models.ClauseVariantGroup(
        name=group_in.name,
        description=group_in.description,
        category=group_in.category,
        country_code=group_in.country_code,
        base_clause_id=group_in.base_clause_id,
        created_at=datetime.utcnow().isoformat(),
        created_by=str(getattr(current_user, 'id', 'system')),
        is_active=True,
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)

    return {
        **group.__dict__,
        "variants": [],
    }


@router.get("/groups/{group_id}", response_model=VariantGroupResponse)
async def get_variant_group(
    group_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
) -> Any:
    """Details einer Varianten-Gruppe."""
    query = (
        select(models.ClauseVariantGroup)
        .options(selectinload(models.ClauseVariantGroup.variants))
        .where(models.ClauseVariantGroup.id == group_id)
    )
    result = await db.execute(query)
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(status_code=404, detail="Varianten-Gruppe nicht gefunden")

    # Varianten mit Klausel-Details
    variants = []
    for variant in group.variants:
        clause = await db.get(models.Clause, variant.clause_id)
        variants.append({
            "id": variant.id,
            "group_id": variant.group_id,
            "clause_id": variant.clause_id,
            "variant_name": variant.variant_name,
            "variant_code": variant.variant_code,
            "description": variant.description,
            "auto_select_condition": variant.auto_select_condition,
            "sort_order": variant.sort_order,
            "is_default": variant.is_default,
            "is_active": variant.is_active,
            "clause_title": clause.title if clause else None,
            "clause_content_preview": (
                clause.content_html[:200] + "..." if clause and len(clause.content_html) > 200
                else clause.content_html if clause else None
            ),
        })

    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "category": group.category,
        "country_code": group.country_code,
        "base_clause_id": group.base_clause_id,
        "is_active": group.is_active,
        "created_at": group.created_at,
        "variants": variants,
    }


@router.put("/groups/{group_id}", response_model=VariantGroupResponse)
async def update_variant_group(
    group_id: int,
    *,
    db: Annotated[AsyncSession, Depends(get_db)],
    group_in: VariantGroupUpdate,
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """Varianten-Gruppe aktualisieren."""
    group = await db.get(models.ClauseVariantGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Varianten-Gruppe nicht gefunden")

    update_data = group_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group, field, value)

    await db.commit()
    await db.refresh(group)

    return await get_variant_group(group_id, db, current_user)


@router.delete("/groups/{group_id}")
async def delete_variant_group(
    group_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """Varianten-Gruppe löschen (soft delete)."""
    group = await db.get(models.ClauseVariantGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Varianten-Gruppe nicht gefunden")

    group.is_active = False
    await db.commit()

    return {"message": "Varianten-Gruppe deaktiviert", "id": group_id}


# ══════════════════════════════════════════════════════════════════════════════
# VARIANTEN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════
@router.post("/groups/{group_id}/variants", response_model=ClauseVariantResponse)
async def add_variant_to_group(
    group_id: int,
    *,
    db: Annotated[AsyncSession, Depends(get_db)],
    variant_in: ClauseVariantCreate,
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """Variante zu einer Gruppe hinzufügen."""
    # Gruppe prüfen
    group = await db.get(models.ClauseVariantGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Varianten-Gruppe nicht gefunden")

    # Textbaustein prüfen
    clause = await db.get(models.Clause, variant_in.clause_id)
    if not clause:
        raise HTTPException(status_code=404, detail="Textbaustein nicht gefunden")

    # Falls diese die Default-Variante sein soll, andere Defaults entfernen
    if variant_in.is_default:
        update_query = (
            models.ClauseVariant.__table__.update()
            .where(models.ClauseVariant.group_id == group_id)
            .values(is_default=False)
        )
        await db.execute(update_query)

    variant = models.ClauseVariant(
        group_id=group_id,
        clause_id=variant_in.clause_id,
        variant_name=variant_in.variant_name,
        variant_code=variant_in.variant_code,
        description=variant_in.description,
        auto_select_condition=variant_in.auto_select_condition,
        sort_order=variant_in.sort_order,
        is_default=variant_in.is_default,
        is_active=True,
    )
    db.add(variant)
    await db.commit()
    await db.refresh(variant)

    return {
        "id": variant.id,
        "group_id": variant.group_id,
        "clause_id": variant.clause_id,
        "variant_name": variant.variant_name,
        "variant_code": variant.variant_code,
        "description": variant.description,
        "auto_select_condition": variant.auto_select_condition,
        "sort_order": variant.sort_order,
        "is_default": variant.is_default,
        "is_active": variant.is_active,
        "clause_title": clause.title,
        "clause_content_preview": (
            clause.content_html[:200] + "..." if len(clause.content_html) > 200
            else clause.content_html
        ),
    }


@router.put("/variants/{variant_id}", response_model=ClauseVariantResponse)
async def update_variant(
    variant_id: int,
    *,
    db: Annotated[AsyncSession, Depends(get_db)],
    variant_in: ClauseVariantUpdate,
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """Variante aktualisieren."""
    variant = await db.get(models.ClauseVariant, variant_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Variante nicht gefunden")

    update_data = variant_in.dict(exclude_unset=True)

    # Falls diese die Default-Variante werden soll, andere Defaults entfernen
    if update_data.get("is_default"):
        reset_query = (
            models.ClauseVariant.__table__.update()
            .where(models.ClauseVariant.group_id == variant.group_id)
            .values(is_default=False)
        )
        await db.execute(reset_query)

    for field, value in update_data.items():
        setattr(variant, field, value)

    await db.commit()
    await db.refresh(variant)

    clause = await db.get(models.Clause, variant.clause_id)

    return {
        "id": variant.id,
        "group_id": variant.group_id,
        "clause_id": variant.clause_id,
        "variant_name": variant.variant_name,
        "variant_code": variant.variant_code,
        "description": variant.description,
        "auto_select_condition": variant.auto_select_condition,
        "sort_order": variant.sort_order,
        "is_default": variant.is_default,
        "is_active": variant.is_active,
        "clause_title": clause.title if clause else None,
        "clause_content_preview": (
            clause.content_html[:200] + "..." if clause and len(clause.content_html) > 200
            else clause.content_html if clause else None
        ),
    }


@router.delete("/variants/{variant_id}")
async def delete_variant(
    variant_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """Variante löschen (soft delete)."""
    variant = await db.get(models.ClauseVariant, variant_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Variante nicht gefunden")

    variant.is_active = False
    await db.commit()

    return {"message": "Variante deaktiviert", "id": variant_id}


# ══════════════════════════════════════════════════════════════════════════════
# HELPER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/clauses/{clause_id}/variant-groups")
async def get_clause_variant_groups(
    clause_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
) -> Any:
    """
    Finde alle Varianten-Gruppen, in denen einen Textbaustein enthalten ist.
    Nützlich um zu sehen, ob einen Textbaustein Teil einer Varianten-Gruppe ist.
    """
    query = (
        select(models.ClauseVariant)
        .where(models.ClauseVariant.clause_id == clause_id)
        .where(models.ClauseVariant.is_active == True)
    )
    result = await db.execute(query)
    variants = result.scalars().all()

    groups = []
    for variant in variants:
        group = await db.get(models.ClauseVariantGroup, variant.group_id)
        if group and group.is_active:
            groups.append({
                "group_id": group.id,
                "group_name": group.name,
                "variant_id": variant.id,
                "variant_name": variant.variant_name,
                "is_default": variant.is_default,
            })

    return {
        "clause_id": clause_id,
        "variant_groups": groups,
        "is_part_of_variant_group": len(groups) > 0,
    }


# ══════════════════════════════════════════════════════════════════════════════
# BULK-ZUORDNUNG: Varianten-Gruppe → Dokumenttypen (v4.2 Feature)
# Ermöglicht das Zuordnen einer Varianten-Gruppe zu mehreren Dokumenttypen
# ══════════════════════════════════════════════════════════════════════════════

class DocTypeAssignment(BaseModel):
    """Zuordnung zu einem Dokumenttyp."""
    document_type_id: int
    is_mandatory: bool = True
    default_variant_id: Optional[int] = None
    display_order: int = 0


class BulkAssignmentRequest(BaseModel):
    """Bulk-Zuordnung einer Varianten-Gruppe zu mehreren Dokumenttypen."""
    assignments: List[DocTypeAssignment]


@router.get("/groups/{group_id}/document-types")
async def get_variant_group_document_types(
    group_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
) -> Any:
    """
    Alle Dokumenttypen abrufen, denen eine Varianten-Gruppe zugeordnet ist.

    Nützlich für ClauseVariantManager, um zu sehen, welche Dokumenttypen
    diese Varianten-Gruppe verwenden.
    """
    # Prüfen ob Gruppe existiert
    group = await db.get(models.ClauseVariantGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Varianten-Gruppe nicht gefunden")

    # Alle Zuordnungen laden
    query = (
        select(models.DocumentTypeVariantGroup)
        .options(
            selectinload(models.DocumentTypeVariantGroup.default_variant)
        )
        .where(models.DocumentTypeVariantGroup.variant_group_id == group_id)
    )
    result = await db.execute(query)
    links = result.scalars().all()

    # Dokumenttyp-Daten laden
    assignments = []
    for link in links:
        doc_type = await db.get(models.DocumentType, link.document_type_id)
        if doc_type:
            assignments.append({
                "document_type_id": doc_type.id,
                "document_type_name": doc_type.name,
                "document_type_category": doc_type.category,
                "is_mandatory": link.is_mandatory,
                "display_order": link.display_order,
                "default_variant_id": link.default_variant_id,
                "default_variant_name": link.default_variant.variant_name if link.default_variant else None,
            })

    # Alle verfügbaren Dokumenttypen für Auswahl laden
    all_doc_types_query = select(models.DocumentType).where(
        models.DocumentType.is_active == True,
        models.DocumentType.country_code == group.country_code
    )
    all_doc_types_result = await db.execute(all_doc_types_query)
    all_doc_types = all_doc_types_result.scalars().all()

    assigned_ids = {a["document_type_id"] for a in assignments}
    available_doc_types = [
        {"id": dt.id, "name": dt.name, "category": dt.category}
        for dt in all_doc_types
        if dt.id not in assigned_ids
    ]

    return {
        "group_id": group_id,
        "group_name": group.name,
        "assignments": assignments,
        "available_document_types": available_doc_types,
    }


@router.put("/groups/{group_id}/document-types")
async def bulk_assign_variant_group_to_document_types(
    group_id: int,
    request: BulkAssignmentRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """
    Bulk-Zuordnung einer Varianten-Gruppe zu mehreren Dokumenttypen.

    Ersetzt alle bestehenden Zuordnungen mit den neuen.
    Ermöglicht das Setzen von individuellen Standard-Varianten pro Dokumenttyp.
    """
    from sqlalchemy import delete

    # Prüfen ob Gruppe existiert
    group = await db.get(models.ClauseVariantGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Varianten-Gruppe nicht gefunden")

    # Alle bestehenden Zuordnungen löschen
    await db.execute(
        delete(models.DocumentTypeVariantGroup).where(
            models.DocumentTypeVariantGroup.variant_group_id == group_id
        )
    )

    # Neue Zuordnungen erstellen
    created = []
    for assignment in request.assignments:
        # Prüfen ob Dokumenttyp existiert
        doc_type = await db.get(models.DocumentType, assignment.document_type_id)
        if not doc_type:
            continue  # Überspringe ungültige Dokumenttypen

        # Prüfen ob default_variant_id zur Gruppe gehört (falls angegeben)
        if assignment.default_variant_id:
            variant = await db.get(models.ClauseVariant, assignment.default_variant_id)
            if not variant or variant.group_id != group_id:
                # Ungültige Variante - ignorieren
                assignment.default_variant_id = None

        link = models.DocumentTypeVariantGroup(
            document_type_id=assignment.document_type_id,
            variant_group_id=group_id,
            is_mandatory=assignment.is_mandatory,
            default_variant_id=assignment.default_variant_id,
            display_order=assignment.display_order,
        )
        db.add(link)
        created.append({
            "document_type_id": doc_type.id,
            "document_type_name": doc_type.name,
            "is_mandatory": assignment.is_mandatory,
            "default_variant_id": assignment.default_variant_id,
        })

    await db.commit()

    return {
        "group_id": group_id,
        "group_name": group.name,
        "assignments_count": len(created),
        "assignments": created,
        "message": f"Varianten-Gruppe '{group.name}' wurde {len(created)} Dokumenttypen zugeordnet",
    }


@router.post("/groups/{group_id}/document-types/{document_type_id}")
async def add_single_document_type_to_variant_group(
    group_id: int,
    document_type_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
    is_mandatory: bool = True,
    default_variant_id: Optional[int] = None,
    display_order: int = 0,
) -> Any:
    """
    Einzelnen Dokumenttyp einer Varianten-Gruppe hinzufügen.
    """
    # Prüfen ob Gruppe existiert
    group = await db.get(models.ClauseVariantGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Varianten-Gruppe nicht gefunden")

    # Prüfen ob Dokumenttyp existiert
    doc_type = await db.get(models.DocumentType, document_type_id)
    if not doc_type:
        raise HTTPException(status_code=404, detail="Dokumenttyp nicht gefunden")

    # Prüfen ob bereits zugeordnet
    existing_query = select(models.DocumentTypeVariantGroup).where(
        models.DocumentTypeVariantGroup.variant_group_id == group_id,
        models.DocumentTypeVariantGroup.document_type_id == document_type_id
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Dokumenttyp ist bereits dieser Varianten-Gruppe zugeordnet"
        )

    # Zuordnung erstellen
    link = models.DocumentTypeVariantGroup(
        document_type_id=document_type_id,
        variant_group_id=group_id,
        is_mandatory=is_mandatory,
        default_variant_id=default_variant_id,
        display_order=display_order,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)

    return {
        "id": link.id,
        "document_type_id": doc_type.id,
        "document_type_name": doc_type.name,
        "variant_group_id": group_id,
        "variant_group_name": group.name,
        "is_mandatory": link.is_mandatory,
        "default_variant_id": link.default_variant_id,
        "message": f"Dokumenttyp '{doc_type.name}' wurde Varianten-Gruppe '{group.name}' zugeordnet",
    }


@router.delete("/groups/{group_id}/document-types/{document_type_id}")
async def remove_document_type_from_variant_group(
    group_id: int,
    document_type_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """
    Dokumenttyp aus Varianten-Gruppe entfernen.
    """
    from sqlalchemy import delete

    # Prüfen ob Gruppe existiert
    group = await db.get(models.ClauseVariantGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Varianten-Gruppe nicht gefunden")

    # Zuordnung löschen
    result = await db.execute(
        delete(models.DocumentTypeVariantGroup).where(
            models.DocumentTypeVariantGroup.variant_group_id == group_id,
            models.DocumentTypeVariantGroup.document_type_id == document_type_id
        )
    )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Zuordnung nicht gefunden")

    await db.commit()

    return {
        "message": "Zuordnung entfernt",
        "variant_group_id": group_id,
        "document_type_id": document_type_id,
    }
