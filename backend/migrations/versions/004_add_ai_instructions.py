"""Add AI instructions fields to design_settings and document_types

Enables user-configurable AI behavior through custom instructions:
- design_settings.ai_instructions: Global instructions applied to ALL LLM prompts
  (e.g. "Use Austrian labor law", "Always use formal 'Sie'")
- document_types.ai_instructions: Document-type-specific instructions
  (e.g. "Use collective agreement wording for employment contracts")

Both fields are combined and injected into system prompts for:
- Compliance scanner
- Clause AI selection
- Chat assistant
- Smart mode extraction
- Document upload extraction

Revision ID: 004_add_ai_instructions
Revises: 003_add_clause_ai_metadata
Create Date: 2026-02-08

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004_add_ai_instructions'
down_revision = '003_add_clause_ai_metadata'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Global AI instructions on CompanySettings (per country)
    op.add_column('company_settings', sa.Column(
        'ai_instructions', sa.Text(), nullable=True,
        comment='Global AI instructions applied to all LLM prompts for this country'
    ))

    # Global AI instructions on DesignSetting (per country, backup location)
    op.add_column('design_settings', sa.Column(
        'ai_instructions', sa.Text(), nullable=True,
        comment='Global AI instructions applied to all LLM prompts for this country'
    ))

    # Document-type-specific AI instructions
    op.add_column('document_types', sa.Column(
        'ai_instructions', sa.Text(), nullable=True,
        comment='AI instructions specific to this document type, supplements global instructions'
    ))


def downgrade() -> None:
    op.drop_column('document_types', 'ai_instructions')
    op.drop_column('design_settings', 'ai_instructions')
    op.drop_column('company_settings', 'ai_instructions')
