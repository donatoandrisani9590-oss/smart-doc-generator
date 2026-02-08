from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UUID
from sqlalchemy.sql import func
from app.db import Base
import uuid

class GeneratedDocument(Base):
    __tablename__ = "generated_documents"

    id = Column(Integer, primary_key=True, index=True)
    document_type_id = Column(Integer, ForeignKey("document_types.id"), index=True)
    file_path = Column(String, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_by = Column(String(255), nullable=True)  # User identifier string (for history API)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    retention_date = Column(DateTime(timezone=True), nullable=True, index=True)
    is_deleted = Column(Boolean, default=False, index=True)
    is_archived = Column(Boolean, default=False, index=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    archived_by = Column(String(255), nullable=True)

    # Document context
    country_code = Column(String(2), nullable=True, index=True)  # DE or IT
    file_format = Column(String(10), nullable=True)  # pdf, docx

    # Extended metadata for document management (15.5.2, 16.3)
    title = Column(String(255), nullable=True)  # Display title
    employee_name = Column(String(255), nullable=True, index=True)  # For search - indexed
    employee_id = Column(String(100), nullable=True, index=True)  # Personnel number - indexed
    form_data = Column(Text, nullable=True)  # JSON snapshot of form values
    current_version = Column(Integer, default=1)  # Track version number
    is_correctable = Column(Boolean, default=True)  # Can this doc be corrected?

class DocumentLock(Base):
    """
    Pessimistic locking for documents during editing/correction.

    Prevents concurrent editing conflicts:
    - User acquires lock before starting correction
    - Lock expires after timeout (heartbeat-based)
    - Other users see "locked by X" indicator
    - Lock released on correction submit/cancel or timeout
    """
    __tablename__ = "document_locks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("generated_documents.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Who holds the lock
    locked_by_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    locked_by_email = Column(String(255), nullable=False)
    locked_by_name = Column(String(255), nullable=True)  # Display name for UI

    # Timing
    locked_at = Column(DateTime(timezone=True), server_default=func.now())
    last_heartbeat = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)  # Auto-expire time

    # Context
    lock_reason = Column(String(100), default="correction")  # correction, review, editing


class RetentionPolicy(Base):
    __tablename__ = "retention_policies"

    id = Column(Integer, primary_key=True, index=True)
    doc_category = Column(String, unique=True, nullable=False)
    retention_period_days = Column(Integer, nullable=False)
    action = Column(String, default="DELETE") # DELETE or ARCHIVE

class BulkJob(Base):
    __tablename__ = "bulk_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, default="PENDING", index=True)  # PENDING, PROCESSING, COMPLETED, FAILED - indexed
    total_records = Column(Integer, default=0)
    processed_records = Column(Integer, default=0)
    result_file_path = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), index=True)

class CloudSyncConfig(Base):
    __tablename__ = "cloud_sync_config"

    id = Column(Integer, primary_key=True, index=True)
    provider_type = Column(String, nullable=False) # SMB or SHAREPOINT
    config_json = Column(String, nullable=False) # Encrypted JSON ideally
    is_active = Column(Boolean, default=True)

class DocumentShare(Base):
    __tablename__ = "document_shares"

    id = Column(Integer, primary_key=True, index=True)
    generated_document_id = Column(Integer, ForeignKey("generated_documents.id"))
    token = Column(String, default=lambda: str(uuid.uuid4()), unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    is_active = Column(Boolean, default=True)


# ═══════════════════════════════════════════════════════════════════════════
# DOCUMENT APPROVAL WORKFLOW
# ═══════════════════════════════════════════════════════════════════════════

class DocumentApproval(Base):
    """
    Genehmigungsworkflow für Dokumente auf Dokumentenebene.

    State Machine:
    - DRAFT (Erstellt, noch nicht eingereicht)
    - PENDING_APPROVAL (Zur Genehmigung eingereicht)
    - APPROVED (Genehmigt)
    - CHANGES_REQUESTED (Änderungen angefordert – Dokument wird für Ersteller editierbar)
    - REJECTED (Abgelehnt)

    Ermöglicht:
    - Ein Nutzer reicht ein Dokument aus "Meine Dokumente" zur Genehmigung ein
    - Der Genehmiger erhält eine Notification
    - Bei Ablehnung/Änderungsanforderung wird das Dokument wieder editierbar
    - Unveränderliches Protokoll über AuditLog
    """
    __tablename__ = "document_approvals"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("generated_documents.id", ondelete="CASCADE"), nullable=False, index=True)

    # Status
    status = Column(String(30), default="pending_approval", nullable=False, index=True)
    # Erlaubte Werte: pending_approval, approved, changes_requested, rejected

    # Wer soll genehmigen?
    approver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # Wer hat eingereicht?
    requested_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    requested_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Entscheidung
    decided_at = Column(DateTime(timezone=True), nullable=True)
    decision_comment = Column(Text, nullable=True)

    # Priorität
    priority = Column(String(20), default="normal")  # low, normal, high, urgent

    # Frist
    due_date = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


# ═══════════════════════════════════════════════════════════════════════════
# NEW MODELS FROM GAP ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════

class Attachment(Base):
    """Static documents that can be appended to generated docs (GDPR forms, etc.)"""
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    country_code = Column(String(2), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(10), nullable=False)  # 'pdf' or 'docx'
    file_size_bytes = Column(Integer, nullable=True)
    page_count = Column(Integer, nullable=True)
    category = Column(String(100), nullable=True, index=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    uploaded_by = Column(String(255), nullable=True)


class DocumentTypeAttachment(Base):
    """Many-to-many: which attachments belong to which document types"""
    __tablename__ = "document_type_attachments"

    id = Column(Integer, primary_key=True, index=True)
    document_type_id = Column(Integer, ForeignKey("document_types.id", ondelete="CASCADE"), index=True)
    attachment_id = Column(Integer, ForeignKey("attachments.id", ondelete="CASCADE"), index=True)
    display_order = Column(Integer, nullable=False)
    is_mandatory = Column(Boolean, default=False)
    is_preselected = Column(Boolean, default=True)


class DocumentDraft(Base):
    """Auto-saved drafts for interrupted document creation"""
    __tablename__ = "document_drafts"

    id = Column(Integer, primary_key=True, index=True)
    country_code = Column(String(2), nullable=False, index=True)
    document_type_id = Column(Integer, ForeignKey("document_types.id"), index=True)
    user_id = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=True)
    form_data = Column(Text, nullable=False)  # JSON string
    custom_clauses = Column(Text, nullable=True)  # JSON for Individualvereinbarung
    version = Column(Integer, default=1, nullable=False)  # Optimistic locking
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class FormField(Base):
    """
    Dynamic form fields auto-generated from clause placeholders.

    HR can customize these fields without IT help:
    - Change labels and help text
    - Set validation rules (min, max, required)
    - Define default values
    - Group fields logically
    """
    __tablename__ = "form_fields"

    id = Column(Integer, primary_key=True, index=True)
    document_type_id = Column(Integer, ForeignKey("document_types.id", ondelete="CASCADE"), index=True)
    field_name = Column(String(100), nullable=False, index=True)  # Placeholder name (e.g., "gehalt_brutto")
    field_label = Column(String(255), nullable=False)  # Display label (e.g., "Bruttogehalt (jährlich)")
    field_type = Column(String(50), default="text")  # text, textarea, date, number, select, checkbox, email
    is_required = Column(Boolean, default=False)
    default_value = Column(Text, nullable=True)
    options = Column(Text, nullable=True)  # JSON for select options
    validation = Column(Text, nullable=True)  # JSON for validation rules
    display_order = Column(Integer, nullable=True)
    display_group = Column(String(100), nullable=True)
    source_clause_id = Column(Integer, ForeignKey("clauses.id"), nullable=True)

    # HR-friendly customization fields (NEW)
    help_text = Column(Text, nullable=True)  # Tooltip/description for the field
    placeholder_text = Column(String(255), nullable=True)  # Input placeholder (e.g., "z.B. 55000")
    suffix = Column(String(50), nullable=True)  # Unit suffix (e.g., "€", "Tage", "Stunden")
    prefix = Column(String(50), nullable=True)  # Unit prefix

    # Validation - expanded for HR
    min_value = Column(Integer, nullable=True)  # For numbers
    max_value = Column(Integer, nullable=True)  # For numbers
    min_length = Column(Integer, nullable=True)  # For text
    max_length = Column(Integer, nullable=True)  # For text
    pattern = Column(String(255), nullable=True)  # Regex pattern
    pattern_error_message = Column(String(255), nullable=True)  # Custom error message

    # Conditional visibility
    show_condition = Column(Text, nullable=True)  # JSON: when to show this field

    # Metadata
    is_system_field = Column(Boolean, default=False)  # True = auto-generated, can't delete
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class CustomClauseTemplate(Base):
    """Reusable templates for Individualvereinbarungen (custom clauses)"""
    __tablename__ = "custom_clause_templates"

    id = Column(Integer, primary_key=True, index=True)
    country_code = Column(String(2), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(100), nullable=True, index=True)
    usage_count = Column(Integer, default=0)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True, index=True)


class UserFavorite(Base):
    """
    User favorites for quick access to document types and documents.

    Supports two favorite types:
    - 'document_type': Frequently used document types (Arbeitsvertrag, etc.)
    - 'document': Specific generated documents for reference
    """
    __tablename__ = "user_favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    favorite_type = Column(String(50), nullable=False)  # 'document_type' or 'document'

    # One of these will be set based on favorite_type
    document_type_id = Column(Integer, ForeignKey("document_types.id", ondelete="CASCADE"), nullable=True)
    document_id = Column(Integer, ForeignKey("generated_documents.id", ondelete="CASCADE"), nullable=True)

    # Optional display name override
    display_name = Column(String(255), nullable=True)

    # Ordering for user's favorite list
    display_order = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ═══════════════════════════════════════════════════════════════════════════
# TEAM FEATURES
# ═══════════════════════════════════════════════════════════════════════════

class Team(Base):
    """
    Teams allow grouping users for shared access to documents and drafts.
    Each team belongs to a specific country/jurisdiction.
    """
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    country_code = Column(String(2), nullable=False, index=True)

    # Team settings
    is_active = Column(Boolean, default=True)
    allow_member_invites = Column(Boolean, default=False)  # Can members invite others?

    # Metadata
    created_by = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class TeamMember(Base):
    """
    Team membership with roles.
    Roles: 'owner', 'admin', 'member', 'viewer'
    """
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)

    # Role determines permissions
    role = Column(String(50), default="member")  # owner, admin, member, viewer

    # When member joined
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    # Invitation tracking (if invited by someone)
    invited_by = Column(String(255), nullable=True)


class TeamDocumentShare(Base):
    """
    Share documents with teams.
    Supports sharing both generated documents and drafts.
    """
    __tablename__ = "team_document_shares"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)

    # One of these will be set
    document_id = Column(Integer, ForeignKey("generated_documents.id", ondelete="CASCADE"), nullable=True)
    draft_id = Column(Integer, ForeignKey("document_drafts.id", ondelete="CASCADE"), nullable=True)

    # Permissions
    can_view = Column(Boolean, default=True)
    can_edit = Column(Boolean, default=False)  # Only for drafts
    can_download = Column(Boolean, default=True)

    # Metadata
    shared_by = Column(String(255), nullable=False)
    shared_at = Column(DateTime(timezone=True), server_default=func.now())
    note = Column(Text, nullable=True)  # Optional note for sharing


class TeamTemplateShare(Base):
    """
    Share document templates (DocumentTypes) between teams.

    Allows teams to discover and use templates created by other teams.
    Different from TeamDocumentShare which shares generated documents.
    """
    __tablename__ = "team_template_shares"

    id = Column(Integer, primary_key=True, index=True)

    # Source: which template is being shared
    document_type_id = Column(Integer, ForeignKey("document_types.id", ondelete="CASCADE"), nullable=False, index=True)

    # Target: which team can use this template
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)

    # Permissions
    can_use = Column(Boolean, default=True)  # Can create documents from this template
    can_duplicate = Column(Boolean, default=False)  # Can copy/customize this template

    # Metadata
    shared_by = Column(String(255), nullable=False)
    shared_at = Column(DateTime(timezone=True), server_default=func.now())
    note = Column(Text, nullable=True)


# ═══════════════════════════════════════════════════════════════════════════
# DOCUMENT VERSIONING & CORRECTION (15.5.2)
# ═══════════════════════════════════════════════════════════════════════════

class DocumentVersion(Base):
    """
    Version history for generated documents.

    Enables document correction workflow:
    1. User creates document (version 1)
    2. User requests correction
    3. System creates new version, preserves old
    4. Full audit trail maintained
    """
    __tablename__ = "document_versions"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("generated_documents.id", ondelete="CASCADE"), nullable=False, index=True)

    # Version info
    version_number = Column(Integer, nullable=False)
    file_path = Column(String(500), nullable=False)

    # What was stored for this version
    form_data_snapshot = Column(Text, nullable=False)  # JSON: all form values at time of generation
    selected_clauses_snapshot = Column(Text, nullable=True)  # JSON: clause IDs selected
    custom_clauses_snapshot = Column(Text, nullable=True)  # JSON: Individualvereinbarungen

    # Change tracking
    change_reason = Column(Text, nullable=True)  # Why was this version created?
    changed_fields = Column(Text, nullable=True)  # JSON: list of fields that changed

    # Metadata
    created_by = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Is this the current active version?
    is_current = Column(Boolean, default=True)


class DocumentCorrectionRequest(Base):
    """
    Tracks correction requests for documents.

    Workflow:
    1. User requests correction for a document
    2. System loads previous form data
    3. User edits values
    4. New version generated
    5. Request marked completed
    """
    __tablename__ = "document_correction_requests"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("generated_documents.id", ondelete="CASCADE"), nullable=False, index=True)

    # Status tracking
    status = Column(String(50), default="pending", index=True)  # pending, in_progress, completed, cancelled

    # What to correct
    requested_changes = Column(Text, nullable=True)  # JSON: description of requested changes

    # Who requested
    requested_by = Column(String(255), nullable=False)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())

    # Completion
    completed_by = Column(String(255), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    result_version_id = Column(Integer, ForeignKey("document_versions.id"), nullable=True)


# ═══════════════════════════════════════════════════════════════════════════
# AUDIT LOG (15.5.5)
# ═══════════════════════════════════════════════════════════════════════════

class AuditLog(Base):
    """
    Comprehensive audit log for all HR actions.

    Tracks:
    - Document creation, correction, deletion
    - Clause modifications
    - Form field changes
    - Template updates
    - User access and permissions
    - Bulk operations

    Immutable: Once created, audit entries cannot be modified or deleted.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    # When
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Who
    user_id = Column(String(255), nullable=False, index=True)
    user_email = Column(String(255), nullable=True)
    user_name = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)  # IPv6 support

    # What
    action = Column(String(100), nullable=False, index=True)  # e.g., 'document.create', 'clause.update'
    action_category = Column(String(50), nullable=False, index=True)  # 'document', 'clause', 'form_field', 'user', 'bulk', 'system'

    # Target entity
    entity_type = Column(String(50), nullable=True)  # 'document', 'clause', 'document_type', etc.
    entity_id = Column(Integer, nullable=True, index=True)
    entity_name = Column(String(255), nullable=True)  # Human-readable name at time of action

    # Details
    description = Column(Text, nullable=True)  # Human-readable description
    old_value = Column(Text, nullable=True)  # JSON: previous state (for updates)
    new_value = Column(Text, nullable=True)  # JSON: new state (for creates/updates)
    extra_metadata = Column(Text, nullable=True)  # JSON: additional context

    # Context
    country_code = Column(String(2), nullable=True, index=True)
    document_type_id = Column(Integer, nullable=True)
    session_id = Column(String(100), nullable=True)  # For correlating related actions

    # Result
    status = Column(String(20), default="success")  # 'success', 'failure', 'partial'
    error_message = Column(Text, nullable=True)


class AuditLogRetention(Base):
    """
    Configuration for audit log retention per category.
    Complies with GDPR and legal requirements.
    """
    __tablename__ = "audit_log_retention"

    id = Column(Integer, primary_key=True, index=True)
    action_category = Column(String(50), unique=True, nullable=False)
    retention_days = Column(Integer, nullable=False, default=365 * 7)  # 7 years default
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)


# ═══════════════════════════════════════════════════════════════════════════
# NOTIFICATIONS (15.5.6)
# ═══════════════════════════════════════════════════════════════════════════

class Notification(Base):
    """
    User notifications for document actions.

    Notification types:
    - document_created: New document was generated
    - document_corrected: Document was corrected
    - document_shared: Document was shared with user/team
    - draft_reminder: Reminder about unfinished draft
    - bulk_completed: Bulk generation completed
    - approval_required: Document needs approval
    - retention_warning: Document approaching retention date
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)

    # Notification type and content
    notification_type = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    priority = Column(String(20), default="normal")  # low, normal, high, urgent

    # Related entity (optional)
    entity_type = Column(String(50), nullable=True)  # document, draft, bulk_job, etc.
    entity_id = Column(Integer, nullable=True)
    action_url = Column(String(500), nullable=True)  # Link to view/act on the notification

    # Status tracking
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    is_dismissed = Column(Boolean, default=False)

    # Metadata
    extra_data = Column(Text, nullable=True)  # JSON for additional data
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Auto-dismiss after this time


class NotificationPreference(Base):
    """
    User preferences for notification delivery.

    Controls what notifications users want to receive and how.
    """
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)

    # Notification type settings
    notification_type = Column(String(50), nullable=False)

    # Delivery channels
    in_app_enabled = Column(Boolean, default=True)
    email_enabled = Column(Boolean, default=False)
    email_digest = Column(String(20), nullable=True)  # immediate, daily, weekly

    # Schedule
    quiet_hours_start = Column(String(5), nullable=True)  # "22:00"
    quiet_hours_end = Column(String(5), nullable=True)  # "08:00"

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ═══════════════════════════════════════════════════════════════════════════
# SEARCH HISTORY
# ═══════════════════════════════════════════════════════════════════════════

class SearchHistory(Base):
    """
    User search history for recent searches feature.

    Stores the last 20 searches per user.
    """
    __tablename__ = "search_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    query = Column(String(255), nullable=False)
    result_count = Column(Integer, default=0)
    country_code = Column(String(2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


# ═══════════════════════════════════════════════════════════════════════════
# DEADLINES (HR-Fristen Management)
# ═══════════════════════════════════════════════════════════════════════════

class Deadline(Base):
    """
    HR-Fristen für Probezeit, Befristung, Kündigungsfristen etc.

    Wird automatisch aus Dokumentdaten erstellt oder manuell angelegt.
    """
    __tablename__ = "deadlines"

    id = Column(Integer, primary_key=True, index=True)
    country_code = Column(String(2), nullable=False, index=True)

    # Frist-Details
    deadline_type = Column(String(50), nullable=False, index=True)  # probezeit_ende, befristung_ende, kuendigung_frist
    deadline_date = Column(DateTime(timezone=True), nullable=False, index=True)
    deadline_label = Column(String(255), nullable=True)

    # Mitarbeiter-Referenz
    employee_name = Column(String(255), nullable=False, index=True)
    employee_id = Column(String(100), nullable=True, index=True)  # Personalnummer

    # Status
    status = Column(String(50), default="pending", index=True)  # pending, completed, cancelled
    notes = Column(Text, nullable=True)

    # Verknüpfung zum Dokument (optional)
    document_id = Column(Integer, ForeignKey("generated_documents.id", ondelete="SET NULL"), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    completed_by = Column(String(255), nullable=True)


# ═══════════════════════════════════════════════════════════════════════════
# WEBHOOK SUBSCRIPTIONS (für Copilot Studio / Power Automate Integration)
# ═══════════════════════════════════════════════════════════════════════════

class WebhookSubscription(Base):
    """
    Webhook-Subscriptions für Event-Benachrichtigungen.

    Ermöglicht Integration mit:
    - Microsoft Power Automate
    - Microsoft Copilot Studio
    - Zapier / Make
    - Custom Systeme
    """
    __tablename__ = "webhook_subscriptions"

    id = Column(Integer, primary_key=True, index=True)

    # Webhook-Konfiguration
    url = Column(String(1000), nullable=False)
    events = Column(Text, nullable=False)  # JSON Array von Event-Namen
    secret = Column(String(255), nullable=True)  # HMAC Secret für Signatur
    description = Column(String(500), nullable=True)

    # Status
    is_active = Column(Boolean, default=True, index=True)

    # Statistik
    trigger_count = Column(Integer, default=0)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(255), nullable=True)


# ═══════════════════════════════════════════════════════════════════════════
# COPILOT STUDIO INTEGRATION SETTINGS
# ═══════════════════════════════════════════════════════════════════════════

class CopilotStudioConfig(Base):
    """
    Konfiguration für Microsoft Copilot Studio Integration.

    Speichert Connection-Details und Berechtigungen.
    """
    __tablename__ = "copilot_studio_config"

    id = Column(Integer, primary_key=True, index=True)

    # Verbindung
    is_enabled = Column(Boolean, default=False)
    tenant_id = Column(String(100), nullable=True)  # Azure AD Tenant
    client_id = Column(String(100), nullable=True)  # App Registration Client ID
    bot_id = Column(String(100), nullable=True)  # Copilot Studio Bot ID

    # API-Schlüssel (für eingehende Requests vom Bot)
    api_key = Column(String(255), nullable=True)
    api_key_created_at = Column(DateTime(timezone=True), nullable=True)

    # Berechtigungen
    allow_document_creation = Column(Boolean, default=True)
    allow_document_search = Column(Boolean, default=True)
    allow_deadline_access = Column(Boolean, default=True)
    allowed_document_types = Column(Text, nullable=True)  # JSON Array oder NULL für alle

    # Statistik
    last_request_at = Column(DateTime(timezone=True), nullable=True)
    request_count = Column(Integer, default=0)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

