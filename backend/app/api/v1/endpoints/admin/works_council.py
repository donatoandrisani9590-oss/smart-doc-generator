"""
Betriebsrat-Vorlagen API (v4.2 Feature: Kapitel 15.4.6)

Verwaltung von Betriebsrat-Mitteilungs-Templates und
Generierung von BR-Dokumenten aus Arbeitsverträgen.
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import json
import html

from app.db import get_db
from app.models.documents import (
    WorksCouncilTemplate,
    WorksCouncilNotification,
)

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class WorksCouncilTemplateBase(BaseModel):
    name: str
    template_type: str  # einstellung, versetzung, eingruppierung
    country_code: str = "DE"
    header_html: Optional[str] = None
    content_html: str
    footer_html: Optional[str] = None
    included_fields: Optional[List[str]] = None
    excluded_fields: Optional[List[str]] = None
    is_active: bool = True


class WorksCouncilTemplateCreate(WorksCouncilTemplateBase):
    pass


class WorksCouncilTemplateResponse(WorksCouncilTemplateBase):
    id: int
    version: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class GenerateBRNotificationRequest(BaseModel):
    """Request zum Generieren einer BR-Mitteilung aus Vertragsdaten."""
    template_id: Optional[int] = None  # Falls None: Standard-Template verwenden
    document_id: Optional[int] = None  # Verknüpfung zum Ursprungsdokument

    # Daten aus dem Arbeitsvertrag
    employee_name: str
    notification_type: str = "einstellung"

    # Felder für die BR-Mitteilung (§99 BetrVG relevante Infos)
    form_data: dict  # Alle Formulardaten, Template filtert relevante


class BRNotificationResponse(BaseModel):
    id: int
    template_id: Optional[int]
    employee_name: str
    notification_type: str
    content_html: str
    status: str
    created_at: str

    class Config:
        from_attributes = True


class BRNotificationListItem(BaseModel):
    id: int
    employee_name: str
    notification_type: str
    status: str
    created_at: str
    created_by: Optional[str]


# ══════════════════════════════════════════════════════════════════════════════
# TEMPLATE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/templates", response_model=List[WorksCouncilTemplateResponse])
async def list_templates(
    template_type: Optional[str] = Query(None, description="Filter by type: einstellung, versetzung"),
    country_code: str = Query("DE"),
    db: AsyncSession = Depends(get_db),
):
    """Alle BR-Vorlagen abrufen."""
    query = select(WorksCouncilTemplate).where(
        WorksCouncilTemplate.country_code == country_code,
        WorksCouncilTemplate.is_active == True,
    )

    if template_type:
        query = query.where(WorksCouncilTemplate.template_type == template_type)

    result = await db.execute(query)
    templates = result.scalars().all()

    # Convert JSON fields
    response = []
    for t in templates:
        data = WorksCouncilTemplateResponse(
            id=t.id,
            name=t.name,
            template_type=t.template_type,
            country_code=t.country_code,
            header_html=t.header_html,
            content_html=t.content_html,
            footer_html=t.footer_html,
            included_fields=json.loads(t.included_fields) if t.included_fields else None,
            excluded_fields=json.loads(t.excluded_fields) if t.excluded_fields else None,
            is_active=t.is_active,
            version=t.version,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        response.append(data)

    return response


@router.get("/templates/{template_id}", response_model=WorksCouncilTemplateResponse)
async def get_template(template_id: int, db: AsyncSession = Depends(get_db)):
    """Eine BR-Vorlage abrufen."""
    result = await db.execute(
        select(WorksCouncilTemplate).where(WorksCouncilTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Template nicht gefunden")

    return WorksCouncilTemplateResponse(
        id=template.id,
        name=template.name,
        template_type=template.template_type,
        country_code=template.country_code,
        header_html=template.header_html,
        content_html=template.content_html,
        footer_html=template.footer_html,
        included_fields=json.loads(template.included_fields) if template.included_fields else None,
        excluded_fields=json.loads(template.excluded_fields) if template.excluded_fields else None,
        is_active=template.is_active,
        version=template.version,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


@router.post("/templates", response_model=WorksCouncilTemplateResponse)
async def create_template(
    data: WorksCouncilTemplateCreate,
    db: AsyncSession = Depends(get_db),
):
    """Neue BR-Vorlage erstellen."""
    template = WorksCouncilTemplate(
        name=data.name,
        template_type=data.template_type,
        country_code=data.country_code,
        header_html=data.header_html,
        content_html=data.content_html,
        footer_html=data.footer_html,
        included_fields=json.dumps(data.included_fields) if data.included_fields else None,
        excluded_fields=json.dumps(data.excluded_fields) if data.excluded_fields else None,
        is_active=data.is_active,
        created_at=datetime.now(timezone.utc),
    )

    db.add(template)
    await db.commit()
    await db.refresh(template)

    return WorksCouncilTemplateResponse(
        id=template.id,
        name=template.name,
        template_type=template.template_type,
        country_code=template.country_code,
        header_html=template.header_html,
        content_html=template.content_html,
        footer_html=template.footer_html,
        included_fields=data.included_fields,
        excluded_fields=data.excluded_fields,
        is_active=template.is_active,
        version=template.version,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


@router.put("/templates/{template_id}", response_model=WorksCouncilTemplateResponse)
async def update_template(
    template_id: int,
    data: WorksCouncilTemplateCreate,
    db: AsyncSession = Depends(get_db),
):
    """BR-Vorlage aktualisieren."""
    result = await db.execute(
        select(WorksCouncilTemplate).where(WorksCouncilTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Template nicht gefunden")

    template.name = data.name
    template.template_type = data.template_type
    template.country_code = data.country_code
    template.header_html = data.header_html
    template.content_html = data.content_html
    template.footer_html = data.footer_html
    template.included_fields = json.dumps(data.included_fields) if data.included_fields else None
    template.excluded_fields = json.dumps(data.excluded_fields) if data.excluded_fields else None
    template.is_active = data.is_active
    template.updated_at = datetime.now(timezone.utc)
    template.version = template.version + 1

    await db.commit()
    await db.refresh(template)

    return WorksCouncilTemplateResponse(
        id=template.id,
        name=template.name,
        template_type=template.template_type,
        country_code=template.country_code,
        header_html=template.header_html,
        content_html=template.content_html,
        footer_html=template.footer_html,
        included_fields=data.included_fields,
        excluded_fields=data.excluded_fields,
        is_active=template.is_active,
        version=template.version,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


# ══════════════════════════════════════════════════════════════════════════════
# NOTIFICATION GENERATION ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/generate", response_model=BRNotificationResponse)
async def generate_br_notification(
    request: GenerateBRNotificationRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    BR-Mitteilung aus Vertragsdaten generieren.

    Erstellt eine Betriebsrat-Mitteilung gemäß §99 BetrVG.
    Das Template enthält nur die für den BR relevanten Informationen.
    """
    # Template laden (oder Standard-Template verwenden)
    template = None
    if request.template_id:
        result = await db.execute(
            select(WorksCouncilTemplate).where(WorksCouncilTemplate.id == request.template_id)
        )
        template = result.scalar_one_or_none()

    if not template:
        # Standard-Template für Einstellungen
        result = await db.execute(
            select(WorksCouncilTemplate).where(
                WorksCouncilTemplate.template_type == request.notification_type,
                WorksCouncilTemplate.is_active == True,
            ).limit(1)
        )
        template = result.scalar_one_or_none()

    # Felder filtern: Nur BR-relevante Infos
    br_relevant_fields = [
        "employee_name",
        "job_title",
        "department",
        "start_date",
        "working_hours",
        "salary_group",  # Eingruppierung, aber nicht Gehalt!
        "employment_type",  # Vollzeit/Teilzeit
        "contract_type",  # unbefristet/befristet
    ]

    if template and template.included_fields:
        try:
            br_relevant_fields = json.loads(template.included_fields)
        except json.JSONDecodeError:
            pass

    # Sensitive Felder ausschließen
    excluded_fields = ["salary", "bank_account", "social_security", "tax_id", "private_email", "private_phone"]
    if template and template.excluded_fields:
        try:
            excluded_fields = json.loads(template.excluded_fields)
        except json.JSONDecodeError:
            pass

    # Gefilterte Daten erstellen
    filtered_data = {
        k: v for k, v in request.form_data.items()
        if k in br_relevant_fields and k not in excluded_fields
    }

    # Content generieren
    content_html = _generate_br_content(
        template=template,
        employee_name=request.employee_name,
        notification_type=request.notification_type,
        data=filtered_data,
    )

    # Notification speichern
    notification = WorksCouncilNotification(
        template_id=template.id if template else None,
        generated_document_id=request.document_id,
        employee_name=request.employee_name,
        notification_type=request.notification_type,
        content_html=content_html,
        status="erstellt",
        created_at=datetime.now(timezone.utc),
    )

    db.add(notification)
    await db.commit()
    await db.refresh(notification)

    return BRNotificationResponse(
        id=notification.id,
        template_id=notification.template_id,
        employee_name=notification.employee_name,
        notification_type=notification.notification_type,
        content_html=notification.content_html,
        status=notification.status,
        created_at=notification.created_at,
    )


@router.get("/notifications", response_model=List[BRNotificationListItem])
async def list_notifications(
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Liste aller BR-Mitteilungen."""
    query = select(WorksCouncilNotification).order_by(
        WorksCouncilNotification.created_at.desc()
    ).limit(limit)

    if status:
        query = query.where(WorksCouncilNotification.status == status)

    result = await db.execute(query)
    notifications = result.scalars().all()

    return [
        BRNotificationListItem(
            id=n.id,
            employee_name=n.employee_name,
            notification_type=n.notification_type,
            status=n.status,
            created_at=n.created_at,
            created_by=n.created_by,
        )
        for n in notifications
    ]


@router.get("/notifications/{notification_id}", response_model=BRNotificationResponse)
async def get_notification(notification_id: int, db: AsyncSession = Depends(get_db)):
    """Eine BR-Mitteilung abrufen."""
    result = await db.execute(
        select(WorksCouncilNotification).where(WorksCouncilNotification.id == notification_id)
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(status_code=404, detail="Mitteilung nicht gefunden")

    return BRNotificationResponse(
        id=notification.id,
        template_id=notification.template_id,
        employee_name=notification.employee_name,
        notification_type=notification.notification_type,
        content_html=notification.content_html,
        status=notification.status,
        created_at=notification.created_at,
    )


@router.patch("/notifications/{notification_id}/status")
async def update_notification_status(
    notification_id: int,
    status: str = Query(..., description="erstellt, versendet, bestaetigt"),
    db: AsyncSession = Depends(get_db),
):
    """Status einer BR-Mitteilung aktualisieren."""
    result = await db.execute(
        select(WorksCouncilNotification).where(WorksCouncilNotification.id == notification_id)
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(status_code=404, detail="Mitteilung nicht gefunden")

    valid_statuses = ["erstellt", "versendet", "bestaetigt"]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Ungültiger Status. Erlaubt: {valid_statuses}"
        )

    notification.status = status
    if status == "versendet":
        notification.sent_at = datetime.now(timezone.utc)
    elif status == "bestaetigt":
        notification.confirmed_at = datetime.now(timezone.utc)

    await db.commit()

    return {"success": True, "status": status}


# ══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def _generate_br_content(
    template: Optional[WorksCouncilTemplate],
    employee_name: str,
    notification_type: str,
    data: dict,
) -> str:
    """Generiert den HTML-Inhalt der BR-Mitteilung."""

    if template and template.content_html:
        # Template-basierte Generierung
        content = template.content_html

        # Platzhalter ersetzen - MIT HTML-ESCAPING gegen XSS
        safe_employee_name = html.escape(str(employee_name)) if employee_name else ""
        safe_notification_type = html.escape(str(notification_type)) if notification_type else ""

        content = content.replace("{{employee_name}}", safe_employee_name)
        content = content.replace("{{notification_type}}", safe_notification_type)

        for key, value in data.items():
            # Escape all user-provided values to prevent XSS
            safe_value = html.escape(str(value)) if value else ""
            content = content.replace(f"{{{{{key}}}}}", safe_value)

        # Header/Footer hinzufügen
        full_content = ""
        if template.header_html:
            full_content += template.header_html
        full_content += content
        if template.footer_html:
            full_content += template.footer_html

        return full_content

    # Standard-Vorlage ohne Template
    type_labels = {
        "einstellung": "Einstellung",
        "versetzung": "Versetzung",
        "eingruppierung": "Eingruppierung",
    }

    field_labels = {
        "employee_name": "Name des Mitarbeiters",
        "job_title": "Stellenbezeichnung",
        "department": "Abteilung",
        "start_date": "Eintrittsdatum",
        "working_hours": "Wöchentliche Arbeitszeit",
        "salary_group": "Eingruppierung",
        "employment_type": "Beschäftigungsart",
        "contract_type": "Vertragsart",
    }

    content = f"""
    <div class="br-notification">
        <h2>Unterrichtung des Betriebsrats gemäß §99 BetrVG</h2>
        <h3>Maßnahme: {type_labels.get(notification_type, notification_type)}</h3>

        <table class="br-data-table" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    """

    for key, value in data.items():
        if value:
            label = field_labels.get(key, key.replace("_", " ").title())
            content += f"""
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 40%;">{label}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">{value}</td>
            </tr>
            """

    content += """
        </table>

        <div class="br-legal-notice" style="margin-top: 30px; padding: 15px; background: #f5f5f5; border-radius: 4px;">
            <p><strong>Hinweis:</strong> Der Betriebsrat wird hiermit über die geplante personelle
            Maßnahme unterrichtet. Gemäß §99 Abs. 3 BetrVG gilt die Zustimmung als erteilt,
            wenn der Betriebsrat nicht binnen einer Woche nach ordnungsgemäßer Unterrichtung
            seine Zustimmung verweigert.</p>
        </div>

        <div class="br-signature" style="margin-top: 40px;">
            <p>_______________________________</p>
            <p>Datum, Unterschrift Personalleitung</p>
        </div>
    </div>
    """

    return content
