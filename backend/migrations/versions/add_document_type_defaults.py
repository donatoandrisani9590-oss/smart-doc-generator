"""Add default values columns to document_types table

v4.2 UX-Verbesserung: Standardwerte werden pro Dokumenttyp definiert,
nicht mehr global in den Stammdaten.

Revision ID: add_doctype_defaults
Revises: fix_user_id_types_and_fks
Create Date: 2025-01-26

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_doctype_defaults'
down_revision = 'fix_user_id_types_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Neue Spalten für Dokumenttyp-Standardwerte
    op.add_column('document_types', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('document_types', sa.Column('default_probation_months', sa.Integer(), nullable=True, server_default='6'))
    op.add_column('document_types', sa.Column('default_notice_period', sa.String(100), nullable=True, server_default='4 Wochen zum Monatsende'))
    op.add_column('document_types', sa.Column('default_vacation_days', sa.Integer(), nullable=True, server_default='30'))
    op.add_column('document_types', sa.Column('default_weekly_hours', sa.Integer(), nullable=True, server_default='40'))


def downgrade() -> None:
    # Entferne die neuen Spalten
    op.drop_column('document_types', 'default_weekly_hours')
    op.drop_column('document_types', 'default_vacation_days')
    op.drop_column('document_types', 'default_notice_period')
    op.drop_column('document_types', 'default_probation_months')
    op.drop_column('document_types', 'description')
