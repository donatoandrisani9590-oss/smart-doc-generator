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
