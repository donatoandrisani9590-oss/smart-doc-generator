"""
Guest Review Links API (Phase 3.7)

Sichere Gast-Links für externes Dokument-Review.

Ermöglicht Empfängern (z.B. zukünftige Mitarbeiter, Anwälte) das
Kommentieren/Vorschlagen von Änderungen ohne Account.

Endpoints:
  Authenticated (require JWT):
    POST   /documents/{document_id}/guest-links          — Link erstellen
    GET    /documents/{document_id}/guest-links          — Links auflisten
    PATCH  /documents/{document_id}/guest-links/{link_id} — Link (de)aktivieren
    GET    /documents/{document_id}/guest-comments       — Alle Kommentare
    PATCH  /documents/{document_id}/guest-comments/{comment_id} — Kommentar bewerten

  Public (no authentication):
    GET    /guest-review/{token}              — Dokument-Vorschau laden
    POST   /guest-review/{token}/comments     — Kommentar abgeben
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.models.core import User
from app.models.enterprise import (
    GeneratedDocument,
    GuestReviewLink,
    GuestReviewComment,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════

VALID_PERMISSIONS = {"view_only", "comment_only", "suggest_changes"}
VALID_COMMENT_TYPES = {"comment", "suggestion", "approval"}
VALID_RESOLUTION_STATUSES = {"accepted", "rejected", "noted"}

# Permissions that allow submitting comments
COMMENT_ALLOWED_PERMISSIONS = {"comment_only", "suggest_changes"}

# Permissions that allow submitting suggestions (with suggested_replacement)
SUGGESTION_ALLOWED_PERMISSIONS = {"suggest_changes"}

MAX_EXPIRES_DAYS = 90
MIN_EXPIRES_DAYS = 1
DEFAULT_EXPIRES_DAYS = 14


# ═══════════════════════════════════════════════════════════════════════════
# REQUEST / RESPONSE SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class GuestLinkCreateRequest(BaseModel):
    """Neuen Gast-Review-Link erstellen."""
    recipient_name: str = Field(
        ..., min_length=1, max_length=255,
        description="Name des Empfängers"
    )
    recipient_email: Optional[str] = Field(
        None, max_length=255,
        description="E-Mail des Empfängers (optional)"
    )
    permissions: str = Field(
        "comment_only",
        description="Berechtigungsstufe: view_only, comment_only, suggest_changes"
    )
    expires_days: int = Field(
        DEFAULT_EXPIRES_DAYS, ge=MIN_EXPIRES_DAYS, le=MAX_EXPIRES_DAYS,
        description=f"Gültigkeitsdauer in Tagen ({MIN_EXPIRES_DAYS}-{MAX_EXPIRES_DAYS})"
    )

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, v: str) -> str:
        if v not in VALID_PERMISSIONS:
            raise ValueError(
                f"Ungültige Berechtigung: '{v}'. "
                f"Erlaubt: {', '.join(sorted(VALID_PERMISSIONS))}"
            )
        return v


class GuestLinkUpdateRequest(BaseModel):
    """Gast-Review-Link (de)aktivieren."""
    is_active: bool


class GuestCommentResolutionRequest(BaseModel):
    """Kommentar akzeptieren/ablehnen/vermerken."""
    status: str = Field(
        ..., description="accepted, rejected, noted"
    )

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_RESOLUTION_STATUSES:
            raise ValueError(
                f"Ungültiger Status: '{v}'. "
                f"Erlaubt: {', '.join(sorted(VALID_RESOLUTION_STATUSES))}"
            )
        return v


class GuestLinkResponse(BaseModel):
    id: int
    document_id: int
    token: str
    recipient_name: str
    recipient_email: Optional[str] = None
    permissions: str
    expires_at: datetime
    is_active: bool
    created_by_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    review_url: Optional[str] = None
    comment_count: int = 0

    class Config:
        from_attributes = True


class GuestCommentResponse(BaseModel):
    id: int
    link_id: int
    guest_name: str
    comment_type: str
    target_clause_id: Optional[int] = None
    target_text: Optional[str] = None
    content: str
    suggested_replacement: Optional[str] = None
    status: str
    resolved_by_id: Optional[int] = None
    resolved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    # Enriched from the link
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None

    class Config:
        from_attributes = True


class GuestDocumentPreviewResponse(BaseModel):
    """Öffentliche Dokument-Vorschau für Gast-Reviewer."""
    document_title: Optional[str] = None
    content_html: Optional[str] = None
    permissions: str
    recipient_name: str
    expires_at: datetime


class GuestCommentCreateRequest(BaseModel):
    """Kommentar eines Gastes."""
    guest_name: str = Field(
        ..., min_length=1, max_length=255,
        description="Name des Gastes"
    )
    comment_type: str = Field(
        "comment",
        description="comment, suggestion, approval"
    )
    target_text: Optional[str] = Field(
        None, max_length=5000,
        description="Markierter Textabschnitt im Dokument"
    )
    content: str = Field(
        ..., min_length=1, max_length=10000,
        description="Kommentarinhalt"
    )
    suggested_replacement: Optional[str] = Field(
        None, max_length=10000,
        description="Vorgeschlagener Ersatztext (nur bei suggestion)"
    )
    target_clause_id: Optional[int] = Field(
        None, description="ID der Zielklausel (optional)"
    )

    @field_validator("comment_type")
    @classmethod
    def validate_comment_type(cls, v: str) -> str:
        if v not in VALID_COMMENT_TYPES:
            raise ValueError(
                f"Ungültiger Kommentartyp: '{v}'. "
                f"Erlaubt: {', '.join(sorted(VALID_COMMENT_TYPES))}"
            )
        return v


class GuestCommentCreatedResponse(BaseModel):
    id: int
    link_id: int
    guest_name: str
    comment_type: str
    target_clause_id: Optional[int] = None
    target_text: Optional[str] = None
    content: str
    suggested_replacement: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════

async def _get_document_or_404(
    db: AsyncSession,
    document_id: int,
    current_user: User,
) -> GeneratedDocument:
    """Fetch document and verify the requesting user is the creator."""
    stmt = select(GeneratedDocument).where(
        GeneratedDocument.id == document_id,
        GeneratedDocument.is_deleted == False,  # noqa: E712
    )
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()

    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dokument nicht gefunden.",
        )

    # Only the document creator or an admin may manage guest links
    if doc.created_by_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Keine Berechtigung für dieses Dokument.",
        )

    return doc


async def _get_active_link_or_fail(
    db: AsyncSession, token: str
) -> GuestReviewLink:
    """
    Validate a guest review token: exists, is active, and not expired.
    Returns the link or raises an appropriate HTTPException.
    """
    stmt = select(GuestReviewLink).where(GuestReviewLink.token == token)
    result = await db.execute(stmt)
    link = result.scalar_one_or_none()

    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review-Link nicht gefunden.",
        )

    if not link.is_active:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Dieser Review-Link wurde deaktiviert.",
        )

    if link.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Dieser Review-Link ist abgelaufen.",
        )

    return link


def _build_review_url(token: str) -> str:
    """Build the frontend URL for a guest review link."""
    # Use the known production frontend URL.
    # In the future this could come from a settings/env variable.
    return f"https://smart-doc-generator.vercel.app/guest-review/{token}"


# ═══════════════════════════════════════════════════════════════════════════
# AUTHENTICATED ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post(
    "/documents/{document_id}/guest-links",
    response_model=GuestLinkResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Gast-Review-Link erstellen",
)
async def create_guest_link(
    document_id: int,
    body: GuestLinkCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Erstellt einen neuen Gast-Review-Link für ein Dokument.

    Der Link enthält einen sicheren Token, mit dem der Empfänger ohne Login
    auf eine Vorschau des Dokuments zugreifen und je nach Berechtigungsstufe
    Kommentare oder Änderungsvorschläge einreichen kann.
    """
    doc = await _get_document_or_404(db, document_id, current_user)

    token = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_days)

    link = GuestReviewLink(
        document_id=doc.id,
        token=token,
        recipient_name=body.recipient_name,
        recipient_email=body.recipient_email,
        permissions=body.permissions,
        expires_at=expires_at,
        is_active=True,
        created_by_id=current_user.id,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)

    logger.info(
        "Gast-Review-Link erstellt: document_id=%s, recipient=%s, permissions=%s, "
        "expires_at=%s, created_by=%s",
        doc.id, body.recipient_name, body.permissions,
        expires_at.isoformat(), current_user.id,
    )

    return GuestLinkResponse(
        id=link.id,
        document_id=link.document_id,
        token=link.token,
        recipient_name=link.recipient_name,
        recipient_email=link.recipient_email,
        permissions=link.permissions,
        expires_at=link.expires_at,
        is_active=link.is_active,
        created_by_id=link.created_by_id,
        created_at=link.created_at,
        updated_at=link.updated_at,
        review_url=_build_review_url(link.token),
        comment_count=0,
    )


@router.get(
    "/documents/{document_id}/guest-links",
    response_model=List[GuestLinkResponse],
    summary="Gast-Review-Links auflisten",
)
async def list_guest_links(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Listet alle Gast-Review-Links für ein Dokument auf,
    inklusive der Anzahl eingegangener Kommentare pro Link.
    """
    await _get_document_or_404(db, document_id, current_user)

    # Subquery: comment count per link
    comment_count_sq = (
        select(
            GuestReviewComment.link_id,
            func.count(GuestReviewComment.id).label("comment_count"),
        )
        .group_by(GuestReviewComment.link_id)
        .subquery()
    )

    stmt = (
        select(GuestReviewLink, comment_count_sq.c.comment_count)
        .outerjoin(
            comment_count_sq,
            GuestReviewLink.id == comment_count_sq.c.link_id,
        )
        .where(GuestReviewLink.document_id == document_id)
        .order_by(GuestReviewLink.created_at.desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        GuestLinkResponse(
            id=link.id,
            document_id=link.document_id,
            token=link.token,
            recipient_name=link.recipient_name,
            recipient_email=link.recipient_email,
            permissions=link.permissions,
            expires_at=link.expires_at,
            is_active=link.is_active,
            created_by_id=link.created_by_id,
            created_at=link.created_at,
            updated_at=link.updated_at,
            review_url=_build_review_url(link.token),
            comment_count=count or 0,
        )
        for link, count in rows
    ]


@router.patch(
    "/documents/{document_id}/guest-links/{link_id}",
    response_model=GuestLinkResponse,
    summary="Gast-Review-Link (de)aktivieren",
)
async def update_guest_link(
    document_id: int,
    link_id: int,
    body: GuestLinkUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aktiviert oder deaktiviert einen bestehenden Gast-Review-Link.

    Deaktivierte Links können nicht mehr zum Zugriff auf das Dokument
    verwendet werden. Sie können jedoch wieder aktiviert werden.
    """
    await _get_document_or_404(db, document_id, current_user)

    stmt = select(GuestReviewLink).where(
        GuestReviewLink.id == link_id,
        GuestReviewLink.document_id == document_id,
    )
    result = await db.execute(stmt)
    link = result.scalar_one_or_none()

    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review-Link nicht gefunden.",
        )

    link.is_active = body.is_active
    await db.commit()
    await db.refresh(link)

    action = "aktiviert" if body.is_active else "deaktiviert"
    logger.info(
        "Gast-Review-Link %s: link_id=%s, document_id=%s, by user=%s",
        action, link_id, document_id, current_user.id,
    )

    # Fetch current comment count for the response
    count_stmt = (
        select(func.count(GuestReviewComment.id))
        .where(GuestReviewComment.link_id == link.id)
    )
    count_result = await db.execute(count_stmt)
    comment_count = count_result.scalar() or 0

    return GuestLinkResponse(
        id=link.id,
        document_id=link.document_id,
        token=link.token,
        recipient_name=link.recipient_name,
        recipient_email=link.recipient_email,
        permissions=link.permissions,
        expires_at=link.expires_at,
        is_active=link.is_active,
        created_by_id=link.created_by_id,
        created_at=link.created_at,
        updated_at=link.updated_at,
        review_url=_build_review_url(link.token),
        comment_count=comment_count,
    )


@router.get(
    "/documents/{document_id}/guest-comments",
    response_model=List[GuestCommentResponse],
    summary="Alle Gast-Kommentare eines Dokuments",
)
async def list_guest_comments(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Gibt alle Gast-Kommentare für ein Dokument zurück,
    aggregiert über alle zugehörigen Review-Links.

    Enthält Informationen über den jeweiligen Empfänger (aus dem Link).
    """
    await _get_document_or_404(db, document_id, current_user)

    stmt = (
        select(GuestReviewComment, GuestReviewLink)
        .join(
            GuestReviewLink,
            GuestReviewComment.link_id == GuestReviewLink.id,
        )
        .where(GuestReviewLink.document_id == document_id)
        .order_by(GuestReviewComment.created_at.desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        GuestCommentResponse(
            id=comment.id,
            link_id=comment.link_id,
            guest_name=comment.guest_name,
            comment_type=comment.comment_type,
            target_clause_id=comment.target_clause_id,
            target_text=comment.target_text,
            content=comment.content,
            suggested_replacement=comment.suggested_replacement,
            status=comment.status,
            resolved_by_id=comment.resolved_by_id,
            resolved_at=comment.resolved_at,
            created_at=comment.created_at,
            recipient_name=link.recipient_name,
            recipient_email=link.recipient_email,
        )
        for comment, link in rows
    ]


@router.patch(
    "/documents/{document_id}/guest-comments/{comment_id}",
    response_model=GuestCommentResponse,
    summary="Gast-Kommentar akzeptieren/ablehnen",
)
async def resolve_guest_comment(
    document_id: int,
    comment_id: int,
    body: GuestCommentResolutionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Setzt den Status eines Gast-Kommentars (accepted / rejected / noted).

    Nur der Dokumentenersteller oder ein Admin kann Kommentare bewerten.
    """
    await _get_document_or_404(db, document_id, current_user)

    # Verify the comment belongs to a link for this document
    stmt = (
        select(GuestReviewComment, GuestReviewLink)
        .join(
            GuestReviewLink,
            GuestReviewComment.link_id == GuestReviewLink.id,
        )
        .where(
            GuestReviewComment.id == comment_id,
            GuestReviewLink.document_id == document_id,
        )
    )
    result = await db.execute(stmt)
    row = result.first()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kommentar nicht gefunden.",
        )

    comment, link = row

    comment.status = body.status
    comment.resolved_by_id = current_user.id
    comment.resolved_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(comment)

    logger.info(
        "Gast-Kommentar bewertet: comment_id=%s, status=%s, by user=%s",
        comment_id, body.status, current_user.id,
    )

    return GuestCommentResponse(
        id=comment.id,
        link_id=comment.link_id,
        guest_name=comment.guest_name,
        comment_type=comment.comment_type,
        target_clause_id=comment.target_clause_id,
        target_text=comment.target_text,
        content=comment.content,
        suggested_replacement=comment.suggested_replacement,
        status=comment.status,
        resolved_by_id=comment.resolved_by_id,
        resolved_at=comment.resolved_at,
        created_at=comment.created_at,
        recipient_name=link.recipient_name,
        recipient_email=link.recipient_email,
    )


# ═══════════════════════════════════════════════════════════════════════════
# PUBLIC ENDPOINTS (no authentication required)
# ═══════════════════════════════════════════════════════════════════════════

@router.get(
    "/guest-review/{token}",
    response_model=GuestDocumentPreviewResponse,
    summary="Dokument-Vorschau für Gast-Reviewer",
)
async def get_guest_review(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Öffentlicher Endpoint: Lädt die Dokument-Vorschau für einen Gast-Reviewer.

    Validiert den Token auf Gültigkeit, Aktivität und Ablaufdatum.
    Gibt den Dokumentinhalt zusammen mit den erlaubten Berechtigungen zurück.
    """
    link = await _get_active_link_or_fail(db, token)

    # Fetch the associated document
    stmt = select(GeneratedDocument).where(
        GeneratedDocument.id == link.document_id,
        GeneratedDocument.is_deleted == False,  # noqa: E712
    )
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()

    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Das verknüpfte Dokument wurde nicht gefunden.",
        )

    logger.info(
        "Gast-Review aufgerufen: token=%s..., document_id=%s, recipient=%s",
        token[:12], doc.id, link.recipient_name,
    )

    return GuestDocumentPreviewResponse(
        document_title=doc.title,
        content_html=doc.content_html,
        permissions=link.permissions,
        recipient_name=link.recipient_name,
        expires_at=link.expires_at,
    )


@router.post(
    "/guest-review/{token}/comments",
    response_model=GuestCommentCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Gast-Kommentar einreichen",
)
async def create_guest_comment(
    token: str,
    body: GuestCommentCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Öffentlicher Endpoint: Ein Gast-Reviewer reicht einen Kommentar ein.

    Validiert:
    - Token ist aktiv und nicht abgelaufen
    - Die Berechtigungsstufe des Links erlaubt den gewünschten Kommentartyp
    - view_only: Keine Kommentare erlaubt
    - comment_only: Nur comment und approval
    - suggest_changes: Alle Typen inklusive suggestion
    """
    link = await _get_active_link_or_fail(db, token)

    # ── Permission checks ─────────────────────────────────────────────────

    if link.permissions == "view_only":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dieser Review-Link erlaubt nur das Ansehen, keine Kommentare.",
        )

    if link.permissions not in COMMENT_ALLOWED_PERMISSIONS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Keine Berechtigung zum Kommentieren.",
        )

    # Suggestions require suggest_changes permission
    if body.comment_type == "suggestion" and link.permissions not in SUGGESTION_ALLOWED_PERMISSIONS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Änderungsvorschläge sind mit der Berechtigungsstufe "
                f"'{link.permissions}' nicht erlaubt. "
                "Benötigt: suggest_changes."
            ),
        )

    # Validate: suggestions should include a suggested_replacement
    if body.comment_type == "suggestion" and not body.suggested_replacement:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Änderungsvorschläge müssen einen Ersatztext enthalten.",
        )

    # ── Create the comment ────────────────────────────────────────────────

    comment = GuestReviewComment(
        link_id=link.id,
        guest_name=body.guest_name,
        comment_type=body.comment_type,
        target_clause_id=body.target_clause_id,
        target_text=body.target_text,
        content=body.content,
        suggested_replacement=body.suggested_replacement,
        status="pending",
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    logger.info(
        "Gast-Kommentar erstellt: comment_id=%s, link_id=%s, type=%s, guest=%s",
        comment.id, link.id, body.comment_type, body.guest_name,
    )

    return GuestCommentCreatedResponse(
        id=comment.id,
        link_id=comment.link_id,
        guest_name=comment.guest_name,
        comment_type=comment.comment_type,
        target_clause_id=comment.target_clause_id,
        target_text=comment.target_text,
        content=comment.content,
        suggested_replacement=comment.suggested_replacement,
        status=comment.status,
        created_at=comment.created_at,
    )
