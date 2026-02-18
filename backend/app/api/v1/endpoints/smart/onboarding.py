"""
Onboarding Package Endpoint — SSE streaming pipeline.

POST /api/v1/smart/onboarding — Create document package (SSE stream)
GET  /api/v1/smart/onboarding/{job_id} — Get job status + drafts
GET  /api/v1/smart/onboarding/packages — List available packages
"""
import asyncio
import json
import logging
import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.models.enterprise import OnboardingJob, DocumentDraft
from app.services.onboarding_service import (
    extract_employee_data,
    create_package_drafts,
    search_employee_history,
)
from app.services.onboarding_packages import (
    ONBOARDING_PACKAGES, detect_package_from_text,
)
from app.services.llm_service import log_llm_call, LLMResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/smart/onboarding", tags=["smart-onboarding"])


class OnboardingRequest(BaseModel):
    message: str = Field(..., description="Natürlichsprachliche Beschreibung, z.B. 'Onboarding für Anna Müller, Developer, 70k'")
    package_key: Optional[str] = Field(None, description="Optional: Paket-Schlüssel (onboarding, kuendigung, befoerderung)")
    country_code: str = Field(default="DE", pattern="^(DE|AT|CH|IT)$")


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.get("/packages")
async def list_packages(current_user=Depends(get_current_user)):
    """List available document packages."""
    return {
        "packages": [
            {"key": key, "name": pkg["name"], "description": pkg["description"],
             "document_types": pkg["document_types"]}
            for key, pkg in ONBOARDING_PACKAGES.items()
        ]
    }


@router.get("/{job_id}")
async def get_job_status(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get onboarding job status and draft details."""
    job = await db.get(OnboardingJob, job_id)
    if not job or job.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Job nicht gefunden")

    draft_ids = json.loads(job.draft_ids) if job.draft_ids else []
    drafts = []
    for did in draft_ids:
        draft = await db.get(DocumentDraft, did)
        if draft:
            drafts.append({
                "id": draft.id,
                "name": draft.name,
                "document_type_id": draft.document_type_id,
                "country_code": draft.country_code,
            })

    return {
        "id": job.id,
        "status": job.status,
        "package_key": job.package_key,
        "employee_name": job.employee_name,
        "drafts": drafts,
        "error_message": job.error_message,
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }


@router.post("")
async def create_onboarding_package(
    request: OnboardingRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Create a document package via SSE streaming pipeline.

    Streams progress events as each step completes:
    - status: Pipeline step progress
    - employee_history: Found previous documents
    - draft_created: Each draft as it's created
    - done: Final summary with all drafts
    - error: If something fails
    """
    async def _stream():
        _start = time.time()

        try:
            # Step 1: Extract data from message
            yield _sse({"type": "status", "step": "extracting",
                        "message": "Extrahiere Mitarbeiterdaten..."})

            extracted = await extract_employee_data(
                request.message, request.country_code
            )

            # Determine package key
            pkg_key = request.package_key or extracted.get("package_key")
            if not pkg_key:
                pkg_key = detect_package_from_text(request.message)
            if not pkg_key:
                pkg_key = "onboarding"  # sensible default

            package = ONBOARDING_PACKAGES.get(pkg_key)
            if not package:
                yield _sse({"type": "error", "message": f"Unbekanntes Paket: {pkg_key}"})
                return

            employee_name = f"{extracted.get('vorname', '')} {extracted.get('nachname', '')}".strip()

            yield _sse({"type": "status", "step": "extracted",
                        "message": f"Daten extrahiert: {employee_name or 'Mitarbeiter'}",
                        "extracted_fields": list(extracted.keys()),
                        "package_key": pkg_key,
                        "package_name": package["name"]})

            # Step 2: Search employee history
            yield _sse({"type": "status", "step": "history",
                        "message": f"Suche frühere Dokumente{' für ' + employee_name if employee_name else ''}..."})

            history = await search_employee_history(
                employee_name, current_user.id, db
            )

            if history:
                yield _sse({"type": "employee_history",
                            "field_count": len(history),
                            "message": f"{len(history)} Felder aus früheren Dokumenten übernommen"})
            else:
                yield _sse({"type": "status", "step": "history_empty",
                            "message": "Keine früheren Dokumente gefunden"})

            # Step 3: Create drafts
            yield _sse({"type": "status", "step": "creating",
                        "message": f"Erstelle {len(package['document_types'])} Dokumente..."})

            job = await create_package_drafts(
                package_key=pkg_key,
                extracted_data=extracted,
                user_id=current_user.id,
                country_code=request.country_code,
                db=db,
            )

            # Stream individual draft results
            draft_results = getattr(job, "_draft_results", [])
            for dr in draft_results:
                if dr.get("error"):
                    yield _sse({"type": "draft_error",
                                "document_type": dr["document_type"],
                                "error": dr["error"]})
                else:
                    yield _sse({"type": "draft_created", "draft": dr})

            # Step 4: Done
            latency_ms = int((time.time() - _start) * 1000)

            total_missing = sum(
                len(dr.get("missing_fields", []))
                for dr in draft_results if not dr.get("error")
            )
            successful = [dr for dr in draft_results if not dr.get("error")]

            summary = f"{len(successful)} Dokumente erstellt"
            if total_missing > 0:
                summary += f", {total_missing} fehlende Felder"

            yield _sse({
                "type": "done",
                "job_id": job.id,
                "status": job.status,
                "summary": summary,
                "drafts": draft_results,
                "latency_ms": latency_ms,
            })

            # Fire-and-forget LLM logging
            try:
                llm_response = LLMResponse(
                    content=json.dumps(extracted),
                    provider="pipeline",
                    model="extraction",
                    usage={"total_tokens": 0},
                )
                asyncio.create_task(log_llm_call(
                    feature="onboarding",
                    response=llm_response,
                    latency_ms=latency_ms,
                    user_id=str(current_user.id),
                    country_code=request.country_code,
                ))
            except Exception:
                pass

        except Exception as e:
            logger.error(f"Onboarding pipeline error: {e}")
            yield _sse({"type": "error", "message": str(e)})

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
