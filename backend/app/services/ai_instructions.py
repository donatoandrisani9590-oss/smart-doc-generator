"""
AI Instructions Service: Loads and combines user-configured AI instructions.

Three levels (hierarchical):
1. Global (per country) — from CompanySettings.ai_instructions
2. Team — from Team.ai_instructions (NEU)
3. Per document type — from DocumentType.ai_instructions

Combined output is injected into all LLM system prompts.
Results are cached in Redis (10min TTL) to avoid DB queries on every LLM call.
"""
import logging
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.documents import CompanySettings, DocumentType
from app.services.cache import cache, ai_instructions_key, ai_instructions_key_with_team

logger = logging.getLogger(__name__)

# Sentinel to distinguish "not cached" from "cached empty string"
_CACHE_WRAPPER_KEY = "instructions"


async def get_ai_instructions(
    db: AsyncSession,
    country_code: str,
    document_type_id: Optional[int] = None,
    team_id: Optional[int] = None,
) -> str:
    """
    Load and combine AI instructions from 3 levels:
    1. Global (per country) — CompanySettings.ai_instructions
    2. Team — Team.ai_instructions (NEU)
    3. Per document type — DocumentType.ai_instructions

    Returns formatted string for system prompts, or empty string.
    Cached for 10 minutes.
    """
    # Use team-aware cache key when team_id is provided, legacy key otherwise
    if team_id:
        cache_key = ai_instructions_key_with_team(country_code, team_id, document_type_id)
    else:
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
        parts.append(f"UNTERNEHMENS-RICHTLINIEN:\n{company.ai_instructions.strip()}")

    # 2. Team-specific instructions (NEU)
    if team_id:
        from app.models.enterprise import Team
        team = await db.get(Team, team_id)
        if team and team.ai_instructions and team.ai_instructions.strip():
            parts.append(f"TEAM-REGELN ({team.name}):\n{team.ai_instructions.strip()}")

    # 3. Document-type-specific instructions
    if document_type_id:
        doc_type = await db.get(DocumentType, document_type_id)
        if doc_type and doc_type.ai_instructions and doc_type.ai_instructions.strip():
            parts.append(f"DOKUMENTTYP-REGELN ({doc_type.name}):\n{doc_type.ai_instructions.strip()}")

    if not parts:
        instructions = ""
    else:
        instructions = "\n\nBENUTZERDEFINIERTE ANWEISUNGEN:\n" + "\n\n".join(parts)

    # Cache result (wrapped to distinguish empty string from cache miss)
    await cache.set(cache_key, {_CACHE_WRAPPER_KEY: instructions}, ttl=600)  # 10min

    return instructions
