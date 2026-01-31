from __future__ import annotations
from typing import Any, List, Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.db import get_db
from app.api import deps
from app.schemas import document_type as schemas
from app.models import documents as models
from app.models import enterprise as enterprise_models

router = APIRouter()


class DuplicateRequest(BaseModel):
    """Request body for duplicating a document type."""
    new_name: Optional[str] = None  # If not provided, appends "(Kopie)"
    target_country_code: Optional[str] = None  # If not provided, keeps same country
    include_clauses: bool = True
    include_attachments: bool = True
    include_form_fields: bool = True


class DuplicateResponse(BaseModel):
    """Response from document type duplication."""
    id: int
    name: str
    country_code: str
    category: Optional[str]
    description: Optional[str] = None
    clauses_copied: int
    attachments_copied: int
    form_fields_copied: int
    # Kopierte Standardwerte
    default_probation_months: Optional[int] = None
    default_notice_period: Optional[str] = None
    default_vacation_days: Optional[int] = None
    default_weekly_hours: Optional[int] = None
    message: str


@router.get("/", response_model=List[schemas.DocumentType])
async def read_document_types(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
    skip: int = 0,
    limit: int = 100,
    country_code: Optional[str] = None
) -> Any:
    query = select(models.DocumentType).options(selectinload(models.DocumentType.clauses))
    if country_code:
        query = query.where(models.DocumentType.country_code == country_code)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{document_type_id}", response_model=schemas.DocumentType)
async def get_document_type(
    document_type_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
) -> Any:
    """Get a single document type by ID."""
    query = select(models.DocumentType).options(
        selectinload(models.DocumentType.clauses)
    ).where(models.DocumentType.id == document_type_id)

    result = await db.execute(query)
    doc_type = result.scalar_one_or_none()

    if not doc_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document type not found"
        )

    return doc_type


@router.get("/{document_type_id}/with-variant-groups")
async def get_document_type_with_variant_groups(
    document_type_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
) -> Any:
    """
    Get a document type with all assigned variant groups.

    Returns the document type with variant groups including their variants,
    useful for the DocumentTypeEditor and Generator views.
    """
    query = select(models.DocumentType).options(
        selectinload(models.DocumentType.clauses),
        selectinload(models.DocumentType.variant_groups)
            .selectinload(models.DocumentTypeVariantGroup.variant_group)
            .selectinload(models.ClauseVariantGroup.variants)
    ).where(models.DocumentType.id == document_type_id)

    result = await db.execute(query)
    doc_type = result.scalar_one_or_none()

    if not doc_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document type not found"
        )

    # Build response with variant groups
    variant_groups_response = []
    for dvg in doc_type.variant_groups:
        vg = dvg.variant_group
        variants = [
            {
                "id": v.id,
                "variant_name": v.variant_name,
                "variant_code": v.variant_code,
                "is_default": v.is_default,
                "clause_id": v.clause_id,
            }
            for v in vg.variants if v.is_active
        ]
        variant_groups_response.append({
            "id": dvg.id,
            "variant_group_id": dvg.variant_group_id,
            "display_order": dvg.display_order,
            "is_mandatory": dvg.is_mandatory,
            "default_variant_id": dvg.default_variant_id,
            "variant_group_name": vg.name,
            "variant_group_description": vg.description,
            "variant_count": len(variants),
            "variants": variants,
        })

    return {
        "id": doc_type.id,
        "name": doc_type.name,
        "country_code": doc_type.country_code,
        "category": doc_type.category,
        "is_active": doc_type.is_active,
        "description": doc_type.description,
        "default_probation_months": doc_type.default_probation_months,
        "default_notice_period": doc_type.default_notice_period,
        "default_vacation_days": doc_type.default_vacation_days,
        "default_weekly_hours": doc_type.default_weekly_hours,
        "variant_groups": variant_groups_response,
    }


@router.post("/", response_model=schemas.DocumentType)
async def create_document_type(
    *,
    db: Annotated[AsyncSession, Depends(get_db)],
    doc_in: schemas.DocumentTypeCreate,
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    # Transaction to handle DocType + Link Table
    doc = models.DocumentType(
        name=doc_in.name,
        country_code=doc_in.country_code,
        category=doc_in.category,
        is_active=doc_in.is_active,
        description=doc_in.description,
        # Standardwerte für diesen Dokumenttyp (v4.2 UX-Verbesserung)
        default_probation_months=doc_in.default_probation_months,
        default_notice_period=doc_in.default_notice_period,
        default_vacation_days=doc_in.default_vacation_days,
        default_weekly_hours=doc_in.default_weekly_hours,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Add clauses
    if doc_in.clauses:
        for link in doc_in.clauses:
            db_link = models.DocumentTypeClause(
                document_type_id=doc.id,
                clause_id=link.clause_id,
                display_order=link.display_order,
                is_mandatory=link.is_mandatory
            )
            db.add(db_link)
        await db.commit()

    # Add variant groups (v4.2 Feature: Varianten-Gruppen Zuordnung)
    if doc_in.variant_groups:
        for vg_link in doc_in.variant_groups:
            db_vg_link = models.DocumentTypeVariantGroup(
                document_type_id=doc.id,
                variant_group_id=vg_link.variant_group_id,
                display_order=vg_link.display_order,
                is_mandatory=vg_link.is_mandatory,
                default_variant_id=vg_link.default_variant_id,
            )
            db.add(db_vg_link)
        await db.commit()

    return doc


@router.post("/{document_type_id}/duplicate", response_model=DuplicateResponse)
async def duplicate_document_type(
    document_type_id: int,
    duplicate_request: DuplicateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """
    Duplicate a document type with all its related data.

    Creates a copy of the document type including:
    - Clause links (if include_clauses=True)
    - Attachment links (if include_attachments=True)
    - Form field definitions (if include_form_fields=True)

    Useful for creating variations of existing templates
    or copying templates between countries.
    """
    # Get the original document type
    original_query = select(models.DocumentType).where(
        models.DocumentType.id == document_type_id
    )
    result = await db.execute(original_query)
    original = result.scalar_one_or_none()

    if not original:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document type not found"
        )

    # Determine new name and country
    new_name = duplicate_request.new_name or f"{original.name} (Kopie)"
    target_country = duplicate_request.target_country_code or original.country_code

    # Check if name already exists in target country
    existing_query = select(models.DocumentType).where(
        models.DocumentType.name == new_name,
        models.DocumentType.country_code == target_country
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ein Dokumenttyp mit dem Namen '{new_name}' existiert bereits in {target_country}"
        )

    # Create the new document type (inkl. Standardwerte kopieren)
    new_doc_type = models.DocumentType(
        name=new_name,
        country_code=target_country,
        category=original.category,
        is_active=True,  # New copies start as active
        description=original.description,
        # Standardwerte vom Original übernehmen
        default_probation_months=original.default_probation_months,
        default_notice_period=original.default_notice_period,
        default_vacation_days=original.default_vacation_days,
        default_weekly_hours=original.default_weekly_hours,
    )
    db.add(new_doc_type)
    await db.commit()
    await db.refresh(new_doc_type)

    clauses_copied = 0
    attachments_copied = 0
    form_fields_copied = 0

    # Copy clause links
    if duplicate_request.include_clauses:
        clause_links_query = select(models.DocumentTypeClause).where(
            models.DocumentTypeClause.document_type_id == document_type_id
        )
        clause_links_result = await db.execute(clause_links_query)
        clause_links = clause_links_result.scalars().all()

        for link in clause_links:
            new_link = models.DocumentTypeClause(
                document_type_id=new_doc_type.id,
                clause_id=link.clause_id,
                display_order=link.display_order,
                is_mandatory=link.is_mandatory
            )
            db.add(new_link)
            clauses_copied += 1

    # Copy attachment links
    if duplicate_request.include_attachments:
        attach_links_query = select(enterprise_models.DocumentTypeAttachment).where(
            enterprise_models.DocumentTypeAttachment.document_type_id == document_type_id
        )
        attach_links_result = await db.execute(attach_links_query)
        attach_links = attach_links_result.scalars().all()

        for link in attach_links:
            new_link = enterprise_models.DocumentTypeAttachment(
                document_type_id=new_doc_type.id,
                attachment_id=link.attachment_id,
                display_order=link.display_order,
                is_mandatory=link.is_mandatory,
                is_preselected=link.is_preselected
            )
            db.add(new_link)
            attachments_copied += 1

    # Copy form field definitions
    if duplicate_request.include_form_fields:
        form_fields_query = select(enterprise_models.FormField).where(
            enterprise_models.FormField.document_type_id == document_type_id
        )
        form_fields_result = await db.execute(form_fields_query)
        form_fields = form_fields_result.scalars().all()

        for field in form_fields:
            new_field = enterprise_models.FormField(
                document_type_id=new_doc_type.id,
                field_name=field.field_name,
                field_label=field.field_label,
                field_type=field.field_type,
                is_required=field.is_required,
                default_value=field.default_value,
                options=field.options,
                validation=field.validation,
                display_order=field.display_order,
                display_group=field.display_group,
                source_clause_id=field.source_clause_id
            )
            db.add(new_field)
            form_fields_copied += 1

    await db.commit()

    return DuplicateResponse(
        id=new_doc_type.id,
        name=new_doc_type.name,
        country_code=new_doc_type.country_code,
        category=new_doc_type.category,
        description=new_doc_type.description,
        clauses_copied=clauses_copied,
        attachments_copied=attachments_copied,
        form_fields_copied=form_fields_copied,
        default_probation_months=new_doc_type.default_probation_months,
        default_notice_period=new_doc_type.default_notice_period,
        default_vacation_days=new_doc_type.default_vacation_days,
        default_weekly_hours=new_doc_type.default_weekly_hours,
        message=f"Dokumenttyp erfolgreich dupliziert als '{new_name}'"
    )


@router.put("/{document_type_id}", response_model=schemas.DocumentType)
async def update_document_type(
    document_type_id: int,
    doc_in: schemas.DocumentTypeUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """Update an existing document type."""
    query = select(models.DocumentType).where(models.DocumentType.id == document_type_id)
    result = await db.execute(query)
    doc_type = result.scalar_one_or_none()

    if not doc_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document type not found"
        )

    # Update fields
    update_data = doc_in.model_dump(exclude_unset=True)
    clauses_data = update_data.pop("clauses", None)
    variant_groups_data = update_data.pop("variant_groups", None)

    for field, value in update_data.items():
        setattr(doc_type, field, value)

    # Update clause links if provided
    from sqlalchemy import delete
    if clauses_data is not None:
        # Delete existing links
        await db.execute(
            delete(models.DocumentTypeClause).where(
                models.DocumentTypeClause.document_type_id == document_type_id
            )
        )

        # Add new links
        for link in clauses_data:
            db_link = models.DocumentTypeClause(
                document_type_id=document_type_id,
                clause_id=link["clause_id"],
                display_order=link["display_order"],
                is_mandatory=link.get("is_mandatory", True)
            )
            db.add(db_link)

    # Update variant group links if provided (v4.2 Feature)
    if variant_groups_data is not None:
        # Delete existing variant group links
        await db.execute(
            delete(models.DocumentTypeVariantGroup).where(
                models.DocumentTypeVariantGroup.document_type_id == document_type_id
            )
        )

        # Add new variant group links
        for vg_link in variant_groups_data:
            db_vg_link = models.DocumentTypeVariantGroup(
                document_type_id=document_type_id,
                variant_group_id=vg_link["variant_group_id"],
                display_order=vg_link.get("display_order", 0),
                is_mandatory=vg_link.get("is_mandatory", True),
                default_variant_id=vg_link.get("default_variant_id"),
            )
            db.add(db_vg_link)

    await db.commit()
    await db.refresh(doc_type)

    return doc_type


@router.get("/{document_type_id}/clauses")
async def get_document_type_clauses(
    document_type_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
) -> Any:
    """
    Get all clauses assigned to a document type.

    Returns clauses with their display order and mandatory status.
    """
    # Verify document type exists
    doc_type = await db.get(models.DocumentType, document_type_id)
    if not doc_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document type not found"
        )

    # Get clause links with clause data
    query = (
        select(
            models.DocumentTypeClause,
            models.Clause
        )
        .join(models.Clause, models.DocumentTypeClause.clause_id == models.Clause.id)
        .where(models.DocumentTypeClause.document_type_id == document_type_id)
        .order_by(models.DocumentTypeClause.display_order)
    )

    result = await db.execute(query)
    rows = result.all()

    clauses = []
    for link, clause in rows:
        clauses.append({
            "id": clause.id,
            "title": clause.title,
            "display_order": link.display_order,
            "is_mandatory": link.is_mandatory,
            "is_default_selected": link.is_default_selected if hasattr(link, 'is_default_selected') else True,
            "clause_type": link.clause_type if hasattr(link, 'clause_type') else "standard",
            "is_order_locked": link.is_order_locked if hasattr(link, 'is_order_locked') else False,
            "variant_group_id": None,
            "variant_group_name": None,
        })

    return clauses


@router.delete("/{document_type_id}")
async def delete_document_type(
    document_type_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """Delete a document type (soft delete - sets is_active=False)."""
    query = select(models.DocumentType).where(models.DocumentType.id == document_type_id)
    result = await db.execute(query)
    doc_type = result.scalar_one_or_none()

    if not doc_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document type not found"
        )

    # Soft delete
    doc_type.is_active = False
    await db.commit()

    return {"status": "deleted", "id": document_type_id}


# ══════════════════════════════════════════════════════════════════════════════
# VARIANTEN-GRUPPEN ENDPOINTS (v4.2 Feature: UX-Verbesserung)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{document_type_id}/variant-groups")
async def get_document_type_variant_groups(
    document_type_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_user)],
) -> Any:
    """
    Get all variant groups assigned to a document type.

    Returns variant groups with their variants, useful for the Generator.
    """
    # Verify document type exists
    doc_type = await db.get(models.DocumentType, document_type_id)
    if not doc_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document type not found"
        )

    # Get variant group links with data
    query = (
        select(models.DocumentTypeVariantGroup)
        .options(
            selectinload(models.DocumentTypeVariantGroup.variant_group)
                .selectinload(models.ClauseVariantGroup.variants)
                .selectinload(models.ClauseVariant.clause),
            selectinload(models.DocumentTypeVariantGroup.default_variant)
        )
        .where(models.DocumentTypeVariantGroup.document_type_id == document_type_id)
        .order_by(models.DocumentTypeVariantGroup.display_order)
    )

    result = await db.execute(query)
    links = result.scalars().all()

    variant_groups = []
    for link in links:
        vg = link.variant_group
        variants = [
            {
                "id": v.id,
                "variant_name": v.variant_name,
                "variant_code": v.variant_code,
                "is_default": v.is_default,
                "clause_id": v.clause_id,
                "clause_title": v.clause.title if v.clause else None,
                "clause_content_preview": (v.clause.content_html[:200] + "...") if v.clause and len(v.clause.content_html) > 200 else (v.clause.content_html if v.clause else None),
            }
            for v in vg.variants if v.is_active
        ]

        # Determine effective default variant
        effective_default_id = link.default_variant_id
        if not effective_default_id:
            default_variant = next((v for v in vg.variants if v.is_default), None)
            effective_default_id = default_variant.id if default_variant else None

        variant_groups.append({
            "id": link.id,
            "variant_group_id": vg.id,
            "variant_group_name": vg.name,
            "variant_group_description": vg.description,
            "display_order": link.display_order,
            "is_mandatory": link.is_mandatory,
            "default_variant_id": link.default_variant_id,
            "effective_default_id": effective_default_id,
            "variant_count": len(variants),
            "variants": variants,
        })

    return variant_groups


@router.post("/{document_type_id}/variant-groups")
async def add_variant_group_to_document_type(
    document_type_id: int,
    variant_group_link: schemas.DocumentTypeVariantGroupLink,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """
    Add a variant group to a document type.
    """
    # Verify document type exists
    doc_type = await db.get(models.DocumentType, document_type_id)
    if not doc_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document type not found"
        )

    # Verify variant group exists
    vg = await db.get(models.ClauseVariantGroup, variant_group_link.variant_group_id)
    if not vg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Variant group not found"
        )

    # Check for existing link
    existing_query = select(models.DocumentTypeVariantGroup).where(
        models.DocumentTypeVariantGroup.document_type_id == document_type_id,
        models.DocumentTypeVariantGroup.variant_group_id == variant_group_link.variant_group_id
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Variant group is already assigned to this document type"
        )

    # Create link
    db_link = models.DocumentTypeVariantGroup(
        document_type_id=document_type_id,
        variant_group_id=variant_group_link.variant_group_id,
        display_order=variant_group_link.display_order,
        is_mandatory=variant_group_link.is_mandatory,
        default_variant_id=variant_group_link.default_variant_id,
    )
    db.add(db_link)
    await db.commit()
    await db.refresh(db_link)

    return {
        "id": db_link.id,
        "document_type_id": db_link.document_type_id,
        "variant_group_id": db_link.variant_group_id,
        "display_order": db_link.display_order,
        "is_mandatory": db_link.is_mandatory,
        "default_variant_id": db_link.default_variant_id,
        "variant_group_name": vg.name,
    }


@router.delete("/{document_type_id}/variant-groups/{variant_group_id}")
async def remove_variant_group_from_document_type(
    document_type_id: int,
    variant_group_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[models.Base, Depends(deps.get_current_active_admin)],
) -> Any:
    """
    Remove a variant group from a document type.
    """
    from sqlalchemy import delete

    # Verify document type exists
    doc_type = await db.get(models.DocumentType, document_type_id)
    if not doc_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document type not found"
        )

    # Delete the link
    result = await db.execute(
        delete(models.DocumentTypeVariantGroup).where(
            models.DocumentTypeVariantGroup.document_type_id == document_type_id,
            models.DocumentTypeVariantGroup.variant_group_id == variant_group_id
        )
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Variant group assignment not found"
        )

    await db.commit()

    return {"status": "removed", "document_type_id": document_type_id, "variant_group_id": variant_group_id}
