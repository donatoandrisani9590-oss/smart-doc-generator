"""
LLM Usage Observability API

Provides statistics, logs, and daily aggregation for all LLM API calls.
Used by the admin dashboard to monitor:
- Total calls, tokens, latency
- Error rates
- Breakdowns by provider and feature
- Daily trends for charting

Data source: LLMCallLog model (fire-and-forget logging from llm_service).
"""
import logging
import math
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_, desc, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.models.enterprise import LLMCallLog
from app.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/llm-usage", tags=["llm-usage"])


def _require_admin(current_user: User) -> None:
    """Nur Admins dürfen auf LLM-Nutzungsdaten zugreifen."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Nur Administratoren können auf LLM-Nutzungsdaten zugreifen.",
        )


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class ProviderBreakdown(BaseModel):
    provider: str
    count: int
    tokens: int


class FeatureBreakdown(BaseModel):
    feature: str
    count: int
    tokens: int


class LLMUsageStats(BaseModel):
    total_calls: int
    calls_today: int
    calls_this_week: int
    total_tokens: int
    tokens_today: int
    avg_latency_ms: int
    error_rate: float  # percentage 0-100
    by_provider: List[ProviderBreakdown]
    by_feature: List[FeatureBreakdown]


class LLMLogEntry(BaseModel):
    id: int
    created_at: str
    user_id: Optional[str] = None
    feature: str
    provider: str
    model: Optional[str] = None
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    latency_ms: int
    status: str
    error_message: Optional[str] = None
    country_code: Optional[str] = None

    class Config:
        from_attributes = True


class LLMLogListResponse(BaseModel):
    items: List[LLMLogEntry]
    total: int
    page: int
    page_size: int
    total_pages: int


class DailyStatsEntry(BaseModel):
    date: str
    calls: int
    tokens: int
    avg_latency_ms: int


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/stats", response_model=LLMUsageStats)
async def get_llm_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aggregierte LLM-Nutzungsstatistiken.

    Liefert Gesamtzahlen, Aufschlüsselung nach Provider und Feature,
    sowie Fehlerrate und durchschnittliche Latenz.
    """
    _require_admin(current_user)
    try:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(weeks=1)

        # --- Total calls ---
        total_calls = await db.scalar(
            select(func.count(LLMCallLog.id))
        ) or 0

        # --- Calls today ---
        calls_today = await db.scalar(
            select(func.count(LLMCallLog.id)).where(
                LLMCallLog.created_at >= today_start
            )
        ) or 0

        # --- Calls this week ---
        calls_this_week = await db.scalar(
            select(func.count(LLMCallLog.id)).where(
                LLMCallLog.created_at >= week_start
            )
        ) or 0

        # --- Total tokens ---
        total_tokens = await db.scalar(
            select(func.sum(LLMCallLog.total_tokens))
        ) or 0

        # --- Tokens today ---
        tokens_today = await db.scalar(
            select(func.sum(LLMCallLog.total_tokens)).where(
                LLMCallLog.created_at >= today_start
            )
        ) or 0

        # --- Average latency ---
        avg_latency = await db.scalar(
            select(func.avg(LLMCallLog.latency_ms))
        )
        avg_latency_ms = int(avg_latency) if avg_latency else 0

        # --- Error rate ---
        error_count = await db.scalar(
            select(func.count(LLMCallLog.id)).where(
                LLMCallLog.status == "error"
            )
        ) or 0
        error_rate = round((error_count / total_calls * 100), 2) if total_calls > 0 else 0.0

        # --- By provider ---
        provider_query = (
            select(
                LLMCallLog.provider,
                func.count(LLMCallLog.id).label("count"),
                func.coalesce(func.sum(LLMCallLog.total_tokens), 0).label("tokens"),
            )
            .group_by(LLMCallLog.provider)
            .order_by(desc(func.count(LLMCallLog.id)))
        )
        provider_result = await db.execute(provider_query)
        by_provider = [
            ProviderBreakdown(provider=row.provider, count=row.count, tokens=row.tokens)
            for row in provider_result.all()
        ]

        # --- By feature ---
        feature_query = (
            select(
                LLMCallLog.feature,
                func.count(LLMCallLog.id).label("count"),
                func.coalesce(func.sum(LLMCallLog.total_tokens), 0).label("tokens"),
            )
            .group_by(LLMCallLog.feature)
            .order_by(desc(func.count(LLMCallLog.id)))
        )
        feature_result = await db.execute(feature_query)
        by_feature = [
            FeatureBreakdown(feature=row.feature, count=row.count, tokens=row.tokens)
            for row in feature_result.all()
        ]

        return LLMUsageStats(
            total_calls=total_calls,
            calls_today=calls_today,
            calls_this_week=calls_this_week,
            total_tokens=total_tokens,
            tokens_today=tokens_today,
            avg_latency_ms=avg_latency_ms,
            error_rate=error_rate,
            by_provider=by_provider,
            by_feature=by_feature,
        )

    except Exception as e:
        logger.error("Fehler beim Laden der LLM-Statistiken: %s", e)
        raise HTTPException(
            status_code=500,
            detail="LLM-Statistiken konnten nicht geladen werden.",
        )


@router.get("/logs", response_model=LLMLogListResponse)
async def get_llm_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    feature: Optional[str] = None,
    provider: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Paginierte Liste aller LLM-Aufrufe mit Filtern.

    Filter:
    - feature: z.B. refine, compliance, chat, smart_mode
    - provider: z.B. groq, mistral, ollama
    - status: success oder error
    """
    _require_admin(current_user)
    try:
        query = select(LLMCallLog)
        count_query = select(func.count(LLMCallLog.id))

        conditions = []

        if feature:
            conditions.append(LLMCallLog.feature == feature)
        if provider:
            conditions.append(LLMCallLog.provider == provider)
        if status:
            conditions.append(LLMCallLog.status == status)

        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        # Total count
        total = await db.scalar(count_query) or 0

        # Pagination
        offset = (page - 1) * page_size
        query = query.order_by(desc(LLMCallLog.created_at)).offset(offset).limit(page_size)

        result = await db.execute(query)
        entries = result.scalars().all()

        items = [
            LLMLogEntry(
                id=entry.id,
                created_at=entry.created_at.isoformat() if entry.created_at else "",
                user_id=entry.user_id,
                feature=entry.feature,
                provider=entry.provider,
                model=entry.model,
                prompt_tokens=entry.prompt_tokens or 0,
                completion_tokens=entry.completion_tokens or 0,
                total_tokens=entry.total_tokens or 0,
                latency_ms=entry.latency_ms or 0,
                status=entry.status or "success",
                error_message=entry.error_message,
                country_code=entry.country_code,
            )
            for entry in entries
        ]

        return LLMLogListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total > 0 else 0,
        )

    except Exception as e:
        logger.error("Fehler beim Laden der LLM-Logs: %s", e)
        raise HTTPException(
            status_code=500,
            detail="LLM-Logs konnten nicht geladen werden.",
        )


@router.get("/daily", response_model=List[DailyStatsEntry])
async def get_daily_stats(
    days: int = Query(30, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Tägliche Aggregation für Diagramme.

    Liefert pro Tag: Anzahl Aufrufe, Gesamttokens, durchschnittliche Latenz.
    Standard: letzte 30 Tage, maximal 90 Tage.
    """
    _require_admin(current_user)
    try:
        cutoff = datetime.utcnow() - timedelta(days=days)

        daily_query = (
            select(
                cast(LLMCallLog.created_at, Date).label("date"),
                func.count(LLMCallLog.id).label("calls"),
                func.coalesce(func.sum(LLMCallLog.total_tokens), 0).label("tokens"),
                func.coalesce(func.avg(LLMCallLog.latency_ms), 0).label("avg_latency"),
            )
            .where(LLMCallLog.created_at >= cutoff)
            .group_by(cast(LLMCallLog.created_at, Date))
            .order_by(cast(LLMCallLog.created_at, Date))
        )

        result = await db.execute(daily_query)
        rows = result.all()

        return [
            DailyStatsEntry(
                date=str(row.date),
                calls=row.calls,
                tokens=row.tokens,
                avg_latency_ms=int(row.avg_latency),
            )
            for row in rows
        ]

    except Exception as e:
        logger.error("Fehler beim Laden der täglichen LLM-Statistiken: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Tägliche LLM-Statistiken konnten nicht geladen werden.",
        )
