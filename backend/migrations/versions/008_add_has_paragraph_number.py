"""Add has_paragraph_number to clauses for dynamic §-numbering.

Textbausteine können jetzt als "Paragraf" (mit §-Nummer, für Verträge)
oder als "Textblock" (ohne §, für Schreiben wie Abmahnungen) markiert werden.

Revision ID: 008_add_has_paragraph_number
Revises: 007_add_document_type_updated_at
Create Date: 2026-02-16
"""
from alembic import op
import sqlalchemy as sa
import re


revision = '008_add_has_paragraph_number'
down_revision = '007_add_document_type_updated_at'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add has_paragraph_number column (default True for existing contract clauses)
    op.add_column(
        'clauses',
        sa.Column('has_paragraph_number', sa.Boolean(), nullable=False, server_default=sa.text('true'))
    )

    # 2. Strip hardcoded § prefixes from title and content_html
    # Pattern: "§ 1 " or "§ 14 " at the start of title/content
    conn = op.get_bind()

    # Strip § prefix from titles (e.g., "§ 1 Beginn und Dauer" → "Beginn und Dauer")
    conn.execute(sa.text("""
        UPDATE clauses
        SET title = REGEXP_REPLACE(title, '^§\s*\d+\s+', '')
        WHERE title ~ '^§\s*\d+'
    """))

    # Strip § prefix from content_html first paragraph/heading
    # Pattern: content starts with "§ X Title" inside HTML tags
    conn.execute(sa.text("""
        UPDATE clauses
        SET content_html = REGEXP_REPLACE(content_html, '§\s*\d+\s+', '', 'g')
        WHERE content_html ~ '§\s*\d+'
    """))


def downgrade() -> None:
    op.drop_column('clauses', 'has_paragraph_number')
