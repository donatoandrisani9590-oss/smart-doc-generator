"""
Attachments API: Manage static documents (GDPR forms, etc.) that can be appended to generated docs.
Requires authentication. Admin required for create/delete.
"""
import logging
import os
import re

import aiofiles
import magic
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Annotated

logger = logging.getLogger(__name__)

from app.db import get_db
from app.models.enterprise import Attachment, DocumentTypeAttachment
from app.models.core import User
from app.api.deps import get_current_user, get_current_active_admin

router = APIRouter()

ATTACHMENT_STORAGE_PATH = "storage/attachments"

# Maximale Dateigröße: 10 MB
MAX_FILE_SIZE = 10 * 1024 * 1024


class AttachmentCreate(BaseModel):
    country_code: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None


class AttachmentAssign(BaseModel):
    attachment_id: int
    display_order: int = 1
    is_mandatory: bool = False
    is_preselected: bool = True


def sanitize_filename(name: str) -> str:
    """Sanitize filename to prevent path traversal and invalid characters."""
    # Remove any path separators and dangerous characters
    safe_name = re.sub(r'[^\w\s\-äöüÄÖÜß]', '', name)
    safe_name = safe_name.replace(" ", "_").lower()
    # Limit length
    return safe_name[:100] if safe_name else "attachment"


@router.get("")
async def list_attachments(
    country_code: Optional[str] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """List all attachments, optionally filtered by country and category."""
    query = select(Attachment).where(Attachment.is_active == True)

    if country_code:
        query = query.where(Attachment.country_code == country_code.upper())
    if category:
        query = query.where(Attachment.category == category)

    result = await db.execute(query.order_by(Attachment.name))
    attachments = result.scalars().all()

    return [
        {
            "id": a.id,
            "name": a.name,
            "description": a.description,
            "country_code": a.country_code,
            "file_type": a.file_type,
            "file_size_bytes": a.file_size_bytes,
            "page_count": a.page_count,
            "category": a.category,
        }
        for a in attachments
    ]


@router.post("")
async def create_attachment(
    country_code: str = Query(..., description="Country code (e.g., DE, IT)", min_length=2, max_length=2),
    name: str = Query(..., description="Display name for the attachment", min_length=1, max_length=255),
    description: Optional[str] = Query(None, description="Optional description", max_length=1000),
    category: Optional[str] = Query(None, description="Optional category", max_length=100),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_active_admin)] = None
):
    """
    Upload a new attachment.

    Accepts PDF and DOCX files up to 10 MB.
    The file will be stored in the storage/attachments directory.
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="Dateiname fehlt")

    file_ext = file.filename.split('.')[-1].lower()
    if file_ext not in ('pdf', 'docx'):
        raise HTTPException(
            status_code=400,
            detail="Nur PDF- und DOCX-Dateien sind erlaubt"
        )

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Datei zu groß. Maximale Größe: {MAX_FILE_SIZE // (1024*1024)} MB"
        )

    # SECURITY: Validate MIME type via magic bytes (not file extension!)
    mime = magic.from_buffer(content, mime=True)
    allowed_mimes = {
        'application/pdf': 'pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
    }

    if mime not in allowed_mimes:
        raise HTTPException(
            status_code=415,
            detail=f"File type not allowed: {mime}. Only PDF and DOCX files are accepted."
        )

    # Use MIME-detected extension (more secure than user-provided)
    file_ext = allowed_mimes[mime]

    # Sanitize and prepare file path
    safe_name = sanitize_filename(name)
    safe_country = country_code.upper()[:2]

    # Create storage directory if needed
    storage_dir = f"{ATTACHMENT_STORAGE_PATH}/{safe_country.lower()}"
    os.makedirs(storage_dir, exist_ok=True)

    # Generate unique filename if exists
    file_path = f"{safe_country.lower()}/{safe_name}.{file_ext}"
    full_path = f"{ATTACHMENT_STORAGE_PATH}/{file_path}"

    counter = 1
    while os.path.exists(full_path):
        file_path = f"{safe_country.lower()}/{safe_name}_{counter}.{file_ext}"
        full_path = f"{ATTACHMENT_STORAGE_PATH}/{file_path}"
        counter += 1

    # Save file
    async with aiofiles.open(full_path, 'wb') as f:
        await f.write(content)

    # Get page count for PDFs
    page_count = None
    if file_ext == 'pdf':
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(full_path)
            page_count = doc.page_count
            doc.close()
        except (ImportError, RuntimeError, OSError) as e:
            logger.debug("PDF-Seitenzahl konnte nicht ermittelt werden: %s", e)

    # Create DB record
    attachment = Attachment(
        country_code=safe_country,
        name=name.strip(),
        description=description.strip() if description else None,
        file_path=file_path,
        file_type=file_ext,
        file_size_bytes=len(content),
        page_count=page_count,
        category=category.strip() if category else None,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    return {"id": attachment.id, "status": "uploaded"}


@router.get("/{attachment_id}")
async def get_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get attachment details."""
    attachment = await db.get(Attachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Anlage nicht gefunden")
    
    return {
        "id": attachment.id,
        "name": attachment.name,
        "description": attachment.description,
        "country_code": attachment.country_code,
        "file_path": attachment.file_path,
        "file_type": attachment.file_type,
        "file_size_bytes": attachment.file_size_bytes,
        "page_count": attachment.page_count,
        "category": attachment.category,
    }


@router.delete("/{attachment_id}")
async def delete_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_active_admin)] = None
):
    """Soft-delete an attachment. Requires admin privileges."""
    attachment = await db.get(Attachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Anlage nicht gefunden")
    
    attachment.is_active = False
    await db.commit()
    
    return {"status": "deleted"}


# ═══════════════════════════════════════════════════════════════════════════
# DOCUMENT TYPE <-> ATTACHMENT ASSIGNMENT
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/document-type/{document_type_id}")
async def get_attachments_for_document_type(
    document_type_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all attachments assigned to a document type."""
    result = await db.execute(
        select(DocumentTypeAttachment, Attachment)
        .join(Attachment, DocumentTypeAttachment.attachment_id == Attachment.id)
        .where(DocumentTypeAttachment.document_type_id == document_type_id)
        .order_by(DocumentTypeAttachment.display_order)
    )
    rows = result.all()
    
    return [
        {
            "attachment_id": row.Attachment.id,
            "name": row.Attachment.name,
            "file_type": row.Attachment.file_type,
            "page_count": row.Attachment.page_count,
            "display_order": row.DocumentTypeAttachment.display_order,
            "is_mandatory": row.DocumentTypeAttachment.is_mandatory,
            "is_preselected": row.DocumentTypeAttachment.is_preselected,
        }
        for row in rows
    ]


@router.post("/document-type/{document_type_id}/assign")
async def assign_attachment_to_document_type(
    document_type_id: int,
    assignment: AttachmentAssign,
    db: AsyncSession = Depends(get_db)
):
    """Assign an attachment to a document type."""
    # Check if already assigned
    existing = await db.execute(
        select(DocumentTypeAttachment)
        .where(
            DocumentTypeAttachment.document_type_id == document_type_id,
            DocumentTypeAttachment.attachment_id == assignment.attachment_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Anlage ist bereits zugewiesen")

    # Verify attachment exists and is active
    attachment = await db.get(Attachment, assignment.attachment_id)
    if not attachment or not attachment.is_active:
        raise HTTPException(status_code=404, detail="Anlage nicht gefunden")

    link = DocumentTypeAttachment(
        document_type_id=document_type_id,
        attachment_id=assignment.attachment_id,
        display_order=assignment.display_order,
        is_mandatory=assignment.is_mandatory,
        is_preselected=assignment.is_preselected
    )
    db.add(link)
    await db.commit()

    return {"status": "assigned"}


@router.delete("/document-type/{document_type_id}/unassign/{attachment_id}")
async def unassign_attachment_from_document_type(
    document_type_id: int,
    attachment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Remove an attachment assignment from a document type."""
    result = await db.execute(
        select(DocumentTypeAttachment)
        .where(
            DocumentTypeAttachment.document_type_id == document_type_id,
            DocumentTypeAttachment.attachment_id == attachment_id
        )
    )
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=404, detail="Zuweisung nicht gefunden")

    await db.delete(link)
    await db.commit()

    return {"status": "unassigned"}
