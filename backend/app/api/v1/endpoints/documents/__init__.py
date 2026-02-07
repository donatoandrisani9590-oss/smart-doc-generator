# Document endpoints
from app.api.v1.endpoints.documents import (
    generation,
    preview,
    history,
    drafts,
    corrections,
    export,
    repository,
    document_upload,
    approvals,
)

__all__ = [
    "generation",
    "preview",
    "history",
    "drafts",
    "corrections",
    "export",
    "repository",
    "document_upload",
    "approvals",
]
