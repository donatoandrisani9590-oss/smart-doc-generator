"""Add DIN 5008 document format settings to design_settings

Revision ID: add_din5008_settings
Revises: fix_user_id_types_and_fks
Create Date: 2026-01-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_din5008_settings'
down_revision = '001_smart_ux_composer'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add DIN 5008 page margin settings
    op.add_column('design_settings', sa.Column('margin_left_cm', sa.String(10), server_default='2.5'))
    op.add_column('design_settings', sa.Column('margin_right_cm', sa.String(10), server_default='2.0'))
    op.add_column('design_settings', sa.Column('margin_top_cm', sa.String(10), server_default='2.5'))
    op.add_column('design_settings', sa.Column('margin_bottom_cm', sa.String(10), server_default='2.0'))
    op.add_column('design_settings', sa.Column('header_distance_cm', sa.String(10), server_default='1.25'))
    op.add_column('design_settings', sa.Column('footer_distance_cm', sa.String(10), server_default='1.0'))

    # Add typography settings
    op.add_column('design_settings', sa.Column('font_size_pt', sa.Integer(), server_default='11'))
    op.add_column('design_settings', sa.Column('line_spacing', sa.String(10), server_default='1.15'))

    # Add logo settings
    op.add_column('design_settings', sa.Column('logo_width_cm', sa.String(10), server_default='5.0'))
    op.add_column('design_settings', sa.Column('logo_position', sa.String(20), server_default='right'))

    # Add signatory
    op.add_column('design_settings', sa.Column('signatory_name', sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column('design_settings', 'signatory_name')
    op.drop_column('design_settings', 'logo_position')
    op.drop_column('design_settings', 'logo_width_cm')
    op.drop_column('design_settings', 'line_spacing')
    op.drop_column('design_settings', 'font_size_pt')
    op.drop_column('design_settings', 'footer_distance_cm')
    op.drop_column('design_settings', 'header_distance_cm')
    op.drop_column('design_settings', 'margin_bottom_cm')
    op.drop_column('design_settings', 'margin_top_cm')
    op.drop_column('design_settings', 'margin_right_cm')
    op.drop_column('design_settings', 'margin_left_cm')
