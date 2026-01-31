"""Add document_type_variant_groups table for linking variant groups to document types

v4.2 UX-Verbesserung: Varianten-Gruppen können Dokumenttypen zugeordnet werden.
- Ermöglicht Zuordnung über DocumentTypeEditor
- Ermöglicht Bulk-Zuordnung über ClauseVariantManager
- Standard-Variante kann pro Dokumenttyp festgelegt werden

Revision ID: add_doctype_variant_groups
Revises: add_doctype_defaults
Create Date: 2025-01-28

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_doctype_variant_groups'
down_revision = 'add_doctype_defaults'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Neue Verknüpfungstabelle für DocumentType <-> ClauseVariantGroup
    op.create_table(
        'document_type_variant_groups',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('document_type_id', sa.Integer(), sa.ForeignKey('document_types.id', ondelete='CASCADE'), nullable=False),
        sa.Column('variant_group_id', sa.Integer(), sa.ForeignKey('clause_variant_groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('is_mandatory', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('default_variant_id', sa.Integer(), sa.ForeignKey('clause_variants.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.UniqueConstraint('document_type_id', 'variant_group_id', name='uq_doctype_variantgroup'),
    )

    # Index für schnelle Abfragen
    op.create_index(
        'ix_document_type_variant_groups_document_type_id',
        'document_type_variant_groups',
        ['document_type_id']
    )
    op.create_index(
        'ix_document_type_variant_groups_variant_group_id',
        'document_type_variant_groups',
        ['variant_group_id']
    )


def downgrade() -> None:
    # Indizes entfernen
    op.drop_index('ix_document_type_variant_groups_variant_group_id', table_name='document_type_variant_groups')
    op.drop_index('ix_document_type_variant_groups_document_type_id', table_name='document_type_variant_groups')

    # Tabelle entfernen
    op.drop_table('document_type_variant_groups')
