"""
Retention & Cleanup Tasks

Implementiert gemäß v4.2 Spezifikation:
- Kapitel 13.9: Draft Auto-Delete nach TTL (Standard: 30 Tage)
- Kapitel 14.3: Dokument-Retention-Policies
"""
import asyncio
import os
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, delete
from app.db import async_session_factory
from app.models.enterprise import GeneratedDocument, RetentionPolicy, DocumentDraft
from app.worker import celery_app
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Standard-TTL für Drafts in Tagen (v4.2 Kap. 13.9)
DEFAULT_DRAFT_TTL_DAYS = 30

async def _run_retention_logic():
    async with async_session_factory() as db:
        # 1. Find documents past retention date that are not yet deleted
        now = datetime.now(timezone.utc)
        stmt = select(GeneratedDocument).where(
            GeneratedDocument.retention_date < now,
            GeneratedDocument.is_deleted == False
        )
        result = await db.execute(stmt)
        expired_docs = result.scalars().all()
        
        deleted_count = 0
        
        for doc in expired_docs:
            # Delete physical file
            if doc.file_path and os.path.exists(doc.file_path):
                try:
                    os.remove(doc.file_path)
                    logger.info(f"Deleted file: {doc.file_path}")
                except OSError as e:
                    logger.error(f"Error deleting file {doc.file_path}: {e}")
            
            # Mark as deleted in DB
            doc.is_deleted = True
            deleted_count += 1
            
        await db.commit()
        return deleted_count

@celery_app.task
def enforce_retention_policies():
    """
    Celery task wrapper for async retention logic.
    """
    # Create new event loop for async logic inside sync Celery worker
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    count = loop.run_until_complete(_run_retention_logic())
    loop.close()
    return f"Processed retention policy. Deleted {count} documents."


# ============================================================================
# DRAFT AUTO-DELETE (v4.2 Kapitel 13.9)
# ============================================================================

async def _run_draft_cleanup(ttl_days: int = DEFAULT_DRAFT_TTL_DAYS):
    """
    Löscht alte Entwürfe, die länger als TTL nicht aktualisiert wurden.

    Gemäß v4.2 Spezifikation Kapitel 13.9:
    - Standard-TTL: 30 Tage seit letzter Aktualisierung
    - Entwürfe mit Namen werden mit Warnung gelöscht (könnte wichtig sein)
    - Automatische Bereinigung ohne Benutzerinteraktion
    """
    async with async_session_factory() as db:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=ttl_days)

        # Finde alle Drafts, die seit TTL nicht aktualisiert wurden
        stmt = select(DocumentDraft).where(
            DocumentDraft.updated_at < cutoff_date
        )
        result = await db.execute(stmt)
        expired_drafts = result.scalars().all()

        deleted_count = 0
        deleted_named = 0

        for draft in expired_drafts:
            # Logging für benannte Drafts (könnten wichtig sein)
            if draft.name and draft.name.strip():
                logger.warning(
                    f"Deleting named draft: '{draft.name}' (ID: {draft.id}, "
                    f"User: {draft.user_id}, Last update: {draft.updated_at})"
                )
                deleted_named += 1
            else:
                logger.info(
                    f"Deleting unnamed draft (ID: {draft.id}, "
                    f"User: {draft.user_id}, Last update: {draft.updated_at})"
                )

            await db.delete(draft)
            deleted_count += 1

        await db.commit()

        return {
            "deleted_total": deleted_count,
            "deleted_named": deleted_named,
            "ttl_days": ttl_days,
            "cutoff_date": cutoff_date.isoformat()
        }


@celery_app.task
def cleanup_expired_drafts(ttl_days: int = DEFAULT_DRAFT_TTL_DAYS):
    """
    Celery task: Löscht abgelaufene Entwürfe.

    Sollte täglich ausgeführt werden (z.B. via Celery Beat).

    Args:
        ttl_days: Anzahl Tage seit letzter Aktualisierung bevor
                  ein Entwurf als abgelaufen gilt. Standard: 30

    Returns:
        Dict mit Statistiken über gelöschte Entwürfe
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    result = loop.run_until_complete(_run_draft_cleanup(ttl_days))
    loop.close()

    logger.info(
        f"Draft cleanup completed: {result['deleted_total']} drafts deleted "
        f"({result['deleted_named']} were named), TTL: {result['ttl_days']} days"
    )

    return result


@celery_app.task
def run_all_cleanup_tasks():
    """
    Kombinierter Cleanup-Task für alle Aufräumarbeiten.

    Kann als einzelner periodischer Task konfiguriert werden:
    - Document Retention
    - Draft TTL
    - Temp-Dateien

    Empfohlen: Täglich um 03:00 Uhr ausführen.
    """
    results = {
        "retention": None,
        "drafts": None,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    # Retention Policies
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        retention_count = loop.run_until_complete(_run_retention_logic())
        loop.close()
        results["retention"] = {"deleted_documents": retention_count}
    except Exception as e:
        logger.error(f"Retention cleanup failed: {e}")
        results["retention"] = {"error": str(e)}

    # Draft Cleanup
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        draft_result = loop.run_until_complete(_run_draft_cleanup())
        loop.close()
        results["drafts"] = draft_result
    except Exception as e:
        logger.error(f"Draft cleanup failed: {e}")
        results["drafts"] = {"error": str(e)}

    return results
