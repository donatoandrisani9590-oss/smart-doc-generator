"""
AI Instructions Service: Loads and combines user-configured AI instructions.

Two levels:
1. Global (per country) — from CompanySettings.ai_instructions
2. Per document type — from DocumentType.ai_instructions

Combined output is injected into all LLM system prompts.
"""
import logging
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.documents import CompanySettings, DocumentType

logger = logging.getLogger(__name__)


async def get_ai_instructions(
    db: AsyncSession,
    country_code: str,
    document_type_id: Optional[int] = None,
) -> str:
    """
    Load and combine AI instructions from global + document-type level.

    Returns a formatted string ready to inject into system prompts,
    or empty string if no instructions are configured.
    """
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
        return ""

    return "\n\nBENUTZERDEFINIERTE ANWEISUNGEN:\n" + "\n".join(parts)
