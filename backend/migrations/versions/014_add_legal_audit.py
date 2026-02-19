"""Add legal audit infrastructure (Phase 6: Legal Watchdog)

Creates:
- clause_audit_results: Stores LLM-based and manual legal review results
- Adds legal_status and last_audited_at columns to clauses table

Revision ID: 014
"""
from alembic import op
import sqlalchemy as sa

revision = "014_add_legal_audit"
down_revision = "013_add_document_lifecycle"
branch_labels = None
depends_on = None


def upgrade():
    # --- New columns on clauses table ---
    op.add_column(
        "clauses",
        sa.Column("legal_status", sa.String(20), nullable=True, server_default="unchecked"),
    )
    op.add_column(
        "clauses",
        sa.Column("last_audited_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_clauses_legal_status", "clauses", ["legal_status"])

    # --- clause_audit_results table ---
    op.create_table(
        "clause_audit_results",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "clause_id",
            sa.Integer(),
            sa.ForeignKey("clauses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "audited_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("audited_by", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("risk_level", sa.String(20), nullable=False),
        sa.Column("reasoning", sa.Text(), nullable=True),
        sa.Column("affected_law", sa.String(200), nullable=True),
        sa.Column("suggestion", sa.Text(), nullable=True),
        sa.Column(
            "auto_fix_clause_id",
            sa.Integer(),
            sa.ForeignKey("clauses.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("is_resolved", sa.Boolean(), server_default=sa.false()),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "resolved_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_clause_audit_results_clause_id", "clause_audit_results", ["clause_id"])
    op.create_index("ix_clause_audit_results_status", "clause_audit_results", ["status"])
    op.create_index("ix_clause_audit_results_is_resolved", "clause_audit_results", ["is_resolved"])
    op.create_index("ix_clause_audit_results_risk_level", "clause_audit_results", ["risk_level"])
    op.create_index("ix_clause_audit_results_audited_at", "clause_audit_results", ["audited_at"])


def downgrade():
    op.drop_table("clause_audit_results")
    op.drop_index("ix_clauses_legal_status", "clauses")
    op.drop_column("clauses", "last_audited_at")
    op.drop_column("clauses", "legal_status")
