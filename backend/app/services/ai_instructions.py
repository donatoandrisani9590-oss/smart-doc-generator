"""
AI Instructions Service: Loads and combines user-configured AI instructions.

Two levels:
1. Global (per country) — from CompanySettings.ai_instructions
2. Per document type — from DocumentType.ai_instructions

Combined output is injected into all LLM system prompts.
Results are cached in Redis (10min TTL) to avoid DB queries on every LLM call.
"""
import logging
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.documents import CompanySettings, DocumentType
from app.services.cache import cache, ai_instructions_key

logger = logging.getLogger(__name__)

# Sentinel to distinguish "not cached" from "cached empty string"
_CACHE_WRAPPER_KEY = "instructions"


async def get_ai_instructions(
    db: AsyncSession,
    country_code: str,
    document_type_id: Optional[int] = None,
) -> str:
    """
    Load and combine AI instructions from global + document-type level.

    Returns a formatted string ready to inject into system prompts,
    or empty string if no instructions are configured.

    Results are cached for 10 minutes to avoid repeated DB queries.
    """
    # Check cache first (Redis with memory fallback)
    cache_key = ai_instructions_key(country_code, document_type_id)
    cached = await cache.get(cache_key)
    if cached is not None and isinstance(cached, dict) and _CACHE_WRAPPER_KEY in cached:
        return cached[_CACHE_WRAPPER_KEY]

    parts: list[str] = []

    # 1. Global instructions from CompanySettings (per country)
    result = await db.execute(
        select(CompanySettings).where(CompanySettings.country_code == country_code)
    )
    company = result.scalar_one_or_none()
    if company and company.ai_instructions and company.ai_instructions.strip():
        parts.append(company.ai_instructions.strip())

    # 2. Document-type-specific instructions
    if document_type_id:
        doc_type = await db.get(DocumentType, document_type_id)
        if doc_type and doc_type.ai_instructions and doc_type.ai_instructions.strip():
            parts.append(doc_type.ai_instructions.strip())

    if not parts:
        instructions = ""
    else:
        instructions = "\n\nBENUTZERDEFINIERTE ANWEISUNGEN:\n" + "\n".join(parts)

    # Cache result (wrapped to distinguish empty string from cache miss)
    await cache.set(cache_key, {_CACHE_WRAPPER_KEY: instructions}, ttl=600)  # 10min

    return instructions
