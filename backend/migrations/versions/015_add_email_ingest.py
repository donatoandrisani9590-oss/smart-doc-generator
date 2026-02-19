"""Add email_ingests table and enable_email_ingest feature flag

Revision ID: 015
"""
from alembic import op
import sqlalchemy as sa

revision = "015_add_email_ingest"
down_revision = "014_add_legal_audit"
branch_labels = None
depends_on = None


def upgrade():
    # Create email_ingests table
    op.create_table(
        "email_ingests",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("from_email", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(500), nullable=True),
        sa.Column("body_text", sa.Text(), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("status", sa.String(20), nullable=False, server_default="processing"),
        sa.Column("extracted_data", sa.Text(), nullable=True),
        sa.Column("draft_ids", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_email_ingests_user_id", "email_ingests", ["user_id"])
    op.create_index("ix_email_ingests_status", "email_ingests", ["status"])

    # Add enable_email_ingest feature flag to user_feature_settings
    op.add_column(
        "user_feature_settings",
        sa.Column("enable_email_ingest", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade():
    op.drop_column("user_feature_settings", "enable_email_ingest")
    op.drop_table("email_ingests")
