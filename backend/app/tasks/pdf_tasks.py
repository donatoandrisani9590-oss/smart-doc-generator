"""
PDF Conversion Tasks with Celery.

Implements async PDF conversion to prevent blocking the FastAPI event loop.
Includes timeout handling, retry logic, and job status tracking.
"""
from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from typing import Dict, Any
import os
import subprocess
import logging
from pathlib import Path
from datetime import datetime, timezone
import json

logger = logging.getLogger(__name__)

# Redis key prefix for job status
JOB_STATUS_PREFIX = "pdf_job:"


def get_redis_client():
    """Get Redis client for job status storage."""
    import redis
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    return redis.from_url(redis_url)


def update_pdf_job_status(
    job_id: str,
    status: str,
    output_path: str = None,
    error: str = None
):
    """
    Update PDF conversion job status in Redis.

    Args:
        job_id: Unique job identifier
        status: One of: pending, processing, completed, failed
        output_path: Path to generated PDF (when completed)
        error: Error message (when failed)
    """
    try:
        redis_client = get_redis_client()
        job_data = {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if output_path:
            job_data["output_path"] = output_path
        if error:
            job_data["error"] = error

        # Store with 1-hour TTL
        redis_client.setex(
            f"{JOB_STATUS_PREFIX}{job_id}",
            3600,  # 1 hour TTL
            json.dumps(job_data)
        )
    except Exception as e:
        logger.warning(f"Could not update job status in Redis: {e}")


def get_pdf_job_status(job_id: str) -> Dict[str, Any]:
    """
    Get PDF conversion job status from Redis.

    Args:
        job_id: Unique job identifier

    Returns:
        Dict with status, output_path, error, etc.
    """
    try:
        redis_client = get_redis_client()
        data = redis_client.get(f"{JOB_STATUS_PREFIX}{job_id}")
        if data:
            return json.loads(data)
    except Exception as e:
        logger.warning(f"Could not get job status from Redis: {e}")

    return {"status": "unknown", "error": "Job not found"}


@shared_task(
    bind=True,
    max_retries=3,
    soft_time_limit=120,  # 2 minutes soft limit (raises SoftTimeLimitExceeded)
    time_limit=180,  # 3 minutes hard limit (kills task)
    autoretry_for=(subprocess.TimeoutExpired, OSError),
    retry_backoff=True,
    retry_backoff_max=60
)
def convert_docx_to_pdf(
    self,
    docx_path: str,
    job_id: str,
    cleanup_docx: bool = False
) -> Dict[str, Any]:
    """
    Convert a DOCX file to PDF asynchronously using LibreOffice.

    This Celery task:
    1. Updates job status to 'processing'
    2. Runs LibreOffice headless conversion with timeout
    3. Updates status to 'completed' or 'failed'
    4. Optionally cleans up the source DOCX

    Args:
        docx_path: Absolute path to the DOCX file
        job_id: Unique identifier for status tracking
        cleanup_docx: If True, delete the source DOCX after successful conversion

    Returns:
        Dict with status and output_path or error
    """
    logger.info(f"Starting PDF conversion job {job_id}: {docx_path}")
    update_pdf_job_status(job_id, "processing")

    docx_file = Path(docx_path)
    if not docx_file.exists():
        error_msg = f"Source file not found: {docx_path}"
        logger.error(error_msg)
        update_pdf_job_status(job_id, "failed", error=error_msg)
        return {"status": "failed", "error": error_msg}

    # LibreOffice command with timeout
    cmd = [
        "soffice",
        "--headless",
        "--convert-to", "pdf",
        "--outdir", str(docx_file.parent),
        str(docx_file)
    ]

    try:
        # Run with subprocess timeout (separate from Celery timeout)
        result = subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=90  # 90 second subprocess timeout
        )

        pdf_path = docx_file.with_suffix(".pdf")

        if not pdf_path.exists():
            raise RuntimeError("PDF file was not created by LibreOffice")

        # Cleanup source DOCX if requested
        if cleanup_docx:
            try:
                docx_file.unlink()
            except Exception as cleanup_error:
                logger.warning(f"Could not cleanup DOCX: {cleanup_error}")

        logger.info(f"PDF conversion completed for job {job_id}: {pdf_path}")
        update_pdf_job_status(job_id, "completed", output_path=str(pdf_path))

        return {
            "status": "completed",
            "output_path": str(pdf_path),
            "job_id": job_id
        }

    except SoftTimeLimitExceeded:
        error_msg = "PDF conversion timed out (exceeded 2 minutes)"
        logger.error(f"Job {job_id}: {error_msg}")
        update_pdf_job_status(job_id, "failed", error=error_msg)
        return {"status": "failed", "error": error_msg, "job_id": job_id}

    except subprocess.TimeoutExpired:
        error_msg = "LibreOffice process timed out"
        logger.error(f"Job {job_id}: {error_msg}")
        update_pdf_job_status(job_id, "failed", error=error_msg)
        # Let Celery retry
        raise

    except subprocess.CalledProcessError as e:
        error_msg = f"LibreOffice conversion failed: {e.stderr.decode() if e.stderr else str(e)}"
        logger.error(f"Job {job_id}: {error_msg}")
        update_pdf_job_status(job_id, "failed", error=error_msg)
        return {"status": "failed", "error": error_msg, "job_id": job_id}

    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        logger.error(f"Job {job_id}: {error_msg}")
        update_pdf_job_status(job_id, "failed", error=error_msg)

        # Retry for transient errors
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=30 * (self.request.retries + 1))

        return {"status": "failed", "error": error_msg, "job_id": job_id}


@shared_task
def cleanup_old_pdf_jobs(max_age_hours: int = 24):
    """
    Clean up old PDF conversion results.

    Removes PDF files older than max_age_hours from the temp directory.
    Should be scheduled to run periodically (e.g., daily).
    """
    import glob
    from datetime import timedelta

    cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
    cleaned = 0

    # Find old PDF files in temp directories
    for pattern in ["/tmp/*.pdf", "/tmp/bulk_job_*/*.pdf"]:
        for pdf_file in glob.glob(pattern):
            try:
                mtime = datetime.fromtimestamp(os.path.getmtime(pdf_file))
                if mtime < cutoff_time:
                    os.remove(pdf_file)
                    cleaned += 1
                    logger.info(f"Cleaned up old PDF: {pdf_file}")
            except Exception as e:
                logger.warning(f"Could not cleanup {pdf_file}: {e}")

    return {"cleaned": cleaned}
