"""
Structured Logging Configuration

Provides JSON-formatted logs for production (ELK, CloudWatch, Datadog)
and human-readable text logs for development.

Usage:
    from app.core.logging_config import setup_logging
    setup_logging()  # Call once at startup
"""
from __future__ import annotations

import logging
import sys
from app.core.config import settings


def setup_logging() -> None:
    """
    Configure structured logging for the application.

    - Production/Staging: JSON format (for log aggregation tools)
    - Development: Text format (human-readable)

    Respects LOG_LEVEL and LOG_FORMAT from settings.
    """
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    # Override with DEBUG flag for backwards compatibility
    if settings.DEBUG:
        log_level = logging.DEBUG

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Clear existing handlers to avoid duplicates
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)

    if settings.LOG_FORMAT == "json" and not settings.DEBUG:
        # JSON structured logging for production
        try:
            from pythonjsonlogger import json as jsonlogger

            formatter = jsonlogger.JsonFormatter(
                fmt="%(asctime)s %(name)s %(levelname)s %(message)s",
                rename_fields={
                    "asctime": "timestamp",
                    "levelname": "level",
                    "name": "logger",
                },
                datefmt="%Y-%m-%dT%H:%M:%S%z",
            )
            handler.setFormatter(formatter)
        except ImportError:
            # Fallback to text if python-json-logger not installed
            _set_text_formatter(handler)
    else:
        _set_text_formatter(handler)

    root_logger.addHandler(handler)

    # Reduce noise from third-party libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.DEBUG if settings.DEBUG else logging.WARNING
    )

    logging.getLogger(__name__).info(
        "Logging configured: level=%s format=%s env=%s",
        settings.LOG_LEVEL,
        settings.LOG_FORMAT if not settings.DEBUG else "text",
        settings.ENVIRONMENT,
    )


def _set_text_formatter(handler: logging.Handler) -> None:
    """Set human-readable text formatter (development mode)."""
    formatter = logging.Formatter(
        fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
