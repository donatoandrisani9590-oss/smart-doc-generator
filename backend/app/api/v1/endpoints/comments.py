"""
Comments API - Phase 2: Async Collaboration

Ermöglicht:
- CRUD für Kommentare an Dokumenten/Klauseln/Entwürfen
- Thread-basierte Antworten
- @Mentions mit Notification-Trigger
- Resolve/Unresolve Threads
- Activity Feed

Ähnlich wie Google Docs / fynk.com Kommentarsystem.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, update, delete
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import re
import json

from app.db import get_db
from app.models.collaboration import Comment, CommentMention, ActivityEvent
from app.models.enterprise import Notification
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


class CommentResponse(BaseModel):
    id: int
    anchor_type: str
    anchor_id: int
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

        # Suche User by email oder name
        query = select(User).where(
            (User.email.ilike(f"%{username_or_email}%")) |
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
    include_resolved: bool = Query(True, description="Auch gelöste Kommentare anzeigen"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Holt alle Kommentare für eine Entität.

    Gibt Thread-Struktur zurück (Root-Kommentare mit Replies).
    """
    # Validiere anchor_type
    valid_types = ["document", "draft", "clause_instance", "clause"]
    if anchor_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Ungültiger anchor_type. Erlaubt: {valid_types}")

    # Root-Kommentare laden
    query = select(Comment).where(
        and_(
            Comment.anchor_type == anchor_type,
            Comment.anchor_id == anchor_id,
            Comment.parent_id.is_(None),
            Comment.is_deleted == False
        )
    ).order_by(Comment.created_at.desc())

    if not include_resolved:
        query = query.where(Comment.is_resolved == False)

    result = await db.execute(query)
    root_comments = result.scalars().all()

    threads = []
    unresolved_count = 0

    for root in root_comments:
        # Replies laden
        replies_query = select(Comment).where(
            and_(
                Comment.parent_id == root.id,
                Comment.is_deleted == False
            )
        ).order_by(Comment.created_at.asc())

        replies_result = await db.execute(replies_query)
        replies = replies_result.scalars().all()

        # Mentions für Root
        mentions_query = select(CommentMention).where(
            CommentMention.comment_id == root.id
        )
        mentions_result = await db.execute(mentions_query)
        root_mentions = mentions_result.scalars().all()

        # Author laden
        author = None
        if root.created_by_id:
            author_query = select(User).where(User.id == root.created_by_id)
            author_result = await db.execute(author_query)
            author = author_result.scalar_one_or_none()

        root_response = CommentResponse(
            id=root.id,
            anchor_type=root.anchor_type,
            anchor_id=root.anchor_id,
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

        # Replies mit Author
        reply_responses = []
        for reply in replies:
            reply_author = None
            if reply.created_by_id:
                ra_query = select(User).where(User.id == reply.created_by_id)
                ra_result = await db.execute(ra_query)
                reply_author = ra_result.scalar_one_or_none()

            reply_responses.append(CommentResponse(
                id=reply.id,
                anchor_type=reply.anchor_type,
                anchor_id=reply.anchor_id,
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


@router.post("/", response_model=CommentResponse)
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
    """
    # Validiere anchor_type
    valid_types = ["document", "draft", "clause_instance", "clause"]
    if request.anchor_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Ungültiger anchor_type. Erlaubt: {valid_types}")

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

    return CommentResponse(
        id=comment.id,
        anchor_type=comment.anchor_type,
        anchor_id=comment.anchor_id,
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
    """
    search_pattern = f"%{query.lower()}%"

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
