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
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.middleware.rate_limit import RateLimitMiddleware
from app.api.v1.endpoints import auth, clauses, document_types, generation, guest
from app.api.v1.endpoints import preview, drafts, attachments, bulk
from app.api.v1.endpoints import logo, chat, templates, clause_versions, custom_clauses, history
from app.api.v1.endpoints import placeholders, statistics, favorites, search, teams, form_fields
from app.api.v1.endpoints import corrections, repository, audit, notifications, export
from app.api.v1.endpoints import clause_notes, company_settings, clause_approval, deadlines, works_council
from app.api.v1.endpoints import word_import, document_type_import, clause_variants, users
from app.api.v1.endpoints import composer

# ═══════════════════════════════════════════════════════════════════════════
# LOGGING CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# MIDDLEWARE CLASSES
# ═══════════════════════════════════════════════════════════════════════════

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


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Global error handler - catches all unhandled exceptions."""

    async def dispatch(self, request: Request, call_next: Callable):
        try:
            return await call_next(request)
        except Exception as exc:
            # Log the full traceback
            logger.error(f"Unhandled exception: {str(exc)}")
            logger.error(traceback.format_exc())

            # In debug mode, return detailed error
            if settings.DEBUG:
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

    yield

    # Shutdown
    logger.info("Shutting down application...")


# ═══════════════════════════════════════════════════════════════════════════
# APP INITIALIZATION
# ═══════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title=settings.PROJECT_NAME,
    # Hide API docs in production
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
    docs_url=f"{settings.API_V1_STR}/docs" if settings.DEBUG else None,
    redoc_url=f"{settings.API_V1_STR}/redoc" if settings.DEBUG else None,
    lifespan=lifespan
)

# Add middlewares (order matters - first added = outermost)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# Rate Limiting - Redis-based in production
if not settings.DEBUG:
    app.add_middleware(RateLimitMiddleware)

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

# Admin Features
app.include_router(form_fields.router, prefix=f"{settings.API_V1_STR}/form-fields", tags=["form-fields"])
app.include_router(corrections.router, prefix=f"{settings.API_V1_STR}/corrections", tags=["corrections"])
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
app.include_router(deadlines.router, prefix=f"{settings.API_V1_STR}/deadlines", tags=["deadlines"])
app.include_router(works_council.router, prefix=f"{settings.API_V1_STR}/works-council", tags=["works-council"])
app.include_router(word_import.router, prefix=f"{settings.API_V1_STR}/word-import", tags=["word-import"])
app.include_router(document_type_import.router, prefix=f"{settings.API_V1_STR}/document-type-import", tags=["document-type-import"])
app.include_router(clause_variants.router, prefix=f"{settings.API_V1_STR}/clause-variants", tags=["clause-variants"])

# Smart UX - Unified Document Composer
app.include_router(composer.router, prefix=f"{settings.API_V1_STR}/composer", tags=["composer"])

# Public/Guest Access
app.include_router(guest.router, tags=["guest"])


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


@app.get("/health/ready")
async def readiness_check():
    """
    Readiness check - verifies all dependencies are available.
    Returns detailed status for monitoring.
    """
    from app.db import async_session
    from sqlalchemy import text
    import redis.asyncio as redis

    checks = {
        "database": "unknown",
        "redis": "unknown",
    }

    # Check database
    try:
        async with async_session() as session:
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

    return {
        "status": "ok" if all_healthy else "degraded",
        "checks": checks,
        "version": "1.0.0",  # TODO: Read from version file
        "debug": settings.DEBUG,
    }
