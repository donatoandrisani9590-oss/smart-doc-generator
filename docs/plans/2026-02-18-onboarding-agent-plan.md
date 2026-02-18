# Onboarding-Paket-Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a hybrid AI agent that creates complete document packages (e.g., Onboarding: contract + NDA + home office) via a fast deterministic pipeline, with agent-powered follow-up refinement in the existing chat.

**Architecture:** Phase 1 uses a single LLM call to extract employee data, then deterministically creates DocumentDrafts for each document type in the package. Phase 2 extends the existing agent orchestrator (`agent.py`) with 2 new tools so users can refine drafts via chat. Frontend adds a 5th mode to ChatAssistent.

**Tech Stack:** FastAPI (SSE streaming), SQLAlchemy async, React 19 + TypeScript, existing LLMService (Groq/Mistral/Ollama), existing agent_tools.py pattern

---

## Task 1: OnboardingJob Model + Migration

**Files:**
- Modify: `backend/app/models/enterprise.py` (append after `BulkJob` class, ~line 80)
- Modify: `backend/app/models/__init__.py` (add import + export)
- Create: `backend/migrations/versions/011_add_onboarding_jobs.py`

**Step 1: Add OnboardingJob model to enterprise.py**

Add after the `BulkJob` class (~line 80):

```python
class OnboardingJob(Base):
    """Tracks a document package creation job (Onboarding, Kündigung, etc.)."""
    __tablename__ = "onboarding_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    package_key = Column(String(50), nullable=False)  # "onboarding", "kuendigung", "befoerderung"
    employee_name = Column(String(255), nullable=True)
    country_code = Column(String(2), nullable=False, default="DE")
    status = Column(String(20), default="pending", nullable=False, index=True)  # pending, processing, completed, failed, partial
    input_data = Column(Text, nullable=True)  # JSON: LLM-extracted fields
    draft_ids = Column(Text, nullable=True)  # JSON: [draft_id_1, draft_id_2, ...]
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

**Step 2: Add import to `__init__.py`**

In `backend/app/models/__init__.py`, add `OnboardingJob` to the import from `enterprise` and to `__all__`.

**Step 3: Create migration file**

Create `backend/migrations/versions/011_add_onboarding_jobs.py`:

```python
"""Add onboarding_jobs table

Revision ID: 011
"""
from alembic import op
import sqlalchemy as sa

revision = "011_add_onboarding_jobs"
down_revision = "010_fix_at_verguetung_template"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "onboarding_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("package_key", sa.String(50), nullable=False),
        sa.Column("employee_name", sa.String(255), nullable=True),
        sa.Column("country_code", sa.String(2), nullable=False, server_default="DE"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending", index=True),
        sa.Column("input_data", sa.Text(), nullable=True),
        sa.Column("draft_ids", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

def downgrade():
    op.drop_table("onboarding_jobs")
```

**Step 4: Verify model loads**

Run: `cd backend && python -c "from app.models.enterprise import OnboardingJob; print('OK:', OnboardingJob.__tablename__)"`
Expected: `OK: onboarding_jobs`

**Step 5: Commit**

```bash
git add backend/app/models/enterprise.py backend/app/models/__init__.py backend/migrations/versions/011_add_onboarding_jobs.py
git commit -m "feat: add OnboardingJob model + migration"
```

---

## Task 2: Package Definitions

**Files:**
- Create: `backend/app/services/onboarding_packages.py`

**Step 1: Create package definitions file**

```python
"""
Onboarding Package Definitions — predefined document bundles.

Each package maps to a set of DocumentType names and shared fields
that are auto-populated across all documents in the package.
"""
from typing import Dict, List, Any

# Package key → definition
ONBOARDING_PACKAGES: Dict[str, Dict[str, Any]] = {
    "onboarding": {
        "name": "Onboarding",
        "description": "Neuen Mitarbeiter einstellen",
        "document_types": ["Arbeitsvertrag", "Verschwiegenheit", "Homeoffice"],
        "shared_fields": [
            "vorname", "nachname", "position", "gehalt", "eintrittsdatum",
            "strasse", "plz", "ort", "geburtsdatum",
        ],
    },
    "kuendigung": {
        "name": "Kündigung",
        "description": "Mitarbeiter kündigen",
        "document_types": ["Kündigung", "Freistellung", "Zeugnis"],
        "shared_fields": [
            "vorname", "nachname", "position",
            "strasse", "plz", "ort",
        ],
    },
    "befoerderung": {
        "name": "Beförderung",
        "description": "Mitarbeiter befördern",
        "document_types": ["Beförderung", "Gehaltserhöhung", "Nachtrag"],
        "shared_fields": [
            "vorname", "nachname", "position",
        ],
    },
}

# Keywords that trigger package detection from user input
PACKAGE_KEYWORDS: Dict[str, List[str]] = {
    "onboarding": ["onboarding", "einstellen", "einstellung", "neuer mitarbeiter", "neue mitarbeiterin", "neueinstellung"],
    "kuendigung": ["kündigung", "kündigen", "entlassen", "entlassung", "trennung"],
    "befoerderung": ["beförderung", "befördern", "aufstieg", "promotion"],
}


def detect_package_from_text(text: str) -> str | None:
    """Detect package key from user message text. Returns None if no match."""
    text_lower = text.lower()
    for key, keywords in PACKAGE_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return key
    return None


def get_package(key: str) -> Dict[str, Any] | None:
    """Get package definition by key."""
    return ONBOARDING_PACKAGES.get(key)
```

**Step 2: Commit**

```bash
git add backend/app/services/onboarding_packages.py
git commit -m "feat: add onboarding package definitions"
```

---

## Task 3: Onboarding Service (Core Pipeline)

**Files:**
- Create: `backend/app/services/onboarding_service.py`

This is the core service. It does:
1. LLM extraction (1 call)
2. Package resolution (DB lookup)
3. Employee history search
4. Draft creation (deterministic)

**Step 1: Create the service file**

```python
"""
Onboarding Service — deterministic document package pipeline.

Pipeline steps:
1. LLM extracts structured data from user message (1 LLM call)
2. Resolve package → DocumentType IDs from DB
3. Search employee history for data reuse
4. Create DocumentDraft per document type (merge: defaults < history < extracted)
5. Save OnboardingJob with draft_ids
"""
import json
import logging
from typing import Optional

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.documents import DocumentType
from app.models.enterprise import (
    GeneratedDocument, DocumentDraft, FormField, OnboardingJob,
)
from app.services.llm_service import LLMService, LLMMessage, LLMConfig, get_llm_service
from app.services.onboarding_packages import (
    ONBOARDING_PACKAGES, detect_package_from_text, get_package,
)

logger = logging.getLogger(__name__)


async def extract_employee_data(message: str, country_code: str = "DE") -> dict:
    """
    Extract structured employee data from natural language input.

    Uses a single LLM call with JSON mode to parse fields like
    vorname, nachname, position, gehalt, eintrittsdatum, and package_key.

    Returns dict with extracted fields + optional "package_key".
    """
    llm = await get_llm_service()
    config = LLMConfig(temperature=0.1, max_tokens=800, json_mode=True)

    system_prompt = (
        "Du extrahierst strukturierte Mitarbeiterdaten aus natürlichsprachlichen Eingaben. "
        "Antworte NUR mit einem JSON-Objekt. Verfügbare Felder:\n"
        "- vorname (string)\n"
        "- nachname (string)\n"
        "- position (string)\n"
        "- gehalt (string, z.B. '70000')\n"
        "- eintrittsdatum (string, ISO-Format YYYY-MM-DD)\n"
        "- wochenstunden (string)\n"
        "- strasse (string)\n"
        "- plz (string)\n"
        "- ort (string)\n"
        "- geburtsdatum (string, ISO-Format)\n"
        "- package_key (string: 'onboarding', 'kuendigung', oder 'befoerderung')\n\n"
        "Extrahiere NUR Felder, die explizit genannt werden. "
        "Lasse Felder weg, die nicht im Text vorkommen. "
        f"Länderkontext: {country_code}."
    )

    messages = [
        LLMMessage(role="system", content=system_prompt),
        LLMMessage(role="user", content=message),
    ]

    response = await llm.chat(messages, config)

    try:
        data = json.loads(response.content)
    except json.JSONDecodeError:
        logger.warning(f"LLM returned non-JSON: {response.content[:200]}")
        data = {}

    # Fallback: detect package from keywords if LLM didn't extract it
    if "package_key" not in data or data["package_key"] not in ONBOARDING_PACKAGES:
        detected = detect_package_from_text(message)
        if detected:
            data["package_key"] = detected

    return data


async def resolve_document_types(
    package_key: str,
    country_code: str,
    db: AsyncSession,
) -> list[tuple[int, str]]:
    """
    Resolve package document type names to DB IDs.

    Returns list of (document_type_id, document_type_name) tuples.
    Skips types that don't exist in DB (with warning).
    """
    package = get_package(package_key)
    if not package:
        return []

    type_names = package["document_types"]
    resolved = []

    for name in type_names:
        result = await db.execute(
            select(DocumentType.id, DocumentType.name).where(
                and_(
                    DocumentType.name.ilike(f"%{name}%"),
                    or_(
                        DocumentType.country_code == country_code,
                        DocumentType.country_code.is_(None),
                    ),
                )
            ).limit(1)
        )
        row = result.first()
        if row:
            resolved.append((row.id, row.name))
        else:
            logger.warning(f"DocumentType '{name}' not found for country {country_code}")

    return resolved


async def search_employee_history(
    employee_name: str,
    user_id: int,
    db: AsyncSession,
) -> dict:
    """
    Search previous documents for an employee and extract reusable form data.

    Returns merged form_data from the most recent document.
    """
    if not employee_name:
        return {}

    result = await db.execute(
        select(GeneratedDocument.form_data)
        .where(
            and_(
                GeneratedDocument.employee_name.ilike(f"%{employee_name}%"),
                GeneratedDocument.created_by_id == user_id,
                GeneratedDocument.is_deleted == False,
            )
        )
        .order_by(GeneratedDocument.created_at.desc())
        .limit(5)
    )

    merged = {}
    for row in reversed(result.all()):  # oldest first so newest overwrites
        if row.form_data:
            try:
                fd = json.loads(row.form_data) if isinstance(row.form_data, str) else row.form_data
                # Only merge non-empty values
                for k, v in fd.items():
                    if v and str(v).strip():
                        merged[k] = v
            except (json.JSONDecodeError, TypeError):
                continue

    return merged


async def get_field_defaults(
    document_type_id: int,
    db: AsyncSession,
) -> dict:
    """Load default values from FormField definitions."""
    result = await db.execute(
        select(FormField.field_name, FormField.default_value)
        .where(FormField.document_type_id == document_type_id)
    )
    return {
        row.field_name: row.default_value
        for row in result.all()
        if row.default_value
    }


async def get_required_fields(
    document_type_id: int,
    db: AsyncSession,
) -> list[str]:
    """Get list of required field names for a document type."""
    result = await db.execute(
        select(FormField.field_name)
        .where(
            and_(
                FormField.document_type_id == document_type_id,
                FormField.is_required == True,
            )
        )
    )
    return [row.field_name for row in result.all()]


async def create_package_drafts(
    package_key: str,
    extracted_data: dict,
    user_id: int,
    country_code: str,
    db: AsyncSession,
) -> OnboardingJob:
    """
    Create all document drafts for a package.

    Pipeline:
    1. Resolve DocumentType IDs
    2. Search employee history
    3. For each type: merge fields → create draft → compute missing fields
    4. Save OnboardingJob

    Returns the OnboardingJob with status and draft_ids.
    """
    package = get_package(package_key)
    if not package:
        raise ValueError(f"Unknown package: {package_key}")

    # Build employee name for history search
    vorname = extracted_data.get("vorname", "")
    nachname = extracted_data.get("nachname", "")
    employee_name = f"{vorname} {nachname}".strip()

    # Create job record
    job = OnboardingJob(
        user_id=user_id,
        package_key=package_key,
        employee_name=employee_name or None,
        country_code=country_code,
        status="processing",
        input_data=json.dumps(extracted_data, ensure_ascii=False),
    )
    db.add(job)
    await db.flush()  # Get job.id

    # Resolve document types
    doc_types = await resolve_document_types(package_key, country_code, db)
    if not doc_types:
        job.status = "failed"
        job.error_message = "Keine Dokumenttypen für dieses Paket gefunden"
        await db.commit()
        return job

    # Search employee history
    history_data = await search_employee_history(employee_name, user_id, db)

    # Shared fields from package definition
    shared_fields = set(package.get("shared_fields", []))

    # Build shared field values (extracted data takes priority over history)
    shared_values = {}
    for field in shared_fields:
        if field in extracted_data and extracted_data[field]:
            shared_values[field] = extracted_data[field]
        elif field in history_data and history_data[field]:
            shared_values[field] = history_data[field]

    draft_ids = []
    draft_results = []

    for doc_type_id, doc_type_name in doc_types:
        try:
            # Load defaults
            defaults = await get_field_defaults(doc_type_id, db)
            required = await get_required_fields(doc_type_id, db)

            # Merge: defaults < history < shared < extracted
            form_data = {}
            form_data.update(defaults)
            form_data.update({k: v for k, v in history_data.items() if v})
            form_data.update(shared_values)
            form_data.update({k: v for k, v in extracted_data.items()
                            if v and k != "package_key"})

            # Calculate missing required fields
            missing = [f for f in required if not form_data.get(f)]

            # Create draft
            draft_name = f"{doc_type_name} — {employee_name}" if employee_name else doc_type_name
            draft = DocumentDraft(
                document_type_id=doc_type_id,
                country_code=country_code,
                user_id=str(user_id),
                name=draft_name,
                form_data=json.dumps(form_data, ensure_ascii=False),
            )
            db.add(draft)
            await db.flush()

            draft_ids.append(draft.id)
            draft_results.append({
                "id": draft.id,
                "title": draft_name,
                "document_type": doc_type_name,
                "document_type_id": doc_type_id,
                "missing_fields": missing,
                "field_count": len(form_data),
            })

        except Exception as e:
            logger.error(f"Failed to create draft for {doc_type_name}: {e}")
            draft_results.append({
                "id": None,
                "title": doc_type_name,
                "document_type": doc_type_name,
                "document_type_id": doc_type_id,
                "error": str(e),
            })

    # Update job
    job.draft_ids = json.dumps(draft_ids)
    job.status = "completed" if draft_ids else "failed"
    if not draft_ids:
        job.error_message = "Keine Entwürfe konnten erstellt werden"
    elif len(draft_ids) < len(doc_types):
        job.status = "partial"

    await db.commit()

    # Attach results to job for the endpoint to stream
    job._draft_results = draft_results  # type: ignore[attr-defined]
    job._history_data = history_data  # type: ignore[attr-defined]

    return job
```

**Step 2: Commit**

```bash
git add backend/app/services/onboarding_service.py
git commit -m "feat: add onboarding service — LLM extraction + draft pipeline"
```

---

## Task 4: SSE Endpoint

**Files:**
- Create: `backend/app/api/v1/endpoints/smart/onboarding.py`
- Modify: `backend/app/api/v1/endpoints/smart/__init__.py` (add import)
- Modify: `backend/app/main.py` (register router)

**Step 1: Create the onboarding endpoint**

```python
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
```

**Step 2: Add import to `smart/__init__.py`**

Add `onboarding` to the imports and `__all__` in `backend/app/api/v1/endpoints/smart/__init__.py`.

**Step 3: Register router in `main.py`**

Add after the agent router registration (~line 686):

```python
# Onboarding Package Agent — document bundle creation
from app.api.v1.endpoints.smart import onboarding as smart_onboarding
app.include_router(smart_onboarding.router, prefix=f"{settings.API_V1_STR}", tags=["smart-onboarding"])
```

**Step 4: Commit**

```bash
git add backend/app/api/v1/endpoints/smart/onboarding.py backend/app/api/v1/endpoints/smart/__init__.py backend/app/main.py
git commit -m "feat: add onboarding SSE endpoint + router registration"
```

---

## Task 5: New Agent Tools (Phase 2)

**Files:**
- Modify: `backend/app/services/agent_tools.py` (add 2 tool definitions + 2 executors)

**Step 1: Add tool definitions to AGENT_TOOLS list**

Append these 2 tools to the `AGENT_TOOLS` list in `agent_tools.py`:

```python
    {
        "type": "function",
        "function": {
            "name": "update_package_draft",
            "description": (
                "Aktualisiere einen einzelnen Entwurf aus einem Onboarding-Paket. "
                "Kann Formularfelder ändern. Verwende die Draft-ID aus dem Paket-Ergebnis."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "draft_id": {
                        "type": "integer",
                        "description": "ID des zu aktualisierenden Entwurfs",
                    },
                    "field_updates": {
                        "type": "object",
                        "description": "Key-Value-Paare der zu ändernden Felder",
                        "additionalProperties": {"type": "string"},
                    },
                },
                "required": ["draft_id", "field_updates"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "apply_to_all_drafts",
            "description": (
                "Wende Feldänderungen auf ALLE Entwürfe eines Onboarding-Pakets an. "
                "Nützlich für gemeinsame Felder wie Adresse, Name, Eintrittsdatum."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {
                        "type": "integer",
                        "description": "ID des Onboarding-Jobs",
                    },
                    "field_updates": {
                        "type": "object",
                        "description": "Key-Value-Paare der zu ändernden Felder",
                        "additionalProperties": {"type": "string"},
                    },
                },
                "required": ["job_id", "field_updates"],
            },
        },
    },
```

**Step 2: Add executor functions and register them**

Add executor functions:

```python
async def _exec_update_package_draft(
    args: dict, db: AsyncSession, user_id: int, country_code: str
) -> dict:
    """Update a single draft's form_data."""
    draft_id = args.get("draft_id")
    field_updates = args.get("field_updates", {})

    if not draft_id or not field_updates:
        return {"error": "draft_id und field_updates sind erforderlich"}

    draft = await db.get(DocumentDraft, draft_id)
    if not draft or draft.user_id != str(user_id):
        return {"error": f"Entwurf {draft_id} nicht gefunden"}

    # Merge updates into existing form_data
    try:
        form_data = json.loads(draft.form_data) if draft.form_data else {}
    except (json.JSONDecodeError, TypeError):
        form_data = {}

    form_data.update(field_updates)
    draft.form_data = json.dumps(form_data, ensure_ascii=False)
    await db.commit()

    return {
        "status": "ok",
        "draft_id": draft_id,
        "fields_updated": len(field_updates),
        "draft_name": draft.name or "",
    }


async def _exec_apply_to_all_drafts(
    args: dict, db: AsyncSession, user_id: int, country_code: str
) -> dict:
    """Update all drafts in an onboarding job."""
    job_id = args.get("job_id")
    field_updates = args.get("field_updates", {})

    if not job_id or not field_updates:
        return {"error": "job_id und field_updates sind erforderlich"}

    job = await db.get(OnboardingJob, job_id)
    if not job or job.user_id != user_id:
        return {"error": f"Job {job_id} nicht gefunden"}

    draft_ids = json.loads(job.draft_ids) if job.draft_ids else []
    updated_count = 0

    for did in draft_ids:
        draft = await db.get(DocumentDraft, did)
        if not draft or draft.user_id != str(user_id):
            continue

        try:
            form_data = json.loads(draft.form_data) if draft.form_data else {}
        except (json.JSONDecodeError, TypeError):
            form_data = {}

        form_data.update(field_updates)
        draft.form_data = json.dumps(form_data, ensure_ascii=False)
        updated_count += 1

    await db.commit()

    return {
        "status": "ok",
        "job_id": job_id,
        "drafts_updated": updated_count,
        "fields_updated": len(field_updates),
    }
```

Add to the `executors` dict inside `execute_tool()`:

```python
    "update_package_draft": _exec_update_package_draft,
    "apply_to_all_drafts": _exec_apply_to_all_drafts,
```

Add the `OnboardingJob` import at the top of the file:

```python
from app.models.enterprise import GeneratedDocument, FormField, OnboardingJob, DocumentDraft
```

Note: `DocumentDraft` is already partially used — check if it's already imported, otherwise add it.

**Step 3: Add `_INT_PARAMS` entries in `agent.py`**

In `backend/app/api/v1/endpoints/smart/agent.py`, add to the `_INT_PARAMS` dict:

```python
    "update_package_draft": {"draft_id"},
    "apply_to_all_drafts": {"job_id"},
```

**Step 4: Commit**

```bash
git add backend/app/services/agent_tools.py backend/app/api/v1/endpoints/smart/agent.py
git commit -m "feat: add update_package_draft + apply_to_all_drafts agent tools"
```

---

## Task 6: Feature Flag

**Files:**
- Modify: `backend/app/models/user_settings.py` (add column + definition)
- Create: `backend/migrations/versions/012_add_onboarding_agent_flag.py`

**Step 1: Add column to UserFeatureSettings**

In `user_settings.py`, add after `enable_ai_agent`:

```python
    enable_onboarding_agent = Column(Boolean, default=True, nullable=False)
```

**Step 2: Add to FEATURE_DEFINITIONS**

```python
    "enable_onboarding_agent": {
        "label": "Onboarding-Agent",
        "description": "Erstellt komplette Dokumentpakete (Onboarding, Kündigung, Beförderung) per Chat",
        "category": "ai",
        "icon": "Package"
    },
```

**Step 3: Create migration**

```python
"""Add onboarding agent feature flag

Revision ID: 012
"""
from alembic import op
import sqlalchemy as sa

revision = "012_add_onboarding_agent_flag"
down_revision = "011_add_onboarding_jobs"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("user_feature_settings",
        sa.Column("enable_onboarding_agent", sa.Boolean(), nullable=False, server_default=sa.true()))

def downgrade():
    op.drop_column("user_feature_settings", "enable_onboarding_agent")
```

**Step 4: Commit**

```bash
git add backend/app/models/user_settings.py backend/migrations/versions/012_add_onboarding_agent_flag.py
git commit -m "feat: add enable_onboarding_agent feature flag"
```

---

## Task 7: OnboardingResultCard Component

**Files:**
- Create: `frontend/src/components/chat/OnboardingResultCard.tsx`

**Step 1: Create the component**

```tsx
/**
 * OnboardingResultCard — shows draft results from the onboarding pipeline.
 *
 * Displays a card in the chat with:
 * - List of created drafts with status icons
 * - Missing field warnings
 * - "Öffnen" buttons that navigate to the generator with the draft
 */
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, AlertTriangle, XCircle, FileText, ExternalLink, Package,
} from "lucide-react";

interface DraftResult {
  id: number | null;
  title: string;
  document_type: string;
  document_type_id: number;
  missing_fields?: string[];
  field_count?: number;
  error?: string;
}

interface OnboardingResultCardProps {
  packageName: string;
  drafts: DraftResult[];
  jobId: number;
  summary: string;
}

export const OnboardingResultCard = ({
  packageName,
  drafts,
  jobId,
  summary,
}: OnboardingResultCardProps) => {
  const navigate = useNavigate();

  const successful = drafts.filter((d) => d.id != null && !d.error);
  const failed = drafts.filter((d) => d.error);

  const handleOpenDraft = (draftId: number, docTypeId: number) => {
    navigate(`/generate?draft=${draftId}&type=${docTypeId}`);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-4 pb-3 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <span className="font-medium text-sm">
            {packageName}-Paket erstellt
          </span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {successful.length}/{drafts.length} Dokumente
          </Badge>
        </div>

        {/* Draft list */}
        <div className="space-y-2">
          {drafts.map((draft, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-2 rounded-md bg-background/80"
            >
              {/* Status icon */}
              {draft.error ? (
                <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              ) : draft.missing_fields && draft.missing_fields.length > 0 ? (
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              )}

              {/* Document info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">
                    {draft.title}
                  </span>
                </div>
                {draft.error ? (
                  <p className="text-xs text-destructive mt-0.5">{draft.error}</p>
                ) : draft.missing_fields && draft.missing_fields.length > 0 ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {draft.missing_fields.length} fehlende Felder
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vollständig
                  </p>
                )}
              </div>

              {/* Open button */}
              {draft.id != null && !draft.error && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => handleOpenDraft(draft.id!, draft.document_type_id)}
                >
                  Öffnen
                  <ExternalLink className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        {failed.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {failed.length} Dokument(e) konnten nicht erstellt werden.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
```

**Step 2: Commit**

```bash
git add frontend/src/components/chat/OnboardingResultCard.tsx
git commit -m "feat: add OnboardingResultCard component"
```

---

## Task 8: ChatAssistent Integration

**Files:**
- Modify: `frontend/src/components/chat/ChatAssistent.tsx`

This is the biggest frontend change. We add:
1. A 5th mode button "Onboarding"
2. SSE handling for the onboarding pipeline
3. Rendering of OnboardingResultCard in chat
4. After pipeline completes, switch to agent mode for follow-up

**Step 1: Add imports and types**

At the top of `ChatAssistent.tsx`, add:

```tsx
import { OnboardingResultCard } from "./OnboardingResultCard";
import { Package } from "lucide-react";
```

Update the mode type:

```tsx
const [mode, setMode] = useState<"general" | "clause" | "formal" | "document" | "onboarding">("general");
```

Add onboarding state:

```tsx
const [onboardingResult, setOnboardingResult] = useState<{
    jobId: number;
    packageName: string;
    drafts: Array<{
        id: number | null;
        title: string;
        document_type: string;
        document_type_id: number;
        missing_fields?: string[];
        error?: string;
    }>;
    summary: string;
} | null>(null);
```

**Step 2: Add onboarding intent detection in sendMessage**

At the beginning of `sendMessage`, before the streaming logic, add onboarding detection:

```tsx
// Detect onboarding intent
const isOnboardingMode = mode === "onboarding";
const onboardingKeywords = ["onboarding", "einstellen", "kündigung", "kündigen", "beförderung", "befördern"];
const isOnboardingIntent = isOnboardingMode ||
    onboardingKeywords.some(kw => input.toLowerCase().includes(kw));

if (isOnboardingIntent && !onboardingResult) {
    // Route to onboarding pipeline
    await handleOnboardingPipeline(input, allMessages);
    return;
}
```

**Step 3: Add handleOnboardingPipeline function**

```tsx
const handleOnboardingPipeline = async (message: string, allMessages: Message[]) => {
    try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
        setIsStreaming(true);
        setMode("onboarding");

        let statusText = "";

        for await (const event of apiStreamSSE(
            "/api/v1/smart/onboarding",
            { message, country_code: countryCode },
            controller.signal,
        )) {
            if (event.type === "status") {
                statusText = event.message as string;
                setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: statusText };
                    return updated;
                });
            }
            if (event.type === "employee_history") {
                statusText += `\n${event.message}`;
                setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: statusText };
                    return updated;
                });
            }
            if (event.type === "draft_created") {
                const draft = event.draft as { title: string };
                statusText += `\n✅ ${draft.title}`;
                setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: statusText };
                    return updated;
                });
            }
            if (event.type === "done") {
                const doneEvent = event as SSEEvent & {
                    job_id: number;
                    summary: string;
                    drafts: Array<{
                        id: number | null;
                        title: string;
                        document_type: string;
                        document_type_id: number;
                        missing_fields?: string[];
                        error?: string;
                    }>;
                };

                // Detect package name from drafts
                const packageName = event.package_name as string || "Onboarding";

                setOnboardingResult({
                    jobId: doneEvent.job_id,
                    packageName,
                    drafts: doneEvent.drafts || [],
                    summary: doneEvent.summary || "",
                });

                // Final text
                setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                        role: "assistant",
                        content: `${doneEvent.summary}\n\nDu kannst die Dokumente jetzt öffnen und bearbeiten. Oder schreib mir, was ich anpassen soll — z.B. "Adresse ist Musterstraße 5, 80333 München".`,
                    };
                    return updated;
                });
                break;
            }
            if (event.type === "error") {
                throw new Error(event.message as string);
            }
        }
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Onboarding pipeline error:", error);
        setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
                role: "assistant",
                content: `Fehler beim Erstellen des Pakets: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
            };
            return updated;
        });
    } finally {
        abortControllerRef.current = null;
        setIsStreaming(false);
        setIsLoading(false);
    }
};
```

**Step 4: Update mode buttons rendering**

Change the mode buttons array from `["general", "clause", "formal", "document"]` to include "onboarding":

```tsx
{(["general", "clause", "formal", "document", "onboarding"] as const).map((m) => (
    <Button
        key={m}
        variant={mode === m ? "secondary" : "ghost"}
        size="sm"
        onClick={() => { setMode(m); if (m !== mode) { handleReset(); setOnboardingResult(null); } }}
        className="text-xs h-7 px-3"
        disabled={isLoading}
    >
        {m === "general" ? "Allgemein" : m === "clause" ? "Textbausteine" : m === "formal" ? "Formell" : m === "document" ? "Dokument" : "Onboarding"}
    </Button>
))}
```

**Step 5: Render OnboardingResultCard after messages**

In the messages rendering area, after the messages list but before `<div ref={messagesEndRef} />`, add:

```tsx
{onboardingResult && (
    <OnboardingResultCard
        packageName={onboardingResult.packageName}
        drafts={onboardingResult.drafts}
        jobId={onboardingResult.jobId}
        summary={onboardingResult.summary}
    />
)}
```

**Step 6: Update handleReset to clear onboarding state**

In `handleReset`, add: `setOnboardingResult(null);`

**Step 7: Commit**

```bash
git add frontend/src/components/chat/ChatAssistent.tsx
git commit -m "feat: add onboarding mode to ChatAssistent with pipeline SSE + result card"
```

---

## Task 9: Build Verification

**Step 1: Run backend import check**

Run: `cd backend && python -c "from app.api.v1.endpoints.smart.onboarding import router; print('Backend OK')"`
Expected: `Backend OK`

**Step 2: Run frontend build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors (warnings OK)

**Step 3: Fix any issues**

If there are import errors or type issues, fix them.

**Step 4: Commit fixes if needed**

```bash
git add -A && git commit -m "fix: resolve build issues for onboarding agent"
```

---

## Task 10: Backend Tests

**Files:**
- Create: `backend/tests/api/test_onboarding.py`

**Step 1: Write tests**

```python
"""Tests for the onboarding package pipeline."""
import json
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch

from app.models.enterprise import OnboardingJob, DocumentDraft
from app.models.documents import DocumentType
from app.services.onboarding_packages import (
    detect_package_from_text, get_package, ONBOARDING_PACKAGES,
)
from app.services.onboarding_service import extract_employee_data


class TestPackageDefinitions:
    """Test package detection and lookup."""

    def test_detect_onboarding(self):
        assert detect_package_from_text("Onboarding für Anna") == "onboarding"

    def test_detect_kuendigung(self):
        assert detect_package_from_text("Kündigung von Max") == "kuendigung"

    def test_detect_befoerderung(self):
        assert detect_package_from_text("Beförderung von Lisa") == "befoerderung"

    def test_detect_einstellen(self):
        assert detect_package_from_text("Neuer Mitarbeiter einstellen") == "onboarding"

    def test_detect_unknown(self):
        assert detect_package_from_text("Hallo Welt") is None

    def test_get_package_valid(self):
        pkg = get_package("onboarding")
        assert pkg is not None
        assert "Arbeitsvertrag" in pkg["document_types"]

    def test_get_package_invalid(self):
        assert get_package("nonexistent") is None

    def test_all_packages_have_required_keys(self):
        for key, pkg in ONBOARDING_PACKAGES.items():
            assert "name" in pkg
            assert "description" in pkg
            assert "document_types" in pkg
            assert "shared_fields" in pkg
            assert len(pkg["document_types"]) > 0


class TestExtractEmployeeData:
    """Test LLM extraction with mocked LLM."""

    @pytest.mark.asyncio
    async def test_extract_basic_data(self):
        mock_response = AsyncMock()
        mock_response.content = json.dumps({
            "vorname": "Anna",
            "nachname": "Müller",
            "position": "Developer",
            "gehalt": "70000",
            "package_key": "onboarding",
        })

        with patch("app.services.onboarding_service.get_llm_service") as mock_llm:
            mock_service = AsyncMock()
            mock_service.chat.return_value = mock_response
            mock_llm.return_value = mock_service

            result = await extract_employee_data(
                "Onboarding für Anna Müller, Developer, 70k"
            )

            assert result["vorname"] == "Anna"
            assert result["nachname"] == "Müller"
            assert result["package_key"] == "onboarding"

    @pytest.mark.asyncio
    async def test_extract_fallback_package_detection(self):
        """If LLM doesn't return package_key, detect from keywords."""
        mock_response = AsyncMock()
        mock_response.content = json.dumps({
            "vorname": "Max",
            "nachname": "Schmidt",
        })

        with patch("app.services.onboarding_service.get_llm_service") as mock_llm:
            mock_service = AsyncMock()
            mock_service.chat.return_value = mock_response
            mock_llm.return_value = mock_service

            result = await extract_employee_data(
                "Kündigung von Max Schmidt"
            )

            assert result["package_key"] == "kuendigung"

    @pytest.mark.asyncio
    async def test_extract_handles_non_json(self):
        """If LLM returns non-JSON, fallback gracefully."""
        mock_response = AsyncMock()
        mock_response.content = "Sorry, I can't parse that."

        with patch("app.services.onboarding_service.get_llm_service") as mock_llm:
            mock_service = AsyncMock()
            mock_service.chat.return_value = mock_response
            mock_llm.return_value = mock_service

            result = await extract_employee_data("something weird")

            assert isinstance(result, dict)
```

**Step 2: Run tests**

Run: `cd backend && python -m pytest tests/api/test_onboarding.py -x -v`

**Step 3: Fix any failures**

**Step 4: Commit**

```bash
git add backend/tests/api/test_onboarding.py
git commit -m "test: add onboarding package tests"
```

---

## Task 11: Final Integration Commit

**Step 1: Run full frontend build**

Run: `cd frontend && npm run build`
Expected: PASS

**Step 2: Run backend tests**

Run: `cd backend && python -m pytest tests/api/test_onboarding.py -x -v`
Expected: PASS

**Step 3: Final commit if any remaining changes**

```bash
git add -A && git commit -m "feat: complete onboarding-paket-agent implementation"
```

---

## Summary of All Files

### New Files (6)
1. `backend/app/models/enterprise.py` — OnboardingJob model (modification)
2. `backend/app/services/onboarding_packages.py` — Package definitions
3. `backend/app/services/onboarding_service.py` — Core pipeline service
4. `backend/app/api/v1/endpoints/smart/onboarding.py` — SSE endpoint
5. `frontend/src/components/chat/OnboardingResultCard.tsx` — Result card
6. `backend/tests/api/test_onboarding.py` — Tests

### Modified Files (7)
1. `backend/app/models/__init__.py` — Import OnboardingJob
2. `backend/app/main.py` — Register onboarding router
3. `backend/app/api/v1/endpoints/smart/__init__.py` — Import onboarding module
4. `backend/app/services/agent_tools.py` — 2 new tools + executors
5. `backend/app/api/v1/endpoints/smart/agent.py` — INT_PARAMS for new tools
6. `backend/app/models/user_settings.py` — Feature flag
7. `frontend/src/components/chat/ChatAssistent.tsx` — Onboarding mode

### Migrations (2)
1. `backend/migrations/versions/011_add_onboarding_jobs.py`
2. `backend/migrations/versions/012_add_onboarding_agent_flag.py`
