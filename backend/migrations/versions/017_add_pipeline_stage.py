"""
Add pipeline_stage column to generated_documents.

Adds a granular lifecycle stage for Kanban board display.
Backfills existing documents by deriving stage from DocumentAction history.

Stages: entwurf, freigabe, versendet, ruecklauf, abgeschlossen, archiv
"""

from alembic import op
import sqlalchemy as sa


# Revision identifiers
revision = "017_add_pipeline_stage"
down_revision = "016_enhance_bulk_jobs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add column with default
    op.add_column(
        "generated_documents",
        sa.Column("pipeline_stage", sa.String(30), nullable=False, server_default="entwurf"),
    )
    op.create_index(
        "ix_generated_documents_pipeline_stage",
        "generated_documents",
        ["pipeline_stage"],
    )

    # 2. Backfill pipeline_stage from DocumentAction history
    # Priority order (highest first):
    #   is_archived → archiv
    #   last action completed/returned → abgeschlossen
    #   open return_pending → ruecklauf
    #   sent (no return_pending/completed after) → versendet
    #   open approval_requested → freigabe
    #   else → entwurf
    conn = op.get_bind()

    # Archived documents → archiv
    conn.execute(sa.text("""
        UPDATE generated_documents
        SET pipeline_stage = 'archiv'
        WHERE is_archived = TRUE
    """))

    # Last action completed/returned → abgeschlossen (not archived)
    conn.execute(sa.text("""
        UPDATE generated_documents
        SET pipeline_stage = 'abgeschlossen'
        WHERE is_archived = FALSE
          AND id IN (
            SELECT da.document_id
            FROM document_actions da
            WHERE da.id = (
                SELECT da2.id FROM document_actions da2
                WHERE da2.document_id = da.document_id
                ORDER BY da2.performed_at DESC
                LIMIT 1
            )
            AND da.action_type IN ('completed', 'returned')
          )
    """))

    # Open return_pending → ruecklauf
    conn.execute(sa.text("""
        UPDATE generated_documents
        SET pipeline_stage = 'ruecklauf'
        WHERE pipeline_stage = 'entwurf'
          AND is_archived = FALSE
          AND id IN (
            SELECT DISTINCT document_id FROM document_actions
            WHERE action_type = 'return_pending' AND is_completed = FALSE
          )
    """))

    # Sent → versendet (not already ruecklauf/abgeschlossen/archiv)
    conn.execute(sa.text("""
        UPDATE generated_documents
        SET pipeline_stage = 'versendet'
        WHERE pipeline_stage = 'entwurf'
          AND is_archived = FALSE
          AND id IN (
            SELECT DISTINCT document_id FROM document_actions
            WHERE action_type = 'sent'
          )
    """))

    # Open approval_requested → freigabe
    conn.execute(sa.text("""
        UPDATE generated_documents
        SET pipeline_stage = 'freigabe'
        WHERE pipeline_stage = 'entwurf'
          AND is_archived = FALSE
          AND id IN (
            SELECT DISTINCT document_id FROM document_actions
            WHERE action_type = 'approval_requested' AND is_completed = FALSE
          )
    """))

    # Remaining documents stay at 'entwurf' (the default)


def downgrade() -> None:
    op.drop_index("ix_generated_documents_pipeline_stage", table_name="generated_documents")
    op.drop_column("generated_documents", "pipeline_stage")
