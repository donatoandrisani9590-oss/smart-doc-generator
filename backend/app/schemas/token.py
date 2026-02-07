from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field

class Token(BaseModel):
    access_token: str = Field(..., max_length=2000, description="JWT access token")
    token_type: str = Field(..., max_length=50, description="Token type (e.g., Bearer)")

class TokenPayload(BaseModel):
    sub: Optional[int] = None

