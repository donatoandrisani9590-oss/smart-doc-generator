"""Add updated_at column to document_types table.

Revision ID: 007_add_document_type_updated_at
Revises: 006_add_streaming_ghostwriter_flags
Create Date: 2025-02-15
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '007_add_document_type_updated_at'
down_revision = '006_add_streaming_ghostwriter_flags'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'document_types',
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=True)
    )
    # Backfill: setze updated_at = created_at für bestehende Einträge
    op.execute("UPDATE document_types SET updated_at = created_at WHERE updated_at IS NULL")


def downgrade() -> None:
    op.drop_column('document_types', 'updated_at')
