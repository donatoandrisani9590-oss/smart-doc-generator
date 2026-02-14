"""Add llm_call_logs table for LLM observability

Tracks all LLM API calls with provider, model, tokens, latency,
feature tag, and status for cost monitoring and debugging.

Revision ID: 005_add_llm_call_logs
Revises: 004_add_ai_instructions
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '005_add_llm_call_logs'
down_revision = '004_add_ai_instructions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'llm_call_logs',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('user_id', sa.String(255), nullable=True),
        sa.Column('feature', sa.String(50), nullable=False),
        sa.Column('provider', sa.String(20), nullable=False),
        sa.Column('model', sa.String(100), nullable=True),
        sa.Column('prompt_tokens', sa.Integer(), nullable=True, default=0),
        sa.Column('completion_tokens', sa.Integer(), nullable=True, default=0),
        sa.Column('total_tokens', sa.Integer(), nullable=True, default=0),
        sa.Column('latency_ms', sa.Integer(), nullable=True, default=0),
        sa.Column('status', sa.String(10), nullable=False, default='success'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('country_code', sa.String(2), nullable=True),
    )

    op.create_index('ix_llm_call_logs_created_at', 'llm_call_logs', ['created_at'])
    op.create_index('ix_llm_call_logs_user_id', 'llm_call_logs', ['user_id'])
    op.create_index('ix_llm_call_logs_feature', 'llm_call_logs', ['feature'])
    op.create_index('ix_llm_call_logs_provider', 'llm_call_logs', ['provider'])
    op.create_index('ix_llm_call_logs_status', 'llm_call_logs', ['status'])


def downgrade() -> None:
    op.drop_index('ix_llm_call_logs_status', 'llm_call_logs')
    op.drop_index('ix_llm_call_logs_provider', 'llm_call_logs')
    op.drop_index('ix_llm_call_logs_feature', 'llm_call_logs')
    op.drop_index('ix_llm_call_logs_user_id', 'llm_call_logs')
    op.drop_index('ix_llm_call_logs_created_at', 'llm_call_logs')
    op.drop_table('llm_call_logs')
