"""
Unified Document Composer Models

Smart UX Konzept - Phase 1:
- DocumentClauseInstance: Textbaustein-Instanzen innerhalb eines Dokuments
- Unterstützt Global (aus Bibliothek), Local (im Dokument erstellt), Deviation (aufgebrochen)
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, CheckConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base
import enum


class ClauseOrigin(str, enum.Enum):
    """Herkunft einer Textbaustein-Instanz im Dokument."""
    GLOBAL = "global"        # Aus Bibliothek, schreibgeschützt (grün)
    LOCAL = "local"          # Im Dokument erstellt (blau)
    DEVIATION = "deviation"  # War global, wurde aufgebrochen (blau mit Indikator)
    VARIANT = "variant"      # Aus Varianten-Gruppe, bei Draft-Erstellung ausgewählt (v4.2)


class DocumentClauseInstance(Base):
    """
    Textbaustein-Instanz innerhalb eines Dokuments (Draft oder Generated).

    Smart UX Konzept - Visuelles System:
    - GLOBAL (grün): Referenz zu Clause-Tabelle, read-only, 🔒 Icon
    - LOCAL (blau): Eigener Content, frei editierbar, ✏️ Icon
    - DEVIATION (blau): Kopie von Global, editierbar, "Abgewandelt" Badge

    Eine Instanz gehört entweder zu einem Draft ODER zu einem GeneratedDocument,
    niemals zu beiden gleichzeitig.
    """
    __tablename__ = "document_clause_instances"

    id = Column(Integer, primary_key=True, index=True)

    # ══════════════════════════════════════════════════════════════════════════
    # ZUORDNUNG: Entweder Draft ODER GeneratedDocument
    # ══════════════════════════════════════════════════════════════════════════
    document_draft_id = Column(
        Integer,
        ForeignKey("document_drafts.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    generated_document_id = Column(
        Integer,
        ForeignKey("generated_documents.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    # ══════════════════════════════════════════════════════════════════════════
    # HERKUNFT & VERKNÜPFUNG
    # ══════════════════════════════════════════════════════════════════════════
    clause_origin = Column(
        String(20),
        nullable=False,
        default=ClauseOrigin.LOCAL.value,
        index=True
    )  # global, local, deviation

    # Verknüpfung zu globaler Klausel (für global und deviation)
    source_clause_id = Column(
        Integer,
        ForeignKey("clauses.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    source_clause_version = Column(Integer, nullable=True)  # Welche Version wurde referenziert

    # ══════════════════════════════════════════════════════════════════════════
    # INHALT
    # ══════════════════════════════════════════════════════════════════════════
    title = Column(String(255), nullable=False)
    content_html = Column(Text, nullable=True)  # NULL bei global (wird aus Clause geladen)

    # Reihenfolge im Dokument
    display_order = Column(Integer, nullable=False, default=0)

    # ══════════════════════════════════════════════════════════════════════════
    # DEVIATION TRACKING (Phase 2)
    # ══════════════════════════════════════════════════════════════════════════
    deviated_at = Column(DateTime(timezone=True), nullable=True)
    deviated_by_user_id = Column(Integer, nullable=True)
    deviated_reason = Column(Text, nullable=True)  # "Anpassung für Sonderfall XY"

    # Original-Content vor Deviation (für Rollback)
    original_content_snapshot = Column(Text, nullable=True)

    # ══════════════════════════════════════════════════════════════════════════
    # PROMOTION TRACKING (Phase 3)
    # ══════════════════════════════════════════════════════════════════════════
    promoted_to_clause_id = Column(
        Integer,
        ForeignKey("clauses.id", ondelete="SET NULL"),
        nullable=True
    )
    promoted_at = Column(DateTime(timezone=True), nullable=True)
    promoted_by_user_id = Column(Integer, nullable=True)

    # ══════════════════════════════════════════════════════════════════════════
    # VARIANTEN-SUPPORT (Integration mit bestehendem System)
    # ══════════════════════════════════════════════════════════════════════════
    variant_group_id = Column(Integer, nullable=True)  # Für Textbausteine mit Varianten
    selected_variant_id = Column(Integer, nullable=True)  # Aktuell ausgewählte Variante

    # ══════════════════════════════════════════════════════════════════════════
    # CONDITIONAL SUPPORT (Integration mit bestehendem System)
    # ══════════════════════════════════════════════════════════════════════════
    condition_json = Column(Text, nullable=True)  # JSON: {"field": "firmenwagen", "operator": "==", "value": true}
    is_condition_met = Column(Boolean, default=True)  # Wird bei Preview/Generate evaluiert

    # ══════════════════════════════════════════════════════════════════════════
    # METADATEN
    # ══════════════════════════════════════════════════════════════════════════
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # ══════════════════════════════════════════════════════════════════════════
    # RELATIONSHIPS
    # ══════════════════════════════════════════════════════════════════════════
    source_clause = relationship(
        "Clause",
        foreign_keys=[source_clause_id],
        backref="instances"
    )
    promoted_clause = relationship(
        "Clause",
        foreign_keys=[promoted_to_clause_id]
    )
    draft = relationship(
        "DocumentDraft",
        backref="clause_instances"
    )
    generated_document = relationship(
        "GeneratedDocument",
        backref="clause_instances"
    )

    # ══════════════════════════════════════════════════════════════════════════
    # CONSTRAINTS & INDEXES
    # ══════════════════════════════════════════════════════════════════════════
    __table_args__ = (
        # Entweder draft_id ODER document_id, nicht beide
        CheckConstraint(
            "(document_draft_id IS NOT NULL AND generated_document_id IS NULL) OR "
            "(document_draft_id IS NULL AND generated_document_id IS NOT NULL)",
            name="check_single_parent"
        ),
        # Composite Index für schnelles Laden aller Textbausteine eines Drafts
        Index("ix_clause_instances_draft_order", "document_draft_id", "display_order"),
        # Composite Index für generierte Dokumente
        Index("ix_clause_instances_doc_order", "generated_document_id", "display_order"),
    )

    def __repr__(self):
        parent = f"draft={self.document_draft_id}" if self.document_draft_id else f"doc={self.generated_document_id}"
        return f"<ClauseInstance(id={self.id}, {parent}, origin={self.clause_origin}, title='{self.title[:30]}...')>"

    @property
    def is_editable(self) -> bool:
        """Kann diesen Textbaustein bearbeitet werden?"""
        return self.clause_origin != ClauseOrigin.GLOBAL.value

    @property
    def visual_style(self) -> str:
        """CSS-Klasse für visuelle Darstellung."""
        if self.clause_origin == ClauseOrigin.GLOBAL.value:
            return "green"  # Grüner Rand
        return "blue"  # Blauer Rand (local und deviation)

    def to_dict(self, include_content: bool = True) -> dict:
        """Serialisierung für API-Response."""
        data = {
            "id": self.id,
            "origin": self.clause_origin,
            "source_clause_id": self.source_clause_id,
            "source_clause_version": self.source_clause_version,
            "title": self.title,
            "display_order": self.display_order,
            "is_editable": self.is_editable,
            "visual_style": self.visual_style,
            "variant_group_id": self.variant_group_id,
            "selected_variant_id": self.selected_variant_id,
            "is_condition_met": self.is_condition_met,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_content:
            data["content_html"] = self.content_html

        # Deviation-spezifische Felder
        if self.clause_origin == ClauseOrigin.DEVIATION.value:
            data["deviated_at"] = self.deviated_at.isoformat() if self.deviated_at else None
            data["deviated_reason"] = self.deviated_reason

        # Promotion-spezifische Felder
        if self.promoted_to_clause_id:
            data["promoted_to_clause_id"] = self.promoted_to_clause_id
            data["promoted_at"] = self.promoted_at.isoformat() if self.promoted_at else None

        return data
