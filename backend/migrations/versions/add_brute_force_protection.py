"""Add brute-force protection fields to users table

Security Hardening Phase 2 (SEC-017):
Adds failed_login_attempts and locked_until columns to track and
prevent brute-force attacks on user accounts.

Revision ID: add_brute_force_001
Revises: add_doctype_defaults
Create Date: 2026-02-07

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_brute_force_001'
down_revision = 'add_doctype_defaults'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add brute-force protection columns
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # Remove brute-force protection columns
    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'failed_login_attempts')
