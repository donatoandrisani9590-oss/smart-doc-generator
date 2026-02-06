"""
Document Correction API endpoints (15.5.2).

Enables users to:
- View correction history for a document
- Request a correction
- Submit corrected form data
- Generate new version
"""

from __future__ import annotations
from typing import Any, Annotated, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from sqlalchemy.sql import func
from pydantic import BaseModel
import json

from app.db import get_db
from app.api import deps
from app.models import core as core_models
from app.models import enterprise as models

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class DocumentVersionResponse(BaseModel):
    id: int
    document_id: int
    version_number: int
    file_path: str
    change_reason: Optional[str] = None
    changed_fields: Optional[List[str]] = None
    created_by: str
    created_at: str
    is_current: bool

    class Config:
        from_attributes = True


class CorrectionRequestResponse(BaseModel):
    id: int
    document_id: int
    status: str
    requested_changes: Optional[str] = None
    requested_by: str
    requested_at: str
    completed_by: Optional[str] = None
    completed_at: Optional[str] = None

    class Config:
        from_attributes = True


class DocumentWithVersionsResponse(BaseModel):
    id: int
    title: Optional[str] = None
    document_type_id: int
    employee_name: Optional[str] = None
    current_version: int
    is_correctable: bool
    created_at: str
    form_data: Optional[dict] = None
    versions: List[DocumentVersionResponse] = []

    class Config:
        from_attributes = True


class StartCorrectionRequest(BaseModel):
    """Start a correction for a document."""
    document_id: int
    requested_changes: Optional[str] = None


class SubmitCorrectionRequest(BaseModel):
    """Submit corrected form data."""
    form_data: dict
    change_reason: str
    changed_fields: List[str]


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/document/{document_id}", response_model=DocumentWithVersionsResponse)
async def get_document_with_versions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    document_id: int,
) -> Any:
    """
    Get a document with its version history.

    Returns the document metadata along with all versions,
    enabling correction workflow.
    """
    # Get document
    result = await db.execute(
        select(models.GeneratedDocument).where(
            and_(
                models.GeneratedDocument.id == document_id,
                models.GeneratedDocument.is_deleted == False,
            )
        )
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dokument nicht gefunden",
        )

    # Get versions
    versions_result = await db.execute(
        select(models.DocumentVersion)
        .where(models.DocumentVersion.document_id == document_id)
        .order_by(desc(models.DocumentVersion.version_number))
    )
    versions = versions_result.scalars().all()

    # Parse form data
    form_data = None
    if document.form_data:
        try:
            form_data = json.loads(document.form_data)
        except json.JSONDecodeError:
            form_data = {}

    # Build version responses
    version_responses = []
    for v in versions:
        changed_fields = None
        if v.changed_fields:
            try:
                changed_fields = json.loads(v.changed_fields)
            except json.JSONDecodeError:
                changed_fields = []

        version_responses.append(DocumentVersionResponse(
            id=v.id,
            document_id=v.document_id,
            version_number=v.version_number,
            file_path=v.file_path,
            change_reason=v.change_reason,
            changed_fields=changed_fields,
            created_by=v.created_by,
            created_at=v.created_at.isoformat() if v.created_at else "",
            is_current=v.is_current,
        ))

    return DocumentWithVersionsResponse(
        id=document.id,
        title=document.title,
        document_type_id=document.document_type_id,
        employee_name=document.employee_name,
        current_version=document.current_version or 1,
        is_correctable=document.is_correctable if document.is_correctable is not None else True,
        created_at=document.created_at.isoformat() if document.created_at else "",
        form_data=form_data,
        versions=version_responses,
    )


@router.get("/document/{document_id}/versions", response_model=List[DocumentVersionResponse])
async def get_document_versions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    document_id: int,
) -> Any:
    """Get all versions of a document."""
    result = await db.execute(
        select(models.DocumentVersion)
        .where(models.DocumentVersion.document_id == document_id)
        .order_by(desc(models.DocumentVersion.version_number))
    )
    versions = result.scalars().all()

    responses = []
    for v in versions:
        changed_fields = None
        if v.changed_fields:
            try:
                changed_fields = json.loads(v.changed_fields)
            except json.JSONDecodeError:
                changed_fields = []

        responses.append(DocumentVersionResponse(
            id=v.id,
            document_id=v.document_id,
            version_number=v.version_number,
            file_path=v.file_path,
            change_reason=v.change_reason,
            changed_fields=changed_fields,
            created_by=v.created_by,
            created_at=v.created_at.isoformat() if v.created_at else "",
            is_current=v.is_current,
        ))

    return responses


@router.post("/start", response_model=CorrectionRequestResponse)
async def start_correction(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    request_data: StartCorrectionRequest,
) -> Any:
    """
    Start a document correction process.

    Creates a correction request and returns the document's
    current form data for editing.
    """
    # Get document
    result = await db.execute(
        select(models.GeneratedDocument).where(
            and_(
                models.GeneratedDocument.id == request_data.document_id,
                models.GeneratedDocument.is_deleted == False,
            )
        )
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dokument nicht gefunden",
        )

    if not (document.is_correctable if document.is_correctable is not None else True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dieses Dokument kann nicht korrigiert werden",
        )

    # Check for existing pending correction
    existing = await db.execute(
        select(models.DocumentCorrectionRequest).where(
            and_(
                models.DocumentCorrectionRequest.document_id == request_data.document_id,
                models.DocumentCorrectionRequest.status.in_(["pending", "in_progress"]),
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Es gibt bereits eine offene Korrekturanfrage für dieses Dokument",
        )

    # Create correction request
    correction = models.DocumentCorrectionRequest(
        document_id=request_data.document_id,
        status="in_progress",
        requested_changes=request_data.requested_changes,
        requested_by=current_user.email,
    )

    db.add(correction)
    await db.commit()
    await db.refresh(correction)

    return CorrectionRequestResponse(
        id=correction.id,
        document_id=correction.document_id,
        status=correction.status,
        requested_changes=correction.requested_changes,
        requested_by=correction.requested_by,
        requested_at=correction.requested_at.isoformat() if correction.requested_at else "",
        completed_by=correction.completed_by,
        completed_at=correction.completed_at.isoformat() if correction.completed_at else None,
    )


@router.post("/{correction_id}/submit")
async def submit_correction(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    correction_id: int,
    submit_data: SubmitCorrectionRequest,
) -> Any:
    """
    Submit corrected form data.

    This will:
    1. Mark old version as non-current
    2. Create new document version
    3. Store new form data snapshot
    4. Mark correction request as completed

    Note: Actual document regeneration should be triggered separately
    via the /documents/generate endpoint with the updated form_data.
    """
    # Get correction request
    result = await db.execute(
        select(models.DocumentCorrectionRequest).where(
            models.DocumentCorrectionRequest.id == correction_id
        )
    )
    correction = result.scalar_one_or_none()

    if not correction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Korrekturanfrage nicht gefunden",
        )

    if correction.status not in ["pending", "in_progress"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Diese Korrekturanfrage ist bereits abgeschlossen",
        )

    # Get document
    doc_result = await db.execute(
        select(models.GeneratedDocument).where(
            models.GeneratedDocument.id == correction.document_id
        )
    )
    document = doc_result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dokument nicht gefunden",
        )

    # Mark current versions as non-current
    current_versions = await db.execute(
        select(models.DocumentVersion).where(
            and_(
                models.DocumentVersion.document_id == document.id,
                models.DocumentVersion.is_current == True,
            )
        )
    )
    for v in current_versions.scalars().all():
        v.is_current = False

    # Create new version
    new_version_number = (document.current_version or 1) + 1

    new_version = models.DocumentVersion(
        document_id=document.id,
        version_number=new_version_number,
        file_path=document.file_path,  # Will be updated after regeneration
        form_data_snapshot=json.dumps(submit_data.form_data, ensure_ascii=False),
        change_reason=submit_data.change_reason,
        changed_fields=json.dumps(submit_data.changed_fields, ensure_ascii=False),
        created_by=current_user.email,
        is_current=True,
    )

    db.add(new_version)

    # Update document
    document.current_version = new_version_number
    document.form_data = json.dumps(submit_data.form_data, ensure_ascii=False)

    # Complete correction request
    correction.status = "completed"
    correction.completed_by = current_user.email
    correction.completed_at = func.now()

    await db.commit()
    await db.refresh(new_version)

    return {
        "message": "Korrektur erfolgreich gespeichert",
        "new_version_number": new_version_number,
        "version_id": new_version.id,
        "document_id": document.id,
    }


@router.post("/{correction_id}/cancel")
async def cancel_correction(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    correction_id: int,
) -> Any:
    """Cancel a pending correction request."""
    result = await db.execute(
        select(models.DocumentCorrectionRequest).where(
            models.DocumentCorrectionRequest.id == correction_id
        )
    )
    correction = result.scalar_one_or_none()

    if not correction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Korrekturanfrage nicht gefunden",
        )

    if correction.status not in ["pending", "in_progress"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nur offene Korrekturanfragen können abgebrochen werden",
        )

    correction.status = "cancelled"
    await db.commit()

    return {"message": "Korrekturanfrage abgebrochen", "id": correction_id}


@router.get("/requests", response_model=List[CorrectionRequestResponse])
async def get_my_correction_requests(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    status_filter: Optional[str] = None,
) -> Any:
    """Get all correction requests by the current user."""
    query = select(models.DocumentCorrectionRequest).where(
        models.DocumentCorrectionRequest.requested_by == current_user.email
    )

    if status_filter:
        query = query.where(models.DocumentCorrectionRequest.status == status_filter)

    query = query.order_by(desc(models.DocumentCorrectionRequest.requested_at))

    result = await db.execute(query)
    requests = result.scalars().all()

    return [
        CorrectionRequestResponse(
            id=r.id,
            document_id=r.document_id,
            status=r.status,
            requested_changes=r.requested_changes,
            requested_by=r.requested_by,
            requested_at=r.requested_at.isoformat() if r.requested_at else "",
            completed_by=r.completed_by,
            completed_at=r.completed_at.isoformat() if r.completed_at else None,
        )
        for r in requests
    ]


@router.get("/version/{version_id}/download")
async def get_version_download_url(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    version_id: int,
) -> Any:
    """
    Get download information for a specific document version.

    Returns file path that can be used to download the document.
    """
    result = await db.execute(
        select(models.DocumentVersion).where(models.DocumentVersion.id == version_id)
    )
    version = result.scalar_one_or_none()

    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Version nicht gefunden",
        )

    return {
        "version_id": version.id,
        "version_number": version.version_number,
        "file_path": version.file_path,
        "created_at": version.created_at.isoformat() if version.created_at else "",
    }
