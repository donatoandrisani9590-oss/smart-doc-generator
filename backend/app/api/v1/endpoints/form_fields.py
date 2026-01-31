"""
Form Field Management API endpoints.

Allows HR to customize form fields without IT:
- Change labels, help text, placeholders
- Set validation rules (min, max, required)
- Define default values
- Reorder fields
"""

from __future__ import annotations
from typing import Any, Annotated, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel

from app.db import get_db
from app.api import deps
from app.models import core as core_models
from app.models import enterprise as models
from app.models import documents as doc_models
from app.services.placeholder_validator import (
    extract_placeholders_from_html,
    PLACEHOLDER_LOOKUP,
    PlaceholderInfo,
)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class FormFieldResponse(BaseModel):
    id: int
    document_type_id: int
    field_name: str
    field_label: str
    field_type: str
    is_required: bool
    default_value: Optional[str] = None
    options: Optional[str] = None  # JSON string
    display_order: Optional[int] = None
    display_group: Optional[str] = None

    # HR customization fields
    help_text: Optional[str] = None
    placeholder_text: Optional[str] = None
    suffix: Optional[str] = None
    prefix: Optional[str] = None

    # Validation
    min_value: Optional[int] = None
    max_value: Optional[int] = None
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    pattern: Optional[str] = None
    pattern_error_message: Optional[str] = None

    # Conditional visibility (v4.2: Checkbox → Variante → Felder Flow)
    show_condition: Optional[str] = None  # JSON: { clause_id?, variant_id?, field_conditions? }
    source_clause_id: Optional[int] = None  # Welche Klausel hat dieses Feld erzeugt?

    # Metadata
    is_system_field: bool = False

    class Config:
        from_attributes = True


class FormFieldUpdate(BaseModel):
    """What HR can change about a form field."""
    field_label: Optional[str] = None
    field_type: Optional[str] = None
    is_required: Optional[bool] = None
    default_value: Optional[str] = None
    options: Optional[str] = None  # JSON string for select options

    # HR customization
    help_text: Optional[str] = None
    placeholder_text: Optional[str] = None
    suffix: Optional[str] = None
    prefix: Optional[str] = None

    # Validation
    min_value: Optional[int] = None
    max_value: Optional[int] = None
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    pattern: Optional[str] = None
    pattern_error_message: Optional[str] = None

    # Display
    display_order: Optional[int] = None
    display_group: Optional[str] = None

    # Conditional visibility (v4.2: Checkbox → Variante → Felder Flow)
    show_condition: Optional[str] = None  # JSON: { clause_id?, variant_id?, field_conditions? }


class FormFieldCreate(BaseModel):
    """Create a new custom form field."""
    document_type_id: int
    field_name: str
    field_label: str
    field_type: str = "text"
    is_required: bool = False
    default_value: Optional[str] = None
    options: Optional[str] = None
    help_text: Optional[str] = None
    placeholder_text: Optional[str] = None
    suffix: Optional[str] = None
    display_order: Optional[int] = None
    display_group: Optional[str] = None


class ReorderRequest(BaseModel):
    """Request to reorder fields."""
    field_ids: List[int]  # Ordered list of field IDs


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/document-type/{document_type_id}", response_model=List[FormFieldResponse])
async def get_form_fields(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    document_type_id: int,
) -> Any:
    """
    Get all form fields for a document type.
    Returns fields in display order.
    """
    result = await db.execute(
        select(models.FormField)
        .where(models.FormField.document_type_id == document_type_id)
        .order_by(
            models.FormField.display_group.nulls_last(),
            models.FormField.display_order.nulls_last(),
            models.FormField.id
        )
    )
    fields = result.scalars().all()

    return [FormFieldResponse.model_validate(f) for f in fields]


@router.get("/{field_id}", response_model=FormFieldResponse)
async def get_form_field(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    field_id: int,
) -> Any:
    """Get a single form field by ID."""
    result = await db.execute(
        select(models.FormField).where(models.FormField.id == field_id)
    )
    field = result.scalar_one_or_none()

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Formularfeld nicht gefunden",
        )

    return FormFieldResponse.model_validate(field)


@router.put("/{field_id}", response_model=FormFieldResponse)
async def update_form_field(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    field_id: int,
    update_data: FormFieldUpdate,
) -> Any:
    """
    Update a form field's properties.

    HR can change:
    - Label, help text, placeholder
    - Validation rules
    - Default value
    - Display order and grouping
    """
    result = await db.execute(
        select(models.FormField).where(models.FormField.id == field_id)
    )
    field = result.scalar_one_or_none()

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Formularfeld nicht gefunden",
        )

    # Update only provided fields
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(field, key, value)

    await db.commit()
    await db.refresh(field)

    return FormFieldResponse.model_validate(field)


@router.post("/", response_model=FormFieldResponse, status_code=status.HTTP_201_CREATED)
async def create_form_field(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    field_data: FormFieldCreate,
) -> Any:
    """
    Create a new custom form field.

    Use this to add fields that aren't automatically generated from placeholders.
    """
    # Check for duplicate field_name in same document type
    existing = await db.execute(
        select(models.FormField).where(
            and_(
                models.FormField.document_type_id == field_data.document_type_id,
                models.FormField.field_name == field_data.field_name,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Feld '{field_data.field_name}' existiert bereits für diesen Dokumenttyp",
        )

    field = models.FormField(
        document_type_id=field_data.document_type_id,
        field_name=field_data.field_name,
        field_label=field_data.field_label,
        field_type=field_data.field_type,
        is_required=field_data.is_required,
        default_value=field_data.default_value,
        options=field_data.options,
        help_text=field_data.help_text,
        placeholder_text=field_data.placeholder_text,
        suffix=field_data.suffix,
        display_order=field_data.display_order,
        display_group=field_data.display_group,
        is_system_field=False,  # User-created fields are not system fields
    )

    db.add(field)
    await db.commit()
    await db.refresh(field)

    return FormFieldResponse.model_validate(field)


@router.delete("/{field_id}")
async def delete_form_field(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    field_id: int,
) -> Any:
    """
    Delete a form field.

    Note: System fields (auto-generated from placeholders) cannot be deleted.
    """
    result = await db.execute(
        select(models.FormField).where(models.FormField.id == field_id)
    )
    field = result.scalar_one_or_none()

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Formularfeld nicht gefunden",
        )

    if field.is_system_field:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System-Felder können nicht gelöscht werden",
        )

    await db.delete(field)
    await db.commit()

    return {"message": "Formularfeld gelöscht", "id": field_id}


@router.post("/document-type/{document_type_id}/reorder")
async def reorder_form_fields(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    document_type_id: int,
    reorder_data: ReorderRequest,
) -> Any:
    """
    Reorder form fields for a document type.

    Pass an ordered list of field IDs. Fields will be assigned
    display_order values based on their position in the list.
    """
    for index, field_id in enumerate(reorder_data.field_ids):
        result = await db.execute(
            select(models.FormField).where(
                and_(
                    models.FormField.id == field_id,
                    models.FormField.document_type_id == document_type_id,
                )
            )
        )
        field = result.scalar_one_or_none()

        if field:
            field.display_order = index + 1

    await db.commit()

    return {"message": "Reihenfolge aktualisiert", "count": len(reorder_data.field_ids)}


@router.post("/document-type/{document_type_id}/reset")
async def reset_form_fields(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    document_type_id: int,
) -> Any:
    """
    Reset all form fields to their default state.

    This removes all customizations (labels, help text, validation)
    and restores the original values.
    """
    result = await db.execute(
        select(models.FormField).where(
            models.FormField.document_type_id == document_type_id
        )
    )
    fields = result.scalars().all()

    reset_count = 0
    for field in fields:
        if field.is_system_field:
            # Reset to defaults
            field.help_text = None
            field.placeholder_text = None
            field.suffix = None
            field.prefix = None
            field.min_value = None
            field.max_value = None
            field.min_length = None
            field.max_length = None
            field.pattern = None
            field.pattern_error_message = None
            # Keep field_label as it was originally set
            reset_count += 1

    await db.commit()

    return {"message": "Felder zurückgesetzt", "count": reset_count}


# ═══════════════════════════════════════════════════════════════════════════
# FIELD TYPES & OPTIONS
# ═══════════════════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════════════════
# AUTOMATIC FORMFIELD SYNC FROM CLAUSES (v4.2 Feature)
# ═══════════════════════════════════════════════════════════════════════════

class SyncResult(BaseModel):
    """Result of form field synchronization."""
    created: int
    updated: int
    removed: int
    fields_now: int
    details: List[str]


@router.post("/document-type/{document_type_id}/sync", response_model=SyncResult)
async def sync_form_fields_from_clauses(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_active_admin)],
    document_type_id: int,
) -> Any:
    """
    Synchronize form fields with placeholders from assigned clauses.

    This endpoint:
    1. Scans all clauses assigned to the document type
    2. Extracts placeholders ({{ xyz }}) from clause content
    3. Creates FormFields for new placeholders (as system fields)
    4. Removes FormFields for placeholders no longer used (system fields only)

    HR customizations are preserved - only system fields are affected.
    """
    details = []

    # 1. Get all clauses assigned to this document type
    clause_refs = await db.execute(
        select(doc_models.DocumentTypeClause)
        .where(doc_models.DocumentTypeClause.document_type_id == document_type_id)
    )
    refs = clause_refs.scalars().all()

    # 2. Collect all placeholders from all clauses
    all_placeholders: set[str] = set()
    clause_placeholder_map: dict[int, list[str]] = {}
    # Track which clause each placeholder comes from (for source_clause_id)
    placeholder_source_clause: dict[str, int] = {}
    # Track clause types for optional clause detection
    clause_type_map: dict[int, str] = {}

    for ref in refs:
        clause = await db.get(doc_models.Clause, ref.clause_id)
        if clause and clause.is_active and clause.content_html:
            placeholders = extract_placeholders_from_html(clause.content_html)
            all_placeholders.update(placeholders)
            clause_placeholder_map[clause.id] = placeholders
            clause_type_map[clause.id] = ref.clause_type or "standard"
            # Store first clause that uses this placeholder
            for ph in placeholders:
                if ph not in placeholder_source_clause:
                    placeholder_source_clause[ph] = clause.id
            if placeholders:
                details.append(f"Klausel '{clause.title}': {len(placeholders)} Platzhalter gefunden")

    # 3. Get existing form fields for this document type
    existing_fields = await db.execute(
        select(models.FormField)
        .where(models.FormField.document_type_id == document_type_id)
    )
    existing = {f.field_name: f for f in existing_fields.scalars().all()}

    created_count = 0
    updated_count = 0
    removed_count = 0

    # 4. Create missing form fields
    display_order = max((f.display_order or 0 for f in existing.values()), default=0)

    import json

    for placeholder_name in all_placeholders:
        if placeholder_name not in existing:
            # Get metadata from KNOWN_PLACEHOLDERS
            placeholder_info = PLACEHOLDER_LOOKUP.get(placeholder_name)

            # Determine source clause
            source_clause_id = placeholder_source_clause.get(placeholder_name)

            # Build show_condition for optional clauses (v4.2: Checkbox → Variante → Felder)
            show_condition = None
            if source_clause_id:
                clause_type = clause_type_map.get(source_clause_id, "standard")
                if clause_type in ("optional", "conditional", "variant"):
                    # Field should only show when its source clause is enabled
                    show_condition = json.dumps({"clause_id": source_clause_id})

            display_order += 1
            new_field = models.FormField(
                document_type_id=document_type_id,
                field_name=placeholder_name,
                field_label=placeholder_info.label if placeholder_info else placeholder_name.replace("_", " ").title(),
                field_type=_map_placeholder_type(placeholder_info.type if placeholder_info else "text"),
                is_required=True,  # Default to required
                display_order=display_order,
                display_group=placeholder_info.category if placeholder_info else "Allgemein",
                is_system_field=True,  # Mark as auto-generated
                placeholder_text=placeholder_info.example_value if placeholder_info else None,
                source_clause_id=source_clause_id,  # Track which clause this field comes from
                show_condition=show_condition,  # Conditional visibility for optional clauses
            )
            db.add(new_field)
            created_count += 1
            clause_info = f" (Klausel #{source_clause_id})" if source_clause_id else ""
            details.append(f"✅ Feld erstellt: {placeholder_name} ({new_field.field_label}){clause_info}")

    # 5. Remove system fields that are no longer used
    for field_name, field in existing.items():
        if field.is_system_field and field_name not in all_placeholders:
            await db.delete(field)
            removed_count += 1
            details.append(f"🗑️ Feld entfernt: {field_name} (nicht mehr verwendet)")

    await db.commit()

    # Count final fields
    final_count = await db.execute(
        select(models.FormField)
        .where(models.FormField.document_type_id == document_type_id)
    )
    fields_now = len(final_count.scalars().all())

    return SyncResult(
        created=created_count,
        updated=updated_count,
        removed=removed_count,
        fields_now=fields_now,
        details=details,
    )


def _map_placeholder_type(placeholder_type: str) -> str:
    """Map placeholder types to form field types."""
    type_mapping = {
        "text": "text",
        "date": "date",
        "currency": "number",
        "number": "number",
        "select": "select",
        "boolean": "checkbox",
    }
    return type_mapping.get(placeholder_type, "text")


@router.get("/document-type/{document_type_id}/preview-sync")
async def preview_sync_form_fields(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[core_models.User, Depends(deps.get_current_user)],
    document_type_id: int,
) -> Any:
    """
    Preview what would happen if form fields were synced.

    Returns a list of changes that would be made without actually making them.
    Useful for HR to understand impact before syncing.
    """
    # 1. Get all clauses assigned to this document type
    clause_refs = await db.execute(
        select(doc_models.DocumentTypeClause)
        .where(doc_models.DocumentTypeClause.document_type_id == document_type_id)
    )
    refs = clause_refs.scalars().all()

    # 2. Collect all placeholders
    all_placeholders: set[str] = set()
    clause_details = []

    for ref in refs:
        clause = await db.get(doc_models.Clause, ref.clause_id)
        if clause and clause.is_active and clause.content_html:
            placeholders = extract_placeholders_from_html(clause.content_html)
            all_placeholders.update(placeholders)
            clause_details.append({
                "clause_id": clause.id,
                "clause_title": clause.title,
                "placeholders": placeholders,
            })

    # 3. Get existing form fields
    existing_fields = await db.execute(
        select(models.FormField)
        .where(models.FormField.document_type_id == document_type_id)
    )
    existing = {f.field_name: f for f in existing_fields.scalars().all()}

    # 4. Calculate changes
    to_create = []
    to_remove = []

    for placeholder_name in all_placeholders:
        if placeholder_name not in existing:
            placeholder_info = PLACEHOLDER_LOOKUP.get(placeholder_name)
            to_create.append({
                "field_name": placeholder_name,
                "field_label": placeholder_info.label if placeholder_info else placeholder_name.replace("_", " ").title(),
                "field_type": _map_placeholder_type(placeholder_info.type if placeholder_info else "text"),
                "category": placeholder_info.category if placeholder_info else "Allgemein",
                "is_known": placeholder_info is not None,
            })

    for field_name, field in existing.items():
        if field.is_system_field and field_name not in all_placeholders:
            to_remove.append({
                "field_id": field.id,
                "field_name": field_name,
                "field_label": field.field_label,
            })

    return {
        "document_type_id": document_type_id,
        "clauses_scanned": len(refs),
        "placeholders_found": list(all_placeholders),
        "clause_details": clause_details,
        "changes": {
            "to_create": to_create,
            "to_remove": to_remove,
            "unchanged": len(existing) - len(to_remove),
        },
        "summary": {
            "will_create": len(to_create),
            "will_remove": len(to_remove),
            "total_after_sync": len(existing) + len(to_create) - len(to_remove),
        },
    }


@router.get("/field-types/")
async def get_available_field_types() -> Any:
    """
    Get available field types with their descriptions.

    Helps HR understand what each field type does.
    """
    return {
        "field_types": [
            {
                "type": "text",
                "label": "Textfeld",
                "description": "Einzeiliges Textfeld für kurze Eingaben",
                "supports_validation": ["min_length", "max_length", "pattern"],
            },
            {
                "type": "textarea",
                "label": "Textbereich",
                "description": "Mehrzeiliges Textfeld für längere Eingaben",
                "supports_validation": ["min_length", "max_length"],
            },
            {
                "type": "number",
                "label": "Zahl",
                "description": "Numerisches Eingabefeld",
                "supports_validation": ["min_value", "max_value"],
            },
            {
                "type": "date",
                "label": "Datum",
                "description": "Datumsauswahl mit Kalender",
                "supports_validation": [],
            },
            {
                "type": "select",
                "label": "Auswahl (Dropdown)",
                "description": "Auswahl aus vordefinierten Optionen",
                "supports_validation": [],
                "requires": "options",
            },
            {
                "type": "checkbox",
                "label": "Checkbox",
                "description": "Ja/Nein Auswahl",
                "supports_validation": [],
            },
            {
                "type": "email",
                "label": "E-Mail",
                "description": "E-Mail-Adresse mit Validierung",
                "supports_validation": [],
            },
        ]
    }
