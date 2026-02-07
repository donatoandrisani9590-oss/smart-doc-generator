from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, Enum, DateTime, Date, UniqueConstraint, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base
import enum

class CountryCode(str, enum.Enum):
    DE = "DE"
    IT = "IT"

class DocumentType(Base):
    """
    Dokumenttyp mit Standardwerten für die Dokumentenerstellung.

    v4.2 Feature: Standardwerte pro Dokumenttyp statt global.
    Ermöglicht unterschiedliche Defaults für verschiedene Vertragsarten.
    """
    __tablename__ = "document_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    country_code = Column(String(2), nullable=False, index=True)  # DE or IT - indexed for filtering
    category = Column(String, nullable=True, index=True)
    is_active = Column(Boolean, default=True, index=True)
    description = Column(Text, nullable=True)  # Beschreibung für Admin-UI

    # ══════════════════════════════════════════════════════════════════════════
    # STANDARDWERTE FÜR DIESEN DOKUMENTTYP (v4.2 UX-Verbesserung)
    # Diese werden beim Erstellen eines Dokuments vorausgefüllt
    # ══════════════════════════════════════════════════════════════════════════
    default_probation_months = Column(Integer, default=6)  # Probezeit in Monaten (0, 3, 6)
    default_notice_period = Column(String(100), default="4 Wochen zum Monatsende")  # Kündigungsfrist
    default_vacation_days = Column(Integer, default=30)  # Urlaubstage pro Jahr
    default_weekly_hours = Column(Integer, default=40)  # Wochenstunden

    # ══════════════════════════════════════════════════════════════════════════
    # INDIVIDUELLE KOPF-/FUSSZEILEN PRO VORLAGE (v4.3 Feature)
    # Überschreibt die globalen DesignSettings wenn gesetzt
    # ══════════════════════════════════════════════════════════════════════════
    # Kopfzeile
    custom_header_enabled = Column(Boolean, default=False)  # True = eigene Kopfzeile nutzen
    custom_header_line1 = Column(Text, nullable=True)
    custom_header_line2 = Column(Text, nullable=True)
    custom_header_line3 = Column(Text, nullable=True)

    # Fußzeile
    custom_footer_enabled = Column(Boolean, default=False)  # True = eigene Fußzeile nutzen
    custom_footer_line1 = Column(Text, nullable=True)
    custom_footer_line2 = Column(Text, nullable=True)
    custom_footer_line3 = Column(Text, nullable=True)

    # Logo-Einstellungen (überschreibt DesignSettings wenn gesetzt)
    custom_logo_enabled = Column(Boolean, default=False)
    custom_logo_path = Column(String, nullable=True)  # Eigenes Logo für diese Vorlage
    custom_logo_position = Column(String(20), nullable=True)  # 'left', 'center', 'right'
    custom_logo_width_cm = Column(String(10), nullable=True)  # z.B. "5.0"

    # Design-Einstellungen überschreiben
    custom_margin_left_cm = Column(String(10), nullable=True)
    custom_margin_right_cm = Column(String(10), nullable=True)
    custom_margin_top_cm = Column(String(10), nullable=True)
    custom_margin_bottom_cm = Column(String(10), nullable=True)

    # Referenz zur Quell-Vorlage (für "von Vorlage übernommen")
    source_template_id = Column(Integer, ForeignKey("document_types.id", ondelete="SET NULL"), nullable=True)

    # ══════════════════════════════════════════════════════════════════════════
    # TEAM-VORLAGEN (v4.4 Feature: Geteilte Vorlagen im Team)
    # ══════════════════════════════════════════════════════════════════════════
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True)
    # visibility: 'global' = alle sehen, 'team' = nur Team-Mitglieder, 'private' = nur Ersteller
    visibility = Column(String(20), default="global", index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    clauses = relationship("DocumentTypeClause", back_populates="document_type", order_by="DocumentTypeClause.display_order")
    variant_groups = relationship("DocumentTypeVariantGroup", back_populates="document_type", order_by="DocumentTypeVariantGroup.display_order")
    source_template = relationship("DocumentType", remote_side=[id], foreign_keys=[source_template_id])

class ClauseApprovalStatus(str, enum.Enum):
    """Status für den Freigabe-Workflow (4-Augen-Prinzip)."""
    DRAFT = "draft"              # Entwurf
    PENDING_REVIEW = "pending"   # Zur Prüfung
    APPROVED = "approved"        # Freigegeben
    REJECTED = "rejected"        # Abgelehnt
    ACTIVE = "active"            # Aktiv (nach Freigabe)


class Clause(Base):
    __tablename__ = "clauses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content_html = Column(Text, nullable=False)
    country_code = Column(String(2), nullable=True, index=True)
    category = Column(String, nullable=True, index=True)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True, index=True)

    # ══════════════════════════════════════════════════════════════════════════
    # AI-METADATEN (v4.3 Feature: KI-Klausel-Bridge)
    # Ermöglicht semantisches Matching zwischen User-Intent und Klauseln.
    # Ohne diese Felder kann die KI die Klauseln nicht intelligent auswählen.
    # ══════════════════════════════════════════════════════════════════════════
    tags = Column(JSON, nullable=True, default=list)  # ["kuendigung", "streng", "fristlos"]
    description = Column(Text, nullable=True)  # "Strenge Kündigungsklausel mit kurzer Frist"
    tone = Column(String(50), nullable=True)  # neutral, streng, arbeitnehmerfreundlich, moderat

    # ══════════════════════════════════════════════════════════════════════════
    # TENANT ISOLATION (v4.3 Feature: Mandantentrennung)
    # NULL = globale/geteilte Klausel, sonst gehört die Klausel diesem User.
    # ══════════════════════════════════════════════════════════════════════════
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # ══════════════════════════════════════════════════════════════════════════
    # FREIGABE-WORKFLOW (v4.2 Feature: Kapitel 15.3)
    # ══════════════════════════════════════════════════════════════════════════
    approval_status = Column(String(20), default="active", index=True)  # draft, pending, approved, rejected, active
    approval_requested_at = Column(DateTime(timezone=True), nullable=True)
    approval_requested_by = Column(String(255), nullable=True)
    approval_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    approval_reviewed_by = Column(String(255), nullable=True)
    approval_comment = Column(Text, nullable=True)  # Kommentar bei Ablehnung

class DocumentTypeClause(Base):
    """
    Zuordnung von Klauseln zu Dokumenttypen.

    v4.2 Feature (Kapitel 16.13):
    - 4 Klausel-Typen: standard, optional, conditional, variant
    - Varianten-Gruppen für alternative Klauseln
    """
    __tablename__ = "document_type_clauses"

    document_type_id = Column(Integer, ForeignKey("document_types.id"), primary_key=True)
    clause_id = Column(Integer, ForeignKey("clauses.id"), primary_key=True)
    display_order = Column(Integer, nullable=False)
    is_mandatory = Column(Boolean, default=True)

    # Klausel-Typ: standard, optional, conditional, variant
    clause_type = Column(String(20), default="standard")

    # Für optionale Klauseln: Standardmäßig ausgewählt?
    is_default_selected = Column(Boolean, default=True)

    # Für bedingte Klauseln: Bedingung als JSON
    condition = Column(Text, nullable=True)  # JSON: {"field": "x", "operator": "=", "value": 1}

    # Für Varianten: Gruppierung
    variant_group = Column(String(100), nullable=True)  # z.B. "kuendigungsfrist"
    is_default_variant = Column(Boolean, default=False)

    # Reihenfolge sperren (z.B. Schlussbestimmungen immer am Ende)
    is_order_locked = Column(Boolean, default=False)

    document_type = relationship("DocumentType", back_populates="clauses")
    clause = relationship("Clause")


# ══════════════════════════════════════════════════════════════════════════════
# KLAUSEL-VARIANTEN (v4.2 Feature: Kapitel 16.13.1)
# Mehrere alternative Versionen einer Klausel
# ══════════════════════════════════════════════════════════════════════════════
class ClauseVariantGroup(Base):
    """
    Gruppe von zusammengehörigen Klausel-Varianten.

    Beispiel: Kündigungsfristen
    - Variante A: 3 Monate (Standard)
    - Variante B: 6 Monate (Führungskräfte)
    - Variante C: 12 Monate (Geschäftsführung)
    """
    __tablename__ = "clause_variant_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)  # z.B. "Kündigungsfristen"
    description = Column(Text, nullable=True)
    country_code = Column(String(2), default="DE", index=True)
    category = Column(String(100), nullable=True, index=True)  # z.B. "Arbeitsrecht"

    # Die Basis-Klausel (parent)
    base_clause_id = Column(Integer, ForeignKey("clauses.id"), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)

    # Beziehungen
    variants = relationship("ClauseVariant", back_populates="group", order_by="ClauseVariant.sort_order")
    base_clause = relationship("Clause", foreign_keys=[base_clause_id])


class ClauseVariant(Base):
    """
    Eine einzelne Variante innerhalb einer Gruppe.
    """
    __tablename__ = "clause_variants"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("clause_variant_groups.id"), nullable=False, index=True)
    clause_id = Column(Integer, ForeignKey("clauses.id"), nullable=False, index=True)

    # Varianten-Details
    variant_name = Column(String(255), nullable=False)  # z.B. "3 Monate (Standard)"
    variant_code = Column(String(50), nullable=True)  # z.B. "A", "B", "C"
    description = Column(Text, nullable=True)  # Wann wird diese Variante verwendet?

    # Bedingung für automatische Auswahl (optional)
    auto_select_condition = Column(Text, nullable=True)  # JSON

    # Sortierung und Standard
    sort_order = Column(Integer, default=0)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    # Beziehungen
    group = relationship("ClauseVariantGroup", back_populates="variants")
    clause = relationship("Clause")


# ══════════════════════════════════════════════════════════════════════════════
# DOKUMENTTYP ↔ VARIANTEN-GRUPPE ZUORDNUNG (v4.2 Feature: UX-Verbesserung)
# Ermöglicht die Zuweisung von Varianten-Gruppen zu bestimmten Dokumenttypen
# ══════════════════════════════════════════════════════════════════════════════
class DocumentTypeVariantGroup(Base):
    """
    Verknüpfung zwischen Dokumenttypen und Varianten-Gruppen.

    Ermöglicht zwei Zuordnungswege:
    1. Im DocumentTypeEditor: Varianten-Gruppen zum Dokumenttyp hinzufügen
    2. Im ClauseVariantManager: Varianten-Gruppe mehreren Dokumenttypen zuordnen

    Bei Dokumentgenerierung erscheint dann eine Auswahl für die Varianten
    dieser Gruppe im Generator.
    """
    __tablename__ = "document_type_variant_groups"

    id = Column(Integer, primary_key=True, index=True)
    document_type_id = Column(Integer, ForeignKey("document_types.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_group_id = Column(Integer, ForeignKey("clause_variant_groups.id", ondelete="CASCADE"), nullable=False, index=True)

    # Position im Dokument (für Sortierung zusammen mit Klauseln)
    display_order = Column(Integer, default=0)

    # Pflichtfeld oder optional?
    is_mandatory = Column(Boolean, default=True)

    # Standard-Variante für diesen Dokumenttyp (kann von Gruppen-Default abweichen)
    default_variant_id = Column(Integer, ForeignKey("clause_variants.id", ondelete="SET NULL"), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(255), nullable=True)

    # Beziehungen
    document_type = relationship("DocumentType", back_populates="variant_groups")
    variant_group = relationship("ClauseVariantGroup")
    default_variant = relationship("ClauseVariant")

    __table_args__ = (
        UniqueConstraint('document_type_id', 'variant_group_id', name='uq_doctype_variantgroup'),
    )


# ══════════════════════════════════════════════════════════════════════════════
# KLAUSEL-VERSIONS-HISTORIE (v4.2 Feature: Kapitel 15.5.10)
# Detaillierte Änderungshistorie mit Kommentaren
# ══════════════════════════════════════════════════════════════════════════════
class ClauseVersion(Base):
    """
    Versionshistorie für Klauseln.

    Speichert jeden Stand einer Klausel mit:
    - Vollständigem Inhalt
    - Änderungsgrund/Kommentar
    - Autor und Zeitstempel
    """
    __tablename__ = "clause_versions"

    id = Column(Integer, primary_key=True, index=True)
    clause_id = Column(Integer, ForeignKey("clauses.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)

    # Inhalt dieser Version
    title = Column(String(255), nullable=False)
    content_html = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)

    # Änderungsgrund (kritisch für Compliance!)
    change_reason = Column(String(50), nullable=True)  # gesetzesaenderung, korrektur, optimierung, neu
    change_comment = Column(Text, nullable=True)  # Detaillierter Kommentar
    change_reference = Column(String(255), nullable=True)  # z.B. "§ 4 TzBfG Änderung 2025"

    # Autor-Info
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by_user_id = Column(String(255), nullable=True)
    created_by_user_name = Column(String(255), nullable=True)

    # Status
    is_active = Column(Boolean, default=True)  # Nur eine Version kann aktiv sein
    activated_at = Column(DateTime(timezone=True), nullable=True)

    # Freigabe (optional)
    approved_by = Column(String(255), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    # Beziehung
    clause = relationship("Clause", backref="versions")


# ══════════════════════════════════════════════════════════════════════════════
# KLAUSEL-NOTIZEN (v4.2 Feature: Kapitel 15.5.6)
# Interne Notizen pro Klausel (nur für Admins sichtbar)
# ══════════════════════════════════════════════════════════════════════════════
class ClauseNote(Base):
    """
    Interne Notizen für Klauseln.

    Gemäß Spezifikation v4.2, Kapitel 15.5.6:
    - "RA Müller hat geprüft und freigegeben"
    - "Betriebsrat hat zugestimmt (Protokoll vom 03.12.24)"
    - Diese Notizen erscheinen NICHT im generierten Dokument
    """
    __tablename__ = "clause_notes"

    id = Column(Integer, primary_key=True, index=True)
    clause_id = Column(Integer, ForeignKey("clauses.id"), nullable=False, index=True)

    # Notiz-Inhalt
    content = Column(Text, nullable=False)
    is_pinned = Column(Boolean, default=False)  # Angeheftete Notiz (z.B. "WICHTIG")
    note_type = Column(String(50), default="info")  # info, warning, legal, approval

    # Autor-Info
    created_by_user_id = Column(String(255), nullable=False)
    created_by_user_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Beziehungen
    clause = relationship("Clause", backref="notes")


# ══════════════════════════════════════════════════════════════════════════════
# STAMMDATEN (v4.2 Feature: Kapitel 15.5.7)
# Zentrale Firmendaten für Autofill
# ══════════════════════════════════════════════════════════════════════════════
class CompanySettings(Base):
    """
    Stammdaten-Verwaltung für automatisches Ausfüllen.

    Gemäß Spezifikation v4.2, Kapitel 15.5.7:
    - Firmenname, Adresse, GF zentral pflegen
    - Automatisch in neue Verträge einfügen
    - Standard-Werte (Probezeit, Kündigungsfrist, etc.)
    """
    __tablename__ = "company_settings"

    id = Column(Integer, primary_key=True, index=True)
    country_code = Column(String(2), nullable=False, unique=True)  # DE or IT

    # Unternehmensdaten
    company_name = Column(String(255), nullable=True)
    street = Column(String(255), nullable=True)
    postal_code = Column(String(20), nullable=True)
    city = Column(String(100), nullable=True)
    managing_director = Column(String(255), nullable=True)  # Geschäftsführer
    commercial_register = Column(String(255), nullable=True)  # HRB 12345
    tax_id = Column(String(100), nullable=True)  # USt-IdNr

    # Standard-Werte für neue Verträge
    default_probation_months = Column(Integer, default=6)
    default_notice_period = Column(String(100), default="4 Wochen zum Monatsende")
    default_vacation_days = Column(Integer, default=30)
    default_weekly_hours = Column(Integer, default=40)

    # Timestamps
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    updated_by = Column(String(255), nullable=True)


# ══════════════════════════════════════════════════════════════════════════════
# GENERIERTE DOKUMENTE - Model in enterprise.py definiert
# Import hier für Referenz: from app.models.enterprise import GeneratedDocument
# ══════════════════════════════════════════════════════════════════════════════


# ══════════════════════════════════════════════════════════════════════════════
# FRISTEN-KALENDER (v4.2 Feature: Kapitel 15.2.7)
# Probezeit-Ende, Befristungs-Ablauf tracking
# ══════════════════════════════════════════════════════════════════════════════
class DocumentDeadline(Base):
    """
    Fristen aus generierten Dokumenten.

    Gemäß Spezifikation v4.2, Kapitel 15.2.7:
    - Probezeit-Ende automatisch tracken
    - Befristungs-Ablauf überwachen
    - Erinnerungen vor Ablauf senden
    """
    __tablename__ = "document_deadlines"

    id = Column(Integer, primary_key=True, index=True)
    generated_document_id = Column(Integer, ForeignKey("generated_documents.id", ondelete="SET NULL"), nullable=True, index=True)
    country_code = Column(String(2), nullable=False)

    # Frist-Details
    deadline_type = Column(String(50), nullable=False, index=True)  # probezeit_ende, befristung_ende, etc.
    deadline_date = Column(Date, nullable=False, index=True)  # Proper date type - indexed for calendar queries
    deadline_label = Column(String(255), nullable=True)  # Human-readable Label

    # Mitarbeiter-Info
    employee_name = Column(String(255), nullable=False, index=True)
    employee_id = Column(String(100), nullable=True, index=True)  # Personalnummer

    # Status
    status = Column(String(50), default="pending", index=True)  # pending, acknowledged, completed, dismissed
    reminder_sent_at = Column(DateTime(timezone=True), nullable=True)

    # Notizen
    notes = Column(Text, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(String(255), nullable=True)


class DeadlineFieldMapping(Base):
    """
    Mapping: Welche Formularfelder erzeugen Fristen?

    Z.B.: probezeit_ende_datum → Probezeit-Frist
    """
    __tablename__ = "deadline_field_mappings"

    id = Column(Integer, primary_key=True, index=True)
    document_type_id = Column(Integer, ForeignKey("document_types.id", ondelete="CASCADE"), nullable=True)
    country_code = Column(String(2), nullable=True)

    field_name = Column(String(100), nullable=False)  # z.B. "probezeit_ende"
    deadline_type = Column(String(50), nullable=False)  # z.B. "Probezeit-Ende"
    deadline_label_template = Column(String(255), nullable=True)  # "Probezeit endet für {employee_name}"

    # Erinnerungs-Konfiguration
    reminder_days_before = Column(String(100), default="14,7,1")  # Komma-getrennt: 14, 7, 1 Tage vorher
    is_active = Column(Boolean, default=True)


# ══════════════════════════════════════════════════════════════════════════════
# BETRIEBSRAT-VORLAGEN (v4.2 Feature: Kapitel 15.4.6)
# Templates für Betriebsrat-Mitteilungen
# ══════════════════════════════════════════════════════════════════════════════
class WorksCouncilTemplate(Base):
    """
    Vorlagen für Betriebsrat-Mitteilungen.

    Gemäß Spezifikation v4.2, Kapitel 15.4.6:
    - Standardisierte BR-Vorlagen für Neueinstellungen
    - Enthält nur die relevanten Informationen (§99 BetrVG)
    - Separate Klauseln für verschiedene Szenarien
    """
    __tablename__ = "works_council_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)  # z.B. "Einstellung Vollzeit"
    template_type = Column(String(50), nullable=False)  # einstellung, versetzung, eingruppierung
    country_code = Column(String(2), default="DE")

    # Template-Inhalt (Jinja2 kompatibel)
    header_html = Column(Text, nullable=True)  # Kopfbereich
    content_html = Column(Text, nullable=False)  # Hauptinhalt
    footer_html = Column(Text, nullable=True)  # Fußbereich

    # Welche Felder aus dem Hauptdokument werden übernommen?
    included_fields = Column(Text, nullable=True)  # JSON: ["employee_name", "start_date", ...]
    excluded_fields = Column(Text, nullable=True)  # Felder die NICHT angezeigt werden

    # Metadaten
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    version = Column(Integer, default=1)


class WorksCouncilNotification(Base):
    """
    Erzeugte Betriebsrat-Mitteilungen.

    Dokumentiert wann welche BR-Mitteilung erstellt wurde.
    """
    __tablename__ = "works_council_notifications"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("works_council_templates.id", ondelete="SET NULL"), nullable=True)
    generated_document_id = Column(Integer, ForeignKey("generated_documents.id", ondelete="SET NULL"), nullable=True, index=True)

    # Mitarbeiter-Info
    employee_name = Column(String(255), nullable=False)
    notification_type = Column(String(50), nullable=False)  # einstellung, versetzung, etc.

    # Generierter Inhalt
    content_html = Column(Text, nullable=False)
    pdf_url = Column(String(500), nullable=True)

    # Status
    status = Column(String(50), default="erstellt")  # erstellt, versendet, bestaetigt
    sent_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_by = Column(String(255), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(String(255), nullable=True)
