"""Add AI metadata and tenant isolation fields to clauses table

Closes the gap between clause management and AI selection:
- tags: JSON array for semantic AI matching (e.g. ["kuendigung", "streng", "fristlos"])
- description: Human-readable purpose description for AI context injection
- user_id: Foreign key for tenant isolation (ensures User A cannot see User B's clauses)
- tone: Clause tone indicator for AI matching ("neutral", "streng", "arbeitnehmerfreundlich")

Revision ID: 003_add_clause_ai_metadata
Revises: add_doctype_variant_groups
Create Date: 2025-02-07

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision = '003_add_clause_ai_metadata'
down_revision = 'add_doctype_variant_groups'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # AI-Metadaten für semantisches Matching
    op.add_column('clauses', sa.Column(
        'tags', JSONB, nullable=True, server_default='[]',
        comment='JSON array of semantic tags for AI matching, e.g. ["kuendigung", "streng"]'
    ))
    op.add_column('clauses', sa.Column(
        'description', sa.Text(), nullable=True,
        comment='Human-readable purpose description injected into AI system prompt'
    ))
    op.add_column('clauses', sa.Column(
        'tone', sa.String(50), nullable=True,
        comment='Clause tone: neutral, streng, arbeitnehmerfreundlich, moderat'
    ))

    # Tenant Isolation
    op.add_column('clauses', sa.Column(
        'user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True,
        comment='Owner user ID for tenant isolation. NULL = global/shared clause.'
    ))

    # GIN index for fast JSONB tag queries (e.g. WHERE tags @> '["kuendigung"]')
    op.create_index(
        'ix_clauses_tags_gin',
        'clauses',
        ['tags'],
        postgresql_using='gin'
    )

    # Index for tenant isolation queries
    op.create_index(
        'ix_clauses_user_id',
        'clauses',
        ['user_id']
    )

    # Composite index for the most common AI query pattern:
    # WHERE user_id = ? AND country_code = ? AND is_active = true AND category = ?
    op.create_index(
        'ix_clauses_ai_lookup',
        'clauses',
        ['user_id', 'country_code', 'is_active', 'category']
    )


def downgrade() -> None:
    op.drop_index('ix_clauses_ai_lookup', table_name='clauses')
    op.drop_index('ix_clauses_user_id', table_name='clauses')
    op.drop_index('ix_clauses_tags_gin', table_name='clauses')
    op.drop_column('clauses', 'user_id')
    op.drop_column('clauses', 'tone')
    op.drop_column('clauses', 'description')
    op.drop_column('clauses', 'tags')
