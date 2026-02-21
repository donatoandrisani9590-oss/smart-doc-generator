"""Add CASCADE deletes to clause ForeignKeys and index on document_type_clauses.clause_id

Revision ID: 019
"""
from alembic import op

revision = "019_cascade_index"
down_revision = "018_add_approval_groups"


def upgrade() -> None:
    # DocumentTypeClause.document_type_id → CASCADE
    op.drop_constraint("document_type_clauses_document_type_id_fkey", "document_type_clauses", type_="foreignkey")
    op.create_foreign_key("document_type_clauses_document_type_id_fkey", "document_type_clauses", "document_types", ["document_type_id"], ["id"], ondelete="CASCADE")

    # DocumentTypeClause.clause_id → CASCADE
    op.drop_constraint("document_type_clauses_clause_id_fkey", "document_type_clauses", type_="foreignkey")
    op.create_foreign_key("document_type_clauses_clause_id_fkey", "document_type_clauses", "clauses", ["clause_id"], ["id"], ondelete="CASCADE")

    # ClauseVariant.group_id → CASCADE
    op.drop_constraint("clause_variants_group_id_fkey", "clause_variants", type_="foreignkey")
    op.create_foreign_key("clause_variants_group_id_fkey", "clause_variants", "clause_variant_groups", ["group_id"], ["id"], ondelete="CASCADE")

    # ClauseVariant.clause_id → CASCADE
    op.drop_constraint("clause_variants_clause_id_fkey", "clause_variants", type_="foreignkey")
    op.create_foreign_key("clause_variants_clause_id_fkey", "clause_variants", "clauses", ["clause_id"], ["id"], ondelete="CASCADE")

    # ClauseVersion.clause_id → CASCADE
    op.drop_constraint("clause_versions_clause_id_fkey", "clause_versions", type_="foreignkey")
    op.create_foreign_key("clause_versions_clause_id_fkey", "clause_versions", "clauses", ["clause_id"], ["id"], ondelete="CASCADE")

    # ClauseNote.clause_id → CASCADE
    op.drop_constraint("clause_notes_clause_id_fkey", "clause_notes", type_="foreignkey")
    op.create_foreign_key("clause_notes_clause_id_fkey", "clause_notes", "clauses", ["clause_id"], ["id"], ondelete="CASCADE")

    # Add index for reverse lookups on DocumentTypeClause.clause_id
    op.create_index("ix_dtc_clause_id", "document_type_clauses", ["clause_id"])


def downgrade() -> None:
    op.drop_index("ix_dtc_clause_id", "document_type_clauses")
    # Revert CASCADE (drop and re-create without ondelete)
    for table, col, ref_table in [
        ("document_type_clauses", "document_type_id", "document_types"),
        ("document_type_clauses", "clause_id", "clauses"),
        ("clause_variants", "group_id", "clause_variant_groups"),
        ("clause_variants", "clause_id", "clauses"),
        ("clause_versions", "clause_id", "clauses"),
        ("clause_notes", "clause_id", "clauses"),
    ]:
        fk_name = f"{table}_{col}_fkey"
        op.drop_constraint(fk_name, table, type_="foreignkey")
        op.create_foreign_key(fk_name, table, ref_table, [col], ["id"])
