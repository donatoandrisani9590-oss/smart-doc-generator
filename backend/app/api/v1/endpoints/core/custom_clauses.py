"""
Custom Clause Templates API: User-saved Individualvereinbarungen templates.
Requires authentication. Users can only access their own templates.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Annotated
from datetime import datetime, timezone

from app.db import get_db
from app.models.enterprise import CustomClauseTemplate
from app.models.core import User
from app.api.deps import get_current_user

router = APIRouter()


class CustomTemplateCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1, max_length=50000)
    category: Optional[str] = Field("Individualvereinbarung", max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    country_code: str = Field("DE", min_length=2, max_length=2)

    @field_validator('country_code')
    @classmethod
    def validate_country_code(cls, v: str) -> str:
        return v.upper()


class CustomTemplateUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1, max_length=50000)
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)


@router.get("/templates")
async def list_custom_templates(
    country_code: Optional[str] = None,
    category: Optional[str] = None,
    include_public: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    List custom clause templates.
    Returns user's own templates and optionally public templates.
    """
    user_id = str(current_user.id)

    query = select(CustomClauseTemplate)

    # User can see their own templates and public templates
    if include_public:
        query = query.where(
            or_(
                CustomClauseTemplate.created_by == user_id,
                CustomClauseTemplate.is_public == True
            )
        )
    else:
        query = query.where(CustomClauseTemplate.created_by == user_id)

    if country_code:
        query = query.where(CustomClauseTemplate.country_code == country_code.upper())
    if category:
        query = query.where(CustomClauseTemplate.category == category)

    query = query.order_by(desc(CustomClauseTemplate.updated_at))

    result = await db.execute(query)
    templates = result.scalars().all()

    return {
        "items": [
            {
                "id": t.id,
                "title": t.title,
                "content": t.content,
                "category": t.category,
                "description": t.description,
                "country_code": t.country_code,
                "created_by": t.created_by,
                "is_own": t.created_by == user_id,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "updated_at": t.updated_at.isoformat() if t.updated_at else None,
                "usage_count": t.usage_count
            }
            for t in templates
        ],
        "total": len(templates)
    }


@router.post("/templates")
async def create_custom_template(
    template: CustomTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Create a new custom clause template.
    Users can save their own Individualvereinbarungen for reuse.
    """
    user_id = str(current_user.id)

    new_template = CustomClauseTemplate(
        title=template.title.strip(),
        content=template.content,
        category=template.category or "Individualvereinbarung",
        description=template.description.strip() if template.description else None,
        country_code=template.country_code,
        created_by=user_id
    )

    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)

    return {
        "status": "created",
        "id": new_template.id,
        "title": new_template.title
    }


@router.get("/templates/popular")
async def get_popular_templates(
    country_code: str = "DE",
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Get most popular public custom templates by usage count."""
    # Only show public templates in popular list
    result = await db.execute(
        select(CustomClauseTemplate)
        .where(
            CustomClauseTemplate.country_code == country_code.upper(),
            CustomClauseTemplate.is_public == True
        )
        .order_by(desc(CustomClauseTemplate.usage_count))
        .limit(min(limit, 50))  # Cap at 50
    )
    templates = result.scalars().all()

    return {
        "items": [
            {
                "id": t.id,
                "title": t.title,
                "category": t.category,
                "usage_count": t.usage_count or 0
            }
            for t in templates
        ]
    }


@router.get("/templates/{template_id}")
async def get_custom_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Get a custom template by ID. Must be own template or public."""
    user_id = str(current_user.id)

    result = await db.execute(
        select(CustomClauseTemplate).where(CustomClauseTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Vorlage nicht gefunden")

    # Check access: must be owner or template must be public
    if template.created_by != user_id and not getattr(template, 'is_public', False):
        raise HTTPException(status_code=403, detail="Zugriff verweigert")

    return {
        "id": template.id,
        "title": template.title,
        "content": template.content,
        "category": template.category,
        "description": template.description,
        "country_code": template.country_code,
        "created_by": template.created_by,
        "is_own": template.created_by == user_id,
        "created_at": template.created_at.isoformat() if template.created_at else None,
        "updated_at": template.updated_at.isoformat() if template.updated_at else None,
        "usage_count": template.usage_count
    }


@router.put("/templates/{template_id}")
async def update_custom_template(
    template_id: int,
    update: CustomTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Update a custom template. Only owner can update."""
    user_id = str(current_user.id)

    result = await db.execute(
        select(CustomClauseTemplate).where(CustomClauseTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Vorlage nicht gefunden")

    # Only owner can update
    if template.created_by != user_id:
        raise HTTPException(status_code=403, detail="Nur der Ersteller kann die Vorlage bearbeiten")

    if update.title is not None:
        template.title = update.title.strip()
    if update.content is not None:
        template.content = update.content
    if update.category is not None:
        template.category = update.category.strip()
    if update.description is not None:
        template.description = update.description.strip()

    template.updated_at = datetime.now(timezone.utc)

    await db.commit()

    return {"status": "updated", "id": template_id}


@router.delete("/templates/{template_id}")
async def delete_custom_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Delete a custom template. Only owner can delete."""
    user_id = str(current_user.id)

    result = await db.execute(
        select(CustomClauseTemplate).where(CustomClauseTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Vorlage nicht gefunden")

    # Only owner can delete
    if template.created_by != user_id:
        raise HTTPException(status_code=403, detail="Nur der Ersteller kann die Vorlage löschen")

    await db.delete(template)
    await db.commit()

    return {"status": "deleted", "id": template_id}


@router.post("/templates/{template_id}/use")
async def use_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Mark a template as used.
    Increments the usage_count for popularity tracking.
    Returns the template content for insertion.
    """
    user_id = str(current_user.id)

    result = await db.execute(
        select(CustomClauseTemplate).where(CustomClauseTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Vorlage nicht gefunden")

    # Check access
    if template.created_by != user_id and not getattr(template, 'is_public', False):
        raise HTTPException(status_code=403, detail="Zugriff verweigert")

    template.usage_count = (template.usage_count or 0) + 1
    await db.commit()

    return {
        "id": template.id,
        "title": template.title,
        "content": template.content,
        "usage_count": template.usage_count
    }
