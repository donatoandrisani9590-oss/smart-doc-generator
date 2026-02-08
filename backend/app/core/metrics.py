"""
Prometheus Metrics for Application Monitoring

Exposes key application metrics:
- HTTP request counts and latencies
- Active request gauge
- Document generation counter
- Error rates

Access metrics at GET /metrics (Prometheus text format).
"""
from __future__ import annotations

import time
import logging
from typing import Callable

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Try to import prometheus_client; gracefully degrade if not installed
try:
    from prometheus_client import (
        Counter,
        Histogram,
        Gauge,
        Info,
        generate_latest,
        CONTENT_TYPE_LATEST,
    )

    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    logger.info("prometheus-client not installed – metrics endpoint disabled")


if PROMETHEUS_AVAILABLE:
    # ═══════════════════════════════════════════════════════════════════════
    # METRIC DEFINITIONS
    # ═══════════════════════════════════════════════════════════════════════

    APP_INFO = Info("docgen_app", "Application info")

    REQUEST_COUNT = Counter(
        "docgen_http_requests_total",
        "Total HTTP requests",
        ["method", "endpoint", "status_code"],
    )

    REQUEST_LATENCY = Histogram(
        "docgen_http_request_duration_seconds",
        "HTTP request latency in seconds",
        ["method", "endpoint"],
        buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
    )

    ACTIVE_REQUESTS = Gauge(
        "docgen_active_requests",
        "Number of currently active requests",
    )

    DOCUMENT_GENERATED = Counter(
        "docgen_documents_generated_total",
        "Total documents generated",
        ["country_code", "format"],
    )

    AUTH_EVENTS = Counter(
        "docgen_auth_events_total",
        "Authentication events",
        ["event_type"],  # login_success, login_failed, register, password_reset
    )

    ERROR_COUNT = Counter(
        "docgen_errors_total",
        "Total application errors",
        ["error_type"],  # 4xx, 5xx, unhandled
    )


# ═══════════════════════════════════════════════════════════════════════════
# METRICS MIDDLEWARE
# ═══════════════════════════════════════════════════════════════════════════

class PrometheusMiddleware(BaseHTTPMiddleware):
    """Middleware that records HTTP request metrics for Prometheus."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not PROMETHEUS_AVAILABLE:
            return await call_next(request)

        # Skip metrics endpoint itself to avoid recursion
        if request.url.path == "/metrics":
            return await call_next(request)

        method = request.method
        # Normalize path to avoid high cardinality (strip IDs)
        endpoint = _normalize_path(request.url.path)

        ACTIVE_REQUESTS.inc()
        start_time = time.time()

        try:
            response = await call_next(request)
            status_code = str(response.status_code)

            # Track error rates
            if response.status_code >= 500:
                ERROR_COUNT.labels(error_type="5xx").inc()
            elif response.status_code >= 400:
                ERROR_COUNT.labels(error_type="4xx").inc()

            REQUEST_COUNT.labels(
                method=method, endpoint=endpoint, status_code=status_code
            ).inc()
            REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(
                time.time() - start_time
            )

            return response

        except Exception as exc:
            ERROR_COUNT.labels(error_type="unhandled").inc()
            REQUEST_COUNT.labels(
                method=method, endpoint=endpoint, status_code="500"
            ).inc()
            REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(
                time.time() - start_time
            )
            raise
        finally:
            ACTIVE_REQUESTS.dec()


def _normalize_path(path: str) -> str:
    """
    Normalize URL path to reduce cardinality.
    Replaces numeric IDs with {id} placeholder.
    """
    parts = path.strip("/").split("/")
    normalized = []
    for part in parts:
        if part.isdigit():
            normalized.append("{id}")
        else:
            normalized.append(part)
    return "/" + "/".join(normalized)


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS (for use in endpoints)
# ═══════════════════════════════════════════════════════════════════════════

def track_document_generated(country_code: str, file_format: str) -> None:
    """Call from document generation endpoint to track metrics."""
    if PROMETHEUS_AVAILABLE:
        DOCUMENT_GENERATED.labels(
            country_code=country_code, format=file_format
        ).inc()


def track_auth_event(event_type: str) -> None:
    """Call from auth endpoints to track login/register events."""
    if PROMETHEUS_AVAILABLE:
        AUTH_EVENTS.labels(event_type=event_type).inc()


# ═══════════════════════════════════════════════════════════════════════════
# METRICS ENDPOINT SETUP
# ═══════════════════════════════════════════════════════════════════════════

def register_metrics_middleware(app: FastAPI) -> None:
    """Register Prometheus middleware and /metrics endpoint on the app.

    MUST be called before the app starts (not inside lifespan).
    """
    if not PROMETHEUS_AVAILABLE:
        return

    app.add_middleware(PrometheusMiddleware)

    @app.get("/metrics", include_in_schema=False)
    async def metrics_endpoint():
        """Prometheus metrics in text exposition format."""
        return Response(
            content=generate_latest(),
            media_type=CONTENT_TYPE_LATEST,
        )

    logger.info("Prometheus metrics middleware and endpoint registered")


def setup_metrics(app: FastAPI) -> None:
    """Initialize metric labels (safe to call during lifespan).

    Call register_metrics_middleware() BEFORE app start for middleware,
    then call this during lifespan for app info setup.
    """
    if not PROMETHEUS_AVAILABLE:
        logger.info("Prometheus metrics disabled (prometheus-client not installed)")
        return

    from app.core.config import settings

    APP_INFO.info({
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "project": settings.PROJECT_NAME,
    })

    logger.info("Prometheus metrics initialized")
