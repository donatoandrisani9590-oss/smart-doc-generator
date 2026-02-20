# Models Export
from app.models.core import User, DesignSetting, UserSession
from app.models.documents import (
    DocumentType,
    Clause,
    DocumentTypeClause,
    ClauseVariantGroup,
    ClauseVariant,
    ClauseVersion,
    ClauseNote,
    CompanySettings,
    DocumentDeadline,
    DeadlineFieldMapping,
    WorksCouncilTemplate,
    WorksCouncilNotification,
    ClauseApprovalStatus,
)
from app.models.enterprise import (
    GeneratedDocument,
    RetentionPolicy,
    BulkJob,
    CloudSyncConfig,
    DocumentShare,
    Attachment,
    DocumentTypeAttachment,
    DocumentDraft,
    FormField,
    CustomClauseTemplate,
    UserFavorite,
    Team,
    TeamMember,
    TeamDocumentShare,
    TeamTemplateShare,
    DocumentVersion,
    DocumentCorrectionRequest,
    AuditLog,
    AuditLogRetention,
    Notification,
    NotificationPreference,
    SearchHistory,
    LLMCallLog,
    TeamPattern,
    OnboardingJob,
    DocumentAction,
    GuestReviewLink,
    GuestReviewComment,
    EmailIngest,
)
from app.models.composer import (
    DocumentClauseInstance,
    ClauseOrigin,
)
from app.models.user_settings import (
    UserFeatureSettings,
    FEATURE_DEFINITIONS,
    FEATURE_CATEGORIES,
)
from app.models.collaboration import (
    Comment,
    CommentMention,
    ActivityEvent,
    CommentReaction,
)
from app.models.user_templates import UserTemplate
from app.models.legal_audit import ClauseAuditResult
from app.models.approval_groups import ApprovalGroup, ApprovalGroupMember

__all__ = [
    # Core
    "User",
    "DesignSetting",
    "UserSession",
    # Documents
    "DocumentType",
    "Clause",
    "DocumentTypeClause",
    "ClauseVariantGroup",
    "ClauseVariant",
    "ClauseVersion",
    "ClauseNote",
    "CompanySettings",
    "DocumentDeadline",
    "DeadlineFieldMapping",
    "WorksCouncilTemplate",
    "WorksCouncilNotification",
    "ClauseApprovalStatus",
    # Enterprise
    "GeneratedDocument",
    "RetentionPolicy",
    "BulkJob",
    "CloudSyncConfig",
    "DocumentShare",
    "Attachment",
    "DocumentTypeAttachment",
    "DocumentDraft",
    "FormField",
    "CustomClauseTemplate",
    "UserFavorite",
    "Team",
    "TeamMember",
    "TeamDocumentShare",
    "TeamTemplateShare",
    "DocumentVersion",
    "DocumentCorrectionRequest",
    "AuditLog",
    "AuditLogRetention",
    "Notification",
    "NotificationPreference",
    "SearchHistory",
    "LLMCallLog",
    "TeamPattern",
    "OnboardingJob",
    "DocumentAction",
    "GuestReviewLink",
    "GuestReviewComment",
    "EmailIngest",
    # Composer (Smart UX)
    "DocumentClauseInstance",
    "ClauseOrigin",
    # User Settings
    "UserFeatureSettings",
    "FEATURE_DEFINITIONS",
    "FEATURE_CATEGORIES",
    # Collaboration (Phase 2)
    "Comment",
    "CommentMention",
    "ActivityEvent",
    "CommentReaction",
    # User Templates
    "UserTemplate",
    # Legal Audit (Phase 6)
    "ClauseAuditResult",
    # Approval Groups
    "ApprovalGroup",
    "ApprovalGroupMember",
]
