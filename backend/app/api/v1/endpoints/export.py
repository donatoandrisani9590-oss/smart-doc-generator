"""
Export API (16.6)

Provides:
- ZIP export of multiple documents
- PDF merge functionality
- Batch download with progress tracking
- Export history

Supports various export formats:
- ZIP: Multiple files bundled together
- Merged PDF: Multiple PDFs combined into one
"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import os
import zipfile
import tempfile
import shutil
import io

from app.db import get_db
from app.models.enterprise import GeneratedDocument
from app.models.documents import DocumentType
from app.api.deps import get_current_user

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class ExportRequest(BaseModel):
    document_ids: List[int]
    format: str = "zip"  # "zip" or "merged_pdf"
    filename_prefix: str = "export"


class ExportResponse(BaseModel):
    success: bool
    file_count: int
    total_size_bytes: int
    download_url: str
    expires_at: datetime


class MergePdfRequest(BaseModel):
    document_ids: List[int]
    output_filename: str = "merged"
    include_separator_pages: bool = False


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

def get_safe_filename(name: str) -> str:
    """Convert a name to a safe filename."""
    # Remove or replace unsafe characters
    unsafe_chars = '<>:"/\\|?*'
    for char in unsafe_chars:
        name = name.replace(char, '_')
    return name[:100]  # Limit length


async def get_document_file_info(
    db: AsyncSession, document_id: int, user_id: str
) -> tuple[str, str, str]:
    """Get file path and display name for a document."""
    result = await db.execute(
        select(GeneratedDocument, DocumentType)
        .join(DocumentType, GeneratedDocument.document_type_id == DocumentType.id)
        .where(
            and_(
                GeneratedDocument.id == document_id,
                GeneratedDocument.is_deleted == False,
            )
        )
    )
    row = result.first()
    if not row:
        return None, None, None

    doc, doc_type = row

    # Build display filename
    employee_part = doc.employee_name or f"doc_{doc.id}"
    date_part = doc.created_at.strftime("%Y%m%d") if doc.created_at else "unknown"
    ext = os.path.splitext(doc.file_path)[1] or ".pdf"
    display_name = f"{get_safe_filename(doc_type.name)}_{get_safe_filename(employee_part)}_{date_part}{ext}"

    return doc.file_path, display_name, ext


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/zip")
async def export_as_zip(
    request: ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Export multiple documents as a ZIP file.

    Creates a ZIP archive containing all requested documents
    with meaningful filenames based on document type and employee.
    """
    if not request.document_ids:
        raise HTTPException(status_code=400, detail="Keine Dokumente ausgewählt")

    if len(request.document_ids) > 100:
        raise HTTPException(status_code=400, detail="Maximal 100 Dokumente pro Export")

    user_id = current_user.get("sub", "unknown")

    # Create temporary directory
    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, f"{request.filename_prefix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip")

    try:
        files_added = 0
        total_size = 0
        errors = []

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for doc_id in request.document_ids:
                file_path, display_name, ext = await get_document_file_info(db, doc_id, user_id)

                if not file_path:
                    errors.append(f"Dokument {doc_id} nicht gefunden")
                    continue

                if not os.path.exists(file_path):
                    errors.append(f"Datei für Dokument {doc_id} nicht gefunden")
                    continue

                # Ensure unique filenames in ZIP
                base_name = os.path.splitext(display_name)[0]
                final_name = display_name
                counter = 1
                while final_name in [info.filename for info in zipf.filelist]:
                    final_name = f"{base_name}_{counter}{ext}"
                    counter += 1

                zipf.write(file_path, final_name)
                files_added += 1
                total_size += os.path.getsize(file_path)

        if files_added == 0:
            raise HTTPException(status_code=404, detail="Keine Dateien zum Exportieren gefunden")

        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename=os.path.basename(zip_path),
            headers={
                "X-Files-Included": str(files_added),
                "X-Total-Size": str(total_size),
                "X-Errors": str(len(errors)),
            },
        )

    except Exception as e:
        # Clean up temp directory on error
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Export fehlgeschlagen: {str(e)}")


@router.post("/merge-pdf")
async def merge_pdfs(
    request: MergePdfRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Merge multiple PDF documents into a single file.

    Uses PyPDF2 to combine PDFs while preserving quality.
    Optionally adds separator pages between documents.
    """
    if not request.document_ids:
        raise HTTPException(status_code=400, detail="Keine Dokumente ausgewählt")

    if len(request.document_ids) > 50:
        raise HTTPException(status_code=400, detail="Maximal 50 Dokumente pro Merge")

    try:
        from PyPDF2 import PdfReader, PdfWriter
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas as rl_canvas
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="PDF-Merge nicht verfügbar. Bitte Abhängigkeiten installieren."
        )

    user_id = current_user.get("sub", "unknown")

    # Create temporary directory
    temp_dir = tempfile.mkdtemp()
    output_path = os.path.join(temp_dir, f"{get_safe_filename(request.output_filename)}.pdf")

    try:
        writer = PdfWriter()
        documents_merged = 0

        for doc_id in request.document_ids:
            file_path, display_name, ext = await get_document_file_info(db, doc_id, user_id)

            if not file_path or not os.path.exists(file_path):
                continue

            # Only process PDFs
            if ext.lower() != ".pdf":
                continue

            # Add separator page if requested
            if request.include_separator_pages and documents_merged > 0:
                # Create separator page
                separator_path = os.path.join(temp_dir, f"separator_{doc_id}.pdf")
                c = rl_canvas.Canvas(separator_path, pagesize=A4)
                c.setFont("Helvetica-Bold", 24)
                c.drawCentredString(A4[0] / 2, A4[1] / 2, display_name)
                c.setFont("Helvetica", 12)
                c.drawCentredString(A4[0] / 2, A4[1] / 2 - 30, f"Dokument {documents_merged + 1}")
                c.save()

                separator_reader = PdfReader(separator_path)
                writer.add_page(separator_reader.pages[0])

            # Add document pages
            try:
                reader = PdfReader(file_path)
                for page in reader.pages:
                    writer.add_page(page)
                documents_merged += 1
            except Exception as e:
                # Skip corrupted PDFs
                continue

        if documents_merged == 0:
            raise HTTPException(status_code=404, detail="Keine PDF-Dateien zum Zusammenführen gefunden")

        # Write output
        with open(output_path, "wb") as output_file:
            writer.write(output_file)

        return FileResponse(
            output_path,
            media_type="application/pdf",
            filename=f"{get_safe_filename(request.output_filename)}.pdf",
            headers={
                "X-Documents-Merged": str(documents_merged),
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"PDF-Merge fehlgeschlagen: {str(e)}")


@router.get("/single/{document_id}")
async def download_single_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Download a single document with proper filename.
    """
    user_id = current_user.get("sub", "unknown")
    file_path, display_name, ext = await get_document_file_info(db, document_id, user_id)

    if not file_path:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")

    media_type = "application/pdf" if ext.lower() == ".pdf" else "application/octet-stream"

    return FileResponse(
        file_path,
        media_type=media_type,
        filename=display_name,
    )


@router.get("/formats")
async def list_export_formats():
    """
    List available export formats with descriptions.
    """
    return {
        "formats": [
            {
                "id": "zip",
                "name": "ZIP-Archiv",
                "description": "Alle Dokumente in einer ZIP-Datei herunterladen",
                "max_documents": 100,
                "supports_all_types": True,
            },
            {
                "id": "merged_pdf",
                "name": "Zusammengeführte PDF",
                "description": "Alle PDFs zu einem Dokument zusammenfügen",
                "max_documents": 50,
                "supports_all_types": False,  # Only PDFs
                "note": "Nur PDF-Dokumente werden berücksichtigt",
            },
        ]
    }


@router.post("/preview")
async def preview_export(
    request: ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Preview an export without downloading.

    Returns information about what would be included in the export.
    """
    user_id = current_user.get("sub", "unknown")
    files = []
    total_size = 0
    pdf_count = 0

    for doc_id in request.document_ids:
        file_path, display_name, ext = await get_document_file_info(db, doc_id, user_id)

        if file_path and os.path.exists(file_path):
            size = os.path.getsize(file_path)
            total_size += size
            is_pdf = ext.lower() == ".pdf"
            if is_pdf:
                pdf_count += 1

            files.append({
                "document_id": doc_id,
                "filename": display_name,
                "size_bytes": size,
                "is_pdf": is_pdf,
            })

    return {
        "file_count": len(files),
        "pdf_count": pdf_count,
        "total_size_bytes": total_size,
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "files": files,
        "can_merge_pdf": pdf_count > 0,
        "can_zip": len(files) > 0,
    }
