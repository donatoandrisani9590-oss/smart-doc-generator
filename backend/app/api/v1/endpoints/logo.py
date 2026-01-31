"""
Logo Upload API: Handles company logo uploads for document headers.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import os
import aiofiles
from datetime import datetime

from app.db import get_db
from app.models.core import DesignSetting

router = APIRouter()

LOGO_STORAGE_PATH = "storage/logos"


@router.post("/{country_code}")
async def upload_logo(
    country_code: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a company logo for a specific country.
    Supported formats: PNG, JPG, SVG
    Max size: 2MB
    """
    # Validate file type
    allowed_types = {"image/png", "image/jpeg", "image/svg+xml"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail="Nur PNG, JPG oder SVG erlaubt"
        )
    
    # Read and check size (2MB max)
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Datei zu groß. Maximum: 2MB"
        )
    
    # Create directory if needed
    os.makedirs(f"{LOGO_STORAGE_PATH}/{country_code.lower()}", exist_ok=True)
    
    # Generate filename with timestamp
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'png'
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"logo_{timestamp}.{ext}"
    file_path = f"{country_code.lower()}/{filename}"
    full_path = f"{LOGO_STORAGE_PATH}/{file_path}"
    
    # Save file
    async with aiofiles.open(full_path, 'wb') as f:
        await f.write(content)
    
    # Update design settings
    result = await db.execute(
        select(DesignSetting).where(DesignSetting.country_code == country_code.upper())
    )
    design = result.scalar_one_or_none()
    
    if design:
        # Delete old logo if exists
        if design.logo_path and os.path.exists(f"{LOGO_STORAGE_PATH}/{design.logo_path}"):
            try:
                os.remove(f"{LOGO_STORAGE_PATH}/{design.logo_path}")
            except:
                pass
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
        "url": f"/api/v1/admin/logo/{country_code.lower()}/{filename}"
    }


@router.get("/{country_code}/{filename}")
async def get_logo(country_code: str, filename: str):
    """Serve a logo file."""
    file_path = f"{LOGO_STORAGE_PATH}/{country_code.lower()}/{filename}"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Logo nicht gefunden")
    
    # Determine content type
    ext = filename.split('.')[-1].lower()
    content_types = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "svg": "image/svg+xml"
    }
    
    return FileResponse(
        file_path,
        media_type=content_types.get(ext, "application/octet-stream")
    )


@router.delete("/{country_code}")
async def delete_logo(
    country_code: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete the logo for a specific country."""
    result = await db.execute(
        select(DesignSetting).where(DesignSetting.country_code == country_code.upper())
    )
    design = result.scalar_one_or_none()
    
    if not design or not design.logo_path:
        raise HTTPException(status_code=404, detail="Kein Logo vorhanden")
    
    # Delete file
    full_path = f"{LOGO_STORAGE_PATH}/{design.logo_path}"
    if os.path.exists(full_path):
        os.remove(full_path)
    
    design.logo_path = None
    await db.commit()
    
    return {"status": "deleted"}
