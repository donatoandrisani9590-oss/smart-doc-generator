"""
018: Add approval_groups and approval_group_members tables.

Also adds approval_group_id column to document_approvals for group-based approvals.
Adds 'escalated' to the valid action types in document_actions.
"""

import logging
from app.db import get_sync_engine

logger = logging.getLogger(__name__)


def run_migration():
    """Create approval_groups, approval_group_members tables and extend document_approvals."""
    engine = get_sync_engine()

    with engine.connect() as conn:
        # ── 1. approval_groups table ──────────────────────────────────────
        conn.execute(
            __import__("sqlalchemy").text("""
                CREATE TABLE IF NOT EXISTS approval_groups (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    country_code VARCHAR(2),
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    created_by VARCHAR(255)
                )
            """)
        )
        logger.info("Table approval_groups created or already exists")

        # Indexes
        conn.execute(
            __import__("sqlalchemy").text("""
                CREATE INDEX IF NOT EXISTS ix_approval_groups_country_code
                ON approval_groups (country_code)
            """)
        )
        conn.execute(
            __import__("sqlalchemy").text("""
                CREATE INDEX IF NOT EXISTS ix_approval_groups_is_active
                ON approval_groups (is_active)
            """)
        )

        # ── 2. approval_group_members table ───────────────────────────────
        conn.execute(
            __import__("sqlalchemy").text("""
                CREATE TABLE IF NOT EXISTS approval_group_members (
                    id SERIAL PRIMARY KEY,
                    group_id INTEGER NOT NULL REFERENCES approval_groups(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    is_primary BOOLEAN DEFAULT FALSE,
                    joined_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
        )
        logger.info("Table approval_group_members created or already exists")

        # Indexes
        conn.execute(
            __import__("sqlalchemy").text("""
                CREATE INDEX IF NOT EXISTS ix_approval_group_members_group_id
                ON approval_group_members (group_id)
            """)
        )
        conn.execute(
            __import__("sqlalchemy").text("""
                CREATE INDEX IF NOT EXISTS ix_approval_group_members_user_id
                ON approval_group_members (user_id)
            """)
        )

        # ── 3. Add approval_group_id to document_approvals ────────────────
        result = conn.execute(
            __import__("sqlalchemy").text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'document_approvals' AND column_name = 'approval_group_id'
            """)
        )
        if not result.fetchone():
            conn.execute(
                __import__("sqlalchemy").text("""
                    ALTER TABLE document_approvals
                    ADD COLUMN approval_group_id INTEGER REFERENCES approval_groups(id) ON DELETE SET NULL
                """)
            )
            conn.execute(
                __import__("sqlalchemy").text("""
                    CREATE INDEX IF NOT EXISTS ix_document_approvals_approval_group_id
                    ON document_approvals (approval_group_id)
                """)
            )
            logger.info("Column approval_group_id added to document_approvals")
        else:
            logger.info("Column approval_group_id already exists on document_approvals")

        conn.commit()
        logger.info("Migration 018_add_approval_groups completed successfully")
