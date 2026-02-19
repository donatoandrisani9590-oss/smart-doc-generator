"""
Magic Fill — RAG-basierte Defaults aus Team-Dokumenten.

Analysiert die letzten Dokumente des gleichen Dokumenttyps
und schlägt typische Feldwerte als Defaults vor.

POST /api/v1/smart/magic-fill
"""
import json
import logging
from collections import Counter
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.models.enterprise import GeneratedDocument
from app.services.cache import cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/smart/magic-fill")

# TTL: 10 Minuten
MAGIC_FILL_CACHE_TTL = 600

# Felder, die für Magic Fill analysiert werden
MAGIC_FILL_FIELDS = [
    "probezeit",
    "urlaubstage",
    "wochenstunden",
    "kuendigungsfrist",
    "au_frist",
    "vwl_betrag",
    "urlaubsgeld_pro_tag",
    "vertragsart",
    "entgeltgruppe",
]

# Min. Confidence, um einen Vorschlag auszugeben (50%)
MIN_CONFIDENCE = 0.5

# Min. Dokumente, um überhaupt Vorschläge zu machen
MIN_DOCUMENTS = 3

# Max. Dokumente, die analysiert werden
MAX_DOCUMENTS = 50


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class MagicFillRequest(BaseModel):
    document_type_id: int
    country_code: str = "DE"
    position: Optional[str] = None  # Für kontextbezogene Vorschläge


class MagicFillSuggestion(BaseModel):
    field_key: str
    value: str
    confidence: float           # 0.0-1.0
    source_count: int           # Anzahl Dokumente, aus denen der Wert abgeleitet wurde
    hint: str                   # z.B. "Basierend auf 12 ähnlichen Verträgen"


class MagicFillResponse(BaseModel):
    suggestions: list[MagicFillSuggestion]
    document_count: int         # Gesamtzahl analysierter Dokumente


# ═══════════════════════════════════════════════════════════════════════════
# CACHE KEY
# ═══════════════════════════════════════════════════════════════════════════

def _cache_key(user_id: int, document_type_id: int, country_code: str) -> str:
    return f"magic_fill:{user_id}:{document_type_id}:{country_code}"


# ═══════════════════════════════════════════════════════════════════════════
# FIELD LABELS (für den hint-Text)
# ═══════════════════════════════════════════════════════════════════════════

FIELD_LABELS_DE = {
    "probezeit": "Probezeit",
    "urlaubstage": "Urlaubstage",
    "wochenstunden": "Wochenstunden",
    "kuendigungsfrist": "Kündigungsfrist",
    "au_frist": "AU-Bescheinigung ab",
    "vwl_betrag": "VWL-Betrag",
    "urlaubsgeld_pro_tag": "Urlaubsgeld/Tag",
    "vertragsart": "Vertragsart",
    "entgeltgruppe": "Entgeltgruppe",
}


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════

@router.post("", response_model=MagicFillResponse)
async def magic_fill(
    request: MagicFillRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Analysiert historische Dokumente und schlägt typische Feldwerte vor.

    Statistisch basiert (kein LLM nötig):
    - Liest die letzten 50 Dokumente des gleichen Dokumenttyps
    - Zählt die häufigsten Werte pro Feld
    - Gibt nur Vorschläge mit >= 50% Konfidenz zurück
    """
    user_id = current_user.id
    cache_key = _cache_key(user_id, request.document_type_id, request.country_code)

    # Cache prüfen
    cached = await cache.get(cache_key)
    if cached:
        return MagicFillResponse(**cached)

    # Letzte Dokumente des gleichen Typs + Land des aktuellen Users abfragen
    conditions = [
        GeneratedDocument.document_type_id == request.document_type_id,
        GeneratedDocument.is_deleted == False,  # noqa: E712
        GeneratedDocument.created_by_id == user_id,
        GeneratedDocument.form_data.isnot(None),
    ]

    # Country-Code filtern, falls vorhanden
    if request.country_code:
        conditions.append(GeneratedDocument.country_code == request.country_code)

    stmt = (
        select(GeneratedDocument.form_data)
        .where(and_(*conditions))
        .order_by(GeneratedDocument.created_at.desc())
        .limit(MAX_DOCUMENTS)
    )

    result = await db.execute(stmt)
    rows = result.all()

    document_count = len(rows)

    # Nicht genug Daten
    if document_count < MIN_DOCUMENTS:
        empty_response = MagicFillResponse(suggestions=[], document_count=document_count)
        await cache.set(cache_key, empty_response.model_dump(), ttl=MAGIC_FILL_CACHE_TTL)
        return empty_response

    # Feld-Werte zählen
    field_counters: dict[str, Counter] = {}

    for (form_data_raw,) in rows:
        if not form_data_raw:
            continue

        try:
            form_data = json.loads(form_data_raw) if isinstance(form_data_raw, str) else form_data_raw
        except (json.JSONDecodeError, TypeError):
            continue

        for field_key in MAGIC_FILL_FIELDS:
            value = form_data.get(field_key)
            if value is None:
                continue

            # Normalisieren: Strings trimmen, leere Werte ignorieren
            str_value = str(value).strip()
            if not str_value:
                continue

            if field_key not in field_counters:
                field_counters[field_key] = Counter()
            field_counters[field_key][str_value] += 1

    # Vorschläge generieren
    suggestions: list[MagicFillSuggestion] = []

    for field_key, counter in field_counters.items():
        if not counter:
            continue

        most_common_value, count = counter.most_common(1)[0]
        confidence = count / document_count

        if confidence < MIN_CONFIDENCE:
            continue

        # Hint-Text generieren
        label = FIELD_LABELS_DE.get(field_key, field_key)
        percentage = int(confidence * 100)
        hint = f"In {percentage}% deiner letzten {document_count} Verträge: {label} = \"{most_common_value}\""

        suggestions.append(MagicFillSuggestion(
            field_key=field_key,
            value=most_common_value,
            confidence=confidence,
            source_count=count,
            hint=hint,
        ))

    # Nach Konfidenz sortieren (höchste zuerst)
    suggestions.sort(key=lambda s: s.confidence, reverse=True)

    response = MagicFillResponse(
        suggestions=suggestions,
        document_count=document_count,
    )

    # In Cache speichern
    await cache.set(cache_key, response.model_dump(), ttl=MAGIC_FILL_CACHE_TTL)

    logger.info(
        "Magic Fill: %d Vorschläge aus %d Dokumenten für User %s, DocType %d",
        len(suggestions),
        document_count,
        user_id,
        request.document_type_id,
    )

    return response
