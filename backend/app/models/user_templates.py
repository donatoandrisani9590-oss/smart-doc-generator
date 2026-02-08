"""
UserTemplate - Benutzereigene DOCX-Vorlagen

Nutzer können eigene DOCX-Templates hochladen (mit Branding, Header/Footer),
die bei der Dokumentengenerierung als Layout-Basis verwendet werden können.
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class UserTemplate(Base):
    """
    Benutzereigenes DOCX-Template mit Branding/Layout.

    Der Body des Templates wird bei der Generierung mit KI-Content befüllt,
    während Header, Footer und Styles erhalten bleiben.
    """
    __tablename__ = "user_templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)  # UUID-basiert
    file_size = Column(Integer, nullable=False)
    country_code = Column(String(2), nullable=True, index=True)  # Optional: DE, IT

    # Sichtbarkeit & Zuordnung (spiegelt DocumentType.visibility-Muster)
    # 'company' = alle Nutzer, 'team' = nur Team-Mitglieder, 'private' = nur Ersteller
    scope = Column(String(20), default="company", server_default="company", nullable=False, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True)
    category = Column(String(100), nullable=True, index=True)  # z.B. "HR", "Recht", "Finanzen"

    # Metadaten aus DOCX-Analyse
    has_header = Column(Boolean, default=False)
    has_footer = Column(Boolean, default=False)
    has_logo = Column(Boolean, default=False)
    font_family = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User", backref="user_templates")
