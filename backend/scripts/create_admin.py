#!/usr/bin/env python3
"""
Create Admin User Script

Creates an admin user for the Smart Document Generator.

Usage:
    python scripts/create_admin.py
    # Or via Docker:
    docker compose exec web python scripts/create_admin.py
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db import get_db
from app.models.core import User
from app.core.security import get_password_hash
from sqlalchemy import select


async def create_admin():
    """Create admin user interactively."""
    print("━" * 60)
    print("  Smart Document Generator - Admin User Creation")
    print("━" * 60)
    print()

    # Get user input
    email = input("Admin Email [admin@example.com]: ").strip() or "admin@example.com"
    password = input("Admin Password [changeme123]: ").strip() or "changeme123"
    country = input("Country Code [DE]: ").strip().upper() or "DE"

    if country not in ["DE", "IT"]:
        print(f"❌ Invalid country code: {country}. Using DE.")
        country = "DE"

    print()
    print("Creating admin user with:")
    print(f"  Email: {email}")
    print(f"  Password: {'*' * len(password)}")
    print(f"  Country: {country}")
    print()

    confirm = input("Continue? [Y/n]: ").strip().lower()
    if confirm and confirm != 'y':
        print("Cancelled.")
        return

    # Create admin
    async for db in get_db():
        try:
            # Check if user already exists
            result = await db.execute(select(User).where(User.email == email))
            existing = result.scalar_one_or_none()

            if existing:
                print(f"⚠️  User {email} already exists!")
                update = input("Update password? [y/N]: ").strip().lower()
                if update == 'y':
                    existing.password_hash = get_password_hash(password)
                    existing.role = 'admin'
                    existing.is_active = True
                    existing.failed_login_attempts = 0
                    existing.locked_until = None
                    await db.commit()
                    print(f"✅ Updated user: {email}")
                else:
                    print("Skipped.")
                return

            # Create new admin
            admin = User(
                email=email,
                password_hash=get_password_hash(password),
                role='admin',
                country_code=country,
                is_active=True,
                failed_login_attempts=0,
                locked_until=None
            )
            db.add(admin)
            await db.commit()
            await db.refresh(admin)

            print()
            print("━" * 60)
            print("✅ Admin user created successfully!")
            print("━" * 60)
            print()
            print(f"  ID:      {admin.id}")
            print(f"  Email:   {admin.email}")
            print(f"  Role:    {admin.role}")
            print(f"  Country: {admin.country_code}")
            print(f"  Active:  {admin.is_active}")
            print()
            print("You can now login with these credentials.")
            print()
            print("⚠️  IMPORTANT: Change the password after first login!")
            print()

        except Exception as e:
            print(f"❌ Error: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(create_admin())
