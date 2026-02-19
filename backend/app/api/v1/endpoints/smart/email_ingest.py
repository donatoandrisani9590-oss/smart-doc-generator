"""
Email Ingest API: Parse incoming emails into document drafts.

POST /api/v1/ingest/email         — Webhook for incoming emails (matches sender to user)
GET  /api/v1/ingest/email/history  — List email ingests for current user (paginated)
GET  /api/v1/ingest/email/{id}     — Get single ingest details
"""
import asyncio
import json
import logging
import time
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.models.core import User
from app.models.enterprise import EmailIngest, DocumentDraft, Notification
from app.models.documents import DocumentType
from app.services.llm_service import (
    LLMService, LLMMessage, LLMConfig, get_llm_service, log_llm_call
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["email-ingest"])


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class EmailIngestRequest(BaseModel):
    """Incoming email webhook payload."""
    from_email: str = Field(..., description="Absender-E-Mail-Adresse")
    subject: Optional[str] = Field(None, description="E-Mail-Betreff")
    body_text: str = Field(..., min_length=10, description="E-Mail-Textinhalt")
    received_at: Optional[str] = Field(None, description="Empfangszeitpunkt (ISO 8601)")


class EmailIngestResponse(BaseModel):
    """Response after processing an email."""
    status: str
    ingest_id: int
    draft_id: Optional[int] = None
    message: Optional[str] = None


class EmailIngestDetail(BaseModel):
    """Detailed view of a single email ingest."""
    id: int
    from_email: str
    subject: Optional[str]
    body_text: str
    status: str
    extracted_data: Optional[Dict[str, Any]] = None
    draft_ids: Optional[List[int]] = None
    error_message: Optional[str] = None
    received_at: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class EmailIngestListResponse(BaseModel):
    """Paginated list of email ingests."""
    items: List[EmailIngestDetail]
    total: int
    limit: int
    offset: int


# ═══════════════════════════════════════════════════════════════════════════
# LLM EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════

EXTRACTION_SYSTEM_PROMPT = """Du bist ein HR-Assistent. Extrahiere aus der folgenden E-Mail strukturierte Daten für die Dokumenterstellung.

Gib ein JSON-Objekt zurück mit:
- document_type: "arbeitsvertrag" | "kuendigung" | "zeugnis" | "abmahnung" | "anderungsvertrag"
- vorname: String
- nachname: String
- position: String (falls erwähnt)
- gehalt: Number (Jahresgehalt in Euro, falls erwähnt)
- eintrittsdatum: String (ISO-Format, falls erwähnt)
- wochenstunden: Number (falls erwähnt, Standard: 40)
- besondere_anweisungen: String (alles was nicht in die obigen Felder passt)
- confidence: Number (0-1, wie sicher du bei der Extraktion bist)

Antworte NUR mit dem JSON-Objekt, ohne Markdown-Codeblöcke oder Erklärungen."""

# Map LLM-extracted document_type strings to DB lookup names
DOCUMENT_TYPE_MAP = {
    "arbeitsvertrag": "Arbeitsvertrag",
    "kuendigung": "Kündigung",
    "zeugnis": "Zeugnis",
    "abmahnung": "Abmahnung",
    "anderungsvertrag": "Änderungsvertrag",
}


async def _extract_data_from_email(
    llm: LLMService,
    subject: Optional[str],
    body_text: str,
    user_id: str,
) -> Dict[str, Any]:
    """Use LLM to extract structured data from email body. Returns parsed dict."""
    user_prompt = ""
    if subject:
        user_prompt += f"Betreff: {subject}\n\n"
    user_prompt += f"E-Mail-Inhalt:\n{body_text}"

    _start = time.time()
    response = await llm.chat(
        messages=[
            LLMMessage(role="system", content=EXTRACTION_SYSTEM_PROMPT),
            LLMMessage(role="user", content=user_prompt),
        ],
        config=LLMConfig(temperature=0.1, max_tokens=1000),
    )
    latency_ms = int((time.time() - _start) * 1000)

    # Fire-and-forget logging
    asyncio.create_task(log_llm_call(
        feature="email_ingest",
        response=response,
        latency_ms=latency_ms,
        user_id=user_id,
    ))

    # Parse JSON from LLM response
    content = response.content.strip()
    # Strip markdown code fences if present
    if content.startswith("```"):
        lines = content.split("\n")
        # Remove first and last lines (```json and ```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        content = "\n".join(lines)

    try:
        extracted = json.loads(content)
    except json.JSONDecodeError:
        logger.warning("LLM returned non-JSON response for email extraction: %s", content[:200])
        raise ValueError("KI konnte keine strukturierten Daten aus der E-Mail extrahieren")

    return extracted


async def _resolve_document_type(
    db: AsyncSession,
    extracted_type: str,
    country_code: str = "DE",
) -> Optional[DocumentType]:
    """Resolve extracted document_type string to a DocumentType record."""
    display_name = DOCUMENT_TYPE_MAP.get(extracted_type.lower())
    if not display_name:
        return None

    result = await db.execute(
        select(DocumentType)
        .where(DocumentType.name == display_name)
        .where(DocumentType.country_code == country_code)
        .where(DocumentType.is_active == True)
        .limit(1)
    )
    return result.scalar_one_or_none()


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("", response_model=EmailIngestResponse)
async def ingest_email(
    payload: EmailIngestRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Webhook endpoint for incoming emails.

    Matches from_email against registered users.
    If unknown sender: creates EmailIngest with status='rejected', returns 200 (no user info leak).
    If known sender: extracts data via LLM, creates DocumentDraft, sends notification.
    """
    # 1. Match sender to a registered user
    result = await db.execute(
        select(User).where(
            func.lower(User.email) == payload.from_email.lower().strip()
        )
    )
    user = result.scalar_one_or_none()

    if user is None:
        # Unknown sender -- create record but reject silently
        ingest = EmailIngest(
            user_id=0,  # No user matched
            from_email=payload.from_email,
            subject=payload.subject,
            body_text=payload.body_text,
            status="rejected",
            error_message="Absender nicht als Benutzer registriert",
        )
        db.add(ingest)
        await db.commit()
        await db.refresh(ingest)

        logger.info("Email ingest rejected: unknown sender %s", payload.from_email)
        return EmailIngestResponse(
            status="received",
            ingest_id=ingest.id,
            message="E-Mail empfangen",
        )

    # 2. Create ingest record in processing state
    ingest = EmailIngest(
        user_id=user.id,
        from_email=payload.from_email,
        subject=payload.subject,
        body_text=payload.body_text,
        status="processing",
    )
    db.add(ingest)
    await db.commit()
    await db.refresh(ingest)

    # 3. Extract structured data via LLM
    try:
        llm = await get_llm_service()
    except RuntimeError as e:
        ingest.status = "failed"
        ingest.error_message = f"KI-Service nicht verfügbar: {str(e)}"
        await db.commit()
        logger.error("Email ingest %d: LLM service unavailable: %s", ingest.id, e)
        return EmailIngestResponse(
            status="failed",
            ingest_id=ingest.id,
            message="KI-Service nicht verfügbar",
        )

    try:
        extracted = await _extract_data_from_email(
            llm, payload.subject, payload.body_text, str(user.id)
        )
        ingest.extracted_data = json.dumps(extracted, ensure_ascii=False)
    except (ValueError, Exception) as e:
        ingest.status = "failed"
        ingest.error_message = str(e)
        await db.commit()
        logger.error("Email ingest %d: extraction failed: %s", ingest.id, e)
        return EmailIngestResponse(
            status="failed",
            ingest_id=ingest.id,
            message="Datenextraktion fehlgeschlagen",
        )

    # 4. Resolve document type
    extracted_doc_type = extracted.get("document_type", "arbeitsvertrag")
    country_code = user.country_code or "DE"
    doc_type = await _resolve_document_type(db, extracted_doc_type, country_code)

    if doc_type is None:
        # Fallback: try without country filter
        result_fallback = await db.execute(
            select(DocumentType)
            .where(DocumentType.is_active == True)
            .limit(1)
        )
        doc_type = result_fallback.scalar_one_or_none()

    if doc_type is None:
        ingest.status = "failed"
        ingest.error_message = "Kein passender Dokumenttyp gefunden"
        await db.commit()
        return EmailIngestResponse(
            status="failed",
            ingest_id=ingest.id,
            message="Kein passender Dokumenttyp gefunden",
        )

    # 5. Build form_data for the draft
    form_data = {}
    field_map = {
        "vorname": "vorname",
        "nachname": "nachname",
        "position": "position",
        "gehalt": "gehalt",
        "eintrittsdatum": "eintrittsdatum",
        "wochenstunden": "wochenstunden",
    }
    for llm_key, form_key in field_map.items():
        value = extracted.get(llm_key)
        if value is not None and str(value).strip():
            form_data[form_key] = value

    # 6. Create DocumentDraft
    employee_name_parts = []
    if extracted.get("vorname"):
        employee_name_parts.append(str(extracted["vorname"]))
    if extracted.get("nachname"):
        employee_name_parts.append(str(extracted["nachname"]))
    employee_name = " ".join(employee_name_parts) or "Unbekannt"

    draft_name = f"E-Mail-Entwurf: {DOCUMENT_TYPE_MAP.get(extracted_doc_type, extracted_doc_type)} - {employee_name}"

    draft = DocumentDraft(
        country_code=country_code,
        document_type_id=doc_type.id,
        user_id=str(user.id),
        name=draft_name,
        form_data=json.dumps(form_data, ensure_ascii=False),
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)

    # 7. Update ingest record
    ingest.status = "completed"
    ingest.draft_ids = json.dumps([draft.id])
    await db.commit()

    # 8. Create in-app notification
    doc_type_display = DOCUMENT_TYPE_MAP.get(extracted_doc_type, extracted_doc_type)
    notification = Notification(
        user_id=str(user.id),
        notification_type="email_ingest_completed",
        title="Neuer Entwurf aus E-Mail erstellt",
        message=f"Neuer Entwurf aus E-Mail erstellt: {doc_type_display} für {employee_name}",
        priority="normal",
        entity_type="draft",
        entity_id=draft.id,
        action_url=f"/generator?draft_id={draft.id}",
    )
    db.add(notification)
    await db.commit()

    logger.info(
        "Email ingest %d completed: draft %d created for user %d (%s)",
        ingest.id, draft.id, user.id, employee_name,
    )

    return EmailIngestResponse(
        status="completed",
        ingest_id=ingest.id,
        draft_id=draft.id,
        message=f"Entwurf erstellt: {doc_type_display} für {employee_name}",
    )


@router.get("/history", response_model=EmailIngestListResponse)
async def list_email_ingests(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List email ingests for the current user (paginated)."""
    # Count total
    count_result = await db.execute(
        select(func.count(EmailIngest.id)).where(EmailIngest.user_id == current_user.id)
    )
    total = count_result.scalar() or 0

    # Fetch items
    result = await db.execute(
        select(EmailIngest)
        .where(EmailIngest.user_id == current_user.id)
        .order_by(EmailIngest.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    ingests = result.scalars().all()

    items = []
    for ing in ingests:
        items.append(EmailIngestDetail(
            id=ing.id,
            from_email=ing.from_email,
            subject=ing.subject,
            body_text=ing.body_text,
            status=ing.status,
            extracted_data=json.loads(ing.extracted_data) if ing.extracted_data else None,
            draft_ids=json.loads(ing.draft_ids) if ing.draft_ids else None,
            error_message=ing.error_message,
            received_at=ing.received_at.isoformat() if ing.received_at else None,
            created_at=ing.created_at.isoformat() if ing.created_at else None,
        ))

    return EmailIngestListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{ingest_id}", response_model=EmailIngestDetail)
async def get_email_ingest(
    ingest_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get details of a single email ingest."""
    ingest = await db.get(EmailIngest, ingest_id)
    if not ingest or ingest.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="E-Mail-Eingang nicht gefunden")

    return EmailIngestDetail(
        id=ingest.id,
        from_email=ingest.from_email,
        subject=ingest.subject,
        body_text=ingest.body_text,
        status=ingest.status,
        extracted_data=json.loads(ingest.extracted_data) if ingest.extracted_data else None,
        draft_ids=json.loads(ingest.draft_ids) if ingest.draft_ids else None,
        error_message=ingest.error_message,
        received_at=ingest.received_at.isoformat() if ingest.received_at else None,
        created_at=ingest.created_at.isoformat() if ingest.created_at else None,
    )
