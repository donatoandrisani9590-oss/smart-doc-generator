"""Add collaboration tables for Comments, Mentions, Activity Feed

Revision ID: 002_collaboration
Revises: 001_smart_ux_composer
Create Date: 2026-02-01

Phase 2: Async Collaboration
- comments: Thread-based comments on documents/drafts/clauses
- comment_mentions: @mentions in comments
- activity_events: Activity feed for real-time updates
- comment_reactions: Emoji reactions on comments
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_collaboration'
down_revision = '001_smart_ux_composer'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ═══════════════════════════════════════════════════════════════════════════
    # COMMENTS TABLE
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table(
        'comments',
        sa.Column('id', sa.Integer(), nullable=False),

        # Anchor: Where is the comment attached?
        # Types: 'document', 'draft', 'clause_instance', 'clause'
        sa.Column('anchor_type', sa.String(50), nullable=False),
        sa.Column('anchor_id', sa.Integer(), nullable=False),

        # Thread structure (NULL = root comment)
        sa.Column('parent_id', sa.Integer(), sa.ForeignKey('comments.id', ondelete='CASCADE'), nullable=True),

        # Content
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('content_html', sa.Text(), nullable=True),

        # Status
        sa.Column('is_resolved', sa.Boolean(), default=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),

        # Soft Delete
        sa.Column('is_deleted', sa.Boolean(), default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),

        # Metadata
        sa.Column('created_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now(), server_default=sa.func.now()),

        sa.PrimaryKeyConstraint('id'),
    )

    # Indexes for comments
    op.create_index('ix_comments_id', 'comments', ['id'])
    op.create_index('ix_comments_anchor_type', 'comments', ['anchor_type'])
    op.create_index('ix_comments_anchor_id', 'comments', ['anchor_id'])
    op.create_index('ix_comments_parent_id', 'comments', ['parent_id'])
    op.create_index('ix_comments_is_resolved', 'comments', ['is_resolved'])
    op.create_index('ix_comments_is_deleted', 'comments', ['is_deleted'])
    op.create_index('ix_comments_created_by_id', 'comments', ['created_by_id'])
    op.create_index('ix_comments_created_at', 'comments', ['created_at'])

    # Composite indexes
    op.create_index('ix_comments_anchor', 'comments', ['anchor_type', 'anchor_id'])
    op.create_index('ix_comments_created', 'comments', ['created_at', 'is_deleted'])

    # ═══════════════════════════════════════════════════════════════════════════
    # COMMENT MENTIONS TABLE
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table(
        'comment_mentions',
        sa.Column('id', sa.Integer(), nullable=False),

        # Relations
        sa.Column('comment_id', sa.Integer(), sa.ForeignKey('comments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('mentioned_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),

        # Position in text (optional, for highlighting)
        sa.Column('start_position', sa.Integer(), nullable=True),
        sa.Column('end_position', sa.Integer(), nullable=True),

        # Status
        sa.Column('seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notified_at', sa.DateTime(timezone=True), nullable=True),

        # Metadata
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),

        sa.PrimaryKeyConstraint('id'),
    )

    # Indexes for comment_mentions
    op.create_index('ix_comment_mentions_id', 'comment_mentions', ['id'])
    op.create_index('ix_comment_mentions_comment_id', 'comment_mentions', ['comment_id'])
    op.create_index('ix_comment_mentions_mentioned_user_id', 'comment_mentions', ['mentioned_user_id'])
    op.create_index('ix_comment_mentions_user', 'comment_mentions', ['mentioned_user_id', 'seen_at'])

    # ═══════════════════════════════════════════════════════════════════════════
    # ACTIVITY EVENTS TABLE
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table(
        'activity_events',
        sa.Column('id', sa.Integer(), nullable=False),

        # Event type (comment.created, comment.replied, document.updated, etc.)
        sa.Column('event_type', sa.String(50), nullable=False),

        # Actor (who performed the action?)
        sa.Column('actor_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('actor_name', sa.String(255), nullable=True),  # Snapshot for quick display

        # Affected entity
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=False),
        sa.Column('entity_name', sa.String(255), nullable=True),  # Snapshot

        # Target (e.g., for "replied": parent comment)
        sa.Column('target_type', sa.String(50), nullable=True),
        sa.Column('target_id', sa.Integer(), nullable=True),

        # Description & Extra Data
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('metadata_json', sa.Text(), nullable=True),

        # Visibility
        sa.Column('visibility', sa.String(20), default='team'),  # 'private', 'team', 'public'

        # Metadata
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),

        sa.PrimaryKeyConstraint('id'),
    )

    # Indexes for activity_events
    op.create_index('ix_activity_events_id', 'activity_events', ['id'])
    op.create_index('ix_activity_events_event_type', 'activity_events', ['event_type'])
    op.create_index('ix_activity_events_actor_id', 'activity_events', ['actor_id'])
    op.create_index('ix_activity_events_entity_type', 'activity_events', ['entity_type'])
    op.create_index('ix_activity_events_entity_id', 'activity_events', ['entity_id'])
    op.create_index('ix_activity_events_created_at', 'activity_events', ['created_at'])

    # Composite indexes
    op.create_index('ix_activity_entity', 'activity_events', ['entity_type', 'entity_id'])
    op.create_index('ix_activity_feed', 'activity_events', ['created_at', 'visibility'])

    # ═══════════════════════════════════════════════════════════════════════════
    # COMMENT REACTIONS TABLE
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table(
        'comment_reactions',
        sa.Column('id', sa.Integer(), nullable=False),

        sa.Column('comment_id', sa.Integer(), sa.ForeignKey('comments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),

        # Reaction type: 'like', 'check', 'eyes', 'heart'
        sa.Column('reaction_type', sa.String(20), nullable=False),

        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),

        sa.PrimaryKeyConstraint('id'),
    )

    # Indexes for comment_reactions
    op.create_index('ix_comment_reactions_id', 'comment_reactions', ['id'])
    op.create_index('ix_comment_reactions_comment_id', 'comment_reactions', ['comment_id'])
    op.create_index('ix_comment_reactions_user_id', 'comment_reactions', ['user_id'])

    # Unique constraint: one reaction type per user per comment
    op.create_index(
        'ix_comment_reactions_unique',
        'comment_reactions',
        ['comment_id', 'user_id', 'reaction_type'],
        unique=True
    )


def downgrade() -> None:
    # Drop comment_reactions
    op.drop_index('ix_comment_reactions_unique', 'comment_reactions')
    op.drop_index('ix_comment_reactions_user_id', 'comment_reactions')
    op.drop_index('ix_comment_reactions_comment_id', 'comment_reactions')
    op.drop_index('ix_comment_reactions_id', 'comment_reactions')
    op.drop_table('comment_reactions')

    # Drop activity_events
    op.drop_index('ix_activity_feed', 'activity_events')
    op.drop_index('ix_activity_entity', 'activity_events')
    op.drop_index('ix_activity_events_created_at', 'activity_events')
    op.drop_index('ix_activity_events_entity_id', 'activity_events')
    op.drop_index('ix_activity_events_entity_type', 'activity_events')
    op.drop_index('ix_activity_events_actor_id', 'activity_events')
    op.drop_index('ix_activity_events_event_type', 'activity_events')
    op.drop_index('ix_activity_events_id', 'activity_events')
    op.drop_table('activity_events')

    # Drop comment_mentions
    op.drop_index('ix_comment_mentions_user', 'comment_mentions')
    op.drop_index('ix_comment_mentions_mentioned_user_id', 'comment_mentions')
    op.drop_index('ix_comment_mentions_comment_id', 'comment_mentions')
    op.drop_index('ix_comment_mentions_id', 'comment_mentions')
    op.drop_table('comment_mentions')

    # Drop comments
    op.drop_index('ix_comments_created', 'comments')
    op.drop_index('ix_comments_anchor', 'comments')
    op.drop_index('ix_comments_created_at', 'comments')
    op.drop_index('ix_comments_created_by_id', 'comments')
    op.drop_index('ix_comments_is_deleted', 'comments')
    op.drop_index('ix_comments_is_resolved', 'comments')
    op.drop_index('ix_comments_parent_id', 'comments')
    op.drop_index('ix_comments_anchor_id', 'comments')
    op.drop_index('ix_comments_anchor_type', 'comments')
    op.drop_index('ix_comments_id', 'comments')
    op.drop_table('comments')
