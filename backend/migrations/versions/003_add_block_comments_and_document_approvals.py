"""Add block-based comments and document approval workflow

Revision ID: 003_block_comments_approvals
Revises: 002_collaboration
Create Date: 2026-02-07

Changes:
1. Add block_id and selection_range to comments table (contextual/inline comments)
2. Create document_approvals table (document-level approval workflow)
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003_block_comments_approvals'
down_revision = '002_collaboration'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ═══════════════════════════════════════════════════════════════════════════
    # 1. ADD BLOCK-BASED COMMENT FIELDS TO comments TABLE
    # ═══════════════════════════════════════════════════════════════════════════

    # block_id: ID des Blocks/Absatzes (z.B. "clause_3", "paragraph_5")
    op.add_column('comments', sa.Column('block_id', sa.String(255), nullable=True))

    # selection_range: JSON mit Start/End-Position der markierten Textstelle
    op.add_column('comments', sa.Column('selection_range', sa.Text(), nullable=True))

    # Index for block-based queries
    op.create_index('ix_comments_block_id', 'comments', ['block_id'])
    op.create_index('ix_comments_block', 'comments', ['anchor_type', 'anchor_id', 'block_id'])

    # ═══════════════════════════════════════════════════════════════════════════
    # 2. CREATE document_approvals TABLE
    # ═══════════════════════════════════════════════════════════════════════════
    op.create_table(
        'document_approvals',
        sa.Column('id', sa.Integer(), nullable=False),

        # Which document needs approval?
        sa.Column('document_id', sa.Integer(),
                  sa.ForeignKey('generated_documents.id', ondelete='CASCADE'),
                  nullable=False),

        # Status: pending_approval, approved, changes_requested, rejected
        sa.Column('status', sa.String(30), nullable=False, server_default='pending_approval'),

        # Who should approve?
        sa.Column('approver_id', sa.Integer(),
                  sa.ForeignKey('users.id', ondelete='SET NULL'),
                  nullable=True),

        # Who requested?
        sa.Column('requested_by_id', sa.Integer(),
                  sa.ForeignKey('users.id', ondelete='SET NULL'),
                  nullable=True),
        sa.Column('requested_at', sa.DateTime(timezone=True), server_default=sa.func.now()),

        # Decision
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('decision_comment', sa.Text(), nullable=True),

        # Priority
        sa.Column('priority', sa.String(20), server_default='normal'),

        # Due date
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),

        # Metadata
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  onupdate=sa.func.now(), server_default=sa.func.now()),

        sa.PrimaryKeyConstraint('id'),
    )

    # Indexes for document_approvals
    op.create_index('ix_document_approvals_id', 'document_approvals', ['id'])
    op.create_index('ix_document_approvals_document_id', 'document_approvals', ['document_id'])
    op.create_index('ix_document_approvals_status', 'document_approvals', ['status'])
    op.create_index('ix_document_approvals_approver_id', 'document_approvals', ['approver_id'])
    op.create_index('ix_document_approvals_requested_by_id', 'document_approvals', ['requested_by_id'])
    op.create_index('ix_document_approvals_requested_at', 'document_approvals', ['requested_at'])


def downgrade() -> None:
    # Drop document_approvals table
    op.drop_index('ix_document_approvals_requested_at', 'document_approvals')
    op.drop_index('ix_document_approvals_requested_by_id', 'document_approvals')
    op.drop_index('ix_document_approvals_approver_id', 'document_approvals')
    op.drop_index('ix_document_approvals_status', 'document_approvals')
    op.drop_index('ix_document_approvals_document_id', 'document_approvals')
    op.drop_index('ix_document_approvals_id', 'document_approvals')
    op.drop_table('document_approvals')

    # Remove block-based comment columns
    op.drop_index('ix_comments_block', 'comments')
    op.drop_index('ix_comments_block_id', 'comments')
    op.drop_column('comments', 'selection_range')
    op.drop_column('comments', 'block_id')
