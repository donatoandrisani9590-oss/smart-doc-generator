"""
Unified Document Composer Schemas

Pydantic Models für die Composer API.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ClauseOriginEnum(str, Enum):
    """Herkunft einer Klausel-Instanz."""
    GLOBAL = "global"
    LOCAL = "local"
    DEVIATION = "deviation"
    VARIANT = "variant"  # v4.2: Aus Varianten-Gruppe


# ══════════════════════════════════════════════════════════════════════════════
# CLAUSE INSTANCE SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class ClauseInstanceBase(BaseModel):
    """Basis-Schema für Klausel-Instanzen."""
    title: str = Field(..., min_length=1, max_length=255)
    display_order: int = Field(default=0, ge=0)


class ClauseInstanceCreate(ClauseInstanceBase):
    """Schema zum Erstellen einer Klausel-Instanz."""
    # Für globale Klausel: source_clause_id angeben
    source_clause_id: Optional[int] = None

    # Für lokale Klausel: content_html angeben
    content_html: Optional[str] = None

    # Optional: Position im Dokument (wenn nicht angegeben → ans Ende)
    position: Optional[int] = None

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "title": "§3 Urlaub",
                    "source_clause_id": 42,
                    "position": 3
                },
                {
                    "title": "Sondervereinbarung Homeoffice",
                    "content_html": "<p>Der Mitarbeiter darf bis zu 3 Tage pro Woche im Homeoffice arbeiten.</p>",
                    "position": 5
                }
            ]
        }


class ClauseInstanceUpdate(BaseModel):
    """Schema zum Aktualisieren einer Klausel-Instanz."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content_html: Optional[str] = None


class ClauseInstanceResponse(ClauseInstanceBase):
    """Schema für Klausel-Instanz Response."""
    id: int
    origin: ClauseOriginEnum
    source_clause_id: Optional[int] = None
    source_clause_version: Optional[int] = None
    content_html: Optional[str] = None
    is_editable: bool
    visual_style: str  # "green" oder "blue"

    # Varianten-Support
    variant_group_id: Optional[int] = None
    selected_variant_id: Optional[int] = None

    # Conditional Support
    is_condition_met: bool = True

    # Deviation-Info (Phase 2)
    deviated_at: Optional[datetime] = None
    deviated_by_user_id: Optional[int] = None
    deviated_reason: Optional[str] = None
    original_content_snapshot: Optional[str] = None  # Original-Content vor Deviation

    # Promotion-Info
    promoted_to_clause_id: Optional[int] = None
    promoted_at: Optional[datetime] = None

    # Timestamps
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ClauseInstanceListResponse(BaseModel):
    """Response für Liste von Klausel-Instanzen."""
    clauses: List[ClauseInstanceResponse]
    total: int
    draft_id: int


# ══════════════════════════════════════════════════════════════════════════════
# REORDER SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class ReorderItem(BaseModel):
    """Ein Element in der neuen Reihenfolge."""
    instance_id: int
    position: int = Field(..., ge=0)


class ReorderRequest(BaseModel):
    """Request zum Umsortieren von Klauseln."""
    new_order: List[ReorderItem]

    class Config:
        json_schema_extra = {
            "example": {
                "new_order": [
                    {"instance_id": 1, "position": 0},
                    {"instance_id": 3, "position": 1},
                    {"instance_id": 2, "position": 2}
                ]
            }
        }


# ══════════════════════════════════════════════════════════════════════════════
# DEVIATION SCHEMAS (Phase 2)
# ══════════════════════════════════════════════════════════════════════════════

class DeviateRequest(BaseModel):
    """Request zum Aufbrechen einer globalen Klausel."""
    reason: Optional[str] = Field(
        None,
        max_length=500,
        description="Optionaler Grund für die Abweichung"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "reason": "Anpassung für Sonderfall: Führungskraft mit erweitertem Urlaubsanspruch"
            }
        }


class DeviateResponse(BaseModel):
    """Response nach dem Aufbrechen."""
    id: int
    origin: ClauseOriginEnum  # Sollte jetzt "deviation" sein
    content_html: str  # Der kopierte Content
    deviated_at: datetime
    message: str


# ══════════════════════════════════════════════════════════════════════════════
# PROMOTION SCHEMAS (Phase 3)
# ══════════════════════════════════════════════════════════════════════════════

class PromoteRequest(BaseModel):
    """Request zum Aufnehmen einer Klausel in die Bibliothek."""
    title: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=100)
    country_code: str = Field(default="DE", pattern="^(DE|IT)$")
    convert_to_global: bool = Field(
        default=False,
        description="Soll die Instanz nach Promotion zu 'global' umgewandelt werden?"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "title": "§12 Homeoffice-Regelung",
                "category": "Arbeitszeit",
                "country_code": "DE",
                "convert_to_global": True
            }
        }


class PromoteResponse(BaseModel):
    """Response nach der Promotion."""
    status: str  # "submitted" oder "approved"
    new_clause_id: int
    approval_required: bool
    message: str


# ══════════════════════════════════════════════════════════════════════════════
# LIBRARY SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class LibraryClauseResponse(BaseModel):
    """Schema für eine Klausel aus der Bibliothek (für Drag & Drop)."""
    id: int
    title: str
    category: Optional[str] = None
    preview: str = Field(..., description="Erste 150 Zeichen des Contents")
    version: int
    is_approved: bool
    has_variants: bool = False
    variant_count: int = 0

    class Config:
        from_attributes = True


class LibrarySearchResponse(BaseModel):
    """Response für Bibliothek-Suche."""
    clauses: List[LibraryClauseResponse]
    total: int
    page: int
    page_size: int


class LibrarySearchParams(BaseModel):
    """Query-Parameter für Bibliothek-Suche."""
    country_code: str = "DE"
    category: Optional[str] = None
    search: Optional[str] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=100)


# ══════════════════════════════════════════════════════════════════════════════
# DRAFT COMPOSER SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class SelectedVariant(BaseModel):
    """Eine ausgewählte Variante für die Draft-Erstellung (v4.2 Feature)."""
    variant_group_id: int
    variant_id: int


class ComposerDraftCreate(BaseModel):
    """Schema zum Erstellen eines neuen Composer-Drafts."""
    document_type_id: int
    country_code: str = Field(default="DE", pattern="^(DE|IT)$")
    name: Optional[str] = Field(None, max_length=255)

    # Initial form data (Mitarbeiterdaten, etc.)
    form_data: Optional[dict] = None

    # Ausgewählte Varianten (v4.2 Feature: Varianten-Gruppen)
    selected_variants: Optional[List[SelectedVariant]] = None


class ComposerDraftResponse(BaseModel):
    """Response für einen Composer-Draft."""
    id: int
    document_type_id: int
    document_type_name: str
    country_code: str
    name: Optional[str] = None
    form_data: Optional[dict] = None

    # Klausel-Statistik
    clause_count: int
    global_clause_count: int
    local_clause_count: int
    deviation_count: int

    # Timestamps
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ══════════════════════════════════════════════════════════════════════════════
# FORM DATA SCHEMA
# ══════════════════════════════════════════════════════════════════════════════

class FormDataUpdate(BaseModel):
    """Schema zum Aktualisieren der Formulardaten eines Drafts."""
    form_data: dict

    class Config:
        json_schema_extra = {
            "example": {
                "form_data": {
                    "vorname": "Max",
                    "nachname": "Mustermann",
                    "position": "Software-Entwickler",
                    "gehalt": "5500",
                    "eintrittsdatum": "2025-04-01"
                }
            }
        }
