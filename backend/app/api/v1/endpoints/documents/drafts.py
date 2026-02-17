"""
Draft System API: Auto-save and manual draft management

Implementiert gemäß v4.2 Spezifikation Kapitel 13:
- Auto-Save alle 30 Sekunden
- Manuelles Speichern
- Draft-to-Document Finalisierung
- TTL-basierte automatische Löschung (30 Tage)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, field_validator
from typing import Optional, Union, List, Any
from datetime import datetime, timedelta
import json

from app.db import get_db
from app.models.enterprise import DocumentDraft
from app.api.deps import get_current_user
from app.api.v1.endpoints.documents.preview import build_logo_data_url

router = APIRouter()


class DraftCreate(BaseModel):
    document_type_id: int
    country_code: str = "DE"
    name: Optional[str] = None
    form_data: dict
    custom_clauses: Optional[Union[dict, List[int]]] = None

    @field_validator("form_data")
    @classmethod
    def validate_form_data(cls, v: dict) -> dict:
        """Ensure form_data is a valid dict and not excessively large."""
        serialized = json.dumps(v)
        if len(serialized) > 500_000:  # 500KB max
            raise ValueError("form_data ist zu gross (max 500KB)")
        return v

    @field_validator("country_code")
    @classmethod
    def validate_country_code(cls, v: str) -> str:
        if len(v) != 2 or not v.isalpha():
            raise ValueError("country_code muss ein 2-stelliger Laendercode sein")
        return v.upper()


class DraftUpdate(BaseModel):
    name: Optional[str] = None
    form_data: Optional[dict] = None
    custom_clauses: Optional[Union[dict, List[int]]] = None
    version: Optional[int] = None

    @field_validator("form_data")
    @classmethod
    def validate_form_data(cls, v: Optional[dict]) -> Optional[dict]:
        if v is not None:
            serialized = json.dumps(v)
            if len(serialized) > 500_000:
                raise ValueError("form_data ist zu gross (max 500KB)")
        return v


DRAFT_TTL_DAYS = 30  # Entwürfe werden nach 30 Tagen gelöscht


def calculate_expires_at(created_at: datetime) -> datetime:
    """Berechnet das Ablaufdatum eines Entwurfs."""
    return created_at + timedelta(days=DRAFT_TTL_DAYS)


def calculate_days_remaining(created_at: datetime) -> int:
    """Berechnet verbleibende Tage bis zum Ablauf."""
    expires_at = calculate_expires_at(created_at)
    from datetime import timezone
    now = datetime.now(timezone.utc)
    # Ensure expires_at is timezone-aware
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    remaining = (expires_at - now).days
    return max(0, remaining)


@router.get("")
async def list_drafts(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List all drafts for the current user with TTL information and document type name."""
    from app.models.documents import DocumentType

    # JOIN mit DocumentType um den Namen zu erhalten
    result = await db.execute(
        select(DocumentDraft, DocumentType.name.label("type_name"))
        .outerjoin(DocumentType, DocumentDraft.document_type_id == DocumentType.id)
        .where(DocumentDraft.user_id == str(current_user.id))
        .order_by(DocumentDraft.updated_at.desc())
    )
    rows = result.all()

    return [
        {
            "id": d.id,
            "document_type_id": d.document_type_id,
            "document_type_name": type_name or "Unbekannter Typ",
            "name": d.name or "Unbenannter Entwurf",
            "country_code": d.country_code,
            "version": d.version or 1,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "updated_at": d.updated_at.isoformat() if d.updated_at else None,
            "expires_at": calculate_expires_at(d.created_at).isoformat() if d.created_at else None,
            "days_remaining": calculate_days_remaining(d.created_at) if d.created_at else DRAFT_TTL_DAYS,
            "status": "draft",
        }
        for d, type_name in rows
    ]


@router.post("")
async def create_draft(
    draft: DraftCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new draft (manual save or auto-save)."""
    new_draft = DocumentDraft(
        document_type_id=draft.document_type_id,
        country_code=draft.country_code,
        user_id=str(current_user.id),
        name=draft.name,
        form_data=json.dumps(draft.form_data),
        custom_clauses=json.dumps(draft.custom_clauses) if draft.custom_clauses else None
    )
    db.add(new_draft)
    await db.commit()
    await db.refresh(new_draft)
    
    return {"id": new_draft.id, "version": new_draft.version or 1, "status": "created"}


@router.get("/stats")
async def get_draft_stats(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get statistics about drafts for the current user.

    Includes:
    - Total drafts count
    - Drafts expiring soon (within 7 days)
    - Oldest draft age
    """
    from datetime import timedelta as td

    result = await db.execute(
        select(DocumentDraft)
        .where(DocumentDraft.user_id == str(current_user.id))
    )
    drafts = result.scalars().all()

    if not drafts:
        return {
            "total_drafts": 0,
            "expiring_soon": 0,
            "oldest_draft_days": 0,
            "ttl_days": 30
        }

    now = datetime.utcnow()
    ttl_days = 30  # Standard-TTL
    warning_threshold = td(days=7)
    expiry_threshold = td(days=ttl_days) - warning_threshold

    expiring_soon = 0
    oldest_age_days = 0

    for draft in drafts:
        if draft.updated_at:
            age = now - draft.updated_at
            age_days = age.days

            if age_days > oldest_age_days:
                oldest_age_days = age_days

            # Draft läuft bald ab (innerhalb von 7 Tagen vor TTL)
            if age > expiry_threshold:
                expiring_soon += 1

    return {
        "total_drafts": len(drafts),
        "expiring_soon": expiring_soon,
        "oldest_draft_days": oldest_age_days,
        "ttl_days": ttl_days
    }


@router.get("/{draft_id}")
async def get_draft(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get a specific draft with full form data and document type name."""
    from app.models.documents import DocumentType

    draft = await db.get(DocumentDraft, draft_id)

    if not draft or draft.user_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="Entwurf nicht gefunden")

    # Lade Dokumenttyp-Namen
    document_type = await db.get(DocumentType, draft.document_type_id)
    document_type_name = document_type.name if document_type else "Unbekannter Typ"

    return {
        "id": draft.id,
        "document_type_id": draft.document_type_id,
        "document_type_name": document_type_name,  # NEU
        "name": draft.name,
        "country_code": draft.country_code,
        "form_data": json.loads(draft.form_data) if draft.form_data else {},
        "custom_clauses": json.loads(draft.custom_clauses) if draft.custom_clauses else None,
        "version": draft.version or 1,
        "created_at": draft.created_at.isoformat() if draft.created_at else None,
        "updated_at": draft.updated_at.isoformat() if draft.updated_at else None,
        # TTL-Informationen
        "expires_at": calculate_expires_at(draft.created_at).isoformat() if draft.created_at else None,
        "days_remaining": calculate_days_remaining(draft.created_at) if draft.created_at else DRAFT_TTL_DAYS,
        "status": "draft",
    }


@router.put("/{draft_id}")
async def update_draft(
    draft_id: int,
    update: DraftUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update an existing draft (auto-save endpoint) with optimistic locking."""
    draft = await db.get(DocumentDraft, draft_id)

    if not draft or draft.user_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="Entwurf nicht gefunden")

    # Optimistic locking: reject if client version doesn't match
    current_version = draft.version or 1
    if update.version is not None and update.version != current_version:
        raise HTTPException(
            status_code=409,
            detail="Konflikt: Der Entwurf wurde zwischenzeitlich geändert. Bitte laden Sie den Entwurf neu."
        )

    if update.name is not None:
        draft.name = update.name
    if update.form_data is not None:
        draft.form_data = json.dumps(update.form_data)
    if update.custom_clauses is not None:
        draft.custom_clauses = json.dumps(update.custom_clauses)

    # Increment version on every successful update
    draft.version = current_version + 1

    await db.commit()
    await db.refresh(draft)

    return {
        "id": draft.id,
        "status": "updated",
        "version": draft.version,
        "updated_at": draft.updated_at.isoformat(),
    }


@router.delete("/{draft_id}")
async def delete_draft(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a draft."""
    draft = await db.get(DocumentDraft, draft_id)
    
    if not draft or draft.user_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="Entwurf nicht gefunden")

    await db.delete(draft)
    await db.commit()

    return {"status": "deleted"}


class FinalizeRequest(BaseModel):
    """Request body für Draft-Finalisierung."""
    output_format: str = "pdf"  # "pdf" oder "docx"
    selected_attachments: Optional[list[int]] = None  # IDs der gewählten Anlagen
    signatory_name: str  # Pflichtfeld: Name des Unterzeichners (DIN 5008)


@router.post("/{draft_id}/finalize")
async def finalize_draft(
    draft_id: int,
    request: FinalizeRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Convert a draft to a final document with DIN 5008 format.

    Dieser Endpoint implementiert Kapitel 13.8 der v4.2 Spezifikation:
    1. Lädt den Entwurf mit allen Formulardaten
    2. Ruft den DIN 5008-konformen Document Generation Service auf
    3. Optional: Fügt Anlagen hinzu (PDF Merge)
    4. Speichert das generierte Dokument in der Historie
    5. Löscht den Entwurf (optional)

    Returns:
        - document_id: ID des generierten Dokuments
        - download_url: URL zum Herunterladen
        - format: Ausgabeformat (pdf/docx)
    """
    from app.models.core import DesignSetting
    from app.models.documents import DocumentType, GeneratedDocument, Clause, DocumentTypeClause
    from app.api.v1.endpoints.documents.generation import create_document_from_clauses
    from datetime import datetime
    import uuid

    draft = await db.get(DocumentDraft, draft_id)

    if not draft or draft.user_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="Entwurf nicht gefunden")

    # Lade Dokumenttyp
    document_type = await db.get(DocumentType, draft.document_type_id)
    if not document_type:
        raise HTTPException(status_code=404, detail="Dokumenttyp nicht gefunden")

    # Parse form_data
    form_data = json.loads(draft.form_data) if draft.form_data else {}
    custom_clauses = json.loads(draft.custom_clauses) if draft.custom_clauses else None

    # Get country code
    country_code = draft.country_code or document_type.country_code or "DE"

    # Load design settings with DIN 5008 format
    design_result = await db.execute(
        select(DesignSetting).where(DesignSetting.country_code == country_code)
    )
    design = design_result.scalar_one_or_none()
    if not design:
        design_result = await db.execute(select(DesignSetting).limit(1))
        design = design_result.scalar_one_or_none()

    # Build design settings dict with DIN 5008 values
    design_settings = {
        "company_name": design.company_name if design else "Unternehmen",
        "logo_path": build_logo_data_url(design.logo_path) if design else None,
        "header_line1": design.header_line1 if design else "",
        "header_line2": design.header_line2 if design else "",
        "header_line3": design.header_line3 if design else "",
        "footer_line1": design.footer_line1 if design else "",
        "footer_line2": design.footer_line2 if design else "",
        "footer_line3": design.footer_line3 if design else "",
        "primary_color": design.primary_color if design else "#243186",
        "font_family": design.font_family if design else "Arial",
        # Signatory from request (required field)
        "signatory_name": request.signatory_name,
        # DIN 5008 Page Format Settings
        "margin_left_cm": float(getattr(design, 'margin_left_cm', None) or 2.5),
        "margin_right_cm": float(getattr(design, 'margin_right_cm', None) or 2.0),
        "margin_top_cm": float(getattr(design, 'margin_top_cm', None) or 2.5),
        "margin_bottom_cm": float(getattr(design, 'margin_bottom_cm', None) or 2.0),
        "header_distance_cm": float(getattr(design, 'header_distance_cm', None) or 1.25),
        "footer_distance_cm": float(getattr(design, 'footer_distance_cm', None) or 1.0),
        "font_size_pt": int(getattr(design, 'font_size_pt', None) or 11),
        "line_spacing": float(getattr(design, 'line_spacing', None) or 1.15),
        "logo_width_cm": float(getattr(design, 'logo_width_cm', None) or 5.0),
    }

    # Load clauses for this document type
    clause_refs_result = await db.execute(
        select(DocumentTypeClause)
        .where(DocumentTypeClause.document_type_id == draft.document_type_id)
        .order_by(DocumentTypeClause.display_order)
    )
    clause_refs = clause_refs_result.scalars().all()

    clauses = []
    for ref in clause_refs:
        clause = await db.get(Clause, ref.clause_id)
        if clause and clause.is_active:
            clauses.append({
                "id": clause.id,
                "title": clause.title,
                "content": clause.content_html,
                "is_mandatory": ref.is_mandatory,
            })

    # Generiere eindeutigen Dateinamen
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = str(uuid.uuid4())[:8]
    base_filename = f"{document_type.name.replace(' ', '_')}_{timestamp}_{unique_id}"

    try:
        import tempfile
        import os
        from pathlib import Path

        output_dir = tempfile.gettempdir()
        docx_path = Path(os.path.join(output_dir, f"{base_filename}.docx"))

        # Generate document using DIN 5008 compliant function
        create_document_from_clauses(
            clauses=clauses,
            form_data=form_data,
            design_settings=design_settings,
            country_code=country_code,
            output_path=docx_path
        )

        final_path = docx_path
        final_filename = f"{base_filename}.docx"

        # PDF konvertieren wenn gewünscht
        if request.output_format == "pdf":
            from app.services.template_engine import TemplateEngine
            engine = TemplateEngine()
            pdf_path = engine.convert_to_pdf(docx_path)
            final_path = pdf_path
            final_filename = f"{base_filename}.pdf"

            # Anlagen hinzufügen wenn gewünscht
            if request.selected_attachments:
                from app.services.pdf_merge import merge_pdf_attachments

                with open(pdf_path, "rb") as f:
                    pdf_bytes = f.read()

                merged_bytes = merge_pdf_attachments(
                    main_document=pdf_bytes,
                    attachment_ids=request.selected_attachments,
                    country_code=country_code
                )

                # Überschreibe mit zusammengeführtem PDF
                with open(pdf_path, "wb") as f:
                    f.write(merged_bytes)

        # Dokument in Historie speichern
        generated_doc = GeneratedDocument(
            document_type_id=draft.document_type_id,
            created_by_id=current_user.id,
            country_code=country_code,
            form_data=json.dumps(draft.form_data) if isinstance(draft.form_data, dict) else draft.form_data,
            file_path=str(final_path),
            file_format=request.output_format,
        )
        db.add(generated_doc)

        # Entwurf löschen (optional - könnte auch behalten werden)
        await db.delete(draft)
        await db.commit()
        await db.refresh(generated_doc)

        return {
            "status": "completed",
            "document_id": generated_doc.id,
            "download_url": f"/api/v1/documents/{generated_doc.id}/download",
            "format": request.output_format,
            "filename": final_filename,
        }

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Template nicht gefunden: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Fehler bei der Dokumentgenerierung: {str(e)}"
        )


@router.post("/{draft_id}/refresh")
async def refresh_draft_ttl(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Refresh a draft's TTL by updating its timestamp.

    Useful when the user wants to keep a draft but hasn't made changes.
    This "touches" the draft to reset its expiration countdown.
    """
    draft = await db.get(DocumentDraft, draft_id)

    if not draft or draft.user_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="Entwurf nicht gefunden")

    # Update timestamp to reset TTL
    draft.updated_at = datetime.utcnow()
    await db.commit()

    return {
        "id": draft.id,
        "status": "refreshed",
        "new_expiry": (draft.updated_at + timedelta(days=30)).isoformat()
    }
