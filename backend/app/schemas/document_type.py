from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class DocumentTypeClauseLink(BaseModel):
    clause_id: int
    display_order: int
    is_mandatory: bool = True


# ══════════════════════════════════════════════════════════════════════════════
# VARIANTEN-GRUPPEN ZUORDNUNG (v4.2 Feature: UX-Verbesserung)
# ══════════════════════════════════════════════════════════════════════════════
class DocumentTypeVariantGroupLink(BaseModel):
    """Schema für die Zuordnung einer Varianten-Gruppe zu einem Dokumenttyp."""
    variant_group_id: int
    display_order: int = 0
    is_mandatory: bool = True
    default_variant_id: Optional[int] = None  # Standard-Variante für diesen Dokumenttyp


class DocumentTypeVariantGroupResponse(BaseModel):
    """Response-Schema für eine zugeordnete Varianten-Gruppe."""
    id: int
    variant_group_id: int
    display_order: int
    is_mandatory: bool
    default_variant_id: Optional[int] = None

    # Nested Daten für Frontend
    variant_group_name: Optional[str] = Field(None, max_length=255, description="Variant group name")
    variant_group_description: Optional[str] = Field(None, max_length=1000, description="Variant group description")
    variant_count: int = 0
    variants: List[dict] = []  # Liste der Varianten mit id, name, is_default

    class Config:
        from_attributes = True


class DocumentTypeBase(BaseModel):
    name: str = Field(..., max_length=255, description="Document type name")
    country_code: str = Field(default="DE", max_length=2, description="DE or IT")
    category: Optional[str] = Field(None, max_length=255, description="Document category")
    is_active: bool = True
    description: Optional[str] = Field(None, max_length=1000, description="Document type description")

    # Standardwerte für diesen Dokumenttyp (v4.2 UX-Verbesserung)
    default_probation_months: int = 6
    default_notice_period: str = Field(default="4 Wochen zum Monatsende", max_length=500, description="Default notice period")
    default_vacation_days: int = 30
    default_weekly_hours: int = 40

    # KI-Anweisungen (dokumenttyp-spezifisch)
    ai_instructions: Optional[str] = Field(None, description="AI instructions specific to this document type")

class DocumentTypeCreate(DocumentTypeBase):
    clauses: List[DocumentTypeClauseLink] = []
    variant_groups: List[DocumentTypeVariantGroupLink] = []  # Varianten-Gruppen zuordnen

class DocumentTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255, description="Document type name")
    country_code: Optional[str] = Field(None, max_length=2, description="DE or IT")
    category: Optional[str] = Field(None, max_length=255, description="Document category")
    is_active: Optional[bool] = None
    description: Optional[str] = Field(None, max_length=1000, description="Document type description")
    clauses: Optional[List[DocumentTypeClauseLink]] = None
    variant_groups: Optional[List[DocumentTypeVariantGroupLink]] = None  # Varianten-Gruppen aktualisieren

    # Standardwerte optional aktualisierbar
    default_probation_months: Optional[int] = None
    default_notice_period: Optional[str] = Field(None, max_length=500, description="Default notice period")
    default_vacation_days: Optional[int] = None
    default_weekly_hours: Optional[int] = None

    # KI-Anweisungen
    ai_instructions: Optional[str] = Field(None, description="AI instructions specific to this document type")

class DocumentTypeInDBBase(DocumentTypeBase):
    id: int

    class Config:
        from_attributes = True

class DocumentType(DocumentTypeInDBBase):
    updated_at: Optional[datetime] = None


class DocumentTypeWithVariantGroups(DocumentTypeInDBBase):
    """DocumentType mit zugeordneten Varianten-Gruppen (für Detail-View)."""
    updated_at: Optional[datetime] = None
    variant_groups: List[DocumentTypeVariantGroupResponse] = []


# ══════════════════════════════════════════════════════════════════════════════
# BULK-ZUORDNUNG (für ClauseVariantManager)
# ══════════════════════════════════════════════════════════════════════════════
class VariantGroupDocTypeAssignment(BaseModel):
    """Zuordnung einer Varianten-Gruppe zu einem Dokumenttyp (Bulk-Zuweisung)."""
    document_type_id: int
    is_mandatory: bool = True
    default_variant_id: Optional[int] = None
    display_order: int = 0


class VariantGroupBulkAssignment(BaseModel):
    """Bulk-Zuordnung einer Varianten-Gruppe zu mehreren Dokumenttypen."""
    assignments: List[VariantGroupDocTypeAssignment]


class VariantGroupAssignmentResponse(BaseModel):
    """Response für zugeordnete Dokumenttypen einer Varianten-Gruppe."""
    document_type_id: int
    document_type_name: str
    is_mandatory: bool
    default_variant_id: Optional[int] = None
    default_variant_name: Optional[str] = None

    class Config:
        from_attributes = True
