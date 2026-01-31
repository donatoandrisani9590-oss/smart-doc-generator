from pydantic import BaseModel
from typing import Optional, List

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
    variant_group_name: Optional[str] = None
    variant_group_description: Optional[str] = None
    variant_count: int = 0
    variants: List[dict] = []  # Liste der Varianten mit id, name, is_default

    class Config:
        from_attributes = True


class DocumentTypeBase(BaseModel):
    name: str
    country_code: str = "DE"  # DE or IT
    category: Optional[str] = None
    is_active: bool = True
    description: Optional[str] = None

    # Standardwerte für diesen Dokumenttyp (v4.2 UX-Verbesserung)
    default_probation_months: int = 6
    default_notice_period: str = "4 Wochen zum Monatsende"
    default_vacation_days: int = 30
    default_weekly_hours: int = 40

class DocumentTypeCreate(DocumentTypeBase):
    clauses: List[DocumentTypeClauseLink] = []
    variant_groups: List[DocumentTypeVariantGroupLink] = []  # Varianten-Gruppen zuordnen

class DocumentTypeUpdate(BaseModel):
    name: Optional[str] = None
    country_code: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None
    clauses: Optional[List[DocumentTypeClauseLink]] = None
    variant_groups: Optional[List[DocumentTypeVariantGroupLink]] = None  # Varianten-Gruppen aktualisieren

    # Standardwerte optional aktualisierbar
    default_probation_months: Optional[int] = None
    default_notice_period: Optional[str] = None
    default_vacation_days: Optional[int] = None
    default_weekly_hours: Optional[int] = None

class DocumentTypeInDBBase(DocumentTypeBase):
    id: int

    class Config:
        from_attributes = True

class DocumentType(DocumentTypeInDBBase):
    pass


class DocumentTypeWithVariantGroups(DocumentTypeInDBBase):
    """DocumentType mit zugeordneten Varianten-Gruppen (für Detail-View)."""
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
