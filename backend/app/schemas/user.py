"""
User Schemas - Pydantic models for user API
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, Literal
import re


class UserBase(BaseModel):
    """Base schema for user data."""
    email: EmailStr = Field(..., description="User email address")
    is_active: bool = Field(True, description="Whether user is active")
    role: Literal["admin", "user"] = Field("user", description="User role")
    country_code: Optional[str] = Field("DE", min_length=2, max_length=2, description="ISO country code")

    @field_validator('country_code')
    @classmethod
    def validate_country_code(cls, v: Optional[str]) -> Optional[str]:
        """Validate and uppercase country code."""
        if v is None:
            return "DE"
        v = v.upper().strip()
        if not re.match(r'^[A-Z]{2}$', v):
            raise ValueError("Country code must be 2 uppercase letters (e.g., DE, IT)")
        return v


class UserCreate(UserBase):
    """Schema for creating a new user with password validation."""
    password: str = Field(..., min_length=8, max_length=128, description="User password")

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password complexity."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must not exceed 128 characters")
        # Check for at least one letter and one digit
        if not re.search(r'[A-Za-z]', v):
            raise ValueError("Password must contain at least one letter")
        if not re.search(r'\d', v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(BaseModel):
    """Schema for updating user data."""
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    is_active: Optional[bool] = None
    country_code: Optional[str] = Field(None, min_length=2, max_length=2)
    role: Optional[Literal["admin", "user"]] = None

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        """Validate password complexity if provided."""
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r'[A-Za-z]', v):
            raise ValueError("Password must contain at least one letter")
        if not re.search(r'\d', v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator('country_code')
    @classmethod
    def validate_country_code(cls, v: Optional[str]) -> Optional[str]:
        """Validate country code if provided."""
        if v is None:
            return v
        v = v.upper().strip()
        if not re.match(r'^[A-Z]{2}$', v):
            raise ValueError("Country code must be 2 uppercase letters")
        return v


class UserInDBBase(UserBase):
    """Schema for user as stored in database."""
    id: int

    class Config:
        from_attributes = True


class User(UserInDBBase):
    """Response schema for user data (without sensitive fields)."""
    pass
