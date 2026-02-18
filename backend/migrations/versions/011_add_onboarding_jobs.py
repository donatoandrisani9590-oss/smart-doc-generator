"""Add onboarding_jobs table

Revision ID: 011
"""
from alembic import op
import sqlalchemy as sa

revision = "011_add_onboarding_jobs"
down_revision = "010_fix_at_verguetung_template"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "onboarding_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("package_key", sa.String(50), nullable=False),
        sa.Column("employee_name", sa.String(255), nullable=True),
        sa.Column("country_code", sa.String(2), nullable=False, server_default="DE"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending", index=True),
        sa.Column("input_data", sa.Text(), nullable=True),
        sa.Column("draft_ids", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

def downgrade():
    op.drop_table("onboarding_jobs")
