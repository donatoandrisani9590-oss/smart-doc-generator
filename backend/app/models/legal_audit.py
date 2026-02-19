"""Legal Audit models -- stores results from LegalAuditor clause reviews."""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class ClauseAuditResult(Base):
    """
    Ergebnis einer rechtlichen Prüfung eines Textbausteins.

    Jede Prüfung (automatisch via LLM oder manuell) erzeugt einen Eintrag.
    Verknüpft mit der geprüften Klausel und optional mit einem Ersatz-Vorschlag.
    """
    __tablename__ = "clause_audit_results"

    id = Column(Integer, primary_key=True, index=True)
    clause_id = Column(
        Integer,
        ForeignKey("clauses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    audited_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    audited_by = Column(String(100), nullable=False)  # "legal_auditor_v1" | "manual_review"
    status = Column(String(20), nullable=False, index=True)  # "ok" | "warning" | "deprecated"
    risk_level = Column(String(20), nullable=False)  # "low" | "medium" | "high" | "critical"
    reasoning = Column(Text, nullable=True)
    affected_law = Column(String(200), nullable=True)  # "§ 307 BGB", "NachwG", etc.
    suggestion = Column(Text, nullable=True)
    auto_fix_clause_id = Column(
        Integer,
        ForeignKey("clauses.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_resolved = Column(Boolean, default=False, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    clause = relationship("Clause", foreign_keys=[clause_id], backref="audit_results")
    auto_fix_clause = relationship("Clause", foreign_keys=[auto_fix_clause_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])
