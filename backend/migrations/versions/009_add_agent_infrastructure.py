"""Add agent infrastructure: Team.ai_instructions, Clause AI fields, TeamPattern table"""

from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"


def upgrade():
    # 1. Team: ai_instructions
    op.add_column("teams", sa.Column("ai_instructions", sa.Text(), nullable=True))

    # 2. Clause: KI-Generierungs-Metadaten
    op.add_column("clauses", sa.Column("is_ai_generated", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("clauses", sa.Column("ai_generation_context", sa.Text(), nullable=True))

    # 3. TeamPattern table
    op.create_table(
        "team_patterns",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("document_type_id", sa.Integer(), sa.ForeignKey("document_types.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field_defaults", sa.Text(), nullable=True),
        sa.Column("common_clause_ids", sa.Text(), nullable=True),
        sa.Column("sample_size", sa.Integer(), default=0),
        sa.Column("calculated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("team_id", "document_type_id", name="uq_team_pattern_team_doctype"),
    )


def downgrade():
    op.drop_table("team_patterns")
    op.drop_column("clauses", "ai_generation_context")
    op.drop_column("clauses", "is_ai_generated")
    op.drop_column("teams", "ai_instructions")
