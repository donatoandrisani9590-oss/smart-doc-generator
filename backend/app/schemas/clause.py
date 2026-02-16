"""
Clause Schemas - Pydantic models for clause API
"""
from pydantic import BaseModel, Field, field_validator, computed_field
from typing import Optional, List
import re
import bleach


# Allowed HTML tags for clause content (sanitization)
ALLOWED_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a', 'blockquote', 'code', 'pre'
]
ALLOWED_ATTRS = {
    '*': ['class', 'style'],
    'a': ['href', 'title', 'target'],
    'table': ['border', 'cellpadding', 'cellspacing'],
}


VALID_TONES = ["neutral", "streng", "arbeitnehmerfreundlich", "moderat"]


class ClauseBase(BaseModel):
    """Base schema for clause data."""
    title: str = Field(..., min_length=1, max_length=255, description="Clause title")
    content_html: str = Field(..., min_length=1, max_length=100000, description="HTML content")
    country_code: Optional[str] = Field("DE", min_length=2, max_length=2, description="ISO country code")
    category: Optional[str] = Field("General", max_length=100, description="Clause category")
    is_active: bool = Field(True, description="Whether clause is active")
    # Paragraph numbering (v4.4)
    has_paragraph_number: bool = Field(True, description="Whether clause gets §-numbering in contracts (False for letters like Abmahnungen)")
    # AI metadata fields (v4.3)
    tags: Optional[List[str]] = Field(None, max_length=20, description="Semantic tags for AI matching, e.g. ['kuendigung', 'streng']")
    description: Optional[str] = Field(None, max_length=1000, description="Purpose description for AI context injection")
    tone: Optional[str] = Field(None, max_length=50, description="Clause tone: neutral, streng, arbeitnehmerfreundlich, moderat")

    @field_validator('tone')
    @classmethod
    def validate_tone(cls, v: Optional[str]) -> Optional[str]:
        """Validate tone against allowed values."""
        if v is None:
            return v
        v = v.strip().lower()
        if v not in VALID_TONES:
            raise ValueError(f"Tone must be one of: {', '.join(VALID_TONES)}")
        return v

    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Normalize tags: lowercase, strip, deduplicate."""
        if v is None:
            return v
        normalized = list(set(tag.strip().lower() for tag in v if tag.strip()))
        if len(normalized) > 20:
            raise ValueError("Maximum 20 tags allowed")
        return normalized

    @field_validator('country_code')
    @classmethod
    def validate_country_code(cls, v: Optional[str]) -> Optional[str]:
        """Validate and uppercase country code."""
        if v is None:
            return "DE"
        v = v.upper().strip()
        if not re.match(r'^[A-Z]{2}$', v):
            raise ValueError("Country code must be 2 uppercase letters")
        return v

    @field_validator('content_html')
    @classmethod
    def sanitize_html(cls, v: str) -> str:
        """Sanitize HTML content to prevent XSS."""
        if not v:
            raise ValueError("Content cannot be empty")
        # Sanitize HTML - remove dangerous tags/attributes
        clean_html = bleach.clean(
            v,
            tags=ALLOWED_TAGS,
            attributes=ALLOWED_ATTRS,
            strip=True
        )
        return clean_html

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: str) -> str:
        """Strip and validate title."""
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        return v


class ClauseCreate(ClauseBase):
    """Schema for creating a new clause."""
    pass


class ClauseUpdate(BaseModel):
    """Schema for updating an existing clause."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content_html: Optional[str] = Field(None, min_length=1, max_length=100000)
    country_code: Optional[str] = Field(None, min_length=2, max_length=2)
    category: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None
    # Paragraph numbering (v4.4)
    has_paragraph_number: Optional[bool] = None
    # AI metadata fields (v4.3)
    tags: Optional[List[str]] = Field(None, max_length=20)
    description: Optional[str] = Field(None, max_length=1000)
    tone: Optional[str] = Field(None, max_length=50)

    @field_validator('tone')
    @classmethod
    def validate_tone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip().lower()
        if v not in VALID_TONES:
            raise ValueError(f"Tone must be one of: {', '.join(VALID_TONES)}")
        return v

    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        return list(set(tag.strip().lower() for tag in v if tag.strip()))

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

    @field_validator('content_html')
    @classmethod
    def sanitize_html(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize HTML content if provided."""
        if v is None:
            return v
        return bleach.clean(v, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        """Strip title if provided."""
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        return v


class ClauseInDBBase(ClauseBase):
    """Schema for clause as stored in database."""
    id: int
    version: int = 1
    user_id: Optional[int] = None

    class Config:
        from_attributes = True


class Clause(ClauseInDBBase):
    """Response schema for clauses with computed fields."""

    @computed_field
    @property
    def content(self) -> str:
        """Alias for content_html for frontend compatibility."""
        return self.content_html

    @computed_field
    @property
    def placeholders(self) -> List[str]:
        """Extract all placeholders from content."""
        if not self.content_html:
            return []
        # Find all {{ placeholder }} patterns
        pattern = r'\{\{\s*(\w+)\s*\}\}'
        matches = re.findall(pattern, self.content_html)
        return list(set(matches))  # Unique placeholders
