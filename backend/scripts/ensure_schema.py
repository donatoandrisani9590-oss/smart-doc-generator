"""
Ensure database schema is up to date.

This script adds any missing columns that newer code expects.
It's idempotent - safe to run multiple times.
Runs before app startup in production.
"""
import asyncio
import os
import sys

# Ensure app modules are importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text


def get_async_url(url: str) -> str:
    """Convert standard PostgreSQL URL to asyncpg URL."""
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


# Schema migrations: (table, column, column_type, default_value_or_None)
# All columns that migrations add to existing tables
REQUIRED_COLUMNS = [
    # From: add_brute_force_protection.py
    ("users", "failed_login_attempts", "INTEGER", "0"),
    ("users", "locked_until", "TIMESTAMPTZ", None),
    # From: User model (TOTP/2FA)
    ("users", "totp_secret", "VARCHAR(64)", None),
    ("users", "totp_enabled", "BOOLEAN", "false"),
    # From: User model (SSO)
    ("users", "sso_provider", "VARCHAR(50)", None),
    ("users", "sso_subject_id", "VARCHAR(255)", None),
    ("users", "display_name", "VARCHAR(255)", None),
    # From: add_din5008_settings.py
    ("design_settings", "margin_left_cm", "VARCHAR(10)", None),
    ("design_settings", "margin_right_cm", "VARCHAR(10)", None),
    ("design_settings", "margin_top_cm", "VARCHAR(10)", None),
    ("design_settings", "margin_bottom_cm", "VARCHAR(10)", None),
    ("design_settings", "header_distance_cm", "VARCHAR(10)", None),
    ("design_settings", "footer_distance_cm", "VARCHAR(10)", None),
    ("design_settings", "font_size_pt", "INTEGER", None),
    ("design_settings", "line_spacing", "VARCHAR(10)", None),
    ("design_settings", "logo_width_cm", "VARCHAR(10)", None),
    ("design_settings", "logo_position", "VARCHAR(20)", None),
    ("design_settings", "signatory_name", "VARCHAR(200)", None),
    # From: 004_add_ai_instructions.py
    ("design_settings", "ai_instructions", "TEXT", None),
    ("company_settings", "ai_instructions", "TEXT", None),
    ("document_types", "ai_instructions", "TEXT", None),
    # From: add_document_type_defaults.py
    ("document_types", "description", "TEXT", None),
    ("document_types", "default_probation_months", "INTEGER", None),
    ("document_types", "default_notice_period", "VARCHAR(100)", None),
    ("document_types", "default_vacation_days", "INTEGER", None),
    ("document_types", "default_weekly_hours", "INTEGER", None),
    # From: 003_add_clause_ai_metadata.py
    ("clauses", "tags", "JSONB", None),
    ("clauses", "description", "TEXT", None),
    ("clauses", "tone", "VARCHAR(50)", None),
    ("clauses", "user_id", "INTEGER", None),
    # From: 003_add_block_comments_and_document_approvals.py
    ("comments", "block_id", "VARCHAR(255)", None),
    ("comments", "selection_range", "TEXT", None),
    # From: Split-Screen Document Detail with HTML preview
    ("generated_documents", "content_html", "TEXT", None),
]

# Tables that need to be created if they don't exist
# From: 003_add_block_comments_and_document_approvals.py
CREATE_TABLES = [
    (
        "document_approvals",
        """
        CREATE TABLE IF NOT EXISTS document_approvals (
            id SERIAL PRIMARY KEY,
            document_id INTEGER REFERENCES generated_documents(id) ON DELETE CASCADE,
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            approver_id INTEGER REFERENCES users(id),
            requested_by_id INTEGER REFERENCES users(id),
            requested_at TIMESTAMPTZ DEFAULT NOW(),
            decided_at TIMESTAMPTZ,
            decision_comment TEXT,
            priority VARCHAR(20) DEFAULT 'normal',
            due_date TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
    ),
]


async def ensure_schema():
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        print("SCHEMA CHECK: No DATABASE_URL set, skipping.")
        return

    engine = create_async_engine(get_async_url(database_url), echo=False)
    changes_made = 0

    async with engine.begin() as conn:
        # 1. Create missing tables
        for table_name, create_sql in CREATE_TABLES:
            result = await conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = :table"
            ), {"table": table_name})
            if result.fetchone() is None:
                await conn.execute(text(create_sql))
                print(f"SCHEMA CHECK: Created table {table_name}")
                changes_made += 1
            else:
                print(f"SCHEMA CHECK: Table {table_name} already exists")

        # 2. Add missing columns to existing tables
        for table, column, col_type, default in REQUIRED_COLUMNS:
            # First check if the table exists
            table_result = await conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = :table"
            ), {"table": table})
            if table_result.fetchone() is None:
                print(f"SCHEMA CHECK: Table {table} does not exist, skipping {column}")
                continue

            # Check if column exists
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = :table AND column_name = :column"
            ), {"table": table, "column": column})

            if result.fetchone() is None:
                # Build ALTER TABLE statement
                default_clause = f" DEFAULT {default}" if default is not None else ""
                await conn.execute(text(
                    f'ALTER TABLE "{table}" ADD COLUMN "{column}" {col_type}{default_clause}'
                ))
                print(f"SCHEMA CHECK: Added {table}.{column} ({col_type})")
                changes_made += 1
            else:
                pass  # Column exists, no output needed for existing columns

    await engine.dispose()
    print(f"SCHEMA CHECK: Complete. {changes_made} changes made.")


if __name__ == "__main__":
    asyncio.run(ensure_schema())
