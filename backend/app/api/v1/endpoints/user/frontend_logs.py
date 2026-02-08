"""
Frontend Log Ingestion Endpoint

Receives batched log entries from the frontend logger (lib/logger.ts).
Logs them server-side for centralized log aggregation.

Rate limited to prevent abuse.
"""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

router = APIRouter()
frontend_logger = logging.getLogger("frontend")


class FrontendLogEntry(BaseModel):
    """Single log entry from the frontend."""
    level: str = Field(..., pattern="^(debug|info|warn|error)$")
    message: str = Field(..., max_length=2000)
    timestamp: str
    url: Optional[str] = Field(None, max_length=500)
    userAgent: Optional[str] = Field(None, max_length=500)
    data: Optional[dict] = None


class FrontendLogBatch(BaseModel):
    """Batch of log entries from the frontend."""
    logs: List[FrontendLogEntry] = Field(..., max_length=100)


# Map frontend log levels to Python logging levels
_LEVEL_MAP = {
    "debug": logging.DEBUG,
    "info": logging.INFO,
    "warn": logging.WARNING,
    "error": logging.ERROR,
}


@router.post("", status_code=204)
async def ingest_frontend_logs(
    batch: FrontendLogBatch,
    request: Request,
):
    """
    Receive batched log entries from the frontend.

    Logs each entry server-side at the appropriate level.
    No authentication required (fire-and-forget from frontend).
    Rate limited via middleware.
    """
    client_ip = request.client.host if request.client else "unknown"

    for entry in batch.logs:
        level = _LEVEL_MAP.get(entry.level, logging.INFO)
        extra_data = ""
        if entry.data:
            # Limit extra data size for safety
            data_str = str(entry.data)[:500]
            extra_data = f" | data={data_str}"

        frontend_logger.log(
            level,
            "[FE] %s | url=%s | ip=%s%s",
            entry.message[:500],  # Truncate for safety
            entry.url or "-",
            client_ip,
            extra_data,
        )

    return None
