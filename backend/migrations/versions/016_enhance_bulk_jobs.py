"""Enhance bulk_jobs for smart bulk operations + add enable_bulk_operations feature flag

Revision ID: 016_enhance_bulk_jobs
Revises: 014_add_legal_audit
Create Date: 2026-02-19
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "016_enhance_bulk_jobs"
down_revision = "014_add_legal_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Add new columns to bulk_jobs ---
    op.add_column("bulk_jobs", sa.Column("document_type_id", sa.Integer(), sa.ForeignKey("document_types.id"), nullable=True))
    op.add_column("bulk_jobs", sa.Column("source_filename", sa.String(255), nullable=True))
    op.add_column("bulk_jobs", sa.Column("column_mapping", sa.Text(), nullable=True))
    op.add_column("bulk_jobs", sa.Column("successful_rows", sa.Integer(), server_default="0"))
    op.add_column("bulk_jobs", sa.Column("failed_rows", sa.Integer(), server_default="0"))
    op.add_column("bulk_jobs", sa.Column("draft_ids", sa.Text(), nullable=True))
    op.add_column("bulk_jobs", sa.Column("errors", sa.Text(), nullable=True))
    op.add_column("bulk_jobs", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))

    op.create_index("ix_bulk_jobs_document_type_id", "bulk_jobs", ["document_type_id"])

    # --- Add enable_bulk_operations to user_feature_settings ---
    op.add_column(
        "user_feature_settings",
        sa.Column("enable_bulk_operations", sa.Boolean(), server_default="true", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("user_feature_settings", "enable_bulk_operations")

    op.drop_index("ix_bulk_jobs_document_type_id", table_name="bulk_jobs")
    op.drop_column("bulk_jobs", "completed_at")
    op.drop_column("bulk_jobs", "errors")
    op.drop_column("bulk_jobs", "draft_ids")
    op.drop_column("bulk_jobs", "failed_rows")
    op.drop_column("bulk_jobs", "successful_rows")
    op.drop_column("bulk_jobs", "column_mapping")
    op.drop_column("bulk_jobs", "source_filename")
    op.drop_column("bulk_jobs", "document_type_id")
