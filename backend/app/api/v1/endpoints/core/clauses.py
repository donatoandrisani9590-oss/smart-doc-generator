from __future__ import annotations
import logging
from typing import Any, List, Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from pydantic import BaseModel

from app.db import get_db
from app.api import deps
from app.schemas import clause as schemas
from app.models import documents as models
from app.models.enterprise import GeneratedDocument

logger = logging.getLogger(__name__)

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# IMPACT ANALYSIS SCHEMAS (v4.2 Feature: Auswirkungsanalyse)
# ══════════════════════════════════════════════════════════════════════════════
class DocumentTypeUsage(BaseModel):
    """Ein Dokumenttyp, der den Textbaustein verwendet."""
    id: int
    name: str
    category: Optional[str]
    is_mandatory: bool
    usage_count_30_days: int = 0  # Wie oft in letzten 30 Tagen verwendet

class ClauseImpactAnalysis(BaseModel):
    """Auswirkungsanalyse für einen Textbaustein."""
    clause_id: int
    clause_title: str
    clause_version: int
    affected_document_types: List[DocumentTypeUsage]
    total_document_types: int
    total_usage_30_days: int


@router.get("", response_model=List[schemas.Clause])
async def read_clauses(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
    skip: int = 0,
    limit: int = Query(default=100, ge=1, le=1000),
    country_code: Optional[str] = None
) -> Any:
    # Tenant Isolation: Only own clauses + global clauses (user_id IS NULL)
    query = select(models.Clause).where(
        or_(
            models.Clause.user_id == current_user.id,
            models.Clause.user_id.is_(None),
        )
    )
    if country_code:
        query = query.where(models.Clause.country_code == country_code)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


# ══════════════════════════════════════════════════════════════════════════════
# DOKUMENTTYP-MAPPING (Textbausteine nach Dokumenttyp filtern)
# Kompakte Zuordnung: Welche Textbausteine gehören zu welchem Dokumenttyp?
# ══════════════════════════════════════════════════════════════════════════════
class DocumentTypeClauseMap(BaseModel):
    """Kompakte Zuordnung: Dokumenttyp → Textbaustein-IDs."""
    document_type_id: int
    document_type_name: str
    clause_ids: List[int]


@router.get("/document-type-map", response_model=List[DocumentTypeClauseMap])
async def get_clause_document_type_map(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
    country_code: Optional[str] = None,
) -> Any:
    """
    Gibt eine kompakte Zuordnung von Dokumenttypen zu ihren Textbaustein-IDs zurück.

    Wird auf der Textbausteine-Verwaltungsseite für die Filter-Chips genutzt.
    Berücksichtigt Tenant Isolation: Nur eigene + globale Textbausteine.
    """
    # Query: DocumentType → DocumentTypeClause → Clause (mit Tenant-Filter)
    query = (
        select(
            models.DocumentType.id,
            models.DocumentType.name,
            models.DocumentTypeClause.clause_id,
        )
        .join(
            models.DocumentTypeClause,
            models.DocumentType.id == models.DocumentTypeClause.document_type_id,
        )
        .join(
            models.Clause,
            models.DocumentTypeClause.clause_id == models.Clause.id,
        )
        .where(models.DocumentType.is_active == True)
        .where(
            or_(
                models.Clause.user_id == current_user.id,
                models.Clause.user_id.is_(None),
            )
        )
    )
    if country_code:
        query = query.where(models.DocumentType.country_code == country_code)

    query = query.order_by(models.DocumentType.name)
    result = await db.execute(query)
    rows = result.all()

    # Gruppiere nach Dokumenttyp
    doc_type_map: dict[int, DocumentTypeClauseMap] = {}
    for dt_id, dt_name, clause_id in rows:
        if dt_id not in doc_type_map:
            doc_type_map[dt_id] = DocumentTypeClauseMap(
                document_type_id=dt_id,
                document_type_name=dt_name,
                clause_ids=[],
            )
        if clause_id not in doc_type_map[dt_id].clause_ids:
            doc_type_map[dt_id].clause_ids.append(clause_id)

    return list(doc_type_map.values())


# ══════════════════════════════════════════════════════════════════════════════
# IMPACT ANALYSIS ENDPOINT (v4.2 Feature: Kapitel 15.2.5)
# Zeigt alle Dokumenttypen, die einen Textbaustein verwenden
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/{clause_id}/impact", response_model=ClauseImpactAnalysis)
async def get_clause_impact_analysis(
    clause_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
) -> Any:
    """
    Auswirkungsanalyse für einen Textbaustein.

    Zeigt alle Dokumenttypen, die diesen Textbaustein verwenden,
    sowie Nutzungsstatistiken der letzten 30 Tage.

    Gemäß Spezifikation v4.2, Kapitel 15.2.5:
    - "Dieser Textbaustein wird in 4 Dokumenttypen verwendet"
    - Nutzung in den letzten 30 Tagen anzeigen
    """
    # Textbaustein laden (mit Tenant-Prüfung)
    clause = await db.get(models.Clause, clause_id)
    if not clause:
        raise HTTPException(status_code=404, detail="Textbaustein nicht gefunden")
    if clause.user_id is not None and clause.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Zugriff verweigert")

    # Alle Dokumenttypen finden, die diesen Textbaustein verwenden
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
            from datetime import datetime, timedelta, timezone
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

            # Zähle generierte Dokumente mit diesem Dokumenttyp
            usage_query = (
                select(func.count())
                .select_from(GeneratedDocument)
                .where(GeneratedDocument.document_type_id == dt.id)
                .where(GeneratedDocument.created_at >= thirty_days_ago)
            )
            usage_result = await db.execute(usage_query)
            usage_count = usage_result.scalar() or 0
        except (Exception,) as e:
            # Tabelle GeneratedDocument existiert möglicherweise nicht
            logger.debug("Usage-Abfrage fehlgeschlagen für Dokumenttyp %s: %s", dt.id, e)
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
    """Einzelnen Textbaustein abrufen (Tenant-isoliert)."""
    clause = await db.get(models.Clause, clause_id)
    if not clause:
        raise HTTPException(status_code=404, detail="Textbaustein nicht gefunden")
    # Tenant Isolation: Block access to other users' private clauses
    if clause.user_id is not None and clause.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Zugriff verweigert")
    return clause


@router.post("", response_model=schemas.Clause)
async def create_clause(
    *,
    db: Annotated[AsyncSession, Depends(get_db)],
    clause_in: schemas.ClauseCreate,
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """
    Neuer Textbaustein erstellen.

    Erfordert Admin-Rechte. Setzt user_id für Tenant Isolation.
    """
    clause_data = clause_in.dict()
    clause_data["user_id"] = current_user.id
    clause = models.Clause(**clause_data)
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
    Textbaustein aktualisieren.

    Erfordert Admin-Rechte. Die Versionsnummer wird automatisch erhöht.
    Tenant-isoliert: Nur eigene oder globale Textbausteine dürfen bearbeitet werden.
    """
    clause = await db.get(models.Clause, clause_id)
    if not clause:
        raise HTTPException(status_code=404, detail="Textbaustein nicht gefunden")
    # Tenant Isolation: Only owner or global clauses
    if clause.user_id is not None and clause.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Zugriff verweigert")

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
    Textbaustein löschen.

    Erfordert Admin-Rechte. Entfernt den Textbaustein auch aus allen Dokumenttypen.
    Tenant-isoliert: Nur eigene Textbausteine dürfen gelöscht werden.
    """
    clause = await db.get(models.Clause, clause_id)
    if not clause:
        raise HTTPException(status_code=404, detail="Textbaustein nicht gefunden")
    if clause.user_id is not None and clause.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Zugriff verweigert")

    # Prüfe, ob Klausel in Dokumenttypen verwendet wird
    usage_query = (
        select(func.count())
        .select_from(models.DocumentTypeClause)
        .where(models.DocumentTypeClause.clause_id == clause_id)
    )
    usage_result = await db.execute(usage_query)
    usage_count = usage_result.scalar() or 0

    # Entferne Textbaustein aus allen Dokumenttypen
    if usage_count > 0:
        delete_links_query = (
            models.DocumentTypeClause.__table__.delete()
            .where(models.DocumentTypeClause.clause_id == clause_id)
        )
        await db.execute(delete_links_query)

    # Lösche den Textbaustein selbst
    await db.delete(clause)
    await db.commit()

    return {
        "message": "Textbaustein erfolgreich gelöscht",
        "removed_from_document_types": usage_count
    }
