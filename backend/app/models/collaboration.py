"""
Collaboration Models - Phase 2: Async Collaboration

Ermöglicht:
- Kommentare an Dokumenten/Klauseln/Entwürfen
- @Mentions von Team-Mitgliedern
- Thread-basierte Diskussionen
- Activity Feed

Ähnlich wie Google Docs / fynk.com Kommentarsystem.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from app.db import Base


# ═══════════════════════════════════════════════════════════════════════════
# COMMENTS
# ═══════════════════════════════════════════════════════════════════════════

class Comment(Base):
    """
    Kommentare an verschiedenen Entitäten (Dokumente, Klauseln, Entwürfe).

    Unterstützt:
    - Thread-Antworten (parent_id)
    - @Mentions im Text (werden in CommentMention extrahiert)
    - Resolved/Unresolved Status
    - Soft Delete

    Anchor-Typen:
    - 'document': Kommentar an GeneratedDocument
    - 'draft': Kommentar an DocumentDraft
    - 'clause_instance': Kommentar an DocumentClauseInstance (Composer)
    - 'clause': Kommentar an Clause (Bibliothek)
    """
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)

    # Wo ist der Kommentar verankert?
    anchor_type = Column(String(50), nullable=False, index=True)
    anchor_id = Column(Integer, nullable=False, index=True)

    # Thread-Struktur (NULL = Root-Kommentar)
    parent_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True, index=True)

    # Inhalt
    content = Column(Text, nullable=False)
    content_html = Column(Text, nullable=True)  # Optional: Formatierter HTML-Content

    # Status
    is_resolved = Column(Boolean, default=False, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Soft Delete
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Metadata
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationships
    mentions = relationship("CommentMention", back_populates="comment", cascade="all, delete-orphan")

    # Composite Index für häufige Abfragen
    __table_args__ = (
        Index("ix_comments_anchor", "anchor_type", "anchor_id"),
        Index("ix_comments_created", "created_at", "is_deleted"),
    )


# Self-referential relationship muss nach der Klassen-Definition hinzugefügt werden
# um die Column-Referenz korrekt aufzulösen
Comment.replies = relationship(
    "Comment",
    backref=backref("parent", remote_side=[Comment.id]),
    foreign_keys=[Comment.parent_id],
    lazy="selectin",
)


class CommentMention(Base):
    """
    @Mentions in Kommentaren.

    Wird beim Erstellen/Bearbeiten eines Kommentars extrahiert.
    Triggert Notification an den erwähnten User.
    """
    __tablename__ = "comment_mentions"

    id = Column(Integer, primary_key=True, index=True)

    # Verknüpfungen
    comment_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True)
    mentioned_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Position im Text (optional, für Highlighting)
    start_position = Column(Integer, nullable=True)
    end_position = Column(Integer, nullable=True)

    # Status
    seen_at = Column(DateTime(timezone=True), nullable=True)
    notified_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    comment = relationship("Comment", back_populates="mentions")

    # Unique constraint: Ein User kann pro Kommentar nur einmal erwähnt werden
    __table_args__ = (
        Index("ix_comment_mentions_user", "mentioned_user_id", "seen_at"),
    )


# ═══════════════════════════════════════════════════════════════════════════
# ACTIVITY FEED
# ═══════════════════════════════════════════════════════════════════════════

class ActivityEvent(Base):
    """
    Activity Feed Events für Echtzeit-Updates.

    Event-Typen:
    - comment.created: Neuer Kommentar
    - comment.replied: Antwort auf Kommentar
    - comment.resolved: Kommentar-Thread gelöst
    - comment.mentioned: User wurde erwähnt
    - document.created: Dokument erstellt
    - document.updated: Dokument aktualisiert
    - draft.created: Entwurf erstellt
    - draft.shared: Entwurf geteilt
    - clause.approved: Klausel freigegeben

    Diese Events werden auch für Realtime-Updates (Phase 3) genutzt.
    """
    __tablename__ = "activity_events"

    id = Column(Integer, primary_key=True, index=True)

    # Event-Typ
    event_type = Column(String(50), nullable=False, index=True)

    # Wer hat die Aktion ausgeführt?
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_name = Column(String(255), nullable=True)  # Snapshot für schnelle Anzeige

    # Betroffene Entität
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(Integer, nullable=False, index=True)
    entity_name = Column(String(255), nullable=True)  # Snapshot

    # Zusätzlicher Kontext
    target_type = Column(String(50), nullable=True)  # z.B. bei "replied": parent comment
    target_id = Column(Integer, nullable=True)

    # Beschreibung & Details
    description = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)  # JSON für extra Daten

    # Sichtbarkeit
    visibility = Column(String(20), default="team")  # 'private', 'team', 'public'

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Composite Index
    __table_args__ = (
        Index("ix_activity_entity", "entity_type", "entity_id"),
        Index("ix_activity_feed", "created_at", "visibility"),
    )


# ═══════════════════════════════════════════════════════════════════════════
# COMMENT REACTIONS (Optional - für zukünftige Erweiterung)
# ═══════════════════════════════════════════════════════════════════════════

class CommentReaction(Base):
    """
    Reaktionen auf Kommentare (👍, ✅, 👀, etc.)

    Ermöglicht schnelles Feedback ohne neuen Kommentar.
    """
    __tablename__ = "comment_reactions"

    id = Column(Integer, primary_key=True, index=True)

    comment_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Reaktionstyp
    reaction_type = Column(String(20), nullable=False)  # 'like', 'check', 'eyes', 'heart'

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Unique: Ein User kann pro Reaktionstyp nur einmal reagieren
    __table_args__ = (
        Index("ix_comment_reactions_unique", "comment_id", "user_id", "reaction_type", unique=True),
    )
