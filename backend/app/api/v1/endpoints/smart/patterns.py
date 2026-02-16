"""
Team Patterns — Smart Defaults based on historical team document data.

GET /api/v1/smart/patterns/defaults?team_id=1&document_type_id=2
Returns common field values and frequently-used clause IDs for a team+doctype combo.

POST /api/v1/smart/patterns/calculate?team_id=1
Triggers pattern calculation for a team (analyzes last 50 docs per doctype).
"""
import json
import logging
from collections import Counter
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.models.enterprise import GeneratedDocument, TeamPattern
from app.services.cache import cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/smart/patterns")

PATTERN_CACHE_TTL = 3600  # 1h


@router.get("/defaults")
async def get_smart_defaults(
    team_id: int = Query(...),
    document_type_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get smart defaults (common field values + frequent clause IDs)
    for a team + document type combination.
    """
    cache_key = f"pattern:defaults:{team_id}:{document_type_id}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    # Query TeamPattern table
    result = await db.execute(
        select(TeamPattern).where(
            and_(
                TeamPattern.team_id == team_id,
                TeamPattern.document_type_id == document_type_id,
            )
        )
    )
    pattern = result.scalar_one_or_none()

    if not pattern:
        response = {"field_defaults": {}, "common_clause_ids": [], "sample_size": 0}
        await cache.set(cache_key, response, ttl=PATTERN_CACHE_TTL)
        return response

    field_defaults = {}
    if pattern.field_defaults:
        try:
            field_defaults = json.loads(pattern.field_defaults) if isinstance(pattern.field_defaults, str) else pattern.field_defaults
        except (json.JSONDecodeError, TypeError):
            pass

    common_clause_ids = []
    if pattern.common_clause_ids:
        try:
            common_clause_ids = json.loads(pattern.common_clause_ids) if isinstance(pattern.common_clause_ids, str) else pattern.common_clause_ids
        except (json.JSONDecodeError, TypeError):
            pass

    response = {
        "field_defaults": field_defaults,
        "common_clause_ids": common_clause_ids,
        "sample_size": pattern.sample_size or 0,
        "calculated_at": pattern.calculated_at.isoformat() if pattern.calculated_at else None,
    }

    await cache.set(cache_key, response, ttl=PATTERN_CACHE_TTL)
    return response


@router.post("/calculate")
async def calculate_team_patterns(
    team_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Calculate team patterns by analyzing the last 50 documents per document type.
    Extracts common field values and frequently-used clause IDs.
    """
    # Get all document types that have documents for this team
    result = await db.execute(
        select(GeneratedDocument.document_type_id)
        .where(
            and_(
                GeneratedDocument.is_deleted == False,
                GeneratedDocument.created_by == str(current_user.id),
            )
        )
        .group_by(GeneratedDocument.document_type_id)
    )
    doc_type_ids = [row.document_type_id for row in result.all() if row.document_type_id]

    patterns_created = 0

    for dt_id in doc_type_ids:
        # Fetch last 50 documents for this team+doctype
        docs_result = await db.execute(
            select(GeneratedDocument.form_data, GeneratedDocument.clause_ids)
            .where(
                and_(
                    GeneratedDocument.is_deleted == False,
                    GeneratedDocument.document_type_id == dt_id,
                )
            )
            .order_by(GeneratedDocument.created_at.desc())
            .limit(50)
        )
        docs = docs_result.all()

        if len(docs) < 3:
            continue  # Not enough data to establish patterns

        # Analyze field patterns
        field_counters: dict[str, Counter] = {}
        clause_counter: Counter = Counter()

        for doc in docs:
            # Parse form_data
            form_data = {}
            if doc.form_data:
                try:
                    form_data = json.loads(doc.form_data) if isinstance(doc.form_data, str) else doc.form_data
                except (json.JSONDecodeError, TypeError):
                    pass

            for key, value in form_data.items():
                if value and isinstance(value, str) and value.strip():
                    if key not in field_counters:
                        field_counters[key] = Counter()
                    field_counters[key][value] += 1

            # Parse clause_ids
            clause_ids = []
            if doc.clause_ids:
                try:
                    clause_ids = json.loads(doc.clause_ids) if isinstance(doc.clause_ids, str) else doc.clause_ids
                except (json.JSONDecodeError, TypeError):
                    pass
            for cid in clause_ids:
                clause_counter[cid] += 1

        # Extract defaults: most common value per field (if >50% frequency)
        sample_size = len(docs)
        threshold = sample_size * 0.5
        field_defaults = {}
        for field_name, counter in field_counters.items():
            most_common_value, count = counter.most_common(1)[0]
            if count >= threshold:
                field_defaults[field_name] = most_common_value

        # Common clauses: used in >50% of documents
        common_clause_ids = [
            cid for cid, count in clause_counter.most_common()
            if count >= threshold
        ]

        # Upsert TeamPattern
        existing = await db.execute(
            select(TeamPattern).where(
                and_(
                    TeamPattern.team_id == team_id,
                    TeamPattern.document_type_id == dt_id,
                )
            )
        )
        pattern = existing.scalar_one_or_none()

        if pattern:
            pattern.field_defaults = json.dumps(field_defaults, ensure_ascii=False)
            pattern.common_clause_ids = json.dumps(common_clause_ids)
            pattern.sample_size = sample_size
        else:
            pattern = TeamPattern(
                team_id=team_id,
                document_type_id=dt_id,
                field_defaults=json.dumps(field_defaults, ensure_ascii=False),
                common_clause_ids=json.dumps(common_clause_ids),
                sample_size=sample_size,
            )
            db.add(pattern)

        patterns_created += 1

        # Invalidate cache
        cache_key = f"pattern:defaults:{team_id}:{dt_id}"
        await cache.delete(cache_key)

    await db.commit()

    return {
        "status": "ok",
        "team_id": team_id,
        "patterns_calculated": patterns_created,
        "document_types_analyzed": len(doc_type_ids),
    }
