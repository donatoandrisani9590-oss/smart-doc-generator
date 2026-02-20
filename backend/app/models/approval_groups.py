"""
Approval Groups — Genehmigungsgruppen für den Freigabe-Workflow.

Ermöglicht die Zuordnung von Genehmigungsanfragen an Gruppen statt an Einzelpersonen.
Bei Gruppenanfragen werden alle Mitglieder benachrichtigt;
der erste Reagierende übernimmt die Genehmigung.

Modelle:
    ApprovalGroup        — Benannte Gruppe (z.B. "HR-Leitung", "Geschäftsführung")
    ApprovalGroupMember  — Mitglied einer Gruppe (mit is_primary Flag)
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func

from app.db import Base


class ApprovalGroup(Base):
    """
    Genehmigungsgruppe (z.B. "HR-Leitung DE", "Geschäftsführung IT").

    Gruppen können als Genehmiger für Dokumente zugewiesen werden.
    Alle aktiven Mitglieder einer Gruppe werden benachrichtigt.
    """
    __tablename__ = "approval_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    country_code = Column(String(2), nullable=True, index=True)  # DE, IT oder NULL für alle
    is_active = Column(Boolean, default=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    created_by = Column(String(255), nullable=True)


class ApprovalGroupMember(Base):
    """
    Mitglied einer Genehmigungsgruppe.

    is_primary: Primärer Genehmiger — wird bevorzugt zugewiesen wenn
    die Gruppe als Ganzes angefragt wird (z.B. für Eskalationslogik).
    """
    __tablename__ = "approval_group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(
        Integer,
        ForeignKey("approval_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_primary = Column(Boolean, default=False)

    joined_at = Column(DateTime(timezone=True), server_default=func.now())
