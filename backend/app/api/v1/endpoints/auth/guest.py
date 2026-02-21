from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models.enterprise import DocumentShare, GeneratedDocument
import os

router = APIRouter()

@router.get("/public/documents/{token}")
async def download_shared_document(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Public endpoint for downloading a shared document via guest link (token).
    """
    stmt = select(DocumentShare).where(
        DocumentShare.token == token,
        DocumentShare.is_active == True
    )
    result = await db.execute(stmt)
    share = result.scalar_one_or_none()
    
    if not share:
        raise HTTPException(status_code=404, detail="Link ungueltig oder abgelaufen")
    
    if share.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Link abgelaufen")
        
    # Fetch document
    doc_stmt = select(GeneratedDocument).where(GeneratedDocument.id == share.generated_document_id)
    doc_res = await db.execute(doc_stmt)
    doc = doc_res.scalar_one_or_none()
    
    if not doc or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
        
    return FileResponse(
        doc.file_path, 
        filename=os.path.basename(doc.file_path)
    )
