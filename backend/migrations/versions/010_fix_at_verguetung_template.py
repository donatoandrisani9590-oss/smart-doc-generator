"""Fix AT-Vergütung clause template: remove duplicate euro sign from [gehalt] placeholder.

The template had `[gehalt]&nbsp;&euro;` but format_currency_localized() already
appends ' €' to the formatted value, resulting in '60.000,00 € €'.
"""

from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"


def upgrade():
    # Fix the AT-Vergütung clause content_html: remove &nbsp;&euro; after [gehalt]
    op.execute(
        sa.text("""
            UPDATE clauses
            SET content_html = REPLACE(
                content_html,
                '[gehalt]&nbsp;&euro;</strong>',
                '[gehalt]</strong>'
            )
            WHERE content_html LIKE '%[gehalt]&nbsp;&euro;%'
        """)
    )


def downgrade():
    # Revert: add back &nbsp;&euro; after [gehalt]
    op.execute(
        sa.text("""
            UPDATE clauses
            SET content_html = REPLACE(
                content_html,
                '[gehalt]</strong>',
                '[gehalt]&nbsp;&euro;</strong>'
            )
            WHERE content_html LIKE '%[gehalt]</strong>%'
              AND content_html LIKE '%Bruttofestgehalt%'
        """)
    )
