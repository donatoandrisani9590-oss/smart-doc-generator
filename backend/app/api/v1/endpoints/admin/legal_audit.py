"""
Legal Audit Admin Endpoints -- Manage clause auditing and compliance.

POST /admin/legal-audit/run           -- Start manual audit (single or batch)
GET  /admin/legal-audit/results       -- Fetch audit results with filters
GET  /admin/legal-audit/stats         -- Aggregated compliance stats for dashboard
POST /admin/legal-audit/auto-fix/{clause_id}  -- Generate AI fix for a clause
PATCH /admin/legal-audit/results/{id}/resolve -- Mark result as resolved
GET  /admin/legal-audit/clauses/{clause_id}/audit-history -- Audit history for clause
"""
import logging
import math
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.models.documents import Clause
from app.models.legal_audit import ClauseAuditResult
from app.services.legal_auditor_service import get_legal_auditor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/legal-audit", tags=["legal-audit"])


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class AuditRunRequest(BaseModel):
    """Request to run audit on clauses."""
    clause_ids: Optional[List[int]] = None
    country_code: Optional[str] = Field("DE", max_length=2)
    limit: Optional[int] = Field(50, ge=1, le=200)


class AuditResultResponse(BaseModel):
    """Single audit result."""
    id: int
    clause_id: int
    clause_title: Optional[str] = None
    audited_at: str
    audited_by: str
    status: str
    risk_level: str
    reasoning: Optional[str] = None
    affected_law: Optional[str] = None
    suggestion: Optional[str] = None
    is_resolved: bool
    resolved_at: Optional[str] = None

    class Config:
        from_attributes = True


class AuditResultListResponse(BaseModel):
    """Paginated list of audit results."""
    items: List[AuditResultResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class AuditStatsResponse(BaseModel):
    """Aggregated compliance statistics."""
    total_checked: int
    ok_count: int
    warning_count: int
    deprecated_count: int
    unchecked_count: int
    by_risk_level: dict  # {"low": int, "medium": int, "high": int, "critical": int}


class AutoFixResponse(BaseModel):
    """Response from auto-fix generation."""
    clause_id: int
    original_html: str
    corrected_html: str
    audit_reasoning: Optional[str] = None
    affected_law: Optional[str] = None


class ResolveRequest(BaseModel):
    """Request to mark audit result as resolved."""
    pass  # No body needed -- resolved_by comes from current_user


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/run", response_model=List[AuditResultResponse])
async def run_audit(
    request: AuditRunRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Rechtsprüfung starten (einzeln oder Batch).

    Prüft die angegebenen Textbausteine oder alle aktiven Textbausteine
    eines Landes auf rechtliche Konformität mittels LLM.
    """
    try:
        auditor = get_legal_auditor()
        results = await auditor.audit_batch(
            db=db,
            clause_ids=request.clause_ids,
            country_code=request.country_code or "DE",
            limit=request.limit or 50,
        )

        return [
            AuditResultResponse(
                id=r.id,
                clause_id=r.clause_id,
                clause_title=None,  # Would need join -- keep lightweight
                audited_at=r.audited_at.isoformat() if r.audited_at else "",
                audited_by=r.audited_by,
                status=r.status,
                risk_level=r.risk_level,
                reasoning=r.reasoning,
                affected_law=r.affected_law,
                suggestion=r.suggestion,
                is_resolved=r.is_resolved or False,
                resolved_at=r.resolved_at.isoformat() if r.resolved_at else None,
            )
            for r in results
        ]

    except Exception as e:
        logger.error("Fehler beim Starten der Rechtsprüfung: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Rechtsprüfung konnte nicht durchgeführt werden.",
        )


@router.get("/results", response_model=AuditResultListResponse)
async def get_audit_results(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    audit_status: Optional[str] = Query(None, alias="status"),
    risk_level: Optional[str] = None,
    clause_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Prüfergebnisse abrufen (paginiert, mit Filtern).

    Filter:
    - status: ok, warning, deprecated
    - risk_level: low, medium, high, critical
    - clause_id: Ergebnisse für einen bestimmten Textbaustein
    """
    try:
        query = select(ClauseAuditResult)
        count_query = select(func.count(ClauseAuditResult.id))

        conditions = []
        if audit_status:
            conditions.append(ClauseAuditResult.status == audit_status)
        if risk_level:
            conditions.append(ClauseAuditResult.risk_level == risk_level)
        if clause_id:
            conditions.append(ClauseAuditResult.clause_id == clause_id)

        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        total = await db.scalar(count_query) or 0

        offset = (page - 1) * page_size
        query = (
            query
            .order_by(desc(ClauseAuditResult.audited_at))
            .offset(offset)
            .limit(page_size)
        )

        result = await db.execute(query)
        entries = result.scalars().all()

        items = [
            AuditResultResponse(
                id=e.id,
                clause_id=e.clause_id,
                clause_title=None,
                audited_at=e.audited_at.isoformat() if e.audited_at else "",
                audited_by=e.audited_by,
                status=e.status,
                risk_level=e.risk_level,
                reasoning=e.reasoning,
                affected_law=e.affected_law,
                suggestion=e.suggestion,
                is_resolved=e.is_resolved or False,
                resolved_at=e.resolved_at.isoformat() if e.resolved_at else None,
            )
            for e in entries
        ]

        return AuditResultListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total > 0 else 0,
        )

    except Exception as e:
        logger.error("Fehler beim Laden der Prüfergebnisse: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Prüfergebnisse konnten nicht geladen werden.",
        )


@router.get("/stats", response_model=AuditStatsResponse)
async def get_audit_stats(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Aggregierte Compliance-Statistiken für das Dashboard.

    Zeigt Anzahl der geprüften, unbeanstandeten, beanstandeten
    und veralteten Textbausteine.
    """
    try:
        # Count clauses by legal_status
        total_checked = await db.scalar(
            select(func.count(Clause.id)).where(
                Clause.legal_status != "unchecked"
            )
        ) or 0

        ok_count = await db.scalar(
            select(func.count(Clause.id)).where(Clause.legal_status == "ok")
        ) or 0

        warning_count = await db.scalar(
            select(func.count(Clause.id)).where(Clause.legal_status == "warning")
        ) or 0

        deprecated_count = await db.scalar(
            select(func.count(Clause.id)).where(Clause.legal_status == "deprecated")
        ) or 0

        unchecked_count = await db.scalar(
            select(func.count(Clause.id)).where(
                Clause.legal_status == "unchecked"
            )
        ) or 0

        # Count unresolved audit results by risk_level
        risk_query = (
            select(
                ClauseAuditResult.risk_level,
                func.count(ClauseAuditResult.id).label("count"),
            )
            .where(ClauseAuditResult.is_resolved == False)
            .group_by(ClauseAuditResult.risk_level)
        )
        risk_result = await db.execute(risk_query)
        by_risk_level = {
            "low": 0, "medium": 0, "high": 0, "critical": 0,
        }
        for row in risk_result.all():
            if row.risk_level in by_risk_level:
                by_risk_level[row.risk_level] = row.count

        return AuditStatsResponse(
            total_checked=total_checked,
            ok_count=ok_count,
            warning_count=warning_count,
            deprecated_count=deprecated_count,
            unchecked_count=unchecked_count,
            by_risk_level=by_risk_level,
        )

    except Exception as e:
        logger.error("Fehler beim Laden der Audit-Statistiken: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Audit-Statistiken konnten nicht geladen werden.",
        )


@router.post("/auto-fix/{clause_id}", response_model=AutoFixResponse)
async def generate_auto_fix(
    clause_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    KI-Korrektur für einen beanstandeten Textbaustein generieren.

    Nutzt das letzte Audit-Ergebnis als Grundlage für die Korrektur.
    """
    # Load clause
    clause = await db.get(Clause, clause_id)
    if not clause:
        raise HTTPException(
            status_code=404,
            detail=f"Textbaustein {clause_id} nicht gefunden.",
        )

    # Load latest audit result for this clause
    result = await db.execute(
        select(ClauseAuditResult)
        .where(ClauseAuditResult.clause_id == clause_id)
        .order_by(desc(ClauseAuditResult.audited_at))
        .limit(1)
    )
    audit_result = result.scalar_one_or_none()

    if not audit_result:
        raise HTTPException(
            status_code=404,
            detail="Kein Audit-Ergebnis für diesen Textbaustein vorhanden. "
                   "Bitte zuerst eine Prüfung durchführen.",
        )

    if audit_result.status == "ok":
        raise HTTPException(
            status_code=400,
            detail="Textbaustein ist bereits als konform eingestuft. "
                   "Keine Korrektur erforderlich.",
        )

    try:
        auditor = get_legal_auditor()
        corrected_html = await auditor.generate_auto_fix(
            clause=clause,
            audit_result=audit_result,
            db=db,
        )

        return AutoFixResponse(
            clause_id=clause.id,
            original_html=clause.content_html,
            corrected_html=corrected_html,
            audit_reasoning=audit_result.reasoning,
            affected_law=audit_result.affected_law,
        )

    except Exception as e:
        logger.error("Fehler bei Auto-Fix für Textbaustein %d: %s", clause_id, e)
        raise HTTPException(
            status_code=500,
            detail="Automatische Korrektur konnte nicht generiert werden.",
        )


@router.patch("/results/{result_id}/resolve", response_model=AuditResultResponse)
async def resolve_audit_result(
    result_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Audit-Ergebnis als erledigt markieren.

    Setzt is_resolved=True, resolved_at und resolved_by_id.
    """
    audit_result = await db.get(ClauseAuditResult, result_id)
    if not audit_result:
        raise HTTPException(
            status_code=404,
            detail=f"Audit-Ergebnis {result_id} nicht gefunden.",
        )

    if audit_result.is_resolved:
        raise HTTPException(
            status_code=400,
            detail="Dieses Ergebnis wurde bereits als erledigt markiert.",
        )

    audit_result.is_resolved = True
    audit_result.resolved_at = datetime.now(timezone.utc)
    audit_result.resolved_by_id = current_user.id

    await db.commit()
    await db.refresh(audit_result)

    return AuditResultResponse(
        id=audit_result.id,
        clause_id=audit_result.clause_id,
        clause_title=None,
        audited_at=audit_result.audited_at.isoformat() if audit_result.audited_at else "",
        audited_by=audit_result.audited_by,
        status=audit_result.status,
        risk_level=audit_result.risk_level,
        reasoning=audit_result.reasoning,
        affected_law=audit_result.affected_law,
        suggestion=audit_result.suggestion,
        is_resolved=audit_result.is_resolved,
        resolved_at=audit_result.resolved_at.isoformat() if audit_result.resolved_at else None,
    )


@router.get(
    "/clauses/{clause_id}/audit-history",
    response_model=List[AuditResultResponse],
)
async def get_clause_audit_history(
    clause_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Prüfhistorie für einen bestimmten Textbaustein abrufen.

    Zeigt alle vergangenen Audit-Ergebnisse chronologisch absteigend.
    """
    # Verify clause exists
    clause = await db.get(Clause, clause_id)
    if not clause:
        raise HTTPException(
            status_code=404,
            detail=f"Textbaustein {clause_id} nicht gefunden.",
        )

    result = await db.execute(
        select(ClauseAuditResult)
        .where(ClauseAuditResult.clause_id == clause_id)
        .order_by(desc(ClauseAuditResult.audited_at))
    )
    entries = result.scalars().all()

    return [
        AuditResultResponse(
            id=e.id,
            clause_id=e.clause_id,
            clause_title=clause.title,
            audited_at=e.audited_at.isoformat() if e.audited_at else "",
            audited_by=e.audited_by,
            status=e.status,
            risk_level=e.risk_level,
            reasoning=e.reasoning,
            affected_law=e.affected_law,
            suggestion=e.suggestion,
            is_resolved=e.is_resolved or False,
            resolved_at=e.resolved_at.isoformat() if e.resolved_at else None,
        )
        for e in entries
    ]
