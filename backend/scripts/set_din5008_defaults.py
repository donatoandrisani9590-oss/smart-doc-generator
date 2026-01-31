"""
Set DIN 5008 defaults for DE and IT design settings.

Run with: python -m scripts.set_din5008_defaults
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, update
from app.db import async_session_maker
from app.models.core import DesignSetting


# DIN 5008 Standard values for professional German business documents
DIN_5008_DEFAULTS = {
    # Page margins (cm)
    "margin_left_cm": "2.5",      # Min 2.5 cm for binding
    "margin_right_cm": "2.0",     # Min 1.0 cm, 2.0 for readability
    "margin_top_cm": "2.5",       # Professional top margin
    "margin_bottom_cm": "2.0",    # Space for page numbers
    "header_distance_cm": "1.25", # Header distance from top
    "footer_distance_cm": "1.0",  # Footer distance from bottom

    # Typography
    "font_size_pt": 11,           # 11pt for readability
    "line_spacing": "1.15",       # Comfortable line spacing

    # Logo
    "logo_width_cm": "5.0",       # Professional, not too dominant
    "logo_position": "right",     # Right-aligned (standard)
}


async def set_din5008_defaults():
    """Update DE and IT design settings with DIN 5008 defaults."""
    async with async_session_maker() as db:
        # Get existing settings for DE and IT
        result = await db.execute(
            select(DesignSetting).where(DesignSetting.country_code.in_(["DE", "IT"]))
        )
        settings = result.scalars().all()

        if not settings:
            print("No existing design settings found for DE or IT.")
            print("Creating default settings...")

            # Create DE settings
            de_settings = DesignSetting(
                country_code="DE",
                company_name="Niederwieser GmbH",
                header_line1="Gewerbepark 9",
                header_line2="87477 Sulzberg",
                font_family="Arial",
                signatory_name="Matthias Schweizer",
                **DIN_5008_DEFAULTS
            )
            db.add(de_settings)

            # Create IT settings
            it_settings = DesignSetting(
                country_code="IT",
                company_name="Niederwieser S.r.l.",
                header_line1="Via Example 1",
                header_line2="39100 Bolzano",
                font_family="Arial",
                signatory_name="Matthias Schweizer",
                **DIN_5008_DEFAULTS
            )
            db.add(it_settings)

            await db.commit()
            print("✓ Created DE and IT settings with DIN 5008 defaults")
        else:
            # Update existing settings
            for setting in settings:
                print(f"Updating {setting.country_code} settings...")

                for key, value in DIN_5008_DEFAULTS.items():
                    setattr(setting, key, value)

                # Set signatory if not set
                if not setting.signatory_name:
                    setting.signatory_name = "Matthias Schweizer"

            await db.commit()
            print(f"✓ Updated {len(settings)} country settings with DIN 5008 defaults")

        # Show current values
        print("\n--- Current DIN 5008 Settings ---")
        result = await db.execute(
            select(DesignSetting).where(DesignSetting.country_code.in_(["DE", "IT"]))
        )
        for s in result.scalars().all():
            print(f"\n{s.country_code}:")
            print(f"  Margins: L={s.margin_left_cm}cm, R={s.margin_right_cm}cm, T={s.margin_top_cm}cm, B={s.margin_bottom_cm}cm")
            print(f"  Font: {s.font_family} {s.font_size_pt}pt, Line Spacing: {s.line_spacing}")
            print(f"  Logo: {s.logo_width_cm}cm, Position: {s.logo_position}")
            print(f"  Signatory: {s.signatory_name}")


if __name__ == "__main__":
    asyncio.run(set_din5008_defaults())
