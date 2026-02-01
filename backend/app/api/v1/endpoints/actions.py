"""
Actions API - High-Level Endpoints für Bot-Integration

Diese Endpoints sind optimiert für:
- Microsoft Copilot Studio
- Power Automate
- Chatbots & Sprachassistenten

Sie bieten vereinfachte Schnittstellen für häufige Aktionen.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import date, datetime
import json
from app.db import get_db
from app.models.documents import DocumentType, Clause
from app.models.enterprise import GeneratedDocument, Deadline
from app.api import deps
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS - Vereinfachte Request/Response Models für Bot-Integration
# ══════════════════════════════════════════════════════════════════════════════

class CreateContractRequest(BaseModel):
    """Vereinfachte Anfrage zum Erstellen eines Arbeitsvertrags."""

    employee_first_name: str = Field(..., description="Vorname des Mitarbeiters", example="Max")
    employee_last_name: str = Field(..., description="Nachname des Mitarbeiters", example="Mustermann")
    position: str = Field(..., description="Position/Stelle", example="Software Developer")
    department: Optional[str] = Field(None, description="Abteilung", example="IT")
    start_date: date = Field(..., description="Eintrittsdatum", example="2024-03-01")
    salary_annual: float = Field(..., description="Jahresgehalt in EUR", example=55000)
    contract_type: Literal["vollzeit", "teilzeit", "befristet", "minijob"] = Field(
        "vollzeit", description="Art des Vertrags"
    )
    working_hours_per_week: Optional[float] = Field(40, description="Wochenstunden", example=40)
    probation_months: Optional[int] = Field(6, description="Probezeit in Monaten", example=6)
    country_code: Literal["DE", "IT"] = Field("DE", description="Land (DE oder IT)")

    class Config:
        json_schema_extra = {
            "example": {
                "employee_first_name": "Max",
                "employee_last_name": "Mustermann",
                "position": "Software Developer",
                "department": "IT",
                "start_date": "2024-03-01",
                "salary_annual": 55000,
                "contract_type": "vollzeit",
                "working_hours_per_week": 40,
                "probation_months": 6,
                "country_code": "DE"
            }
        }


class CreateContractResponse(BaseModel):
    """Antwort nach erfolgreicher Vertragserstellung."""

    success: bool = Field(..., description="War die Erstellung erfolgreich?")
    document_id: int = Field(..., description="ID des erstellten Dokuments")
    document_title: str = Field(..., description="Titel des Dokuments")
    download_url: str = Field(..., description="URL zum Herunterladen des PDFs")
    message: str = Field(..., description="Statusnachricht")

    # Zusätzliche Infos für Bots
    employee_name: str = Field(..., description="Vollständiger Name des Mitarbeiters")
    contract_type_display: str = Field(..., description="Lesbare Vertragsart")
    created_at: datetime = Field(..., description="Erstellungszeitpunkt")


class ListDocumentTypesResponse(BaseModel):
    """Liste verfügbarer Dokumenttypen."""

    document_types: List[dict] = Field(..., description="Verfügbare Dokumenttypen")
    total_count: int = Field(..., description="Gesamtanzahl")


class DeadlineSummaryResponse(BaseModel):
    """Zusammenfassung anstehender Fristen."""

    overdue_count: int = Field(..., description="Anzahl überfälliger Fristen")
    urgent_count: int = Field(..., description="Anzahl dringender Fristen (diese Woche)")
    upcoming_count: int = Field(..., description="Anzahl anstehender Fristen (dieser Monat)")
    next_deadline: Optional[dict] = Field(None, description="Nächste anstehende Frist")
    message: str = Field(..., description="Zusammenfassende Nachricht für Bot")


class SearchDocumentsRequest(BaseModel):
    """Suchanfrage für Dokumente."""

    query: str = Field(..., description="Suchbegriff", example="Müller")
    document_type: Optional[str] = Field(None, description="Dokumenttyp-Filter", example="Arbeitsvertrag")
    limit: int = Field(10, description="Maximale Anzahl Ergebnisse", ge=1, le=50)


class SearchDocumentsResponse(BaseModel):
    """Suchergebnisse."""

    results: List[dict] = Field(..., description="Gefundene Dokumente")
    total_count: int = Field(..., description="Gesamtanzahl Treffer")
    query: str = Field(..., description="Verwendeter Suchbegriff")
    message: str = Field(..., description="Zusammenfassung für Bot")


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS - Bot-optimierte Actions
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/create-contract",
    response_model=CreateContractResponse,
    operation_id="createEmploymentContract",
    summary="Arbeitsvertrag erstellen",
    description="""
    Erstellt einen neuen Arbeitsvertrag mit den angegebenen Daten.

    **Copilot Studio Beispiel:**
    "Erstelle einen Arbeitsvertrag für Max Mustermann als Software Developer mit 55.000€ Jahresgehalt ab 1. März"

    **Power Automate Beispiel:**
    Trigger: Neuer Mitarbeiter in SAP → Action: Vertrag automatisch erstellen
    """,
    responses={
        200: {"description": "Vertrag erfolgreich erstellt"},
        400: {"description": "Ungültige Eingabedaten"},
        404: {"description": "Dokumenttyp nicht gefunden"},
    }
)
async def create_contract(
    request: CreateContractRequest,
    db: AsyncSession = Depends(get_db),
    # current_user = Depends(deps.get_current_user)  # Optional: Auth aktivieren
):
    """
    Erstellt einen Arbeitsvertrag basierend auf vereinfachten Eingabedaten.

    Diese Action ist optimiert für Bot-Szenarien und mappt die Eingaben
    automatisch auf den korrekten Dokumenttyp und die erforderlichen Felder.
    """

    # Dokumenttyp basierend auf contract_type ermitteln
    doc_type_mapping = {
        "vollzeit": "Arbeitsvertrag Vollzeit",
        "teilzeit": "Arbeitsvertrag Teilzeit",
        "befristet": "Arbeitsvertrag Befristet",
        "minijob": "Arbeitsvertrag Minijob",
    }

    doc_type_name = doc_type_mapping.get(request.contract_type, "Arbeitsvertrag Vollzeit")

    # Dokumenttyp aus DB laden
    result = await db.execute(
        select(DocumentType).where(
            DocumentType.name.ilike(f"%{doc_type_name}%"),
            DocumentType.country_code == request.country_code,
            DocumentType.is_active == True
        )
    )
    doc_type = result.scalars().first()

    if not doc_type:
        # Fallback: Generischer Arbeitsvertrag
        result = await db.execute(
            select(DocumentType).where(
                DocumentType.name.ilike("%arbeitsvertrag%"),
                DocumentType.country_code == request.country_code,
                DocumentType.is_active == True
            )
        )
        doc_type = result.scalars().first()

    if not doc_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kein passender Dokumenttyp für '{request.contract_type}' gefunden"
        )

    # Formular-Daten zusammenstellen
    employee_name = f"{request.employee_first_name} {request.employee_last_name}"
    monthly_salary = round(request.salary_annual / 12, 2)

    form_data = {
        "vorname": request.employee_first_name,
        "nachname": request.employee_last_name,
        "position": request.position,
        "abteilung": request.department or "",
        "eintrittsdatum": request.start_date.isoformat(),
        "gehalt": str(monthly_salary),
        "gehalt_jahres": str(request.salary_annual),
        "wochenstunden": str(request.working_hours_per_week or 40),
        "probezeit": f"{request.probation_months or 6} Monate",
    }

    # Dokument in DB speichern (ohne tatsächliche Generierung für jetzt)
    # In Production würde hier die echte PDF-Generierung aufgerufen

    document = GeneratedDocument(
        document_type_id=doc_type.id,
        title=f"Arbeitsvertrag - {employee_name}",
        employee_name=employee_name,
        country_code=request.country_code,
        file_format="pdf",
        file_path=f"pending/{employee_name.replace(' ', '_')}_vertrag.pdf",
        form_data=json.dumps(form_data, ensure_ascii=False),  # Korrektes JSON-Format
    )

    db.add(document)
    await db.commit()
    await db.refresh(document)

    # Response für Bot
    contract_type_display = {
        "vollzeit": "Vollzeit-Arbeitsvertrag",
        "teilzeit": "Teilzeit-Arbeitsvertrag",
        "befristet": "Befristeter Arbeitsvertrag",
        "minijob": "Minijob-Vertrag",
    }.get(request.contract_type, "Arbeitsvertrag")

    return CreateContractResponse(
        success=True,
        document_id=document.id,
        document_title=document.title or f"Arbeitsvertrag - {employee_name}",
        download_url=f"/api/v1/documents/{document.id}/download",
        message=f"✅ {contract_type_display} für {employee_name} wurde erfolgreich erstellt.",
        employee_name=employee_name,
        contract_type_display=contract_type_display,
        created_at=document.created_at or datetime.now(),
    )


@router.get(
    "/document-types",
    response_model=ListDocumentTypesResponse,
    operation_id="listAvailableDocumentTypes",
    summary="Verfügbare Dokumenttypen abrufen",
    description="""
    Gibt eine Liste aller verfügbaren Dokumenttypen zurück.

    **Copilot Studio Beispiel:**
    "Welche Dokumente kann ich erstellen?"
    """,
)
async def list_document_types(
    country_code: Literal["DE", "IT"] = "DE",
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Listet alle aktiven Dokumenttypen auf."""

    query = select(DocumentType).where(
        DocumentType.is_active == True,
        DocumentType.country_code == country_code
    )

    if category:
        query = query.where(DocumentType.category.ilike(f"%{category}%"))

    result = await db.execute(query.order_by(DocumentType.name))
    doc_types = result.scalars().all()

    return ListDocumentTypesResponse(
        document_types=[
            {
                "id": dt.id,
                "name": dt.name,
                "category": dt.category or "Allgemein",
                "description": dt.description,
            }
            for dt in doc_types
        ],
        total_count=len(doc_types)
    )


@router.get(
    "/deadline-summary",
    response_model=DeadlineSummaryResponse,
    operation_id="getDeadlineSummary",
    summary="Fristen-Zusammenfassung abrufen",
    description="""
    Gibt eine Zusammenfassung aller anstehenden HR-Fristen zurück.

    **Copilot Studio Beispiel:**
    "Welche Fristen stehen an?" oder "Gibt es überfällige Fristen?"
    """,
)
async def get_deadline_summary(
    country_code: Literal["DE", "IT"] = "DE",
    db: AsyncSession = Depends(get_db),
):
    """Gibt eine Bot-freundliche Zusammenfassung der Fristen zurück."""

    today = date.today()

    # Überfällige Fristen
    overdue_result = await db.execute(
        select(func.count(Deadline.id)).where(
            Deadline.country_code == country_code,
            Deadline.deadline_date < today,
            Deadline.status == "pending"
        )
    )
    overdue_count = overdue_result.scalar() or 0

    # Diese Woche
    from datetime import timedelta
    week_end = today + timedelta(days=7)
    urgent_result = await db.execute(
        select(func.count(Deadline.id)).where(
            Deadline.country_code == country_code,
            Deadline.deadline_date >= today,
            Deadline.deadline_date <= week_end,
            Deadline.status == "pending"
        )
    )
    urgent_count = urgent_result.scalar() or 0

    # Dieser Monat
    month_end = today + timedelta(days=30)
    upcoming_result = await db.execute(
        select(func.count(Deadline.id)).where(
            Deadline.country_code == country_code,
            Deadline.deadline_date >= today,
            Deadline.deadline_date <= month_end,
            Deadline.status == "pending"
        )
    )
    upcoming_count = upcoming_result.scalar() or 0

    # Nächste Frist
    next_result = await db.execute(
        select(Deadline).where(
            Deadline.country_code == country_code,
            Deadline.deadline_date >= today,
            Deadline.status == "pending"
        ).order_by(Deadline.deadline_date).limit(1)
    )
    next_deadline = next_result.scalars().first()

    next_deadline_info = None
    if next_deadline:
        next_deadline_info = {
            "id": next_deadline.id,
            "type": next_deadline.deadline_type,
            "date": next_deadline.deadline_date.isoformat(),
            "employee_name": next_deadline.employee_name,
            "days_remaining": (next_deadline.deadline_date - today).days,
        }

    # Bot-freundliche Nachricht
    if overdue_count > 0:
        message = f"⚠️ Achtung: {overdue_count} überfällige Frist(en)! "
    else:
        message = "✅ Keine überfälligen Fristen. "

    if urgent_count > 0:
        message += f"Diese Woche: {urgent_count} Frist(en). "

    if next_deadline_info:
        message += f"Nächste Frist: {next_deadline_info['employee_name']} am {next_deadline_info['date']}."

    return DeadlineSummaryResponse(
        overdue_count=overdue_count,
        urgent_count=urgent_count,
        upcoming_count=upcoming_count,
        next_deadline=next_deadline_info,
        message=message
    )


@router.post(
    "/search-documents",
    response_model=SearchDocumentsResponse,
    operation_id="searchDocuments",
    summary="Dokumente suchen",
    description="""
    Durchsucht alle erstellten Dokumente.

    **Copilot Studio Beispiel:**
    "Finde alle Verträge von Müller" oder "Zeige Kündigungen vom letzten Monat"
    """,
)
async def search_documents(
    request: SearchDocumentsRequest,
    db: AsyncSession = Depends(get_db),
):
    """Sucht nach Dokumenten basierend auf Suchbegriff."""

    query = select(GeneratedDocument).where(
        GeneratedDocument.is_deleted == False
    )

    # Textsuche
    if request.query:
        search_term = f"%{request.query}%"
        query = query.where(
            (GeneratedDocument.title.ilike(search_term)) |
            (GeneratedDocument.employee_name.ilike(search_term))
        )

    # Limit
    query = query.order_by(GeneratedDocument.created_at.desc()).limit(request.limit)

    result = await db.execute(query)
    documents = result.scalars().all()

    # Count total
    count_query = select(func.count(GeneratedDocument.id)).where(
        GeneratedDocument.is_deleted == False
    )
    if request.query:
        search_term = f"%{request.query}%"
        count_query = count_query.where(
            (GeneratedDocument.title.ilike(search_term)) |
            (GeneratedDocument.employee_name.ilike(search_term))
        )
    count_result = await db.execute(count_query)
    total_count = count_result.scalar() or 0

    results = [
        {
            "id": doc.id,
            "title": doc.title,
            "employee_name": doc.employee_name,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "download_url": f"/api/v1/documents/{doc.id}/download",
        }
        for doc in documents
    ]

    # Bot-Nachricht
    if total_count == 0:
        message = f"Keine Dokumente für '{request.query}' gefunden."
    elif total_count == 1:
        message = f"1 Dokument für '{request.query}' gefunden."
    else:
        message = f"{total_count} Dokumente für '{request.query}' gefunden."

    return SearchDocumentsResponse(
        results=results,
        total_count=total_count,
        query=request.query,
        message=message
    )


@router.get(
    "/health",
    operation_id="checkApiHealth",
    summary="API-Status prüfen",
    description="Prüft ob die API erreichbar und funktionsfähig ist.",
)
async def check_health():
    """Einfacher Health-Check für Bot-Integration."""
    return {
        "status": "healthy",
        "message": "✅ HR Document Generator API ist erreichbar.",
        "version": "1.0.0",
        "capabilities": [
            "create-contract",
            "search-documents",
            "deadline-summary",
            "document-types"
        ]
    }
