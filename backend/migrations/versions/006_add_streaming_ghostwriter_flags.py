"""Add AI streaming and ghostwriter feature flags.

Revision ID: 006_add_streaming_ghostwriter_flags
Revises: 005_add_llm_call_logs
Create Date: 2025-02-14
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '006_add_streaming_ghostwriter_flags'
down_revision = '005_add_llm_call_logs'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'user_feature_settings',
        sa.Column('enable_ai_streaming', sa.Boolean(), nullable=False, server_default=sa.text('true'))
    )
    op.add_column(
        'user_feature_settings',
        sa.Column('enable_ghostwriter', sa.Boolean(), nullable=False, server_default=sa.text('true'))
    )


def downgrade() -> None:
    op.drop_column('user_feature_settings', 'enable_ghostwriter')
    op.drop_column('user_feature_settings', 'enable_ai_streaming')
