"""
Smart Bulk Operations API: KI-gestützte Spalten-Zuordnung + SSE-Fortschritt
für die Massenverarbeitung von HR-Dokumenten.

Endpoints:
- POST /upload     — CSV/XLSX hochladen, KI-Mapping-Vorschläge erhalten
- POST /preview    — Mapping bestätigen, erste Zeilen als Vorschau
- POST /execute    — Batch-Generierung mit SSE-Progress-Streaming
- GET  /error-report/{job_id} — Fehlerbericht als CSV herunterladen

Trennung von admin/bulk.py: Diese Datei ist der neue "Smart"-Pfad mit
KI-Mapping und SSE-Streaming; admin/bulk.py bleibt für Abwärtskompatibilität.
"""
import asyncio
import csv
import io
import json
import logging
import os
import re
import tempfile
import time
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db, async_session_factory
from app.api.deps import get_current_user
from app.models.enterprise import BulkJob, FormField, DocumentDraft
from app.models.documents import DocumentType
from app.services.llm_service import (
    LLMService, LLMMessage, LLMConfig, get_llm_service, log_llm_call,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["smart-bulk"])

# Maximum file size for upload (10 MB)
MAX_UPLOAD_SIZE = 10 * 1024 * 1024


# ═══════════════════════════════════════════════════════════════════════════
# PYDANTIC SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class MappingSuggestion(BaseModel):
    csv_column: str
    form_field: Optional[str] = None
    confidence: float = 0.0
    transform_note: Optional[str] = None


class UploadResponse(BaseModel):
    job_id: int
    columns: List[str]
    row_count: int
    mapping_suggestions: List[MappingSuggestion]
    preview_rows: List[Dict[str, Any]]


class PreviewRequest(BaseModel):
    job_id: int
    column_mapping: Dict[str, str] = Field(..., description="CSV-Spalte -> Formularfeld")
    document_type_id: int


class PreviewRow(BaseModel):
    row_num: int
    fields: Dict[str, Any]
    validation_errors: List[str]


class PreviewResponse(BaseModel):
    previews: List[PreviewRow]
    valid_count: int
    error_count: int


class ExecuteRequest(BaseModel):
    job_id: int


# ═══════════════════════════════════════════════════════════════════════════
# FILE PARSING (reused from admin/bulk.py pattern)
# ═══════════════════════════════════════════════════════════════════════════

def _parse_file_content(content: bytes, filename: str) -> Tuple[List[Dict[str, str]], List[str]]:
    """Parse CSV or Excel file content into rows + detected column names."""
    rows: List[Dict[str, str]] = []
    columns: List[str] = []

    if filename.lower().endswith(('.xlsx', '.xls')):
        try:
            import openpyxl
            from io import BytesIO
            wb = openpyxl.load_workbook(BytesIO(content), read_only=True)
            ws = wb.active
            data = list(ws.iter_rows(values_only=True))
            if data:
                columns = [
                    str(c).strip() if c else "spalte_%d" % i
                    for i, c in enumerate(data[0])
                ]
                for row_data in data[1:]:
                    row: Dict[str, str] = {}
                    for i, val in enumerate(row_data):
                        if i < len(columns):
                            row[columns[i]] = str(val) if val is not None else ""
                    if any(v.strip() for v in row.values()):
                        rows.append(row)
        except ImportError:
            raise HTTPException(
                status_code=400,
                detail="Excel-Unterstützung nicht verfügbar. Bitte CSV verwenden.",
            )
    else:
        try:
            decoded = content.decode("utf-8")
        except UnicodeDecodeError:
            decoded = content.decode("latin-1")

        reader = csv.DictReader(io.StringIO(decoded), delimiter=";")
        rows = list(reader)
        if not rows:
            reader = csv.DictReader(io.StringIO(decoded), delimiter=",")
            rows = list(reader)

        if rows:
            columns = [k.strip() for k in rows[0].keys()]
            rows = [{k.strip(): v for k, v in row.items()} for row in rows]

    return rows, columns


# ═══════════════════════════════════════════════════════════════════════════
# FIELD VALIDATION (reused from admin/bulk.py pattern)
# ═══════════════════════════════════════════════════════════════════════════

def _validate_field_value(value: str, field: FormField) -> Tuple[bool, str]:
    """Validate a single field value against FormField rules."""
    if not value and field.is_required:
        return False, "Pflichtfeld ist leer"
    if not value:
        return True, ""

    if field.field_type == "number":
        try:
            num = float(value.replace(",", "."))
            if field.min_value is not None and num < field.min_value:
                return False, "Wert muss mindestens %s sein" % field.min_value
            if field.max_value is not None and num > field.max_value:
                return False, "Wert darf maximal %s sein" % field.max_value
        except ValueError:
            return False, "Ungültiger Zahlenwert"

    elif field.field_type == "date":
        date_formats = ["%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y"]
        valid_date = False
        for fmt in date_formats:
            try:
                datetime.strptime(value, fmt)
                valid_date = True
                break
            except ValueError:
                continue
        if not valid_date:
            return False, "Ungültiges Datumsformat (erwartet: TT.MM.JJJJ oder JJJJ-MM-TT)"

    elif field.field_type == "email":
        email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(email_pattern, value):
            return False, "Ungültige E-Mail-Adresse"

    elif field.field_type == "checkbox":
        valid_values = ["true", "false", "ja", "nein", "yes", "no", "1", "0", "x", ""]
        if value.lower() not in valid_values:
            return False, "Ungültiger Wert für Checkbox (erwartet: ja/nein)"

    if field.field_type in ("text", "textarea"):
        if field.min_length and len(value) < field.min_length:
            return False, "Text muss mindestens %s Zeichen haben" % field.min_length
        if field.max_length and len(value) > field.max_length:
            return False, "Text darf maximal %s Zeichen haben" % field.max_length

    if field.pattern:
        try:
            if not re.match(field.pattern, value):
                return False, field.pattern_error_message or "Format stimmt nicht überein"
        except re.error:
            pass

    return True, ""


# ═══════════════════════════════════════════════════════════════════════════
# TRANSFORM HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def _apply_transform(value: str, transform: Optional[str]) -> Dict[str, str]:
    """
    Apply a transform to a raw CSV value.

    Returns a dict because some transforms (e.g. split_name) produce
    multiple form fields from one CSV column.
    """
    if not transform or transform == "none":
        return {"_value": value}

    if transform == "multiply_12":
        try:
            monthly = float(value.replace(",", "."))
            return {"_value": str(int(monthly * 12))}
        except (ValueError, TypeError):
            return {"_value": value}

    if transform == "split_name":
        parts = value.split(",", 1)
        if len(parts) == 2:
            return {
                "nachname": parts[0].strip(),
                "vorname": parts[1].strip(),
            }
        parts = value.rsplit(" ", 1)
        if len(parts) == 2:
            return {
                "vorname": parts[0].strip(),
                "nachname": parts[1].strip(),
            }
        return {"_value": value}

    if transform == "parse_date":
        date_formats = [
            "%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y",
            "%Y/%m/%d", "%m/%d/%Y",
        ]
        for fmt in date_formats:
            try:
                dt = datetime.strptime(value.strip(), fmt)
                return {"_value": dt.strftime("%d.%m.%Y")}
            except ValueError:
                continue
        return {"_value": value}

    return {"_value": value}


# ═══════════════════════════════════════════════════════════════════════════
# LLM COLUMN MAPPING
# ═══════════════════════════════════════════════════════════════════════════

async def _ai_suggest_mapping(
    csv_columns: List[str],
    form_fields: List[FormField],
    user_id: Optional[str] = None,
) -> List[MappingSuggestion]:
    """Use LLM to suggest column-to-field mapping."""
    # Build field descriptions
    field_descriptions = []
    for f in form_fields:
        label = f.field_label or f.field_name
        field_descriptions.append("%s (%s, Typ: %s)" % (f.field_name, label, f.field_type))

    fields_text = "\n".join("- %s" % fd for fd in field_descriptions)
    columns_text = "\n".join("- %s" % c for c in csv_columns)

    system_prompt = """Du bist ein HR-Daten-Assistent. Mappe die CSV-Spaltennamen auf Formularfelder.

Verfügbare Formularfelder:
%s

CSV-Spalten:
%s

Gib ein JSON-Array zurück mit Objekten:
[
  { "csv_column": "...", "form_field": "...", "confidence": 0.9, "transform": "none" }
]

Regeln:
- "Monatsgehalt" oder "Monatsbrutto" -> gehalt mit transform "multiply_12"
- "Name" (enthält Komma, z.B. "Müller, Anna") -> nachname + vorname mit transform "split_name"
- Datumsspalten -> transform "parse_date"
- Unbekannte Spalten -> form_field: null, confidence: 0
- confidence: 0.0 bis 1.0 (wie sicher bist du bei der Zuordnung?)
- Gib NUR das JSON-Array zurück, keine Erklärungen.""" % (fields_text, columns_text)

    try:
        llm = LLMService()
        start_time = time.time()
        config = LLMConfig(temperature=0.1, max_tokens=2000, json_mode=True)
        response = await llm.chat(
            [
                LLMMessage(role="system", content=system_prompt),
                LLMMessage(role="user", content="Mappe die CSV-Spalten auf die Formularfelder."),
            ],
            config=config,
        )
        latency_ms = int((time.time() - start_time) * 1000)

        # Fire-and-forget logging
        asyncio.create_task(log_llm_call(
            feature="bulk_mapping",
            response=response,
            latency_ms=latency_ms,
            user_id=user_id,
        ))

        # Parse JSON
        raw = response.content.strip()
        # Handle markdown code blocks
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        mappings_data = json.loads(raw)
        if not isinstance(mappings_data, list):
            mappings_data = []

        suggestions: List[MappingSuggestion] = []
        for item in mappings_data:
            suggestions.append(MappingSuggestion(
                csv_column=item.get("csv_column", ""),
                form_field=item.get("form_field"),
                confidence=float(item.get("confidence", 0)),
                transform_note=item.get("transform", "none"),
            ))
        return suggestions

    except Exception as e:
        logger.warning("KI-Mapping fehlgeschlagen, verwende Fallback: %s", e)
        return _fallback_mapping(csv_columns, form_fields)


def _fallback_mapping(
    csv_columns: List[str],
    form_fields: List[FormField],
) -> List[MappingSuggestion]:
    """Simple heuristic fallback when LLM is unavailable."""
    field_names = {f.field_name.lower(): f.field_name for f in form_fields}
    field_labels = {}
    for f in form_fields:
        if f.field_label:
            field_labels[f.field_label.lower()] = f.field_name

    suggestions: List[MappingSuggestion] = []
    for col in csv_columns:
        col_lower = col.lower().strip()
        matched_field = None  # type: Optional[str]
        confidence = 0.0

        # Exact name match
        if col_lower in field_names:
            matched_field = field_names[col_lower]
            confidence = 1.0
        else:
            # Exact label match
            if col_lower in field_labels:
                matched_field = field_labels[col_lower]
                confidence = 0.9
            else:
                # Substring match
                for fname, fval in field_names.items():
                    if fname in col_lower or col_lower in fname:
                        matched_field = fval
                        confidence = 0.6
                        break

        transform = "none"
        if col_lower in ("monatsgehalt", "monatsbrutto", "monthly_salary"):
            transform = "multiply_12"
        elif "datum" in col_lower or "date" in col_lower:
            transform = "parse_date"

        suggestions.append(MappingSuggestion(
            csv_column=col,
            form_field=matched_field,
            confidence=confidence,
            transform_note=transform,
        ))

    return suggestions


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/upload", response_model=UploadResponse)
async def smart_bulk_upload(
    document_type_id: int = Query(..., description="ID des Dokumenttyps"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    CSV/XLSX hochladen und KI-gestützte Spalten-Zuordnung erhalten.

    - Datei parsen (CSV/XLSX)
    - FormField-Definitionen für den Dokumenttyp laden
    - LLM-Mapping-Vorschläge generieren
    - Vorschau der ersten 3 Zeilen zurückgeben
    """
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Datei zu groß. Maximum: %d MB" % (MAX_UPLOAD_SIZE // (1024 * 1024)),
        )

    filename = file.filename or "upload.csv"
    if not filename.lower().endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Ungültiges Dateiformat. Erlaubt: CSV, XLSX, XLS",
        )

    # Parse file
    try:
        rows, columns = _parse_file_content(content, filename)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail="Datei konnte nicht gelesen werden: %s" % str(e),
        )

    if not rows:
        raise HTTPException(
            status_code=400,
            detail="Datei ist leer oder enthält keine Datenzeilen",
        )

    # Verify document type exists
    doc_type = await db.get(DocumentType, document_type_id)
    if not doc_type:
        raise HTTPException(status_code=404, detail="Dokumenttyp nicht gefunden")

    # Load form fields
    result = await db.execute(
        select(FormField)
        .where(FormField.document_type_id == document_type_id)
        .order_by(FormField.display_order.nulls_last())
    )
    form_fields = result.scalars().all()

    # Fallback: Standard-HR-Felder wenn keine FormField-Definitionen existieren
    if not form_fields:
        logger.info("Keine FormField-Definitionen für Dokumenttyp %d — verwende Standard-HR-Felder", document_type_id)
        _DEFAULT_FIELDS = [
            {"field_name": "vorname", "field_label": "Vorname", "is_required": True},
            {"field_name": "nachname", "field_label": "Nachname", "is_required": True},
            {"field_name": "position", "field_label": "Position", "is_required": False},
            {"field_name": "gehalt", "field_label": "Gehalt (brutto/Jahr)", "is_required": False},
            {"field_name": "eintrittsdatum", "field_label": "Eintrittsdatum", "is_required": False},
            {"field_name": "wochenstunden", "field_label": "Wochenstunden", "is_required": False},
            {"field_name": "urlaubstage", "field_label": "Urlaubstage", "is_required": False},
            {"field_name": "probezeit", "field_label": "Probezeit (Monate)", "is_required": False},
            {"field_name": "abteilung", "field_label": "Abteilung", "is_required": False},
            {"field_name": "signatory_name", "field_label": "Unterzeichner", "is_required": False},
        ]

        class _FakeField:
            def __init__(self, d):
                self.field_name = d["field_name"]
                self.field_label = d["field_label"]
                self.is_required = d["is_required"]
                self.field_type = "text"

        form_fields = [_FakeField(d) for d in _DEFAULT_FIELDS]

    # KI-Mapping
    user_id_str = str(current_user.id) if current_user else None
    mapping_suggestions = await _ai_suggest_mapping(columns, form_fields, user_id=user_id_str)

    # Save uploaded data as temporary file for later retrieval
    with tempfile.NamedTemporaryFile(delete=False, suffix=".bin") as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    # Create BulkJob record with status "mapping"
    job = BulkJob(
        status="mapping",
        total_records=len(rows),
        processed_records=0,
        created_by_id=current_user.id,
        document_type_id=document_type_id,
        source_filename=filename,
        result_file_path=tmp_path,  # store temp file path for execute step
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    return UploadResponse(
        job_id=job.id,
        columns=columns,
        row_count=len(rows),
        mapping_suggestions=mapping_suggestions,
        preview_rows=rows[:3],
    )


@router.post("/preview", response_model=PreviewResponse)
async def smart_bulk_preview(
    request: PreviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Mapping bestätigen und Vorschau der ersten 3 Zeilen erhalten.

    Wendet die Spalten-Zuordnung auf die ersten 3 Zeilen an,
    validiert jede Zeile und gibt Fehler zurück.
    """
    job = await db.get(BulkJob, request.job_id)
    if not job or job.created_by_id != current_user.id:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")

    if job.status not in ("mapping", "previewing"):
        raise HTTPException(
            status_code=400,
            detail="Auftrag ist nicht im Mapping-Status (aktuell: %s)" % job.status,
        )

    # Reload the uploaded file
    if not job.result_file_path or not os.path.exists(job.result_file_path):
        raise HTTPException(status_code=400, detail="Hochgeladene Datei nicht mehr verfügbar")

    with open(job.result_file_path, "rb") as f:
        content = f.read()

    filename = job.source_filename or "upload.csv"
    rows, _columns = _parse_file_content(content, filename)

    if not rows:
        raise HTTPException(status_code=400, detail="Keine Datenzeilen in der Datei")

    # Load form fields for validation
    result = await db.execute(
        select(FormField)
        .where(FormField.document_type_id == request.document_type_id)
        .order_by(FormField.display_order.nulls_last())
    )
    form_fields = result.scalars().all()
    field_map = {f.field_name.lower(): f for f in form_fields}

    # Apply mapping to first 3 rows
    previews: List[PreviewRow] = []
    valid_count = 0
    error_count = 0

    for idx, row in enumerate(rows[:3], start=1):
        mapped_fields: Dict[str, Any] = {}
        row_errors: List[str] = []

        for csv_col, form_field in request.column_mapping.items():
            if not form_field:
                continue
            raw_value = row.get(csv_col, "")
            mapped_fields[form_field] = raw_value

        # Validate each mapped field
        for field_name, value in mapped_fields.items():
            field_def = field_map.get(field_name.lower())
            if field_def:
                is_valid, error_msg = _validate_field_value(str(value), field_def)
                if not is_valid:
                    row_errors.append("%s: %s" % (field_name, error_msg))

        # Check for missing required fields
        for f in form_fields:
            if f.is_required and f.field_name not in mapped_fields:
                row_errors.append("%s: Pflichtfeld nicht zugeordnet" % f.field_name)

        if row_errors:
            error_count += 1
        else:
            valid_count += 1

        previews.append(PreviewRow(
            row_num=idx,
            fields=mapped_fields,
            validation_errors=row_errors,
        ))

    # Update job
    job.status = "previewing"
    job.column_mapping = json.dumps(request.column_mapping)
    job.document_type_id = request.document_type_id
    await db.commit()

    return PreviewResponse(
        previews=previews,
        valid_count=valid_count,
        error_count=error_count,
    )


@router.post("/execute")
async def smart_bulk_execute(
    request: ExecuteRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Batch-Generierung starten mit SSE-Progress-Streaming.

    Für jede Zeile wird ein DocumentDraft erstellt.
    Der Fortschritt wird als Server-Sent Events gestreamt.
    """
    job = await db.get(BulkJob, request.job_id)
    if not job or job.created_by_id != current_user.id:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")

    if job.status not in ("previewing", "mapping"):
        raise HTTPException(
            status_code=400,
            detail="Auftrag kann nicht gestartet werden (Status: %s)" % job.status,
        )

    if not job.column_mapping:
        raise HTTPException(
            status_code=400,
            detail="Spalten-Zuordnung fehlt. Bitte zuerst /preview aufrufen.",
        )

    if not job.result_file_path or not os.path.exists(job.result_file_path):
        raise HTTPException(status_code=400, detail="Hochgeladene Datei nicht mehr verfügbar")

    # Mark as processing
    job.status = "PROCESSING"
    await db.commit()

    # Prepare data for streaming generator
    job_id = job.id
    user_id = current_user.id
    country_code = getattr(current_user, "country_code", "DE") or "DE"
    document_type_id = job.document_type_id
    column_mapping = json.loads(job.column_mapping)
    source_filename = job.source_filename or "upload.csv"

    with open(job.result_file_path, "rb") as f:
        content = f.read()
    rows, _columns = _parse_file_content(content, source_filename)

    async def _generate_events():
        """SSE event generator — processes rows one by one."""
        successful = 0
        failed = 0
        draft_ids: List[int] = []
        errors_list: List[Dict[str, Any]] = []
        total = len(rows)

        for idx, row in enumerate(rows, start=1):
            try:
                # Apply column mapping
                form_data: Dict[str, Any] = {}
                for csv_col, form_field in column_mapping.items():
                    if not form_field:
                        continue
                    raw_value = row.get(csv_col, "")
                    form_data[form_field] = raw_value

                # Extract employee name for progress display
                employee_name = (
                    form_data.get("vorname", "") + " " + form_data.get("nachname", "")
                ).strip() or ("Zeile %d" % idx)

                # Send progress event
                progress_event = json.dumps({
                    "type": "progress",
                    "processed": idx - 1,
                    "total": total,
                    "current_name": employee_name,
                    "status": "processing",
                })
                yield "data: %s\n\n" % progress_event

                # Create DocumentDraft
                async with async_session_factory() as session:
                    draft = DocumentDraft(
                        country_code=country_code,
                        document_type_id=document_type_id,
                        user_id=str(user_id),
                        name="Bulk: %s" % employee_name,
                        form_data=json.dumps(form_data),
                    )
                    session.add(draft)
                    await session.commit()
                    await session.refresh(draft)
                    draft_id = draft.id

                draft_ids.append(draft_id)
                successful += 1

                # Send row_complete event
                complete_event = json.dumps({
                    "type": "row_complete",
                    "row": idx,
                    "draft_id": draft_id,
                    "employee_name": employee_name,
                })
                yield "data: %s\n\n" % complete_event

            except Exception as e:
                logger.error("Bulk-Zeile %d fehlgeschlagen: %s", idx, e)
                failed += 1
                error_detail = {
                    "row": idx,
                    "field": "",
                    "error": str(e),
                }
                errors_list.append(error_detail)

                error_event = json.dumps({
                    "type": "row_error",
                    "row": idx,
                    "error": str(e),
                })
                yield "data: %s\n\n" % error_event

            # Update job progress in DB after each row
            try:
                async with async_session_factory() as session:
                    await session.execute(
                        update(BulkJob)
                        .where(BulkJob.id == job_id)
                        .values(
                            processed_records=idx,
                            successful_rows=successful,
                            failed_rows=failed,
                        )
                    )
                    await session.commit()
            except Exception as db_err:
                logger.warning("Fortschrittsaktualisierung fehlgeschlagen: %s", db_err)

            # Small yield to prevent blocking
            await asyncio.sleep(0.01)

        # Final update: mark job complete
        try:
            async with async_session_factory() as session:
                await session.execute(
                    update(BulkJob)
                    .where(BulkJob.id == job_id)
                    .values(
                        status="COMPLETED",
                        processed_records=total,
                        successful_rows=successful,
                        failed_rows=failed,
                        draft_ids=json.dumps(draft_ids),
                        errors=json.dumps(errors_list) if errors_list else None,
                        completed_at=datetime.now(timezone.utc),
                    )
                )
                await session.commit()
        except Exception as db_err:
            logger.error("Abschluss-Update fehlgeschlagen: %s", db_err)

        # Send done event
        done_event = json.dumps({
            "type": "done",
            "successful": successful,
            "failed": failed,
            "draft_ids": draft_ids,
        })
        yield "data: %s\n\n" % done_event

    return StreamingResponse(
        _generate_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/error-report/{job_id}")
async def smart_bulk_error_report(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Fehlerbericht als CSV herunterladen.

    Enthält nur die fehlerhaften Zeilen mit Fehlerbeschreibungen.
    """
    job = await db.get(BulkJob, job_id)
    if not job or job.created_by_id != current_user.id:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")

    if not job.errors:
        raise HTTPException(
            status_code=404,
            detail="Keine Fehler für diesen Auftrag vorhanden",
        )

    try:
        errors_list = json.loads(job.errors)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=404, detail="Fehlerbericht konnte nicht gelesen werden")

    if not errors_list:
        raise HTTPException(status_code=404, detail="Keine Fehler für diesen Auftrag vorhanden")

    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["Zeile", "Feld", "Fehler"])

    for err in errors_list:
        writer.writerow([
            err.get("row", ""),
            err.get("field", ""),
            err.get("error", ""),
        ])

    # Write to temp file
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".csv", delete=False, encoding="utf-8-sig"
    ) as f:
        f.write(output.getvalue())
        tmp_path = f.name

    return FileResponse(
        tmp_path,
        media_type="text/csv",
        filename="fehlerbericht_job_%d.csv" % job_id,
    )
