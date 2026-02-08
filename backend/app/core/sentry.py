"""
Sentry Error Tracking Integration

Initializes Sentry SDK for error tracking and performance monitoring.
Set SENTRY_DSN environment variable to enable.
When SENTRY_DSN is empty, all calls are no-ops.
"""
from __future__ import annotations

import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

_sentry_enabled = False


def init_sentry() -> None:
    """Initialize Sentry SDK if DSN is configured."""
    global _sentry_enabled

    if not settings.SENTRY_DSN:
        logger.info("Sentry DSN not configured – error tracking disabled")
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            release=f"docgen-backend@{settings.PROJECT_NAME}",
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            send_default_pii=False,  # Privacy: no PII in error reports
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
                LoggingIntegration(
                    level=logging.WARNING,
                    event_level=logging.ERROR,
                ),
            ],
            # Filter out health check transactions
            traces_sampler=_traces_sampler,
        )
        _sentry_enabled = True
        logger.info("Sentry initialized successfully (env=%s)", settings.ENVIRONMENT)

    except ImportError:
        logger.warning(
            "sentry-sdk not installed – run 'pip install sentry-sdk[fastapi]' to enable error tracking"
        )
    except Exception as e:
        logger.error("Failed to initialize Sentry: %s", e)


def _traces_sampler(sampling_context: dict) -> float:
    """Custom sampler to exclude noisy endpoints from tracing."""
    transaction_name = sampling_context.get("transaction_context", {}).get("name", "")

    # Skip health checks and static assets
    skip_patterns = ["/health", "/api/v1/health", "/favicon", "/static"]
    if any(pattern in transaction_name for pattern in skip_patterns):
        return 0.0

    return settings.SENTRY_TRACES_SAMPLE_RATE


def capture_exception(error: Exception, **extra) -> None:
    """Capture an exception to Sentry if enabled, otherwise log it."""
    if _sentry_enabled:
        try:
            import sentry_sdk
            with sentry_sdk.push_scope() as scope:
                for key, value in extra.items():
                    scope.set_extra(key, value)
                sentry_sdk.capture_exception(error)
        except Exception:
            logger.error("Failed to send exception to Sentry: %s", error)
    else:
        logger.error("Unhandled exception: %s", error, exc_info=error)


def capture_message(message: str, level: str = "info", **extra) -> None:
    """Send a message to Sentry if enabled."""
    if _sentry_enabled:
        try:
            import sentry_sdk
            with sentry_sdk.push_scope() as scope:
                for key, value in extra.items():
                    scope.set_extra(key, value)
                sentry_sdk.capture_message(message, level=level)
        except Exception:
            logger.warning("Failed to send message to Sentry: %s", message)


def set_user_context(user_id: str, email: str | None = None) -> None:
    """Set user context for Sentry error reports (no PII beyond ID+email)."""
    if _sentry_enabled:
        try:
            import sentry_sdk
            sentry_sdk.set_user({"id": user_id, "email": email})
        except Exception:
            pass
