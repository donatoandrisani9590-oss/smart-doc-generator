"""Add stationery fields to user_templates (Blanko-Briefpapier Phase 1)

Erweitert user_templates um:
- template_type: Unterscheidung zwischen 'stationery' (Briefpapier) und 'content' (Inhaltsvorlage)
- is_default: Markiert die Standard-Vorlage pro Land/Kategorie
- thumbnail_path: Pfad zum generierten PNG-Thumbnail

Bestehende Datensaetze werden auf template_type='content' gesetzt (Rueckwaertskompatibilitaet).

Revision ID: add_stationery_fields
Revises: 004_add_ai_instructions
Create Date: 2026-02-11

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_stationery_fields'
down_revision = '004_add_ai_instructions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Neue Spalten fuer Briefpapier-Feature
    op.add_column('user_templates', sa.Column(
        'template_type', sa.String(20), nullable=False,
        server_default='stationery',
    ))
    op.add_column('user_templates', sa.Column(
        'is_default', sa.Boolean(), nullable=False,
        server_default='false',
    ))
    op.add_column('user_templates', sa.Column(
        'thumbnail_path', sa.String(500), nullable=True,
    ))

    # Index fuer schnelle Filterung nach template_type
    op.create_index('ix_user_templates_template_type', 'user_templates', ['template_type'])

    # Bestehende Datensaetze auf 'content' setzen (Rueckwaertskompatibilitaet)
    op.execute("UPDATE user_templates SET template_type = 'content' WHERE template_type = 'stationery'")


def downgrade() -> None:
    op.drop_index('ix_user_templates_template_type', table_name='user_templates')
    op.drop_column('user_templates', 'thumbnail_path')
    op.drop_column('user_templates', 'is_default')
    op.drop_column('user_templates', 'template_type')
