from __future__ import annotations
from typing import Any, List, Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.db import get_db
from app.api import deps
from app.schemas import clause as schemas
from app.models import documents as models

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# IMPACT ANALYSIS SCHEMAS (v4.2 Feature: Auswirkungsanalyse)
# ══════════════════════════════════════════════════════════════════════════════
class DocumentTypeUsage(BaseModel):
    """Ein Dokumenttyp, der die Klausel verwendet."""
    id: int
    name: str
    category: Optional[str]
    is_mandatory: bool
    usage_count_30_days: int = 0  # Wie oft in letzten 30 Tagen verwendet

class ClauseImpactAnalysis(BaseModel):
    """Auswirkungsanalyse für eine Klausel."""
    clause_id: int
    clause_title: str
    clause_version: int
    affected_document_types: List[DocumentTypeUsage]
    total_document_types: int
    total_usage_30_days: int


@router.get("/", response_model=List[schemas.Clause])
async def read_clauses(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
    skip: int = 0,
    limit: int = 100,
    country_code: Optional[str] = None
) -> Any:
    query = select(models.Clause)
    if country_code:
        query = query.where(models.Clause.country_code == country_code)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


# ══════════════════════════════════════════════════════════════════════════════
# IMPACT ANALYSIS ENDPOINT (v4.2 Feature: Kapitel 15.2.5)
# Zeigt alle Dokumenttypen, die eine Klausel verwenden
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/{clause_id}/impact", response_model=ClauseImpactAnalysis)
async def get_clause_impact_analysis(
    clause_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
) -> Any:
    """
    Auswirkungsanalyse für eine Klausel.

    Zeigt alle Dokumenttypen, die diese Klausel verwenden,
    sowie Nutzungsstatistiken der letzten 30 Tage.

    Gemäß Spezifikation v4.2, Kapitel 15.2.5:
    - "Diese Klausel wird in 4 Dokumenttypen verwendet"
    - Nutzung in den letzten 30 Tagen anzeigen
    """
    # Klausel laden
    clause = await db.get(models.Clause, clause_id)
    if not clause:
        raise HTTPException(status_code=404, detail="Klausel nicht gefunden")

    # Alle Dokumenttypen finden, die diese Klausel verwenden
    query = (
        select(
            models.DocumentType.id,
            models.DocumentType.name,
            models.DocumentType.category,
            models.DocumentTypeClause.is_mandatory,
        )
        .join(models.DocumentTypeClause, models.DocumentType.id == models.DocumentTypeClause.document_type_id)
        .where(models.DocumentTypeClause.clause_id == clause_id)
        .where(models.DocumentType.is_active == True)
    )

    result = await db.execute(query)
    document_types = result.all()

    # Nutzungsstatistiken für die letzten 30 Tage abrufen
    # (Wenn GeneratedDocument-Tabelle existiert)
    affected_types = []
    total_usage = 0

    for dt in document_types:
        # Versuche Nutzung zu zählen (falls Tabelle existiert)
        usage_count = 0
        try:
            from datetime import datetime, timedelta
            thirty_days_ago = datetime.utcnow() - timedelta(days=30)

            # Zähle generierte Dokumente mit diesem Dokumenttyp
            usage_query = (
                select(func.count())
                .select_from(models.GeneratedDocument)
                .where(models.GeneratedDocument.document_type_id == dt.id)
                .where(models.GeneratedDocument.created_at >= thirty_days_ago)
            )
            usage_result = await db.execute(usage_query)
            usage_count = usage_result.scalar() or 0
        except Exception:
            # Tabelle existiert möglicherweise nicht
            usage_count = 0

        affected_types.append(DocumentTypeUsage(
            id=dt.id,
            name=dt.name,
            category=dt.category,
            is_mandatory=dt.is_mandatory,
            usage_count_30_days=usage_count,
        ))
        total_usage += usage_count

    return ClauseImpactAnalysis(
        clause_id=clause.id,
        clause_title=clause.title,
        clause_version=clause.version,
        affected_document_types=affected_types,
        total_document_types=len(affected_types),
        total_usage_30_days=total_usage,
    )


@router.get("/{clause_id}", response_model=schemas.Clause)
async def read_clause(
    clause_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
) -> Any:
    """Einzelne Klausel abrufen."""
    clause = await db.get(models.Clause, clause_id)
    if not clause:
        raise HTTPException(status_code=404, detail="Klausel nicht gefunden")
    return clause


@router.post("/", response_model=schemas.Clause)
async def create_clause(
    *,
    db: Annotated[AsyncSession, Depends(get_db)],
    clause_in: schemas.ClauseCreate,
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """
    Neue Klausel erstellen.

    Erfordert Admin-Rechte.
    """
    clause = models.Clause(**clause_in.dict())
    db.add(clause)
    await db.commit()
    await db.refresh(clause)
    return clause


@router.put("/{clause_id}", response_model=schemas.Clause)
async def update_clause(
    clause_id: int,
    *,
    db: Annotated[AsyncSession, Depends(get_db)],
    clause_in: schemas.ClauseUpdate,
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """
    Klausel aktualisieren.

    Erfordert Admin-Rechte. Die Versionsnummer wird automatisch erhöht.
    """
    clause = await db.get(models.Clause, clause_id)
    if not clause:
        raise HTTPException(status_code=404, detail="Klausel nicht gefunden")

    # Update nur die Felder, die im Request enthalten sind
    update_data = clause_in.dict(exclude_unset=True)

    # Versionsnummer erhöhen bei Content-Änderungen
    if "content_html" in update_data and update_data["content_html"] != clause.content_html:
        clause.version = (clause.version or 1) + 1

    for field, value in update_data.items():
        setattr(clause, field, value)

    await db.commit()
    await db.refresh(clause)
    return clause


@router.delete("/{clause_id}")
async def delete_clause(
    clause_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """
    Klausel löschen.

    Erfordert Admin-Rechte. Entfernt die Klausel auch aus allen Dokumenttypen.
    """
    clause = await db.get(models.Clause, clause_id)
    if not clause:
        raise HTTPException(status_code=404, detail="Klausel nicht gefunden")

    # Prüfe, ob Klausel in Dokumenttypen verwendet wird
    usage_query = (
        select(func.count())
        .select_from(models.DocumentTypeClause)
        .where(models.DocumentTypeClause.clause_id == clause_id)
    )
    usage_result = await db.execute(usage_query)
    usage_count = usage_result.scalar() or 0

    # Entferne Klausel aus allen Dokumenttypen
    if usage_count > 0:
        delete_links_query = (
            models.DocumentTypeClause.__table__.delete()
            .where(models.DocumentTypeClause.clause_id == clause_id)
        )
        await db.execute(delete_links_query)

    # Lösche die Klausel selbst
    await db.delete(clause)
    await db.commit()

    return {
        "message": "Klausel erfolgreich gelöscht",
        "removed_from_document_types": usage_count
    }
