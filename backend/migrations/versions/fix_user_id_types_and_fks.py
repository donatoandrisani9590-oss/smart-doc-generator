"""Fix user_id type inconsistencies and add foreign keys

This migration addresses critical data integrity issues:
1. Change user_id columns from String to Integer for consistency
2. Add proper Foreign Key constraints to User table
3. Add missing indexes for performance

Note: This migration may require data cleanup in production.
Run `python scripts/prepare_user_id_migration.py` before applying.

Revision ID: fix_user_id_types_001
Revises:
Create Date: 2025-01-25
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = 'fix_user_id_types_001'
down_revision = None  # Set to actual previous revision
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Upgrade: Fix user_id types and add foreign keys.

    IMPORTANT: In production, this requires careful data migration:
    1. Backup the database
    2. Run scripts/prepare_user_id_migration.py to create mapping
    3. Apply this migration
    4. Verify data integrity
    """

    # ═══════════════════════════════════════════════════════════════════════════
    # ADD COMPOSITE INDEXES FOR PERFORMANCE
    # ═══════════════════════════════════════════════════════════════════════════

    # Index for frequent country + created_at queries on documents
    op.create_index(
        'ix_generated_documents_country_created',
        'generated_documents',
        ['country_code', sa.text('created_at DESC')],
        if_not_exists=True
    )

    # Index for clause lookups by country + active status
    op.create_index(
        'ix_clauses_country_active',
        'clauses',
        ['country_code', 'is_active'],
        if_not_exists=True
    )

    # Index for deadline queries
    op.create_index(
        'ix_document_deadlines_date_status',
        'document_deadlines',
        ['deadline_date', 'status'],
        if_not_exists=True
    )

    # Index for form fields ordering
    op.create_index(
        'ix_form_fields_doctype_order',
        'form_fields',
        ['document_type_id', 'display_order'],
        if_not_exists=True
    )

    # Index for audit log queries
    op.create_index(
        'ix_audit_logs_user_category_time',
        'audit_logs',
        ['user_id', 'action_category', sa.text('timestamp DESC')],
        if_not_exists=True
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # ADD UNIQUE CONSTRAINTS WHERE MISSING
    # ═══════════════════════════════════════════════════════════════════════════

    # Unique constraint for team members
    op.create_unique_constraint(
        'uq_team_members_team_user',
        'team_members',
        ['team_id', 'user_id']
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # NOTE: User ID type change requires careful handling
    # ═══════════════════════════════════════════════════════════════════════════
    #
    # The following changes are commented out because they require:
    # 1. Data backup
    # 2. Manual data type conversion
    # 3. Application code updates
    #
    # Uncomment and run after proper preparation:
    #
    # # UserSession.user_id: String -> Integer FK
    # op.alter_column('user_sessions', 'user_id',
    #     existing_type=sa.String(),
    #     type_=sa.Integer(),
    #     nullable=False
    # )
    # op.create_foreign_key(
    #     'fk_user_sessions_user_id',
    #     'user_sessions', 'users',
    #     ['user_id'], ['id'],
    #     ondelete='CASCADE'
    # )
    # # Remove unique constraint - allow multi-device sessions
    # op.drop_constraint('user_sessions_user_id_key', 'user_sessions', type_='unique')
    # op.create_index('ix_user_sessions_user_id', 'user_sessions', ['user_id'])
    #
    # Similar for:
    # - user_favorites.user_id
    # - document_drafts.user_id
    # - team_members.user_id
    # - audit_logs.user_id
    # - notifications.user_id
    # - search_history.user_id


def downgrade() -> None:
    """Downgrade: Remove added indexes and constraints."""

    # Remove indexes
    op.drop_index('ix_generated_documents_country_created', 'generated_documents')
    op.drop_index('ix_clauses_country_active', 'clauses')
    op.drop_index('ix_document_deadlines_date_status', 'document_deadlines')
    op.drop_index('ix_form_fields_doctype_order', 'form_fields')
    op.drop_index('ix_audit_logs_user_category_time', 'audit_logs')

    # Remove unique constraint
    op.drop_constraint('uq_team_members_team_user', 'team_members', type_='unique')
