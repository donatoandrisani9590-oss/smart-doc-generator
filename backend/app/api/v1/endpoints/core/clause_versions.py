"""
Clause Versions API: Version history and rollback for clauses.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.db import get_db
from app.models.documents import Clause, ClauseVersion
from app.api.deps import get_current_user
from app.models.core import User

router = APIRouter()


class ClauseVersionResponse(BaseModel):
    id: int
    clause_id: int
    content: str
    version: str
    created_at: datetime
    created_by: Optional[str]

    class Config:
        from_attributes = True


@router.get("/{clause_id}/versions")
async def get_clause_versions(
    clause_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get version history for a clause.
    Returns all previous versions, newest first.
    """
    # Check clause exists
    result = await db.execute(select(Clause).where(Clause.id == clause_id))
    clause = result.scalar_one_or_none()
    
    if not clause:
        raise HTTPException(status_code=404, detail="Textbaustein nicht gefunden")
    
    # Get versions
    versions_result = await db.execute(
        select(ClauseVersion)
        .where(ClauseVersion.clause_id == clause_id)
        .order_by(desc(ClauseVersion.created_at))
    )
    versions = versions_result.scalars().all()
    
    return {
        "clause_id": clause_id,
        "clause_title": clause.title,
        "current_version": clause.version,
        "current_content": clause.content,
        "versions": [
            {
                "id": v.id,
                "version": v.version,
                "content": v.content,
                "created_at": v.created_at,
                "created_by": v.created_by
            }
            for v in versions
        ],
        "total_versions": len(versions)
    }


@router.post("/{clause_id}/versions")
async def create_version_snapshot(
    clause_id: int,
    created_by: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a manual version snapshot of the current clause content.
    Usually this is done automatically on updates.
    """
    result = await db.execute(select(Clause).where(Clause.id == clause_id))
    clause = result.scalar_one_or_none()
    
    if not clause:
        raise HTTPException(status_code=404, detail="Textbaustein nicht gefunden")
    
    # Create version snapshot
    version = ClauseVersion(
        clause_id=clause_id,
        content=clause.content,
        version=clause.version,
        created_by=created_by or "system"
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    
    return {
        "status": "created",
        "version_id": version.id,
        "version": version.version
    }


@router.post("/{clause_id}/versions/{version_id}/restore")
async def restore_version(
    clause_id: int,
    version_id: int,
    created_by: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Restore a clause to a previous version.
    Creates a new version snapshot of the current content before restoring.
    """
    # Get clause
    result = await db.execute(select(Clause).where(Clause.id == clause_id))
    clause = result.scalar_one_or_none()
    
    if not clause:
        raise HTTPException(status_code=404, detail="Textbaustein nicht gefunden")
    
    # Get version to restore
    version_result = await db.execute(
        select(ClauseVersion)
        .where(ClauseVersion.id == version_id, ClauseVersion.clause_id == clause_id)
    )
    version = version_result.scalar_one_or_none()
    
    if not version:
        raise HTTPException(status_code=404, detail="Version nicht gefunden")
    
    # Create snapshot of current content before restoring
    current_snapshot = ClauseVersion(
        clause_id=clause_id,
        content=clause.content,
        version=clause.version,
        created_by=f"auto-backup before restore by {created_by or 'system'}"
    )
    db.add(current_snapshot)
    
    # Restore old content
    old_version = clause.version
    clause.content = version.content
    
    # Increment version number
    try:
        major, minor = clause.version.split('.')
        clause.version = f"{major}.{int(minor) + 1}"
    except (ValueError, AttributeError):
        clause.version = f"{clause.version}.restored"
    
    await db.commit()
    
    return {
        "status": "restored",
        "clause_id": clause_id,
        "restored_from_version": version.version,
        "new_version": clause.version,
        "old_version_backed_up": old_version
    }


@router.get("/{clause_id}/versions/{version_id}")
async def get_version_detail(
    clause_id: int,
    version_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get details of a specific version."""
    version_result = await db.execute(
        select(ClauseVersion)
        .where(ClauseVersion.id == version_id, ClauseVersion.clause_id == clause_id)
    )
    version = version_result.scalar_one_or_none()
    
    if not version:
        raise HTTPException(status_code=404, detail="Version nicht gefunden")
    
    return {
        "id": version.id,
        "clause_id": version.clause_id,
        "version": version.version,
        "content": version.content,
        "created_at": version.created_at,
        "created_by": version.created_by
    }


@router.get("/{clause_id}/versions/{version_id}/diff")
async def get_version_diff(
    clause_id: int,
    version_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compare a version with the current clause content.
    Returns a simple diff summary.
    """
    # Get clause
    result = await db.execute(select(Clause).where(Clause.id == clause_id))
    clause = result.scalar_one_or_none()
    
    if not clause:
        raise HTTPException(status_code=404, detail="Textbaustein nicht gefunden")
    
    # Get version
    version_result = await db.execute(
        select(ClauseVersion)
        .where(ClauseVersion.id == version_id, ClauseVersion.clause_id == clause_id)
    )
    version = version_result.scalar_one_or_none()
    
    if not version:
        raise HTTPException(status_code=404, detail="Version nicht gefunden")
    
    # Simple diff calculation
    current_lines = clause.content.split('\n')
    version_lines = version.content.split('\n')
    
    return {
        "clause_id": clause_id,
        "current_version": clause.version,
        "compared_version": version.version,
        "current_length": len(clause.content),
        "version_length": len(version.content),
        "current_lines": len(current_lines),
        "version_lines": len(version_lines),
        "is_different": clause.content != version.content,
        "current_content": clause.content,
        "version_content": version.content
    }
