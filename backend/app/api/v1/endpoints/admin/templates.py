"""
Master Templates API: CRUD operations for document master templates.
Requires admin authentication for upload/delete operations.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Annotated
import os
import aiofiles
import re
from datetime import datetime

from app.db import get_db
from app.models.core import User
from app.api.deps import get_current_user, get_current_active_admin

router = APIRouter()

TEMPLATE_STORAGE_PATH = "storage/master-templates"


class TemplateMetadata(BaseModel):
    id: int
    country_code: str
    category: str
    name: str
    filename: str
    file_size: int
    created_at: datetime
    updated_at: datetime


class TemplateCreate(BaseModel):
    country_code: str
    category: str  # "contract" or "letter"
    name: str


# In-memory registry (in production, this would be a DB table)
# For simplicity, we'll use file system + naming convention
TEMPLATE_CATEGORIES = ["contract", "letter", "memo", "certificate", "amendment", "default"]


def get_template_path(country_code: str, category: str) -> str:
    """Get the standard template path for a country and category."""
    return f"{TEMPLATE_STORAGE_PATH}/template_{category}_{country_code.lower()}.docx"


def list_templates_from_fs() -> list[dict]:
    """List all templates from the file system."""
    templates = []
    if not os.path.exists(TEMPLATE_STORAGE_PATH):
        os.makedirs(TEMPLATE_STORAGE_PATH, exist_ok=True)
        return templates
    
    for filename in os.listdir(TEMPLATE_STORAGE_PATH):
        if filename.endswith('.docx') and filename.startswith('template_'):
            parts = filename.replace('.docx', '').split('_')
            if len(parts) >= 3:
                category = parts[1]
                country_code = parts[2].upper()
                full_path = os.path.join(TEMPLATE_STORAGE_PATH, filename)
                stat = os.stat(full_path)
                templates.append({
                    "id": hash(filename) % 100000,
                    "country_code": country_code,
                    "category": category,
                    "name": f"{category.title()} Template ({country_code})",
                    "filename": filename,
                    "file_size": stat.st_size,
                    "created_at": datetime.fromtimestamp(stat.st_ctime),
                    "updated_at": datetime.fromtimestamp(stat.st_mtime),
                })
    return templates


@router.get("")
async def list_templates(
    country_code: Optional[str] = None,
    category: Optional[str] = None
):
    """
    List all master templates.
    Optional filters: country_code, category
    """
    templates = list_templates_from_fs()
    
    if country_code:
        templates = [t for t in templates if t["country_code"] == country_code.upper()]
    if category:
        templates = [t for t in templates if t["category"] == category]
    
    return {
        "items": templates,
        "total": len(templates),
        "categories": TEMPLATE_CATEGORIES
    }


@router.post("")
async def upload_template(
    country_code: str,
    category: str,
    file: UploadFile = File(...),
    current_user: Annotated[User, Depends(get_current_active_admin)] = None
):
    """
    Upload a new master template or replace an existing one.

    Requires admin privileges.
    File must be a .docx file.
    """
    # Validate country code format
    if not re.match(r'^[A-Z]{2}$', country_code.upper()):
        raise HTTPException(status_code=400, detail="Ungültiger Ländercode. Format: 2 Buchstaben (z.B. DE, IT)")

    if not file.filename or not file.filename.lower().endswith('.docx'):
        raise HTTPException(status_code=400, detail="Nur DOCX-Dateien erlaubt")
    
    if category not in TEMPLATE_CATEGORIES:
        raise HTTPException(
            status_code=400, 
            detail=f"Ungültige Kategorie. Erlaubt: {TEMPLATE_CATEGORIES}"
        )
    
    if country_code.upper() not in ["DE", "IT"]:
        raise HTTPException(status_code=400, detail="Nur DE oder IT erlaubt")
    
    # Read file content
    content = await file.read()
    
    # Max 10MB
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Datei zu groß. Maximum: 10MB")
    
    # Ensure directory exists
    os.makedirs(TEMPLATE_STORAGE_PATH, exist_ok=True)
    
    # Save with standardized name
    template_path = get_template_path(country_code, category)
    
    # Backup existing if present
    if os.path.exists(template_path):
        backup_path = template_path.replace('.docx', f'_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.docx')
        os.rename(template_path, backup_path)
    
    async with aiofiles.open(template_path, 'wb') as f:
        await f.write(content)
    
    return {
        "status": "uploaded",
        "country_code": country_code.upper(),
        "category": category,
        "filename": os.path.basename(template_path),
        "file_size": len(content)
    }


@router.get("/{country_code}/{category}/download")
async def download_template(country_code: str, category: str):
    """Download a master template."""
    template_path = get_template_path(country_code, category)
    
    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template nicht gefunden")
    
    return FileResponse(
        template_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=os.path.basename(template_path)
    )


@router.delete("/{country_code}/{category}")
async def delete_template(
    country_code: str,
    category: str,
    current_user: Annotated[User, Depends(get_current_active_admin)] = None
):
    """Delete a master template. Requires admin privileges."""
    # Validate inputs
    if not re.match(r'^[A-Z]{2}$', country_code.upper()):
        raise HTTPException(status_code=400, detail="Ungültiger Ländercode")
    if category not in TEMPLATE_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Ungültige Kategorie. Erlaubt: {TEMPLATE_CATEGORIES}")

    template_path = get_template_path(country_code, category)
    
    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template nicht gefunden")
    
    # Move to trash instead of hard delete
    trash_path = template_path.replace('.docx', f'_deleted_{datetime.now().strftime("%Y%m%d_%H%M%S")}.docx')
    os.rename(template_path, trash_path)
    
    return {"status": "deleted", "backup": trash_path}


@router.get("/{country_code}/{category}/preview")
async def preview_template(country_code: str, category: str):
    """Get template metadata without downloading."""
    template_path = get_template_path(country_code, category)
    
    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template nicht gefunden")
    
    stat = os.stat(template_path)
    
    return {
        "country_code": country_code.upper(),
        "category": category,
        "filename": os.path.basename(template_path),
        "file_size": stat.st_size,
        "updated_at": datetime.fromtimestamp(stat.st_mtime),
        "placeholders": [
            "{{ logo }}",
            "{{ header_text }}",
            "{{ footer_line1 }}",
            "{{ footer_line2 }}",
            "{{ document_title }}",
            "{{ assembled_content }}"
        ]
    }
