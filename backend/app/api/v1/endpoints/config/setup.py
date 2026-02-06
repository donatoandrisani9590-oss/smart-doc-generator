"""
Initial Setup API endpoints.

These endpoints are only available when no admin user exists in the database.
Used for first-time setup after deployment.
"""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr

from app.db import get_db
from app.models.core import User, DesignSetting
from app.core.security import get_password_hash

router = APIRouter()


class SetupStatus(BaseModel):
    """Status of the system setup."""
    setup_required: bool
    has_admin: bool
    has_design_settings: bool


class InitialAdminCreate(BaseModel):
    """Schema for creating the initial admin user."""
    email: EmailStr
    password: str
    company_name: str = "Niederwieser Flexible Food Packaging GmbH"


class SetupResponse(BaseModel):
    """Response after successful setup."""
    message: str
    admin_email: str
    admin_id: int


@router.get("/status", response_model=SetupStatus)
async def get_setup_status(
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    Check if initial setup is required.

    Returns whether the system needs initial configuration.
    This endpoint is always public.
    """
    # Check for any admin user
    admin_query = select(func.count(User.id)).where(User.role == "admin")
    admin_result = await db.execute(admin_query)
    admin_count = admin_result.scalar() or 0

    # Check for design settings
    settings_query = select(func.count(DesignSetting.id))
    settings_result = await db.execute(settings_query)
    settings_count = settings_result.scalar() or 0

    return SetupStatus(
        setup_required=admin_count == 0,
        has_admin=admin_count > 0,
        has_design_settings=settings_count > 0,
    )


@router.post("/initialize", response_model=SetupResponse)
async def initialize_system(
    setup_data: InitialAdminCreate,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    Initialize the system with the first admin user.

    This endpoint is ONLY available when no admin user exists.
    After the first admin is created, this endpoint becomes disabled.

    Creates:
    - Initial admin user
    - Default design settings for DE
    """
    # Security check: Only allow if no admin exists
    admin_query = select(func.count(User.id)).where(User.role == "admin")
    admin_result = await db.execute(admin_query)
    admin_count = admin_result.scalar() or 0

    if admin_count > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System already initialized. Use admin panel to manage users."
        )

    # Validate password
    if len(setup_data.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long"
        )

    # Check if email already exists
    existing_query = select(User).where(User.email == setup_data.email.lower())
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists"
        )

    # Create admin user
    admin_user = User(
        email=setup_data.email.lower(),
        password_hash=get_password_hash(setup_data.password),
        role="admin",
        country_code="DE",
        is_active=True,
    )
    db.add(admin_user)

    # Create default design settings if not exists
    settings_query = select(DesignSetting).where(DesignSetting.country_code == "DE")
    settings_result = await db.execute(settings_query)
    if not settings_result.scalar_one_or_none():
        de_settings = DesignSetting(
            country_code="DE",
            company_name=setup_data.company_name,
            header_line1=setup_data.company_name,
            header_line2="",
            header_line3="",
            footer_line1="",
            footer_line2="",
            footer_line3="",
            font_family="Arial",
            primary_color="#243186",
            font_size_pt=11,
            line_spacing="1.15",
            margin_left_cm="2.5",
            margin_right_cm="2.0",
            margin_top_cm="2.5",
            margin_bottom_cm="2.0",
        )
        db.add(de_settings)

    await db.commit()
    await db.refresh(admin_user)

    return SetupResponse(
        message="System initialized successfully. You can now log in.",
        admin_email=admin_user.email,
        admin_id=admin_user.id,
    )


@router.post("/migrate-schema")
async def migrate_schema(
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    Add missing columns to existing database tables.

    This endpoint runs schema migrations for:
    - document_types: custom header/footer/logo columns

    Safe to run multiple times (uses IF NOT EXISTS).
    """
    from sqlalchemy import text

    migrations = []
    errors = []

    # document_types table - custom header/footer/logo columns
    document_type_columns = [
        ("custom_header_enabled", "BOOLEAN DEFAULT FALSE"),
        ("custom_header_line1", "TEXT"),
        ("custom_header_line2", "TEXT"),
        ("custom_header_line3", "TEXT"),
        ("custom_footer_enabled", "BOOLEAN DEFAULT FALSE"),
        ("custom_footer_line1", "TEXT"),
        ("custom_footer_line2", "TEXT"),
        ("custom_footer_line3", "TEXT"),
        ("custom_logo_enabled", "BOOLEAN DEFAULT FALSE"),
        ("custom_logo_path", "VARCHAR"),
        ("custom_logo_position", "VARCHAR(20)"),
        ("custom_logo_width_cm", "VARCHAR(10)"),
        ("custom_margin_left_cm", "VARCHAR(10)"),
        ("custom_margin_right_cm", "VARCHAR(10)"),
        ("custom_margin_top_cm", "VARCHAR(10)"),
        ("custom_margin_bottom_cm", "VARCHAR(10)"),
        ("source_template_id", "INTEGER REFERENCES document_types(id) ON DELETE SET NULL"),
        ("team_id", "INTEGER REFERENCES teams(id) ON DELETE SET NULL"),
        ("visibility", "VARCHAR(20) DEFAULT 'global'"),
        ("created_by_user_id", "INTEGER REFERENCES users(id) ON DELETE SET NULL"),
        ("created_at", "TIMESTAMP WITH TIME ZONE DEFAULT NOW()"),
    ]

    for col_name, col_type in document_type_columns:
        try:
            # Check if column exists
            check_sql = text(f"""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'document_types' AND column_name = '{col_name}'
            """)
            result = await db.execute(check_sql)
            if not result.fetchone():
                # Column doesn't exist, add it
                alter_sql = text(f"ALTER TABLE document_types ADD COLUMN {col_name} {col_type}")
                await db.execute(alter_sql)
                migrations.append(f"Added column document_types.{col_name}")
        except Exception as e:
            errors.append(f"Failed to add document_types.{col_name}: {str(e)}")

    await db.commit()

    return {
        "status": "completed",
        "migrations_applied": migrations,
        "errors": errors,
        "total_migrations": len(migrations),
        "total_errors": len(errors)
    }
