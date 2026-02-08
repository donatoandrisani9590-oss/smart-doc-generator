"""
User Templates API: CRUD operations for user-uploaded DOCX templates.

Users can upload their own branded DOCX templates (with logo, header/footer)
to use as layout basis when generating documents.
"""
import os
import re
import uuid
import logging
import aiofiles
from datetime import datetime
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.db import get_db
from app.models.core import User
from app.models.user_templates import UserTemplate
from app.api.deps import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

# Storage path for user templates
BASE_DIR = Path(__file__).parent.parent.parent.parent.parent
USER_TEMPLATE_STORAGE = BASE_DIR / "storage" / "user-templates"
USER_TEMPLATE_STORAGE.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# DOCX magic bytes (PK zip header)
DOCX_MAGIC = b"PK\x03\x04"


def _analyze_docx(file_path: Path) -> dict:
    """Analyze a DOCX file to extract metadata about headers, footers, logos."""
    try:
        from docx import Document
        doc = Document(str(file_path))

        has_header = False
        has_footer = False
        has_logo = False
        font_family = None

        # Check sections for headers/footers
        for section in doc.sections:
            header = section.header
            if header and header.paragraphs:
                for para in header.paragraphs:
                    if para.text.strip():
                        has_header = True
                    for run in para.runs:
                        if run._element.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}drawing'):
                            has_logo = True
                            has_header = True

            footer = section.footer
            if footer and footer.paragraphs:
                for para in footer.paragraphs:
                    if para.text.strip():
                        has_footer = True
                    for run in para.runs:
                        if run._element.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}drawing'):
                            has_footer = True

        # Check images in the document package (rels)
        try:
            from docx.opc.constants import RELATIONSHIP_TYPE as RT
            rels = doc.part.rels
            for rel in rels.values():
                if "image" in rel.reltype:
                    has_logo = True
                    break
        except Exception:
            pass

        # Detect font from Normal style
        try:
            style = doc.styles['Normal']
            if style.font and style.font.name:
                font_family = style.font.name
        except Exception:
            pass

        # Fallback: check first paragraph run font
        if not font_family:
            for para in doc.paragraphs:
                for run in para.runs:
                    if run.font and run.font.name:
                        font_family = run.font.name
                        break
                if font_family:
                    break

        return {
            "has_header": has_header,
            "has_footer": has_footer,
            "has_logo": has_logo,
            "font_family": font_family,
        }
    except Exception as e:
        logger.warning(f"Could not analyze DOCX: {e}")
        return {
            "has_header": False,
            "has_footer": False,
            "has_logo": False,
            "font_family": None,
        }


@router.get("")
async def list_user_templates(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    country_code: Optional[str] = None,
):
    """List all templates uploaded by the current user."""
    query = select(UserTemplate).where(
        UserTemplate.user_id == current_user.id
    ).order_by(UserTemplate.created_at.desc())

    if country_code:
        query = query.where(UserTemplate.country_code == country_code.upper())

    result = await db.execute(query)
    templates = result.scalars().all()

    return {
        "items": [
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "original_filename": t.original_filename,
                "file_size": t.file_size,
                "country_code": t.country_code,
                "has_header": t.has_header,
                "has_footer": t.has_footer,
                "has_logo": t.has_logo,
                "font_family": t.font_family,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            }
            for t in templates
        ],
        "total": len(templates),
    }


@router.post("")
async def upload_user_template(
    file: UploadFile = File(...),
    name: str = Query(..., min_length=1, max_length=255, description="Name der Vorlage"),
    description: Optional[str] = Query(None, max_length=1000),
    country_code: Optional[str] = Query(None, max_length=2),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a new DOCX template.

    The template will be analyzed for headers, footers, logos and font.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith('.docx'):
        raise HTTPException(status_code=400, detail="Nur DOCX-Dateien sind erlaubt")

    # Read content
    content = await file.read()

    # Validate size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Datei zu gross. Maximum: 10 MB")

    # Validate magic bytes (DOCX is a ZIP file)
    if not content[:4] == DOCX_MAGIC:
        raise HTTPException(status_code=400, detail="Ungueltige DOCX-Datei")

    # Validate country code if provided
    if country_code:
        country_code = country_code.upper()
        if not re.match(r'^[A-Z]{2}$', country_code):
            raise HTTPException(status_code=400, detail="Ungueltiger Laendercode (2 Buchstaben)")

    # Create user directory
    user_dir = USER_TEMPLATE_STORAGE / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    file_uuid = str(uuid.uuid4())
    stored_filename = f"{file_uuid}.docx"
    file_path = user_dir / stored_filename

    # Verify path is within storage directory (prevent traversal)
    if not file_path.resolve().is_relative_to(USER_TEMPLATE_STORAGE.resolve()):
        raise HTTPException(status_code=400, detail="Ungueltiger Dateipfad")

    # Save file
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)

    # Analyze DOCX structure
    metadata = _analyze_docx(file_path)

    # Create database record
    template = UserTemplate(
        user_id=current_user.id,
        name=name,
        description=description,
        original_filename=file.filename,
        stored_filename=stored_filename,
        file_size=len(content),
        country_code=country_code,
        has_header=metadata["has_header"],
        has_footer=metadata["has_footer"],
        has_logo=metadata["has_logo"],
        font_family=metadata["font_family"],
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    logger.info(f"User template uploaded: id={template.id}, user={current_user.id}, name={name}")

    return {
        "id": template.id,
        "name": template.name,
        "description": template.description,
        "original_filename": template.original_filename,
        "file_size": template.file_size,
        "country_code": template.country_code,
        "has_header": template.has_header,
        "has_footer": template.has_footer,
        "has_logo": template.has_logo,
        "font_family": template.font_family,
        "created_at": template.created_at.isoformat() if template.created_at else None,
    }


@router.get("/{template_id}")
async def get_user_template(
    template_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get metadata for a single user template."""
    template = await db.get(UserTemplate, template_id)
    if not template or template.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Vorlage nicht gefunden")

    return {
        "id": template.id,
        "name": template.name,
        "description": template.description,
        "original_filename": template.original_filename,
        "file_size": template.file_size,
        "country_code": template.country_code,
        "has_header": template.has_header,
        "has_footer": template.has_footer,
        "has_logo": template.has_logo,
        "font_family": template.font_family,
        "created_at": template.created_at.isoformat() if template.created_at else None,
        "updated_at": template.updated_at.isoformat() if template.updated_at else None,
    }


@router.get("/{template_id}/download")
async def download_user_template(
    template_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Download a user template file."""
    template = await db.get(UserTemplate, template_id)
    if not template or template.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Vorlage nicht gefunden")

    file_path = USER_TEMPLATE_STORAGE / str(current_user.id) / template.stored_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Template-Datei nicht gefunden")

    return FileResponse(
        str(file_path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=template.original_filename,
    )


@router.delete("/{template_id}")
async def delete_user_template(
    template_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Delete a user template."""
    template = await db.get(UserTemplate, template_id)
    if not template or template.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Vorlage nicht gefunden")

    # Remove file
    file_path = USER_TEMPLATE_STORAGE / str(current_user.id) / template.stored_filename
    if file_path.exists():
        os.remove(file_path)

    # Remove DB record
    await db.delete(template)
    await db.commit()

    logger.info(f"User template deleted: id={template_id}, user={current_user.id}")

    return {"status": "deleted", "id": template_id}
