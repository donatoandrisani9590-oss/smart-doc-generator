"""
Document Generator - FastAPI Main Application

Production-ready configuration with:
- Structured logging
- Error handling middleware
- Request timing
- CORS security
- Health checks with DB connectivity
"""

import logging
import time
import traceback
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.middleware.rate_limit import RateLimitMiddleware
# Auth
from app.api.v1.endpoints.auth import auth, guest, sso

# Core Resources
from app.api.v1.endpoints.core import (
    clauses, clause_versions, clause_variants, clause_notes,
    clause_approval, custom_clauses, document_types, placeholders, form_fields,
)

# Documents
from app.api.v1.endpoints.documents import (
    generation, preview, history, drafts, corrections, locks,
    export, repository, document_upload, approvals,
)

# User Features
from app.api.v1.endpoints.user import (
    users, teams, favorites, search, statistics,
    notifications, comments, deadlines, chat, frontend_logs,
)

# Admin Features
from app.api.v1.endpoints.admin import (
    company_settings, logo, templates, attachments, audit,
    works_council, bulk, word_import, document_type_import, feature_settings,
)

# Smart UX
from app.api.v1.endpoints.smart import composer, smart_mode, compliance, clause_ai_selection

# Integration (Copilot Studio, Power Platform)
from app.api.v1.endpoints.integration import actions, webhooks, copilot_studio

# Configuration
from app.api.v1.endpoints.config import setup, countries, locations

# ═══════════════════════════════════════════════════════════════════════════
# LOGGING CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

from app.core.logging_config import setup_logging
setup_logging()
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# MIDDLEWARE CLASSES
# ═══════════════════════════════════════════════════════════════════════════

class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection via X-Requested-With header check.

    State-changing methods (POST, PUT, PATCH, DELETE) must include
    X-Requested-With: XMLHttpRequest. This prevents cross-origin form
    submissions since browsers don't add custom headers automatically.

    Exempted paths: health checks, auth login/register, setup endpoints,
    and Copilot Studio webhooks (use their own API key auth).
    """

    SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
    EXEMPT_PREFIXES = (
        "/health",
        f"{settings.API_V1_STR}/health",
        f"{settings.API_V1_STR}/auth/login",
        f"{settings.API_V1_STR}/auth/register",
        f"{settings.API_V1_STR}/auth/refresh",
        f"{settings.API_V1_STR}/auth/forgot-password",
        f"{settings.API_V1_STR}/auth/reset-password",
        f"{settings.API_V1_STR}/auth/sso/",
        f"{settings.API_V1_STR}/logs",
        f"{settings.API_V1_STR}/setup/",
        f"{settings.API_V1_STR}/actions/",
        f"{settings.API_V1_STR}/webhooks/",
        f"{settings.API_V1_STR}/copilot-studio/",
    )

    async def dispatch(self, request: Request, call_next: Callable):
        if request.method in self.SAFE_METHODS:
            return await call_next(request)

        # Check exempt paths
        path = request.url.path
        if any(path.startswith(prefix) for prefix in self.EXEMPT_PREFIXES):
            return await call_next(request)

        # Require X-Requested-With header for state-changing requests
        x_requested_with = request.headers.get("x-requested-with", "")
        if x_requested_with.lower() != "xmlhttprequest":
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF-Schutz: X-Requested-With Header fehlt"},
            )

        return await call_next(request)


class UploadSizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests with Content-Length exceeding the limit."""

    MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB

    async def dispatch(self, request: Request, call_next: Callable):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.MAX_UPLOAD_BYTES:
            return JSONResponse(
                status_code=413,
                content={"detail": f"Datei zu gross. Maximum: {self.MAX_UPLOAD_BYTES // (1024 * 1024)} MB"},
            )
        return await call_next(request)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log all incoming requests with timing information."""

    async def dispatch(self, request: Request, call_next: Callable):
        start_time = time.time()

        # Generate request ID for tracing
        request_id = request.headers.get("X-Request-ID", f"{time.time():.0f}")

        # Log request (skip health checks in production)
        if settings.DEBUG or request.url.path != "/health":
            logger.info(
                f"[{request_id}] {request.method} {request.url.path} - Started"
            )

        try:
            response = await call_next(request)

            # Calculate duration
            duration = time.time() - start_time

            # Log response (skip health checks in production)
            if settings.DEBUG or request.url.path != "/health":
                logger.info(
                    f"[{request_id}] {request.method} {request.url.path} - "
                    f"Completed {response.status_code} in {duration:.3f}s"
                )

            # Add timing header
            response.headers["X-Response-Time"] = f"{duration:.3f}s"
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception as exc:
            duration = time.time() - start_time
            logger.error(
                f"[{request_id}] {request.method} {request.url.path} - "
                f"Failed after {duration:.3f}s: {str(exc)}"
            )
            raise


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next: Callable):
        response = await call_next(request)
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        # Prevent MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Disable referrer leaking
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Block browser features not needed
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
        # XSS protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Content Security Policy (Phase 3)
        # Restricts sources for scripts, styles, images, etc.
        csp_directives = [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",  # Tailwind needs inline styles
            "img-src 'self' data: blob:",  # Allow data URIs for previews
            "font-src 'self'",
            "connect-src 'self'",  # API calls
            "frame-ancestors 'none'",  # Prevent embedding
            "form-action 'self'",
            "base-uri 'self'",
            "object-src 'none'",  # Block Flash, Java, etc.
        ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)

        # HSTS only in production/staging environments
        if settings.ENVIRONMENT.lower() in ("production", "prod", "staging"):
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        return response


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Global error handler - catches all unhandled exceptions."""

    async def dispatch(self, request: Request, call_next: Callable):
        try:
            return await call_next(request)
        except Exception as exc:
            # Log the full traceback
            logger.error(f"Unhandled exception: {str(exc)}")
            logger.error(traceback.format_exc())

            # Report to Sentry (no-op if not configured)
            from app.core.sentry import capture_exception
            capture_exception(exc, endpoint=str(request.url), method=request.method)

            # In development, return detailed error for debugging
            if settings.DEBUG and settings.ENVIRONMENT.lower() not in ("production", "prod", "staging"):
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={
                        "detail": str(exc),
                        "type": type(exc).__name__,
                        "traceback": traceback.format_exc().split("\n")
                    }
                )

            # In production, return generic error
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "detail": "Ein interner Fehler ist aufgetreten. Bitte versuchen Sie es später erneut."
                }
            )


# ═══════════════════════════════════════════════════════════════════════════
# LIFESPAN - Startup/Shutdown Events
# ═══════════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("=" * 60)
    logger.info(f"Starting {settings.PROJECT_NAME}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info(f"CORS Origins: {settings.BACKEND_CORS_ORIGINS}")
    logger.info("=" * 60)

    # Initialize Sentry error tracking (no-op if SENTRY_DSN not set)
    from app.core.sentry import init_sentry
    init_sentry()

    # Initialize Prometheus metrics (no-op if prometheus-client not installed)
    from app.core.metrics import setup_metrics
    setup_metrics(app)

    # Auto-create database tables if they don't exist
    try:
        from app.db import engine, Base
        # Import all models to register them with Base
        from app.models import core, documents, enterprise, collaboration  # noqa: F401

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified/created successfully")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        # Don't fail startup - allow health checks to report the issue

    # Run schema migrations for columns added after initial table creation
    try:
        from app.db import engine
        from sqlalchemy import text

        async with engine.begin() as conn:
            # Get existing columns for users table
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
            ))
            existing_cols = {row[0] for row in result.fetchall()}

            migrations_run = 0
            user_migrations = [
                ("totp_secret", "ALTER TABLE users ADD COLUMN totp_secret VARCHAR(64)"),
                ("totp_enabled", "ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE"),
                ("sso_provider", "ALTER TABLE users ADD COLUMN sso_provider VARCHAR(50)"),
                ("sso_subject_id", "ALTER TABLE users ADD COLUMN sso_subject_id VARCHAR(255)"),
                ("display_name", "ALTER TABLE users ADD COLUMN display_name VARCHAR(255)"),
            ]
            for col_name, sql in user_migrations:
                if col_name not in existing_cols:
                    await conn.execute(text(sql))
                    migrations_run += 1
                    logger.info(f"Migration: added column users.{col_name}")

            # Create indexes for SSO columns if they were just added
            if "sso_provider" not in existing_cols:
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_users_sso_provider ON users (sso_provider)"
                ))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_users_sso_subject_id ON users (sso_subject_id)"
                ))

            if migrations_run > 0:
                logger.info(f"Schema migrations complete: {migrations_run} columns added")
            else:
                logger.info("Schema migrations: no changes needed")
    except Exception as e:
        logger.error(f"Schema migration failed: {e}")
        # Don't fail startup

    yield

    # Shutdown
    logger.info("Shutting down application...")


# ═══════════════════════════════════════════════════════════════════════════
# APP INITIALIZATION
# ═══════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="""
    HR Document Generator API - Erstellen Sie HR-Dokumente automatisiert.

    ## Features
    - 35+ HR-Dokumenttypen (Arbeitsverträge, Kündigungen, Zeugnisse, etc.)
    - Template-basierte Generierung mit Klausel-Library
    - PDF & DOCX Export
    - Fristen-Management (Probezeit, Befristung)
    - Compliance-Prüfung

    ## Integration
    Diese API ist kompatibel mit:
    - Microsoft Copilot Studio (Custom Connector)
    - Power Automate (HTTP Actions)
    - Zapier / Make
    - Jede REST-fähige Anwendung
    """,
    version="1.0.0",
    # API docs controlled via SHOW_API_DOCS (independent from DEBUG)
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.SHOW_API_DOCS else None,
    docs_url=f"{settings.API_V1_STR}/docs" if settings.SHOW_API_DOCS else None,
    redoc_url=f"{settings.API_V1_STR}/redoc" if settings.SHOW_API_DOCS else None,
    lifespan=lifespan,
    # OpenAPI Tags für bessere Strukturierung
    openapi_tags=[
        {"name": "actions", "description": "High-Level Actions für Bot-Integration (Copilot Studio)"},
        {"name": "webhooks", "description": "Webhook-Subscriptions für Event-Benachrichtigungen"},
        {"name": "auth", "description": "Authentifizierung & Token-Management"},
        {"name": "generation", "description": "Dokument-Generierung"},
        {"name": "document-types", "description": "Dokumenttyp-Verwaltung"},
        {"name": "clauses", "description": "Klausel-Verwaltung"},
        {"name": "drafts", "description": "Entwürfe"},
        {"name": "deadlines", "description": "Fristen-Management"},
        {"name": "search", "description": "Volltextsuche"},
    ]
)

# Add middlewares (order matters - first added = outermost)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CSRFProtectionMiddleware)
app.add_middleware(UploadSizeLimitMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# Rate Limiting - always active (uses in-memory fallback when Redis unavailable)
app.add_middleware(RateLimitMiddleware)

# GZip Compression - compress responses > 500 bytes
app.add_middleware(GZipMiddleware, minimum_size=500)

# Prometheus Metrics middleware (must be registered before app starts, not in lifespan)
from app.core.metrics import register_metrics_middleware
register_metrics_middleware(app)

# CORS - Restrictive configuration
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        # Explicit methods instead of ["*"]
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        # Explicit headers
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Accept",
            "Origin",
            "X-Requested-With",
            "X-Request-ID",
        ],
        # Expose custom headers to frontend
        expose_headers=["X-Response-Time", "X-Request-ID"],
        max_age=600,  # Cache preflight for 10 minutes
    )

# ═══════════════════════════════════════════════════════════════════════════
# API ROUTES
# ═══════════════════════════════════════════════════════════════════════════

# Auth
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(sso.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth-sso"])

# Core Resources
app.include_router(clauses.router, prefix=f"{settings.API_V1_STR}/clauses", tags=["clauses"])
app.include_router(clause_versions.router, prefix=f"{settings.API_V1_STR}/clauses", tags=["clause-versions"])
app.include_router(document_types.router, prefix=f"{settings.API_V1_STR}/document-types", tags=["document-types"])
app.include_router(placeholders.router, prefix=f"{settings.API_V1_STR}/placeholders", tags=["placeholders"])

# Document Generation
app.include_router(generation.router, prefix=f"{settings.API_V1_STR}/documents", tags=["generation"])
app.include_router(preview.router, prefix=f"{settings.API_V1_STR}/preview", tags=["preview"])
app.include_router(history.router, prefix=f"{settings.API_V1_STR}/documents/history", tags=["history"])

# User Features
app.include_router(drafts.router, prefix=f"{settings.API_V1_STR}/drafts", tags=["drafts"])
app.include_router(statistics.router, prefix=f"{settings.API_V1_STR}/statistics", tags=["statistics"])
app.include_router(bulk.router, prefix=f"{settings.API_V1_STR}/bulk", tags=["bulk"])
app.include_router(chat.router, prefix=f"{settings.API_V1_STR}/chat", tags=["chat"])
app.include_router(custom_clauses.router, prefix=f"{settings.API_V1_STR}/custom-clauses", tags=["custom-clauses"])
app.include_router(favorites.router, prefix=f"{settings.API_V1_STR}/favorites", tags=["favorites"])
app.include_router(search.router, prefix=f"{settings.API_V1_STR}/search", tags=["search"])
app.include_router(teams.router, prefix=f"{settings.API_V1_STR}/teams", tags=["teams"])
app.include_router(notifications.router, prefix=f"{settings.API_V1_STR}/notifications", tags=["notifications"])
app.include_router(comments.router, prefix=f"{settings.API_V1_STR}/comments", tags=["comments"])

# Frontend Log Ingestion (fire-and-forget from browser)
app.include_router(frontend_logs.router, prefix=f"{settings.API_V1_STR}/logs", tags=["logs"])

# Admin Features
app.include_router(form_fields.router, prefix=f"{settings.API_V1_STR}/form-fields", tags=["form-fields"])
app.include_router(corrections.router, prefix=f"{settings.API_V1_STR}/corrections", tags=["corrections"])
app.include_router(locks.router, prefix=f"{settings.API_V1_STR}/locks", tags=["document-locks"])
app.include_router(repository.router, prefix=f"{settings.API_V1_STR}/repository", tags=["repository"])
app.include_router(export.router, prefix=f"{settings.API_V1_STR}/export", tags=["export"])
app.include_router(attachments.router, prefix=f"{settings.API_V1_STR}/admin/attachments", tags=["attachments"])
app.include_router(logo.router, prefix=f"{settings.API_V1_STR}/admin/logo", tags=["logo"])
app.include_router(templates.router, prefix=f"{settings.API_V1_STR}/admin/templates", tags=["templates"])
app.include_router(audit.router, prefix=f"{settings.API_V1_STR}/audit", tags=["audit"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])

# v4.2 Features
app.include_router(clause_notes.router, prefix=f"{settings.API_V1_STR}/clause-notes", tags=["clause-notes"])
app.include_router(company_settings.router, prefix=f"{settings.API_V1_STR}/company-settings", tags=["company-settings"])
app.include_router(clause_approval.router, prefix=f"{settings.API_V1_STR}/clause-approval", tags=["clause-approval"])
app.include_router(approvals.router, prefix=f"{settings.API_V1_STR}/document-approvals", tags=["document-approvals"])
app.include_router(deadlines.router, prefix=f"{settings.API_V1_STR}/deadlines", tags=["deadlines"])
app.include_router(works_council.router, prefix=f"{settings.API_V1_STR}/works-council", tags=["works-council"])
app.include_router(word_import.router, prefix=f"{settings.API_V1_STR}/word-import", tags=["word-import"])
app.include_router(document_type_import.router, prefix=f"{settings.API_V1_STR}/document-type-import", tags=["document-type-import"])
app.include_router(clause_variants.router, prefix=f"{settings.API_V1_STR}/clause-variants", tags=["clause-variants"])

# Smart UX - Unified Document Composer
app.include_router(composer.router, prefix=f"{settings.API_V1_STR}/composer", tags=["composer"])

# Compliance - Proactive Risk Detection (Privacy-First: Mistral/Ollama)
app.include_router(compliance.router, prefix=f"{settings.API_V1_STR}", tags=["compliance"])

# Smart Mode - Conversational Document Creation
app.include_router(smart_mode.router, prefix=f"{settings.API_V1_STR}/smart-mode", tags=["smart-mode"])

# AI Clause Selection - Bridges user clauses to LLM (v4.3)
app.include_router(clause_ai_selection.router, prefix=f"{settings.API_V1_STR}", tags=["clause-ai"])

# User Feature Settings (Toggles)
app.include_router(feature_settings.router, prefix=f"{settings.API_V1_STR}/feature-settings", tags=["feature-settings"])

# Document Upload with AI Extraction
app.include_router(document_upload.router, prefix=f"{settings.API_V1_STR}/document-upload", tags=["document-upload"])

# ═══════════════════════════════════════════════════════════════════════════
# COPILOT STUDIO / POWER PLATFORM INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════

# Bot-optimierte Actions API (für Copilot Studio Custom Connector)
app.include_router(actions.router, prefix=f"{settings.API_V1_STR}/actions", tags=["actions"])

# Webhooks für Power Automate Trigger
app.include_router(webhooks.router, prefix=f"{settings.API_V1_STR}/webhooks", tags=["webhooks"])

# Copilot Studio Konfiguration
app.include_router(copilot_studio.router, prefix=f"{settings.API_V1_STR}/copilot-studio", tags=["copilot-studio"])

# Public/Guest Access
app.include_router(guest.router, tags=["guest"])

# Initial Setup (only active when no admin exists)
app.include_router(setup.router, prefix=f"{settings.API_V1_STR}/setup", tags=["setup"])

# Countries Configuration API (v3.1 - Dynamic country support)
app.include_router(countries.router, prefix=f"{settings.API_V1_STR}/countries", tags=["countries"])

# Locations API (v3.1 - Multi-location support)
app.include_router(locations.router, prefix=f"{settings.API_V1_STR}/locations", tags=["locations"])


# ═══════════════════════════════════════════════════════════════════════════
# HEALTH CHECK ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health_check():
    """
    Basic health check - always returns OK if app is running.
    Used by load balancers and container orchestration.
    """
    return {"status": "ok"}


@app.get(f"{settings.API_V1_STR}/health")
async def api_health_check():
    """
    API health check - Endpoint für Frontend Offline-Detector.
    Unterstützt HEAD-Requests für minimalen Overhead.
    """
    return {"status": "ok", "api_version": "1.0.0"}


@app.head(f"{settings.API_V1_STR}/health")
async def api_health_check_head():
    """
    HEAD request für Offline-Detector (minimaler Overhead).
    Gibt nur Status-Code zurück, keinen Body.
    """
    from fastapi.responses import Response
    return Response(status_code=200)


@app.get("/health/ready")
async def readiness_check():
    """
    Readiness check - verifies all dependencies are available.
    Returns detailed status for monitoring.
    """
    from app.db import async_session_factory
    from sqlalchemy import text
    import redis.asyncio as redis

    checks = {
        "database": "unknown",
        "redis": "unknown",
    }

    # Check database
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
            checks["database"] = "healthy"
    except Exception as e:
        checks["database"] = f"unhealthy: {str(e)}"
        logger.error(f"Database health check failed: {e}")

    # Check Redis
    try:
        redis_client = redis.from_url(settings.REDIS_URL)
        await redis_client.ping()
        await redis_client.close()
        checks["redis"] = "healthy"
    except Exception as e:
        checks["redis"] = f"unhealthy: {str(e)}"
        logger.error(f"Redis health check failed: {e}")

    # Determine overall status
    all_healthy = all(v == "healthy" for v in checks.values())

    result = {
        "status": "ok" if all_healthy else "degraded",
        "version": "1.0.0",
    }
    # Only expose detailed checks in non-production environments
    if settings.ENVIRONMENT.lower() not in ("production", "prod", "staging"):
        result["checks"] = checks

    return result
