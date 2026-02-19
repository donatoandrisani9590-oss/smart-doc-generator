# Admin feature endpoints
from app.api.v1.endpoints.admin import (
    company_settings,
    logo,
    templates,
    attachments,
    audit,
    works_council,
    bulk,
    word_import,
    document_type_import,
    feature_settings,
    llm_usage,
    legal_audit,
)

__all__ = [
    "company_settings",
    "logo",
    "templates",
    "attachments",
    "audit",
    "works_council",
    "bulk",
    "word_import",
    "document_type_import",
    "feature_settings",
    "llm_usage",
    "legal_audit",
]
