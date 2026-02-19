"""Add document lifecycle management tables (Phase 3)

Creates:
- document_actions: Event log for document status changes
- guest_review_links: Secure external review tokens
- guest_review_comments: Guest feedback on documents
- Adds workflow_status, has_open_actions, next_due_date to generated_documents

Revision ID: 013
"""
from alembic import op
import sqlalchemy as sa

revision = "013_add_document_lifecycle"
down_revision = "012_add_onboarding_agent_flag"
branch_labels = None
depends_on = None


def upgrade():
    # --- Denormalized lifecycle fields on generated_documents ---
    op.add_column("generated_documents",
        sa.Column("workflow_status", sa.String(30), nullable=False, server_default="erstellt"))
    op.add_column("generated_documents",
        sa.Column("has_open_actions", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("generated_documents",
        sa.Column("next_due_date", sa.DateTime(timezone=True), nullable=True))

    op.create_index("ix_generated_documents_workflow_status", "generated_documents", ["workflow_status"])
    op.create_index("ix_generated_documents_has_open_actions", "generated_documents", ["has_open_actions"])
    op.create_index("ix_generated_documents_next_due_date", "generated_documents", ["next_due_date"])

    # --- document_actions table ---
    op.create_table(
        "document_actions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("generated_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action_type", sa.String(30), nullable=False),
        sa.Column("performed_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("performed_by_name", sa.String(255), nullable=True),
        sa.Column("performed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_completed", sa.Boolean(), server_default=sa.false()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_document_actions_document_id", "document_actions", ["document_id"])
    op.create_index("ix_document_actions_action_type", "document_actions", ["action_type"])
    op.create_index("ix_document_actions_performed_at", "document_actions", ["performed_at"])
    op.create_index("ix_document_actions_due_date", "document_actions", ["due_date"])

    # --- guest_review_links table ---
    op.create_table(
        "guest_review_links",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("generated_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(64), unique=True, nullable=False),
        sa.Column("recipient_name", sa.String(255), nullable=False),
        sa.Column("recipient_email", sa.String(255), nullable=True),
        sa.Column("permissions", sa.String(30), nullable=False, server_default="comment_only"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_guest_review_links_document_id", "guest_review_links", ["document_id"])
    op.create_index("ix_guest_review_links_token", "guest_review_links", ["token"])
    op.create_index("ix_guest_review_links_is_active", "guest_review_links", ["is_active"])

    # --- guest_review_comments table ---
    op.create_table(
        "guest_review_comments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("link_id", sa.Integer(), sa.ForeignKey("guest_review_links.id", ondelete="CASCADE"), nullable=False),
        sa.Column("guest_name", sa.String(255), nullable=False),
        sa.Column("comment_type", sa.String(20), nullable=False, server_default="comment"),
        sa.Column("target_clause_id", sa.Integer(), nullable=True),
        sa.Column("target_text", sa.Text(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("suggested_replacement", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("resolved_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_guest_review_comments_link_id", "guest_review_comments", ["link_id"])
    op.create_index("ix_guest_review_comments_status", "guest_review_comments", ["status"])


def downgrade():
    op.drop_table("guest_review_comments")
    op.drop_table("guest_review_links")
    op.drop_table("document_actions")

    op.drop_index("ix_generated_documents_next_due_date", "generated_documents")
    op.drop_index("ix_generated_documents_has_open_actions", "generated_documents")
    op.drop_index("ix_generated_documents_workflow_status", "generated_documents")

    op.drop_column("generated_documents", "next_due_date")
    op.drop_column("generated_documents", "has_open_actions")
    op.drop_column("generated_documents", "workflow_status")
