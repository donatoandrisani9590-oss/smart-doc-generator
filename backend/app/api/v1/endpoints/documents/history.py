"""
Document History API: User's generated document history.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import os

from app.db import get_db
from app.models.enterprise import GeneratedDocument

router = APIRouter()


@router.get("")
async def list_documents(
    user_id: str = "anonymous",
    country_code: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """
    List generated documents for a user.
    Returns document history with metadata.
    """
    query = select(GeneratedDocument).where(GeneratedDocument.created_by == user_id)
    
    if country_code:
        query = query.where(GeneratedDocument.country_code == country_code.upper())
    
    query = query.order_by(desc(GeneratedDocument.created_at)).offset(offset).limit(limit)
    
    result = await db.execute(query)
    documents = result.scalars().all()
    
    # Count total
    count_query = select(GeneratedDocument).where(GeneratedDocument.created_by == user_id)
    if country_code:
        count_query = count_query.where(GeneratedDocument.country_code == country_code.upper())
    count_result = await db.execute(count_query)
    total = len(count_result.scalars().all())
    
    return {
        "items": [
            {
                "id": doc.id,
                "document_type_id": doc.document_type_id,
                "country_code": doc.country_code,
                "file_format": doc.file_format,
                "file_path": doc.file_path,
                "created_at": doc.created_at,
                "form_data_summary": _get_form_summary(doc.form_data) if doc.form_data else None,
                "can_download": doc.file_path and os.path.exists(doc.file_path) if doc.file_path else False
            }
            for doc in documents
        ],
        "total": total,
        "limit": limit,
        "offset": offset
    }


def _get_form_summary(form_data: dict) -> dict:
    """Extract key fields for display summary."""
    if not form_data:
        return {}
    
    summary_fields = [
        "mitarbeiter_vorname", "mitarbeiter_nachname", "mitarbeiter_name",
        "eintrittsdatum", "position", "gehalt_brutto"
    ]
    
    return {k: v for k, v in form_data.items() if k in summary_fields}


@router.get("/{document_id}")
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get details of a specific generated document."""
    result = await db.execute(
        select(GeneratedDocument).where(GeneratedDocument.id == document_id)
    )
    doc = result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    
    return {
        "id": doc.id,
        "document_type_id": doc.document_type_id,
        "country_code": doc.country_code,
        "file_format": doc.file_format,
        "file_path": doc.file_path,
        "created_at": doc.created_at,
        "created_by": doc.created_by,
        "form_data": doc.form_data,
        "can_download": doc.file_path and os.path.exists(doc.file_path) if doc.file_path else False
    }


@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Download a generated document."""
    result = await db.execute(
        select(GeneratedDocument).where(GeneratedDocument.id == document_id)
    )
    doc = result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    
    if not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Datei nicht mehr verfügbar")
    
    media_type = "application/pdf" if doc.file_format == "pdf" else \
                 "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    
    return FileResponse(
        doc.file_path,
        media_type=media_type,
        filename=os.path.basename(doc.file_path)
    )


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a generated document from history."""
    result = await db.execute(
        select(GeneratedDocument).where(GeneratedDocument.id == document_id)
    )
    doc = result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    
    # Delete file if exists
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    
    await db.delete(doc)
    await db.commit()
    
    return {"status": "deleted", "id": document_id}


@router.post("/{document_id}/regenerate")
async def regenerate_document(
    document_id: int,
    format: str = "pdf",
    db: AsyncSession = Depends(get_db)
):
    """
    Regenerate a document using the saved form data.
    Useful if the template has been updated.
    """
    result = await db.execute(
        select(GeneratedDocument).where(GeneratedDocument.id == document_id)
    )
    doc = result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    
    if not doc.form_data:
        raise HTTPException(status_code=400, detail="Keine Formulardaten gespeichert")
    
    # Return form data for regeneration
    # The frontend should call /api/v1/documents/generate with this data
    return {
        "document_type_id": doc.document_type_id,
        "form_data": doc.form_data,
        "country_code": doc.country_code,
        "suggested_format": format,
        "message": "Verwenden Sie diese Daten mit /api/v1/documents/generate"
    }
