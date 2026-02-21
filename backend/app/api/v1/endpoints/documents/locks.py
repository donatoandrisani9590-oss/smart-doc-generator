"""
Document Locking API endpoints.

Pessimistic locking to prevent concurrent document editing.
Locks expire automatically after a configurable timeout (default 15 min).
Frontend sends heartbeats to keep the lock alive.

Endpoints:
- POST   /locks/acquire       - Acquire a lock on a document
- POST   /locks/release       - Release a lock
- GET    /locks/{document_id} - Check lock status
- POST   /locks/heartbeat     - Extend lock expiration
- POST   /locks/force-release - Admin force-release a stuck lock
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from sqlalchemy.sql import func
from pydantic import BaseModel, Field

from app.db import get_db
from app.api import deps
from app.models import core as core_models
from app.models import enterprise as models

logger = logging.getLogger(__name__)

router = APIRouter()

# Lock timeout in minutes (configurable)
LOCK_TIMEOUT_MINUTES = 15


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class AcquireLockRequest(BaseModel):
    document_id: int
    lock_reason: str = Field(default="correction", max_length=100)


class ReleaseLockRequest(BaseModel):
    document_id: int


class HeartbeatRequest(BaseModel):
    document_id: int


class LockStatusResponse(BaseModel):
    is_locked: bool
    locked_by_id: Optional[int] = None
    locked_by_email: Optional[str] = None
    locked_by_name: Optional[str] = None
    locked_at: Optional[str] = None
    expires_at: Optional[str] = None
    lock_reason: Optional[str] = None
    is_own_lock: bool = False
    is_expired: bool = False


class LockAcquiredResponse(BaseModel):
    message: str
    document_id: int
    expires_at: str
    lock_id: int


# ═══════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def _utcnow() -> datetime:
    """Get current UTC time as naive datetime (compatible with SQLite)."""
    return datetime.now(timezone.utc)


def _make_naive(dt: Optional[datetime]) -> Optional[datetime]:
    """Convert a possibly timezone-aware datetime to naive UTC."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


async def _cleanup_expired_lock(db: AsyncSession, document_id: int) -> None:
    """Remove expired lock for a document."""
    # Load lock and compare in Python to avoid SQLite tz issues
    result = await db.execute(
        select(models.DocumentLock).where(
            models.DocumentLock.document_id == document_id,
        )
    )
    lock = result.scalar_one_or_none()
    if lock and _make_naive(lock.expires_at) < _utcnow():
        logger.info(
            f"Auto-releasing expired lock on document {document_id} "
            f"(was held by {lock.locked_by_email})"
        )
        await db.delete(lock)
        await db.flush()


async def _get_active_lock(
    db: AsyncSession, document_id: int
) -> Optional[models.DocumentLock]:
    """Get active (non-expired) lock for a document."""
    await _cleanup_expired_lock(db, document_id)

    result = await db.execute(
        select(models.DocumentLock).where(
            models.DocumentLock.document_id == document_id
        )
    )
    return result.scalar_one_or_none()


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/acquire", response_model=LockAcquiredResponse)
async def acquire_lock(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    request_data: AcquireLockRequest,
) -> Any:
    """
    Acquire a lock on a document for editing.

    Returns 409 Conflict if the document is already locked by another user.
    If the same user already holds the lock, it refreshes the expiration.
    """
    document_id = request_data.document_id

    # Verify document exists
    doc_result = await db.execute(
        select(models.GeneratedDocument).where(
            and_(
                models.GeneratedDocument.id == document_id,
                models.GeneratedDocument.is_deleted == False,
            )
        )
    )
    document = doc_result.scalar_one_or_none()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dokument nicht gefunden",
        )

    # Check for existing lock
    existing_lock = await _get_active_lock(db, document_id)

    if existing_lock:
        if existing_lock.locked_by_id == current_user.id:
            # Same user - refresh expiration
            existing_lock.expires_at = datetime.now(timezone.utc) + timedelta(
                minutes=LOCK_TIMEOUT_MINUTES
            )
            existing_lock.last_heartbeat = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(existing_lock)

            return LockAcquiredResponse(
                message="Sperre erneuert",
                document_id=document_id,
                expires_at=existing_lock.expires_at.isoformat(),
                lock_id=existing_lock.id,
            )

        # Different user - conflict
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": f"Dokument wird von {existing_lock.locked_by_name or existing_lock.locked_by_email} bearbeitet",
                "locked_by_email": existing_lock.locked_by_email,
                "locked_by_name": existing_lock.locked_by_name,
                "locked_at": existing_lock.locked_at.isoformat() if existing_lock.locked_at else None,
                "expires_at": existing_lock.expires_at.isoformat() if existing_lock.expires_at else None,
            },
        )

    # Create new lock
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=LOCK_TIMEOUT_MINUTES)
    new_lock = models.DocumentLock(
        document_id=document_id,
        locked_by_id=current_user.id,
        locked_by_email=current_user.email,
        locked_by_name=getattr(current_user, "display_name", None) or current_user.email,
        expires_at=expires_at,
        lock_reason=request_data.lock_reason,
    )

    db.add(new_lock)
    await db.commit()
    await db.refresh(new_lock)

    logger.info(
        f"Lock acquired on document {document_id} by {current_user.email} "
        f"(reason: {request_data.lock_reason}, expires: {expires_at.isoformat()})"
    )

    return LockAcquiredResponse(
        message="Dokument gesperrt",
        document_id=document_id,
        expires_at=expires_at.isoformat(),
        lock_id=new_lock.id,
    )


@router.post("/release")
async def release_lock(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    request_data: ReleaseLockRequest,
) -> Any:
    """
    Release a lock on a document.

    Only the lock holder or an admin can release the lock.
    """
    existing_lock = await _get_active_lock(db, request_data.document_id)

    if not existing_lock:
        return {"message": "Keine Sperre vorhanden", "document_id": request_data.document_id}

    # Only lock holder or admin can release
    if existing_lock.locked_by_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nur der Sperr-Inhaber oder ein Admin kann die Sperre aufheben",
        )

    await db.delete(existing_lock)
    await db.commit()

    logger.info(
        f"Lock released on document {request_data.document_id} "
        f"by {current_user.email}"
    )

    return {"message": "Sperre aufgehoben", "document_id": request_data.document_id}


@router.get("/{document_id}", response_model=LockStatusResponse)
async def check_lock_status(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    document_id: int,
) -> Any:
    """
    Check the lock status of a document.

    Returns lock info including whether it's the current user's lock.
    """
    existing_lock = await _get_active_lock(db, document_id)

    if not existing_lock:
        return LockStatusResponse(is_locked=False)

    is_expired = _make_naive(existing_lock.expires_at) < _utcnow() if existing_lock.expires_at else False

    return LockStatusResponse(
        is_locked=True,
        locked_by_id=existing_lock.locked_by_id,
        locked_by_email=existing_lock.locked_by_email,
        locked_by_name=existing_lock.locked_by_name,
        locked_at=existing_lock.locked_at.isoformat() if existing_lock.locked_at else None,
        expires_at=existing_lock.expires_at.isoformat() if existing_lock.expires_at else None,
        lock_reason=existing_lock.lock_reason,
        is_own_lock=existing_lock.locked_by_id == current_user.id,
        is_expired=is_expired,
    )


@router.post("/heartbeat")
async def heartbeat(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    request_data: HeartbeatRequest,
) -> Any:
    """
    Send heartbeat to keep a lock alive.

    Frontend should call this every ~5 minutes to prevent lock expiration.
    Only the lock holder can send heartbeats.
    """
    existing_lock = await _get_active_lock(db, request_data.document_id)

    if not existing_lock:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Keine aktive Sperre für dieses Dokument",
        )

    if existing_lock.locked_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sie sind nicht der Sperr-Inhaber",
        )

    # Extend expiration
    existing_lock.last_heartbeat = datetime.now(timezone.utc)
    existing_lock.expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=LOCK_TIMEOUT_MINUTES
    )
    await db.commit()

    return {
        "message": "Sperre verlängert",
        "document_id": request_data.document_id,
        "expires_at": existing_lock.expires_at.isoformat(),
    }


@router.post("/force-release")
async def force_release_lock(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    request_data: ReleaseLockRequest,
) -> Any:
    """
    Admin-only: Force-release a lock on a document.

    Use when a lock is stuck (e.g., user's browser crashed).
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nur Administratoren können Sperren erzwingen",
        )

    result = await db.execute(
        select(models.DocumentLock).where(
            models.DocumentLock.document_id == request_data.document_id
        )
    )
    lock = result.scalar_one_or_none()

    if not lock:
        return {"message": "Keine Sperre vorhanden", "document_id": request_data.document_id}

    locked_by = lock.locked_by_email
    await db.delete(lock)
    await db.commit()

    logger.warning(
        f"Lock force-released on document {request_data.document_id} "
        f"by admin {current_user.email} (was held by {locked_by})"
    )

    return {
        "message": f"Sperre von {locked_by} erzwungen aufgehoben",
        "document_id": request_data.document_id,
    }
