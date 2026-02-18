"""Add onboarding agent feature flag

Revision ID: 012
"""
from alembic import op
import sqlalchemy as sa

revision = "012_add_onboarding_agent_flag"
down_revision = "011_add_onboarding_jobs"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("user_feature_settings",
        sa.Column("enable_onboarding_agent", sa.Boolean(), nullable=False, server_default=sa.true()))

def downgrade():
    op.drop_column("user_feature_settings", "enable_onboarding_agent")
