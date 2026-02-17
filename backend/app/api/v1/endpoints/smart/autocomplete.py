"""
Employee Autocomplete — search employees and return data from their latest document.

GET /api/v1/smart/autocomplete/employees?q=Müller&country_code=DE
Returns up to 10 matching employees with form_data from their most recent document.
"""
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.models.enterprise import GeneratedDocument

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/smart/autocomplete")


@router.get("/employees")
async def search_employees(
    q: str = Query(..., min_length=2, description="Suchbegriff (min. 2 Zeichen)"),
    country_code: str = Query("DE"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Search employees by name and return form data from their most recent document.
    Used for auto-filling employee data when creating new documents.
    """
    search_pattern = f"%{q}%"

    # DSGVO: Nur Dokumente des eigenen Users (Team-Isolation)
    # Subquery: latest document per employee_name
    latest_per_employee = (
        select(
            GeneratedDocument.employee_name,
            func.max(GeneratedDocument.id).label("latest_id"),
        )
        .where(
            and_(
                GeneratedDocument.is_deleted == False,
                GeneratedDocument.employee_name.ilike(search_pattern),
                GeneratedDocument.country_code == country_code,
                GeneratedDocument.created_by_id == current_user.id,
            )
        )
        .group_by(GeneratedDocument.employee_name)
        .subquery()
    )

    # Join to get full document data for the latest document
    result = await db.execute(
        select(
            GeneratedDocument.id,
            GeneratedDocument.employee_name,
            GeneratedDocument.employee_id,
            GeneratedDocument.title,
            GeneratedDocument.form_data,
            GeneratedDocument.created_at,
            GeneratedDocument.document_type_id,
        )
        .join(
            latest_per_employee,
            GeneratedDocument.id == latest_per_employee.c.latest_id,
        )
        .order_by(GeneratedDocument.employee_name)
        .limit(10)
    )

    employees = []
    for row in result.all():
        form_data = {}
        if row.form_data:
            try:
                form_data = json.loads(row.form_data) if isinstance(row.form_data, str) else row.form_data
            except (json.JSONDecodeError, TypeError):
                pass

        employees.append({
            "employee_name": row.employee_name or "",
            "employee_id": row.employee_id or "",
            "latest_document_title": row.title or "",
            "latest_document_date": row.created_at.isoformat() if row.created_at else "",
            "document_type_id": row.document_type_id,
            "form_data": form_data,
        })

    return {"count": len(employees), "employees": employees}
