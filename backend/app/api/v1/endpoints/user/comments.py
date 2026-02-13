"""
Comments API - Phase 2: Async Collaboration

Ermöglicht:
- CRUD für Kommentare an Dokumenten/Textbausteine/Entwürfen
- Thread-basierte Antworten
- @Mentions mit Notification-Trigger
- Resolve/Unresolve Threads
- Activity Feed

Ähnlich wie Google Docs / fynk.com Kommentarsystem.

v2.3 Security Fixes (Release Audit):
- SEC-001: Anchor existence validation
- SEC-002: IDOR protection via user_id check
- SEC-003: Resolve/Reopen authorization
- PERF-001: N+1 query optimization with eager loading
- SEC-004: Wildcard escaping in mention search
"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, update, delete
from sqlalchemy.orm import selectinload, joinedload
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import re
import json

from app.db import get_db
from app.models.collaboration import Comment, CommentMention, ActivityEvent
from app.models.enterprise import Notification, DocumentDraft, GeneratedDocument
from app.models.documents import Clause
from app.models.core import User
from app.api.deps import get_current_user

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class CommentAuthor(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class CommentMentionResponse(BaseModel):
    id: int
    mentioned_user_id: int
    mentioned_user_email: Optional[str] = None
    mentioned_user_name: Optional[str] = None
    seen_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SelectionRange(BaseModel):
    """Textauswahl für kontextbezogene Kommentare."""
    start: int
    end: int
    text: Optional[str] = None


class CommentResponse(BaseModel):
    id: int
    anchor_type: str
    anchor_id: int
    block_id: Optional[str] = None
    selection_range: Optional[SelectionRange] = None
    parent_id: Optional[int] = None
    content: str
    content_html: Optional[str] = None
    is_resolved: bool
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    author: Optional[CommentAuthor] = None
    mentions: List[CommentMentionResponse] = []
    reply_count: int = 0

    class Config:
        from_attributes = True


class CommentThreadResponse(BaseModel):
    """Ein Kommentar mit allen Antworten"""
    root: CommentResponse
    replies: List[CommentResponse] = []
    total_replies: int = 0


class CommentListResponse(BaseModel):
    comments: List[CommentThreadResponse]
    total: int
    unresolved_count: int


class CreateCommentRequest(BaseModel):
    anchor_type: str = Field(..., description="document, draft, clause_instance, clause")
    anchor_id: int
    block_id: Optional[str] = Field(None, description="Block/Absatz-ID für kontextbezogene Kommentare (z.B. 'clause_3', 'paragraph_5')")
    selection_range: Optional[SelectionRange] = Field(None, description="Textauswahl für Inline-Kommentare")
    parent_id: Optional[int] = Field(None, description="ID des Parent-Kommentars für Antworten")
    content: str = Field(..., min_length=1, max_length=10000)


class UpdateCommentRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)


class ResolveCommentRequest(BaseModel):
    is_resolved: bool


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

# Regex für @mentions: @username oder @[Full Name]
MENTION_PATTERN = re.compile(r'@(\w+(?:\.\w+)?)|@\[([^\]]+)\]')


def escape_like_wildcards(value: str) -> str:
    """
    SEC-004 Fix: Escape SQL LIKE wildcards to prevent DoS via expensive queries.
    """
    return value.replace('%', r'\%').replace('_', r'\_')


def parse_selection_range(raw: Optional[str]) -> Optional[SelectionRange]:
    """Parse selection_range JSON string from DB to SelectionRange model."""
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return SelectionRange(**data)
    except (json.JSONDecodeError, TypeError, KeyError):
        return None


async def validate_anchor_access(
    anchor_type: str,
    anchor_id: int,
    current_user: User,
    db: AsyncSession,
    require_write: bool = False
) -> bool:
    """
    SEC-001 + SEC-002 Fix: Validate anchor exists AND user has access.

    Returns True if valid, raises HTTPException otherwise.
    """
    if anchor_type == "draft":
        # Check draft exists and user owns it
        query = select(DocumentDraft).where(DocumentDraft.id == anchor_id)
        result = await db.execute(query)
        draft = result.scalar_one_or_none()

        if not draft:
            raise HTTPException(status_code=404, detail="Entwurf nicht gefunden")

        # IDOR Protection: Check user_id matches (user_id is string in this model)
        if draft.user_id != str(current_user.id) and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Kein Zugriff auf diesen Entwurf")

        return True

    elif anchor_type == "document":
        # Check document exists and user created it
        query = select(GeneratedDocument).where(
            and_(
                GeneratedDocument.id == anchor_id,
                GeneratedDocument.is_deleted == False
            )
        )
        result = await db.execute(query)
        document = result.scalar_one_or_none()

        if not document:
            raise HTTPException(status_code=404, detail="Dokument nicht gefunden")

        # IDOR Protection: Check created_by_id
        if document.created_by_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Kein Zugriff auf dieses Dokument")

        return True

    elif anchor_type == "clause":
        # Clauses are global (library items), check existence only
        query = select(Clause).where(
            and_(
                Clause.id == anchor_id,
                Clause.is_active == True
            )
        )
        result = await db.execute(query)
        clause = result.scalar_one_or_none()

        if not clause:
            raise HTTPException(status_code=404, detail="Textbaustein nicht gefunden")

        # Admin-only for clause comments
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Nur Admins können Textbausteine kommentieren")

        return True

    elif anchor_type == "clause_instance":
        # Clause instances are part of drafts - validate via parent draft
        # For now, just validate format (positive integer)
        if anchor_id <= 0:
            raise HTTPException(status_code=400, detail="Ungültige Textbaustein-Instanz ID")
        return True

    return False


async def extract_mentions(content: str, db: AsyncSession) -> List[int]:
    """
    Extrahiert @mentions aus dem Content und gibt User-IDs zurück.

    Unterstützt:
    - @email (z.B. @john.doe)
    - @[Full Name] (z.B. @[Max Mustermann])
    """
    mentioned_user_ids = []
    matches = MENTION_PATTERN.findall(content)

    for match in matches:
        username_or_email = match[0] or match[1]  # Entweder Gruppe 1 oder 2

        # SEC-004 Fix: Escape wildcards
        escaped_search = escape_like_wildcards(username_or_email)

        # Suche User by email oder name
        query = select(User).where(
            (User.email.ilike(f"%{escaped_search}%")) |
            (User.email == username_or_email)
        ).limit(1)
        result = await db.execute(query)
        user = result.scalar_one_or_none()

        if user and user.id not in mentioned_user_ids:
            mentioned_user_ids.append(user.id)

    return mentioned_user_ids


async def create_mention_notifications(
    comment: Comment,
    mentioned_user_ids: List[int],
    actor: User,
    db: AsyncSession
):
    """Erstellt Notifications für alle erwähnten User."""
    for user_id in mentioned_user_ids:
        if user_id == actor.id:
            continue  # Keine Notification an sich selbst

        notification = Notification(
            user_id=str(user_id),
            notification_type="comment_mention",
            title=f"{actor.email} hat Sie erwähnt",
            message=comment.content[:200] + ("..." if len(comment.content) > 200 else ""),
            priority="normal",
            entity_type="comment",
            entity_id=comment.id,
            action_url=f"/comments/{comment.anchor_type}/{comment.anchor_id}?highlight={comment.id}",
            extra_data=json.dumps({
                "anchor_type": comment.anchor_type,
                "anchor_id": comment.anchor_id,
                "actor_email": actor.email,
            })
        )
        db.add(notification)


async def create_activity_event(
    event_type: str,
    actor: User,
    entity_type: str,
    entity_id: int,
    entity_name: Optional[str],
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    description: Optional[str] = None,
    db: AsyncSession = None
):
    """Erstellt einen Activity Event für den Feed."""
    event = ActivityEvent(
        event_type=event_type,
        actor_id=actor.id,
        actor_name=actor.email,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        target_type=target_type,
        target_id=target_id,
        description=description,
        visibility="team"
    )
    db.add(event)


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/{anchor_type}/{anchor_id}", response_model=CommentListResponse)
async def get_comments(
    anchor_type: str,
    anchor_id: int,
    block_id: Optional[str] = Query(None, description="Filter nach Block-ID für kontextbezogene Kommentare"),
    include_resolved: bool = Query(True, description="Auch gelöste Kommentare anzeigen"),
    limit: int = Query(50, ge=1, le=200, description="Max. Kommentare pro Seite"),
    offset: int = Query(0, ge=0, description="Offset für Pagination"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Holt alle Kommentare für eine Entität.

    Gibt Thread-Struktur zurück (Root-Kommentare mit Replies).

    SEC-002 Fix: Validates user has access to the anchor entity.
    PERF-001 Fix: Uses eager loading to reduce N+1 queries.
    PERF-002 Fix: Added pagination support.
    """
    # Validiere anchor_type
    valid_types = ["document", "draft", "clause_instance", "clause"]
    if anchor_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Ungültiger anchor_type. Erlaubt: {valid_types}")

    # SEC-001 + SEC-002: Validate anchor exists and user has access
    await validate_anchor_access(anchor_type, anchor_id, current_user, db)

    # PERF-001 Fix: Use eager loading for authors
    # First, get all user IDs we'll need
    filters = [
        Comment.anchor_type == anchor_type,
        Comment.anchor_id == anchor_id,
        Comment.parent_id.is_(None),
        Comment.is_deleted == False,
    ]

    # Block-basierter Filter: Nur Kommentare für einen bestimmten Block/Absatz
    if block_id is not None:
        filters.append(Comment.block_id == block_id)

    query = select(Comment).where(and_(*filters)).order_by(Comment.created_at.desc()).offset(offset).limit(limit)

    if not include_resolved:
        query = query.where(Comment.is_resolved == False)

    result = await db.execute(query)
    root_comments = result.scalars().all()

    # Collect all user IDs for batch loading
    user_ids = set()
    root_ids = []
    for root in root_comments:
        root_ids.append(root.id)
        if root.created_by_id:
            user_ids.add(root.created_by_id)

    # PERF-001 Fix: Batch load all replies at once
    if root_ids:
        replies_query = select(Comment).where(
            and_(
                Comment.parent_id.in_(root_ids),
                Comment.is_deleted == False
            )
        ).order_by(Comment.parent_id, Comment.created_at.asc())

        replies_result = await db.execute(replies_query)
        all_replies = replies_result.scalars().all()

        # Group replies by parent_id
        replies_by_parent = {}
        for reply in all_replies:
            if reply.created_by_id:
                user_ids.add(reply.created_by_id)
            if reply.parent_id not in replies_by_parent:
                replies_by_parent[reply.parent_id] = []
            replies_by_parent[reply.parent_id].append(reply)
    else:
        replies_by_parent = {}

    # PERF-001 Fix: Batch load all users at once
    users_by_id = {}
    if user_ids:
        users_query = select(User).where(User.id.in_(user_ids))
        users_result = await db.execute(users_query)
        for user in users_result.scalars().all():
            users_by_id[user.id] = user

    # PERF-001 Fix: Batch load all mentions at once
    mentions_by_comment = {}
    if root_ids:
        mentions_query = select(CommentMention).where(
            CommentMention.comment_id.in_(root_ids)
        )
        mentions_result = await db.execute(mentions_query)
        for mention in mentions_result.scalars().all():
            if mention.comment_id not in mentions_by_comment:
                mentions_by_comment[mention.comment_id] = []
            mentions_by_comment[mention.comment_id].append(mention)

    threads = []
    unresolved_count = 0

    for root in root_comments:
        author = users_by_id.get(root.created_by_id)
        root_mentions = mentions_by_comment.get(root.id, [])
        replies = replies_by_parent.get(root.id, [])

        root_response = CommentResponse(
            id=root.id,
            anchor_type=root.anchor_type,
            anchor_id=root.anchor_id,
            block_id=root.block_id,
            selection_range=parse_selection_range(root.selection_range),
            parent_id=root.parent_id,
            content=root.content,
            content_html=root.content_html,
            is_resolved=root.is_resolved,
            resolved_at=root.resolved_at,
            created_at=root.created_at,
            updated_at=root.updated_at,
            author=CommentAuthor(id=author.id, email=author.email) if author else None,
            mentions=[
                CommentMentionResponse(
                    id=m.id,
                    mentioned_user_id=m.mentioned_user_id,
                    seen_at=m.seen_at
                ) for m in root_mentions
            ],
            reply_count=len(replies)
        )

        # Replies mit Author (already loaded)
        reply_responses = []
        for reply in replies:
            reply_author = users_by_id.get(reply.created_by_id)
            reply_responses.append(CommentResponse(
                id=reply.id,
                anchor_type=reply.anchor_type,
                anchor_id=reply.anchor_id,
                block_id=reply.block_id,
                selection_range=parse_selection_range(reply.selection_range),
                parent_id=reply.parent_id,
                content=reply.content,
                content_html=reply.content_html,
                is_resolved=reply.is_resolved,
                resolved_at=reply.resolved_at,
                created_at=reply.created_at,
                updated_at=reply.updated_at,
                author=CommentAuthor(id=reply_author.id, email=reply_author.email) if reply_author else None,
                mentions=[],
                reply_count=0
            ))

        threads.append(CommentThreadResponse(
            root=root_response,
            replies=reply_responses,
            total_replies=len(replies)
        ))

        if not root.is_resolved:
            unresolved_count += 1

    return CommentListResponse(
        comments=threads,
        total=len(threads),
        unresolved_count=unresolved_count
    )


@router.post("", response_model=CommentResponse)
async def create_comment(
    request: CreateCommentRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Erstellt einen neuen Kommentar.

    - Extrahiert @mentions automatisch
    - Sendet Notifications an erwähnte User
    - Erstellt Activity Event

    SEC-001 Fix: Validates anchor exists before creating comment.
    SEC-002 Fix: Validates user has access to anchor.
    """
    # Validiere anchor_type
    valid_types = ["document", "draft", "clause_instance", "clause"]
    if request.anchor_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Ungültiger anchor_type. Erlaubt: {valid_types}")

    # SEC-001 + SEC-002: Validate anchor exists and user has access
    await validate_anchor_access(request.anchor_type, request.anchor_id, current_user, db, require_write=True)

    # Falls Antwort: Parent validieren
    if request.parent_id:
        parent_query = select(Comment).where(
            and_(
                Comment.id == request.parent_id,
                Comment.is_deleted == False
            )
        )
        parent_result = await db.execute(parent_query)
        parent = parent_result.scalar_one_or_none()

        if not parent:
            raise HTTPException(status_code=404, detail="Parent-Kommentar nicht gefunden")

        # Antworten erben anchor vom Parent
        if parent.anchor_type != request.anchor_type or parent.anchor_id != request.anchor_id:
            raise HTTPException(status_code=400, detail="Anchor muss mit Parent übereinstimmen")

    # Kommentar erstellen
    comment = Comment(
        anchor_type=request.anchor_type,
        anchor_id=request.anchor_id,
        block_id=request.block_id,
        selection_range=json.dumps(request.selection_range.model_dump()) if request.selection_range else None,
        parent_id=request.parent_id,
        content=request.content,
        created_by_id=current_user.id
    )
    db.add(comment)
    await db.flush()  # ID generieren

    # Mentions extrahieren und speichern
    mentioned_user_ids = await extract_mentions(request.content, db)
    for user_id in mentioned_user_ids:
        mention = CommentMention(
            comment_id=comment.id,
            mentioned_user_id=user_id
        )
        db.add(mention)

    # Notifications erstellen
    await create_mention_notifications(comment, mentioned_user_ids, current_user, db)

    # Activity Event
    event_type = "comment.replied" if request.parent_id else "comment.created"
    await create_activity_event(
        event_type=event_type,
        actor=current_user,
        entity_type="comment",
        entity_id=comment.id,
        entity_name=request.content[:50],
        target_type=request.anchor_type,
        target_id=request.anchor_id,
        db=db
    )

    await db.commit()
    await db.refresh(comment)

    # SSE: comment:new Event an erwähnte User pushen
    from app.services.event_bus import publish_event
    for uid in mentioned_user_ids:
        await publish_event(str(uid), "comment:new", {
            "anchor_type": comment.anchor_type,
            "anchor_id": comment.anchor_id,
            "comment_id": comment.id,
        })

    return CommentResponse(
        id=comment.id,
        anchor_type=comment.anchor_type,
        anchor_id=comment.anchor_id,
        block_id=comment.block_id,
        selection_range=parse_selection_range(comment.selection_range),
        parent_id=comment.parent_id,
        content=comment.content,
        content_html=comment.content_html,
        is_resolved=comment.is_resolved,
        resolved_at=comment.resolved_at,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        author=CommentAuthor(id=current_user.id, email=current_user.email),
        mentions=[
            CommentMentionResponse(id=0, mentioned_user_id=uid, seen_at=None)
            for uid in mentioned_user_ids
        ],
        reply_count=0
    )


@router.put("/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: int,
    request: UpdateCommentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Aktualisiert einen Kommentar.

    Nur der Autor kann seinen Kommentar bearbeiten.
    Mentions werden neu extrahiert.
    """
    query = select(Comment).where(
        and_(
            Comment.id == comment_id,
            Comment.is_deleted == False
        )
    )
    result = await db.execute(query)
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(status_code=404, detail="Kommentar nicht gefunden")

    if comment.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nur der Autor kann den Kommentar bearbeiten")

    # Content aktualisieren
    comment.content = request.content
    comment.updated_at = datetime.utcnow()

    # Alte Mentions löschen
    await db.execute(delete(CommentMention).where(CommentMention.comment_id == comment_id))

    # Neue Mentions extrahieren
    mentioned_user_ids = await extract_mentions(request.content, db)
    for user_id in mentioned_user_ids:
        mention = CommentMention(
            comment_id=comment.id,
            mentioned_user_id=user_id
        )
        db.add(mention)

    # Notifications für neue Mentions
    await create_mention_notifications(comment, mentioned_user_ids, current_user, db)

    await db.commit()
    await db.refresh(comment)

    return CommentResponse(
        id=comment.id,
        anchor_type=comment.anchor_type,
        anchor_id=comment.anchor_id,
        block_id=comment.block_id,
        selection_range=parse_selection_range(comment.selection_range),
        parent_id=comment.parent_id,
        content=comment.content,
        content_html=comment.content_html,
        is_resolved=comment.is_resolved,
        resolved_at=comment.resolved_at,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        author=CommentAuthor(id=current_user.id, email=current_user.email),
        mentions=[
            CommentMentionResponse(id=0, mentioned_user_id=uid, seen_at=None)
            for uid in mentioned_user_ids
        ],
        reply_count=0
    )


@router.delete("/{comment_id}")
async def delete_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Löscht einen Kommentar (Soft Delete).

    Nur der Autor oder Admins können löschen.
    """
    query = select(Comment).where(
        and_(
            Comment.id == comment_id,
            Comment.is_deleted == False
        )
    )
    result = await db.execute(query)
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(status_code=404, detail="Kommentar nicht gefunden")

    # Berechtigung prüfen
    is_admin = current_user.role == "admin"
    is_author = comment.created_by_id == current_user.id

    if not is_admin and not is_author:
        raise HTTPException(status_code=403, detail="Keine Berechtigung zum Löschen")

    # Soft Delete
    comment.is_deleted = True
    comment.deleted_at = datetime.utcnow()
    comment.deleted_by_id = current_user.id

    await db.commit()

    return {"message": "Kommentar gelöscht", "id": comment_id}


@router.post("/{comment_id}/resolve")
async def resolve_comment(
    comment_id: int,
    request: ResolveCommentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Markiert einen Kommentar-Thread als gelöst/ungelöst.

    SEC-003 Fix: Only author, thread participants, or admins can resolve.
    Nur Root-Kommentare können resolved werden.
    """
    query = select(Comment).where(
        and_(
            Comment.id == comment_id,
            Comment.is_deleted == False,
            Comment.parent_id.is_(None)  # Nur Root-Kommentare
        )
    )
    result = await db.execute(query)
    comment = result.scalar_one_or_none()

    if not comment:
        raise HTTPException(status_code=404, detail="Kommentar nicht gefunden oder ist kein Thread-Root")

    # SEC-003 Fix: Authorization check for resolve/reopen
    is_admin = current_user.role == "admin"
    is_author = comment.created_by_id == current_user.id

    # Check if user participated in thread (replied to this comment)
    is_participant = False
    if not is_admin and not is_author:
        participant_query = select(Comment).where(
            and_(
                Comment.parent_id == comment_id,
                Comment.created_by_id == current_user.id,
                Comment.is_deleted == False
            )
        ).limit(1)
        participant_result = await db.execute(participant_query)
        is_participant = participant_result.scalar_one_or_none() is not None

    if not is_admin and not is_author and not is_participant:
        raise HTTPException(
            status_code=403,
            detail="Nur Autor, Thread-Teilnehmer oder Admins können Kommentare auflösen"
        )

    comment.is_resolved = request.is_resolved
    if request.is_resolved:
        comment.resolved_at = datetime.utcnow()
        comment.resolved_by_id = current_user.id
    else:
        comment.resolved_at = None
        comment.resolved_by_id = None

    # Activity Event
    event_type = "comment.resolved" if request.is_resolved else "comment.reopened"
    await create_activity_event(
        event_type=event_type,
        actor=current_user,
        entity_type="comment",
        entity_id=comment.id,
        entity_name=comment.content[:50],
        target_type=comment.anchor_type,
        target_id=comment.anchor_id,
        db=db
    )

    await db.commit()

    # SSE: comment:resolved Event an Kommentar-Ersteller pushen
    if comment.created_by_id and comment.created_by_id != current_user.id:
        from app.services.event_bus import publish_event
        await publish_event(str(comment.created_by_id), "comment:resolved", {
            "anchor_type": comment.anchor_type,
            "anchor_id": comment.anchor_id,
            "comment_id": comment.id,
            "is_resolved": request.is_resolved,
        })

    return {
        "message": "Thread als gelöst markiert" if request.is_resolved else "Thread wieder geöffnet",
        "id": comment_id,
        "is_resolved": request.is_resolved
    }


# ═══════════════════════════════════════════════════════════════════════════
# MENTION AUTOCOMPLETE
# ═══════════════════════════════════════════════════════════════════════════

class UserSuggestion(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None


@router.get("/mentions/suggest", response_model=List[UserSuggestion])
async def suggest_mentions(
    query: str = Query(..., min_length=1, max_length=50),
    limit: int = Query(10, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Autocomplete für @mentions.

    Sucht User nach Email oder Name (case-insensitive).

    SEC-004 Fix: Escapes wildcards in search query.
    """
    # SEC-004 Fix: Escape wildcards
    escaped_query = escape_like_wildcards(query.lower())
    search_pattern = f"%{escaped_query}%"

    user_query = select(User).where(
        and_(
            User.is_active == True,
            User.id != current_user.id,  # Sich selbst nicht vorschlagen
            User.email.ilike(search_pattern)
        )
    ).limit(limit)

    result = await db.execute(user_query)
    users = result.scalars().all()

    return [
        UserSuggestion(
            id=u.id,
            email=u.email,
            name=None,  # User-Modell hat kein name Feld, könnte erweitert werden
            avatar_url=None
        )
        for u in users
    ]


# ═══════════════════════════════════════════════════════════════════════════
# ACTIVITY FEED
# ═══════════════════════════════════════════════════════════════════════════

class ActivityEventResponse(BaseModel):
    id: int
    event_type: str
    actor_name: Optional[str] = None
    entity_type: str
    entity_id: int
    entity_name: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ActivityFeedResponse(BaseModel):
    events: List[ActivityEventResponse]
    total: int
    has_more: bool


@router.get("/activity/{entity_type}/{entity_id}", response_model=ActivityFeedResponse)
async def get_activity_feed(
    entity_type: str,
    entity_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Holt Activity Feed für eine Entität.

    Zeigt alle Aktionen (Kommentare, Änderungen, etc.) für ein Dokument/Draft.
    """
    query = select(ActivityEvent).where(
        and_(
            ActivityEvent.entity_type == entity_type,
            ActivityEvent.entity_id == entity_id
        )
    ).order_by(ActivityEvent.created_at.desc()).offset(offset).limit(limit + 1)

    result = await db.execute(query)
    events = result.scalars().all()

    has_more = len(events) > limit
    if has_more:
        events = events[:limit]

    # Total count
    count_query = select(func.count()).select_from(ActivityEvent).where(
        and_(
            ActivityEvent.entity_type == entity_type,
            ActivityEvent.entity_id == entity_id
        )
    )
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    return ActivityFeedResponse(
        events=[
            ActivityEventResponse(
                id=e.id,
                event_type=e.event_type,
                actor_name=e.actor_name,
                entity_type=e.entity_type,
                entity_id=e.entity_id,
                entity_name=e.entity_name,
                description=e.description,
                created_at=e.created_at
            )
            for e in events
        ],
        total=total,
        has_more=has_more
    )
