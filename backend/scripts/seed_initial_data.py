#!/usr/bin/env python3
"""
Database Seeding Script - Creates initial admin user and basic data.

Run this script after deploying to production to set up initial data:
    python scripts/seed_initial_data.py

Environment variables required:
    - DATABASE_URL: PostgreSQL connection string
    - ADMIN_EMAIL: Admin user email (default: admin@niederwieser.com)
    - ADMIN_PASSWORD: Admin user password (REQUIRED - no default for security)
"""

import asyncio
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db import async_session_factory, engine
from app.models.core import User, DesignSetting
from app.core.security import get_password_hash


async def seed_admin_user():
    """Create initial admin user if not exists."""
    admin_email = os.getenv("ADMIN_EMAIL", "admin@niederwieser.com")
    admin_password = os.getenv("ADMIN_PASSWORD")

    if not admin_password:
        print("ERROR: ADMIN_PASSWORD environment variable is required!")
        print("Set it with: export ADMIN_PASSWORD='your-secure-password'")
        return False

    async with async_session_factory() as session:
        # Check if admin already exists
        result = await session.execute(
            select(User).where(User.email == admin_email)
        )
        existing_user = result.scalar_one_or_none()

        if existing_user:
            print(f"Admin user '{admin_email}' already exists (ID: {existing_user.id})")
            return True

        # Create admin user
        admin_user = User(
            email=admin_email,
            password_hash=get_password_hash(admin_password),
            role="admin",
            country_code="DE",
            is_active=True,
        )
        session.add(admin_user)
        await session.commit()
        await session.refresh(admin_user)

        print(f"Created admin user: {admin_email} (ID: {admin_user.id})")
        return True


async def seed_design_settings():
    """Create default design settings for DE if not exists."""
    async with async_session_factory() as session:
        # Check if DE settings exist
        result = await session.execute(
            select(DesignSetting).where(DesignSetting.country_code == "DE")
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"Design settings for DE already exist (ID: {existing.id})")
            return True

        # Create default DE design settings
        de_settings = DesignSetting(
            country_code="DE",
            company_name="Niederwieser Flexible Food Packaging GmbH",
            header_line1="Niederwieser Flexible Food Packaging GmbH",
            header_line2="Musterstraße 123 • 12345 Musterstadt",
            header_line3="Tel: +49 123 456789 • info@niederwieser.com",
            footer_line1="Geschäftsführer: Max Mustermann",
            footer_line2="Amtsgericht Musterstadt HRB 12345",
            footer_line3="USt-IdNr.: DE123456789",
            font_family="Arial",
            primary_color="#243186",
            font_size_pt=11,
            line_spacing="1.15",
            margin_left_cm="2.5",
            margin_right_cm="2.0",
            margin_top_cm="2.5",
            margin_bottom_cm="2.0",
        )
        session.add(de_settings)
        await session.commit()
        await session.refresh(de_settings)

        print(f"Created design settings for DE (ID: {de_settings.id})")
        return True


async def main():
    """Run all seed functions."""
    print("=" * 60)
    print("Database Seeding Script")
    print("=" * 60)

    success = True

    # Seed admin user
    print("\n[1/2] Seeding admin user...")
    if not await seed_admin_user():
        success = False

    # Seed design settings
    print("\n[2/2] Seeding design settings...")
    if not await seed_design_settings():
        success = False

    print("\n" + "=" * 60)
    if success:
        print("Seeding completed successfully!")
    else:
        print("Seeding completed with errors.")
    print("=" * 60)

    return success


if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result else 1)
