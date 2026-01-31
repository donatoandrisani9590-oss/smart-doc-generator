"""
Bulk processing tasks with Celery.

Implementiert gemäß v4.2 Spezifikation Kapitel 15:
- Asynchrone Bulk-Generierung
- Fortschritts-Tracking
- Cancellation-Support
- ZIP-Erstellung
"""
from celery import shared_task
from typing import List, Dict, Any
import os
import zipfile
import json
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def check_job_cancelled(job_id: int) -> bool:
    """
    Prüft ob ein Job abgebrochen wurde.

    Diese Funktion wird während der Verarbeitung regelmäßig aufgerufen,
    um auf Cancellation-Requests zu reagieren.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.core.config import settings
    from app.models.enterprise import BulkJob

    # Synchrone DB-Verbindung für Celery Task
    engine = create_engine(settings.DATABASE_URL.replace("+asyncpg", ""))
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        job = session.get(BulkJob, job_id)
        return job.status == "CANCELLED" if job else True
    finally:
        session.close()


def update_job_progress(job_id: int, processed: int, status: str = None, error: str = None, result_path: str = None):
    """
    Aktualisiert den Fortschritt eines Jobs.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.core.config import settings
    from app.models.enterprise import BulkJob

    engine = create_engine(settings.DATABASE_URL.replace("+asyncpg", ""))
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        job = session.get(BulkJob, job_id)
        if job:
            job.processed_records = processed
            if status:
                job.status = status
            if error:
                job.error_message = error
            if result_path:
                job.result_file_path = result_path
            session.commit()
    finally:
        session.close()


@shared_task(bind=True, max_retries=3)
def process_bulk_job(
    self,
    job_id: int,
    document_type_id: int,
    rows: List[Dict[str, Any]],
    output_format: str = "pdf",
    signatory_name: str = "Matthias Schweizer"
) -> Dict[str, Any]:
    """
    Verarbeitet einen Bulk-Job asynchron mit DIN 5008 Format.

    Diese Celery-Task:
    1. Aktualisiert den Job-Status auf PROCESSING
    2. Generiert für jeden Record ein DIN 5008-konformes Dokument
    3. Prüft regelmäßig auf Cancellation
    4. Erstellt eine ZIP-Datei mit allen Dokumenten
    5. Aktualisiert den Status auf COMPLETED oder FAILED

    Args:
        job_id: ID des BulkJob-Records
        document_type_id: ID des Dokumenttyps
        rows: Liste der Datensätze (aus CSV/Excel)
        output_format: "pdf" oder "docx"
        signatory_name: Name des Unterzeichners (DIN 5008 Pflichtfeld)

    Returns:
        Dict mit Status und Ergebnis-Pfad
    """
    from app.models.core import DocumentType, DesignSetting
    from app.models.documents import Clause, DocumentTypeClause
    from app.api.v1.endpoints.generation import create_document_from_clauses
    from app.services.template_engine import TemplateEngine
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import sessionmaker
    from app.core.config import settings

    logger.info(f"Starting bulk job {job_id} with {len(rows)} records")

    # Update status to PROCESSING
    update_job_progress(job_id, 0, status="PROCESSING")

    # Output directory
    output_dir = f"/tmp/bulk_job_{job_id}"
    os.makedirs(output_dir, exist_ok=True)

    # Synchrone DB-Verbindung für Celery Task
    sync_url = settings.DATABASE_URL.replace("+asyncpg", "").replace("sqlite+aiosqlite", "sqlite")
    engine = create_engine(sync_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        doc_type = session.get(DocumentType, document_type_id)
        if not doc_type:
            update_job_progress(job_id, 0, status="FAILED", error="Dokumenttyp nicht gefunden")
            return {"status": "failed", "error": "Document type not found"}

        doc_type_name = doc_type.name
        country_code = doc_type.country_code or "DE"

        # Load design settings with DIN 5008 format
        design = session.execute(
            select(DesignSetting).where(DesignSetting.country_code == country_code)
        ).scalar_one_or_none()

        if not design:
            design = session.execute(select(DesignSetting).limit(1)).scalar_one_or_none()

        # Build design settings dict with DIN 5008 values
        design_settings = {
            "company_name": design.company_name if design else "Unternehmen",
            "logo_path": design.logo_path if design else None,
            "header_line1": design.header_line1 if design else "",
            "header_line2": design.header_line2 if design else "",
            "header_line3": design.header_line3 if design else "",
            "footer_line1": design.footer_line1 if design else "",
            "footer_line2": design.footer_line2 if design else "",
            "footer_line3": design.footer_line3 if design else "",
            "primary_color": design.primary_color if design else "#243186",
            "font_family": design.font_family if design else "Arial",
            # Signatory from request (required field)
            "signatory_name": signatory_name,
            # DIN 5008 Page Format Settings
            "margin_left_cm": float(getattr(design, 'margin_left_cm', None) or 2.5),
            "margin_right_cm": float(getattr(design, 'margin_right_cm', None) or 2.0),
            "margin_top_cm": float(getattr(design, 'margin_top_cm', None) or 2.5),
            "margin_bottom_cm": float(getattr(design, 'margin_bottom_cm', None) or 2.0),
            "header_distance_cm": float(getattr(design, 'header_distance_cm', None) or 1.25),
            "footer_distance_cm": float(getattr(design, 'footer_distance_cm', None) or 1.0),
            "font_size_pt": int(getattr(design, 'font_size_pt', None) or 11),
            "line_spacing": float(getattr(design, 'line_spacing', None) or 1.15),
            "logo_width_cm": float(getattr(design, 'logo_width_cm', None) or 5.0),
        }

        # Load clauses for this document type (with conditions for per-row evaluation)
        clause_refs = session.execute(
            select(DocumentTypeClause)
            .where(DocumentTypeClause.document_type_id == document_type_id)
            .order_by(DocumentTypeClause.display_order)
        ).scalars().all()

        # Store clause data with conditions for evaluation during row processing
        clause_templates = []
        for ref in clause_refs:
            clause = session.get(Clause, ref.clause_id)
            if clause and clause.is_active:
                # Parse condition JSON if present
                condition = None
                if ref.condition:
                    try:
                        condition = json.loads(ref.condition) if isinstance(ref.condition, str) else ref.condition
                    except (json.JSONDecodeError, TypeError):
                        condition = None

                clause_templates.append({
                    "id": clause.id,
                    "title": clause.title,
                    "content": clause.content_html,
                    "is_mandatory": ref.is_mandatory,
                    "condition": condition,  # Store condition for per-row evaluation
                })

    finally:
        session.close()

    # Initialize template engine for PDF conversion
    template_engine = TemplateEngine()

    generated_files = []
    errors = []

    for idx, row in enumerate(rows):
        # Check for cancellation every 5 records
        if idx % 5 == 0:
            if check_job_cancelled(job_id):
                logger.info(f"Job {job_id} was cancelled at record {idx}")
                update_job_progress(job_id, idx, status="CANCELLED")
                # Cleanup
                for f in generated_files:
                    try:
                        os.remove(f)
                    except:
                        pass
                return {"status": "cancelled", "processed": idx}

        try:
            from pathlib import Path
            from app.services.preview import evaluate_condition

            # Generate filename from row data
            name_field = row.get("name") or row.get("nachname") or row.get("vorname") or f"record_{idx+1}"
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            base_filename = f"{name_field}_{timestamp}_{idx+1}"
            base_filename = "".join(c for c in base_filename if c.isalnum() or c in "_-")

            # Filter clauses based on conditions for this specific row
            active_clauses = []
            for clause_template in clause_templates:
                condition = clause_template.get("condition")
                if evaluate_condition(condition, row):
                    # Include clause (without the condition field for document generation)
                    active_clauses.append({
                        "id": clause_template["id"],
                        "title": clause_template["title"],
                        "content": clause_template["content"],
                        "is_mandatory": clause_template["is_mandatory"],
                    })

            # Generate document using DIN 5008 compliant function
            docx_path = Path(os.path.join(output_dir, f"{base_filename}.docx"))
            create_document_from_clauses(
                clauses=active_clauses,
                form_data=row,
                design_settings=design_settings,
                country_code=country_code,
                output_path=docx_path
            )

            final_path = str(docx_path)

            # Convert to PDF if requested
            if output_format == "pdf":
                try:
                    pdf_path = template_engine.convert_to_pdf(docx_path)
                    final_path = pdf_path
                    # Remove intermediate DOCX
                    os.remove(docx_path)
                except Exception as pdf_error:
                    logger.warning(f"PDF conversion failed for {base_filename}: {pdf_error}")
                    # Keep DOCX as fallback

            generated_files.append(final_path)

        except Exception as e:
            logger.error(f"Error processing record {idx+1}: {e}")
            errors.append({
                "row": idx + 1,
                "error": str(e)
            })

        # Update progress
        update_job_progress(job_id, idx + 1)

    # Final cancellation check
    if check_job_cancelled(job_id):
        for f in generated_files:
            try:
                os.remove(f)
            except:
                pass
        return {"status": "cancelled", "processed": len(rows)}

    # Create ZIP file
    zip_path = f"/tmp/bulk_dokumente_{job_id}.zip"

    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in generated_files:
                if os.path.exists(file_path):
                    arcname = os.path.basename(file_path)
                    zipf.write(file_path, arcname)

            # Add error report if there were errors
            if errors:
                error_report = json.dumps(errors, indent=2, ensure_ascii=False)
                zipf.writestr("fehler_bericht.json", error_report)

        # Cleanup individual files
        for f in generated_files:
            try:
                os.remove(f)
            except:
                pass

        # Cleanup output directory
        try:
            os.rmdir(output_dir)
        except:
            pass

        # Update job as completed
        update_job_progress(
            job_id,
            len(rows),
            status="COMPLETED",
            result_path=zip_path
        )

        logger.info(f"Bulk job {job_id} completed. {len(generated_files)} documents generated, {len(errors)} errors.")

        return {
            "status": "completed",
            "total": len(rows),
            "success": len(generated_files),
            "errors": len(errors),
            "result_path": zip_path
        }

    except Exception as e:
        logger.error(f"Error creating ZIP for job {job_id}: {e}")
        update_job_progress(job_id, len(rows), status="FAILED", error=str(e))
        return {"status": "failed", "error": str(e)}


@shared_task
def cleanup_old_bulk_results(max_age_hours: int = 24):
    """
    Räumt alte Bulk-Job-Ergebnisse auf.

    Sollte periodisch (z.B. täglich) ausgeführt werden.
    """
    import glob
    from datetime import datetime, timedelta

    cutoff_time = datetime.now() - timedelta(hours=max_age_hours)

    # Find old ZIP files
    pattern = "/tmp/bulk_dokumente_*.zip"
    for zip_file in glob.glob(pattern):
        try:
            mtime = datetime.fromtimestamp(os.path.getmtime(zip_file))
            if mtime < cutoff_time:
                os.remove(zip_file)
                logger.info(f"Cleaned up old bulk result: {zip_file}")
        except Exception as e:
            logger.warning(f"Could not cleanup {zip_file}: {e}")
