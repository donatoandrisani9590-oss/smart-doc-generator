"""
Preview & Design API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, Annotated
import json

from app.db import get_db
from app.models.core import DesignSetting, User
from app.models.documents import Clause, DocumentType, DocumentTypeClause as ClauseReference
from app.services.preview import assemble_html_preview
from app.services.cache import (
    cache, design_settings_key, clauses_key,
    invalidate_design_settings
)
from app.api.deps import get_current_user, get_current_active_admin
from app.core.config import settings


def build_logo_url(logo_path: Optional[str]) -> Optional[str]:
    """Convert logo path to full URL for preview rendering."""
    if not logo_path:
        return None
    # logo_path is like "de/logo_20250115_123456.png"
    # We need to return full API URL
    base_url = getattr(settings, 'API_BASE_URL', 'http://localhost:8000')
    return f"{base_url}/api/v1/admin/logo/{logo_path}"

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class PreviewRequest(BaseModel):
    document_type_id: int
    form_data: dict
    custom_clause: Optional[dict] = None  # For Individualvereinbarung


class TestPreviewRequest(BaseModel):
    """Request for testing document preview with sample data."""
    document_type_id: Optional[int] = None
    clause_ids: list[int]
    use_sample_data: bool = True


class DesignSettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    header_line1: Optional[str] = None
    header_line2: Optional[str] = None
    header_line3: Optional[str] = None
    footer_line1: Optional[str] = None
    footer_line2: Optional[str] = None
    footer_line3: Optional[str] = None
    font_family: Optional[str] = None
    primary_color: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════
# LIVE PREVIEW ENDPOINT (CRITICAL: <50ms server time)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/html", response_class=HTMLResponse)
async def generate_preview(
    request: PreviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
) -> str:
    """
    Generate HTML preview for live document editing.
    
    Performance target: <50ms server time.
    Returns: Plain HTML (not JSON) for direct iframe/innerHTML render.
    
    Uses Redis caching for design settings and clauses.
    """
    # 1. Get document type
    doc_type = await db.get(DocumentType, request.document_type_id)
    if not doc_type:
        raise HTTPException(status_code=404, detail="Dokumenttyp nicht gefunden")
    
    country_code = doc_type.country_code or "DE"
    
    # 2. Get design settings (with caching)
    cache_key = design_settings_key(country_code)
    design_dict = await cache.get(cache_key)
    
    if not design_dict:
        design_result = await db.execute(
            select(DesignSetting).where(DesignSetting.country_code == country_code)
        )
        design = design_result.scalar_one_or_none()
        if not design:
            # Fallback to first available
            design_result = await db.execute(select(DesignSetting).limit(1))
            design = design_result.scalar_one_or_none()
        
        design_dict = {
            "company_name": design.company_name if design else "Company",
            "logo_path": build_logo_url(design.logo_path) if design else None,
            "header_line1": design.header_line1 if design else "",
            "header_line2": design.header_line2 if design else "",
            "header_line3": design.header_line3 if design else "",
            "footer_line1": design.footer_line1 if design else "",
            "footer_line2": design.footer_line2 if design else "",
            "footer_line3": design.footer_line3 if design else "",
            "primary_color": design.primary_color if design else "#243186",
            "font_family": design.font_family if design else "Arial",
            # DIN 5008 Document Format Settings
            "margin_left_cm": getattr(design, 'margin_left_cm', None) or "2.5" if design else "2.5",
            "margin_right_cm": getattr(design, 'margin_right_cm', None) or "2.0" if design else "2.0",
            "margin_top_cm": getattr(design, 'margin_top_cm', None) or "2.5" if design else "2.5",
            "margin_bottom_cm": getattr(design, 'margin_bottom_cm', None) or "2.0" if design else "2.0",
            "font_size_pt": getattr(design, 'font_size_pt', None) or 11 if design else 11,
            "line_spacing": getattr(design, 'line_spacing', None) or "1.15" if design else "1.15",
            "logo_width_cm": getattr(design, 'logo_width_cm', None) or "5.0" if design else "5.0",
        }
        
        # Cache for 5 minutes
        await cache.set(cache_key, design_dict, ttl=300)
    
    # 3. Get clauses for this document type (with caching)
    clauses_cache_key = clauses_key(request.document_type_id)
    clauses = await cache.get(clauses_cache_key)
    
    if not clauses:
        clause_refs = await db.execute(
            select(ClauseReference)
            .where(ClauseReference.document_type_id == request.document_type_id)
            .order_by(ClauseReference.display_order)
        )
        refs = clause_refs.scalars().all()
        
        clauses = []
        for ref in refs:
            clause = await db.get(Clause, ref.clause_id)
            if clause and clause.is_active:
                # Parse condition JSON if exists
                condition = None
                if hasattr(ref, 'condition') and ref.condition:
                    try:
                        condition = json.loads(ref.condition) if isinstance(ref.condition, str) else ref.condition
                    except (json.JSONDecodeError, TypeError, AttributeError):
                        condition = None
                
                clauses.append({
                    "id": clause.id,
                    "title": clause.title,
                    "content": clause.content_html,
                    "is_mandatory": ref.is_mandatory,
                    "condition": condition
                })
        
        # Cache for 2 minutes
        await cache.set(clauses_cache_key, clauses, ttl=120)
    
    # 4. Assemble HTML
    html = assemble_html_preview(
        design_settings=design_dict,
        clauses=clauses,
        form_data=request.form_data,
        country_code=country_code,
        custom_clause=request.custom_clause
    )
    
    return html


# ═══════════════════════════════════════════════════════════════════════════
# DESIGN SETTINGS API
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/design/{country_code}")
async def get_design_settings(
    country_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Get design settings for a specific country."""
    result = await db.execute(
        select(DesignSetting).where(DesignSetting.country_code == country_code.upper())
    )
    design = result.scalar_one_or_none()
    
    if not design:
        raise HTTPException(status_code=404, detail=f"No design settings for {country_code}")
    
    return {
        "id": design.id,
        "country_code": design.country_code,
        "company_name": design.company_name,
        "logo_path": design.logo_path,
        "header_line1": design.header_line1,
        "header_line2": design.header_line2,
        "header_line3": design.header_line3,
        "footer_line1": design.footer_line1,
        "footer_line2": design.footer_line2,
        "footer_line3": design.footer_line3,
        "font_family": design.font_family,
        "primary_color": design.primary_color,
    }


@router.put("/design/{country_code}")
async def update_design_settings(
    country_code: str,
    update: DesignSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_active_admin)] = None
):
    """Update design settings for a specific country."""
    result = await db.execute(
        select(DesignSetting).where(DesignSetting.country_code == country_code.upper())
    )
    design = result.scalar_one_or_none()
    
    if not design:
        # Create new
        design = DesignSetting(
            country_code=country_code.upper(),
            company_name=update.company_name or "Company"
        )
        db.add(design)
    
    # Update fields
    for field, value in update.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(design, field, value)
    
    await db.commit()
    await db.refresh(design)
    
    # Invalidate cache
    await invalidate_design_settings(country_code.upper())
    
    return {"status": "updated", "id": design.id}


@router.post("/cache/clear")
async def clear_preview_cache(
    current_user: Annotated[User, Depends(get_current_active_admin)] = None
):
    """Clear all preview caches. Admin only."""
    from app.services.cache import invalidate_all
    await invalidate_all()
    return {"status": "cleared"}


# ═══════════════════════════════════════════════════════════════════════════
# TEST PREVIEW (v4.2 - Dokumenten-Designer "Vorschau testen")
# ═══════════════════════════════════════════════════════════════════════════

# Sample data generator for test previews
SAMPLE_DATA = {
    "vorname": "Max",
    "nachname": "Mustermann",
    "mitarbeiter_vorname": "Max",
    "mitarbeiter_nachname": "Mustermann",
    "geburtsdatum": "01.01.1990",
    "eintrittsdatum": "01.04.2025",
    "position": "Software-Entwickler",
    "abteilung": "IT-Entwicklung",
    "monatsgehalt": "5.500,00",
    "gehalt": "5.500,00",
    "wochenstunden": "40",
    "urlaubstage": "30",
    "probezeit_monate": "6",
    "kuendigungsfrist": "3 Monate zum Monatsende",
    "company_name": "Muster GmbH",
    "strasse": "Musterstraße 123",
    "plz": "12345",
    "ort": "Musterstadt",
    "datum": "15.01.2025",
    "firmenwagen": "Ja",
    "homeoffice_tage": "2",
    "bonus_prozent": "10",
    "paragraph_number": "§ {n}",  # Will be replaced with actual numbers
}


class ComposerPreviewRequest(BaseModel):
    """Request for Composer document preview."""
    draft_id: int
    form_data: Optional[dict] = None


@router.post("/composer", response_class=HTMLResponse)
async def generate_composer_preview(
    request: ComposerPreviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
) -> str:
    """
    Generate HTML preview from a Composer draft.

    Renders all clauses in the draft in their correct order,
    respecting local clauses, deviations, and form data.
    """
    from app.models.composer import DocumentClauseInstance

    # Get the draft
    draft_result = await db.execute(
        select(DocumentClauseInstance)
        .where(DocumentClauseInstance.draft_id == request.draft_id)
        .order_by(DocumentClauseInstance.display_order)
    )
    instances = draft_result.scalars().all()

    if not instances:
        raise HTTPException(status_code=404, detail="Entwurf nicht gefunden oder leer")

    # Get country code from first clause or default
    country_code = "DE"

    # Get design settings
    design_result = await db.execute(
        select(DesignSetting).where(DesignSetting.country_code == country_code)
    )
    design = design_result.scalar_one_or_none()

    design_dict = {
        "company_name": design.company_name if design else "Unternehmen",
        "logo_path": build_logo_url(design.logo_path) if design else None,
        "header_line1": design.header_line1 if design else "",
        "header_line2": design.header_line2 if design else "",
        "header_line3": design.header_line3 if design else "",
        "footer_line1": design.footer_line1 if design else "Seite {page}",
        "footer_line2": design.footer_line2 if design else "",
        "footer_line3": design.footer_line3 if design else "",
        "primary_color": design.primary_color if design else "#243186",
        "font_family": design.font_family if design else "Arial",
        # DIN 5008 Document Format Settings
        "margin_left_cm": getattr(design, 'margin_left_cm', None) or "2.5" if design else "2.5",
        "margin_right_cm": getattr(design, 'margin_right_cm', None) or "2.0" if design else "2.0",
        "margin_top_cm": getattr(design, 'margin_top_cm', None) or "2.5" if design else "2.5",
        "margin_bottom_cm": getattr(design, 'margin_bottom_cm', None) or "2.0" if design else "2.0",
        "font_size_pt": getattr(design, 'font_size_pt', None) or 11 if design else 11,
        "line_spacing": getattr(design, 'line_spacing', None) or "1.15" if design else "1.15",
        "logo_width_cm": getattr(design, 'logo_width_cm', None) or "5.0" if design else "5.0",
    }

    # Build clauses from instances
    clauses = []
    for inst in instances:
        # Get content - prefer custom content over original
        if inst.custom_content_html:
            content = inst.custom_content_html
        elif inst.source_clause_id:
            # Load from source clause
            source = await db.get(Clause, inst.source_clause_id)
            content = source.content_html if source else ""
        else:
            content = ""

        clauses.append({
            "id": inst.id,
            "title": inst.title,
            "content": content,
            "is_mandatory": True,
            "condition": None,
        })

    # Use provided form data or empty
    form_data = request.form_data or {}

    # Assemble HTML
    html = assemble_html_preview(
        design_settings=design_dict,
        clauses=clauses,
        form_data=form_data,
        country_code=country_code,
        custom_clause=None
    )

    return html


@router.post("/test", response_class=HTMLResponse)
async def generate_test_preview(
    request: TestPreviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
) -> str:
    """
    Generate test preview for document designer.

    Uses sample data to show how the document will look.
    This is for admin/designer testing before publishing.
    """
    if not request.clause_ids:
        raise HTTPException(status_code=400, detail="Mindestens eine clause_id ist erforderlich")

    # Get country code from first clause or default
    country_code = "DE"

    # Get design settings
    design_result = await db.execute(
        select(DesignSetting).where(DesignSetting.country_code == country_code)
    )
    design = design_result.scalar_one_or_none()

    design_dict = {
        "company_name": design.company_name if design else "Muster GmbH",
        "logo_path": build_logo_url(design.logo_path) if design else None,
        "header_line1": design.header_line1 if design else "Muster GmbH",
        "header_line2": design.header_line2 if design else "Musterstraße 123",
        "header_line3": design.header_line3 if design else "12345 Musterstadt",
        "footer_line1": design.footer_line1 if design else "Seite {page}",
        "footer_line2": design.footer_line2 if design else "",
        "footer_line3": design.footer_line3 if design else "",
        "primary_color": design.primary_color if design else "#243186",
        "font_family": design.font_family if design else "Arial",
        # DIN 5008 Document Format Settings
        "margin_left_cm": getattr(design, 'margin_left_cm', None) or "2.5" if design else "2.5",
        "margin_right_cm": getattr(design, 'margin_right_cm', None) or "2.0" if design else "2.0",
        "margin_top_cm": getattr(design, 'margin_top_cm', None) or "2.5" if design else "2.5",
        "margin_bottom_cm": getattr(design, 'margin_bottom_cm', None) or "2.0" if design else "2.0",
        "font_size_pt": getattr(design, 'font_size_pt', None) or 11 if design else 11,
        "line_spacing": getattr(design, 'line_spacing', None) or "1.15" if design else "1.15",
        "logo_width_cm": getattr(design, 'logo_width_cm', None) or "5.0" if design else "5.0",
    }

    # Get clauses
    clauses = []
    paragraph_number = 1

    for clause_id in request.clause_ids:
        clause = await db.get(Clause, clause_id)
        if clause:
            clauses.append({
                "id": clause.id,
                "title": clause.title,
                "content": clause.content_html,
                "is_mandatory": True,
                "condition": None,
            })

    # Use sample data or empty
    form_data = SAMPLE_DATA if request.use_sample_data else {}

    # Assemble HTML with automatic paragraph numbering
    html = assemble_html_preview(
        design_settings=design_dict,
        clauses=clauses,
        form_data=form_data,
        country_code=country_code,
        custom_clause=None
    )

    return html

