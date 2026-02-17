"""
Logo Upload API: Handles company logo uploads for document headers.

Security: All endpoints require admin authentication.
"""
import logging
import re
from pathlib import Path
from typing import Annotated

from app.api.v1.endpoints.documents.preview import invalidate_logo_cache

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import os
import aiofiles
from datetime import datetime

from app.db import get_db
from app.api.deps import get_current_active_admin
from app.models.core import DesignSetting, User

logger = logging.getLogger(__name__)

router = APIRouter()

LOGO_STORAGE_PATH = Path("storage/logos")

# Allowed filename pattern: alphanumeric, underscores, dots, hyphens only
_SAFE_FILENAME_RE = re.compile(r"^[a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+$")


@router.post("/{country_code}")
async def upload_logo(
    country_code: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_active_admin)] = None,
):
    """
    Upload a company logo for a specific country.
    Supported formats: PNG, JPG (SVG disabled for security)
    Max size: 2MB
    Requires: admin role.
    """
    # Validate file type (SVG disabled: can contain XSS via <script> tags)
    allowed_types = {"image/png", "image/jpeg"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Nur PNG oder JPG erlaubt (SVG nicht unterstützt aus Sicherheitsgründen)"
        )

    # Read and check size (2MB max)
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Datei zu groß. Maximum: 2MB"
        )

    # Validate image content for PNG/JPEG (magic bytes check)
    if file.content_type == "image/png" and not content[:8].startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(status_code=400, detail="Ungültige PNG-Datei")
    if file.content_type == "image/jpeg" and not content[:2] == b"\xff\xd8":
        raise HTTPException(status_code=400, detail="Ungültige JPEG-Datei")

    # Sanitize country_code to prevent path traversal
    safe_country = country_code.lower().replace("..", "").replace("/", "").replace("\\", "")

    # Create directory with explicit permissions
    storage_dir = LOGO_STORAGE_PATH / safe_country
    storage_dir.mkdir(parents=True, exist_ok=True, mode=0o755)

    # Generate filename with timestamp
    allowed_extensions = {"png", "jpg", "jpeg"}
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'png'
    if ext not in allowed_extensions:
        ext = "png"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"logo_{timestamp}.{ext}"
    file_path = f"{safe_country}/{filename}"
    full_path = LOGO_STORAGE_PATH / file_path

    # Save file
    async with aiofiles.open(str(full_path), 'wb') as f:
        await f.write(content)

    # Update design settings
    result = await db.execute(
        select(DesignSetting).where(DesignSetting.country_code == country_code.upper())
    )
    design = result.scalar_one_or_none()

    if design:
        # Delete old logo if exists
        if design.logo_path:
            invalidate_logo_cache(design.logo_path)
            old_path = LOGO_STORAGE_PATH / design.logo_path
            if old_path.exists():
                try:
                    old_path.unlink()
                except (FileNotFoundError, OSError) as e:
                    logger.warning(f"Could not delete old logo {design.logo_path}: {e}")
        design.logo_path = file_path
    else:
        design = DesignSetting(
            country_code=country_code.upper(),
            company_name="Company",
            logo_path=file_path
        )
        db.add(design)

    await db.commit()

    return {
        "status": "uploaded",
        "logo_path": file_path,
        "url": f"/api/v1/admin/logo/{safe_country}/{filename}"
    }


@router.get("/{country_code}/{filename}")
async def get_logo(country_code: str, filename: str):
    """Serve a logo file. Public endpoint (logos shown in documents)."""
    # Validate filename to prevent path traversal
    if not _SAFE_FILENAME_RE.match(filename):
        raise HTTPException(status_code=400, detail="Ungültiger Dateiname")

    safe_country = country_code.lower().replace("..", "").replace("/", "").replace("\\", "")
    file_path = LOGO_STORAGE_PATH / safe_country / filename

    # Resolve and verify the path is within LOGO_STORAGE_PATH
    try:
        resolved = file_path.resolve()
        if not resolved.is_relative_to(LOGO_STORAGE_PATH.resolve()):
            raise HTTPException(status_code=403, detail="Zugriff verweigert")
    except (ValueError, RuntimeError):
        raise HTTPException(status_code=400, detail="Ungültiger Pfad")

    if not resolved.exists():
        raise HTTPException(status_code=404, detail="Logo nicht gefunden")

    # Determine content type
    ext = filename.split('.')[-1].lower()
    content_types = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg"
    }

    return FileResponse(
        str(resolved),
        media_type=content_types.get(ext, "application/octet-stream")
    )


@router.delete("/{country_code}")
async def delete_logo(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_active_admin)] = None,
):
    """Delete the logo for a specific country. Requires: admin role."""
    result = await db.execute(
        select(DesignSetting).where(DesignSetting.country_code == country_code.upper())
    )
    design = result.scalar_one_or_none()

    if not design or not design.logo_path:
        raise HTTPException(status_code=404, detail="Kein Logo vorhanden")

    # Invalidate base64 cache
    invalidate_logo_cache(design.logo_path)

    # Delete file
    full_path = LOGO_STORAGE_PATH / design.logo_path
    if full_path.exists():
        try:
            full_path.unlink()
        except (FileNotFoundError, OSError) as e:
            logger.warning(f"Could not delete logo file {design.logo_path}: {e}")

    design.logo_path = None
    await db.commit()

    return {"status": "deleted"}
