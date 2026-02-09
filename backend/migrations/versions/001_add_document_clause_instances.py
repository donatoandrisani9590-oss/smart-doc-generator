"""Add document_clause_instances table for Smart UX Composer

Revision ID: 001_smart_ux_composer
Revises:
Create Date: 2026-01-27

Smart UX Konzept - Phase 1:
Neue Tabelle für Textbaustein-Instanzen mit Global/Local/Deviation Support
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001_smart_ux_composer'
down_revision = 'add_doctype_defaults'  # Chain after document type defaults
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'document_clause_instances',
        # Primary Key
        sa.Column('id', sa.Integer(), nullable=False),

        # Parent relationship (one of these must be set)
        sa.Column('document_draft_id', sa.Integer(), sa.ForeignKey('document_drafts.id', ondelete='CASCADE'), nullable=True),
        sa.Column('generated_document_id', sa.Integer(), sa.ForeignKey('generated_documents.id', ondelete='CASCADE'), nullable=True),

        # Origin & Source
        sa.Column('clause_origin', sa.String(20), nullable=False, default='local'),
        sa.Column('source_clause_id', sa.Integer(), sa.ForeignKey('clauses.id', ondelete='SET NULL'), nullable=True),
        sa.Column('source_clause_version', sa.Integer(), nullable=True),

        # Content
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('content_html', sa.Text(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, default=0),

        # Deviation Tracking
        sa.Column('deviated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deviated_by_user_id', sa.Integer(), nullable=True),
        sa.Column('deviated_reason', sa.Text(), nullable=True),
        sa.Column('original_content_snapshot', sa.Text(), nullable=True),

        # Promotion Tracking
        sa.Column('promoted_to_clause_id', sa.Integer(), sa.ForeignKey('clauses.id', ondelete='SET NULL'), nullable=True),
        sa.Column('promoted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('promoted_by_user_id', sa.Integer(), nullable=True),

        # Variant Support
        sa.Column('variant_group_id', sa.Integer(), nullable=True),
        sa.Column('selected_variant_id', sa.Integer(), nullable=True),

        # Conditional Support
        sa.Column('condition_json', sa.Text(), nullable=True),
        sa.Column('is_condition_met', sa.Boolean(), default=True),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now(), server_default=sa.func.now()),

        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "(document_draft_id IS NOT NULL AND generated_document_id IS NULL) OR "
            "(document_draft_id IS NULL AND generated_document_id IS NOT NULL)",
            name='check_single_parent'
        )
    )

    # Indexes for performance
    op.create_index('ix_document_clause_instances_id', 'document_clause_instances', ['id'])
    op.create_index('ix_document_clause_instances_draft_id', 'document_clause_instances', ['document_draft_id'])
    op.create_index('ix_document_clause_instances_doc_id', 'document_clause_instances', ['generated_document_id'])
    op.create_index('ix_document_clause_instances_origin', 'document_clause_instances', ['clause_origin'])
    op.create_index('ix_document_clause_instances_source', 'document_clause_instances', ['source_clause_id'])

    # Composite indexes for common queries
    op.create_index(
        'ix_clause_instances_draft_order',
        'document_clause_instances',
        ['document_draft_id', 'display_order']
    )
    op.create_index(
        'ix_clause_instances_doc_order',
        'document_clause_instances',
        ['generated_document_id', 'display_order']
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_clause_instances_doc_order', 'document_clause_instances')
    op.drop_index('ix_clause_instances_draft_order', 'document_clause_instances')
    op.drop_index('ix_document_clause_instances_source', 'document_clause_instances')
    op.drop_index('ix_document_clause_instances_origin', 'document_clause_instances')
    op.drop_index('ix_document_clause_instances_doc_id', 'document_clause_instances')
    op.drop_index('ix_document_clause_instances_draft_id', 'document_clause_instances')
    op.drop_index('ix_document_clause_instances_id', 'document_clause_instances')

    # Drop table
    op.drop_table('document_clause_instances')
