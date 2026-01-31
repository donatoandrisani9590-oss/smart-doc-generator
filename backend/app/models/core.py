from sqlalchemy import Column, Integer, String, Boolean, JSON, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user")  # 'admin' or 'user'
    country_code = Column(String(2), nullable=True)  # 'DE', 'IT' - context preference
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

class DesignSetting(Base):
    __tablename__ = "design_settings"

    id = Column(Integer, primary_key=True, index=True)
    country_code = Column(String(2), nullable=False, unique=True)  # 'DE' or 'IT'
    company_name = Column(String, nullable=False)
    logo_path = Column(String, nullable=True)
    header_line1 = Column(Text, nullable=True)
    header_line2 = Column(Text, nullable=True)
    header_line3 = Column(Text, nullable=True)
    footer_line1 = Column(Text, nullable=True)
    footer_line2 = Column(Text, nullable=True)
    footer_line3 = Column(Text, nullable=True)
    font_family = Column(String(100), default="Arial")
    primary_color = Column(String(7), default="#243186")
    colors = Column(JSON, default={})

    # DIN 5008 Document Format Settings (professional German business standard)
    # Page margins in cm
    margin_left_cm = Column(String(10), default="2.5")      # DIN 5008: min 2.5 cm for binding
    margin_right_cm = Column(String(10), default="2.0")     # DIN 5008: min 1.0 cm
    margin_top_cm = Column(String(10), default="2.5")       # Professional top margin
    margin_bottom_cm = Column(String(10), default="2.0")    # Space for page numbers
    header_distance_cm = Column(String(10), default="1.25") # Header distance from top
    footer_distance_cm = Column(String(10), default="1.0")  # Footer distance from bottom

    # Typography
    font_size_pt = Column(Integer, default=11)              # 11pt for readability (DIN 5008)
    line_spacing = Column(String(10), default="1.15")       # Line spacing factor

    # Logo settings
    logo_width_cm = Column(String(10), default="5.0")       # Professional logo width
    logo_position = Column(String(20), default="right")     # 'left', 'center', 'right'

    # Signatory
    signatory_name = Column(String(200), nullable=True)     # Default signatory for contracts

    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class UserSession(Base):
    """Tracks user's active country context for multi-jurisdiction support."""
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, nullable=False)
    country_code = Column(String(2), nullable=False, default="DE")
    locale = Column(String(10), nullable=False, default="de-DE")
    last_active = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


