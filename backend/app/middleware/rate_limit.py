"""
Rate Limiting Middleware

Implements sliding window rate limiting using Redis.
Protects API endpoints from abuse and DoS attacks.

Features:
- Configurable limits per endpoint
- Different limits for authenticated vs anonymous users
- Sliding window algorithm for smoother rate limiting
- Headers to inform clients of their limits
"""

import logging
import time
from typing import Optional

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# RATE LIMIT CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

# Default limits (requests per minute)
DEFAULT_LIMITS = {
    # Anonymous users
    "anonymous": {
        "default": 60,  # 60 req/min
        "auth": 10,  # Login attempts: 10/min
        "generation": 5,  # Document generation: 5/min
    },
    # Authenticated users
    "authenticated": {
        "default": 200,  # 200 req/min
        "auth": 30,  # Token refresh: 30/min
        "generation": 30,  # Document generation: 30/min
        "bulk": 5,  # Bulk operations: 5/min
    },
}

# Path patterns for special limits
PATH_PATTERNS = {
    "/api/v1/auth/": "auth",
    "/api/v1/documents/generate": "generation",
    "/api/v1/bulk/": "bulk",
}


def get_limit_category(path: str) -> str:
    """Determine rate limit category based on request path."""
    for pattern, category in PATH_PATTERNS.items():
        if path.startswith(pattern):
            return category
    return "default"


def get_client_identifier(request: Request) -> tuple[str, bool]:
    """
    Get client identifier for rate limiting.
    Returns (identifier, is_authenticated).
    """
    # Check for authenticated user
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        # Use token hash as identifier (authenticated user)
        token = auth_header[7:]
        # Use first 16 chars of token as identifier
        return f"auth:{token[:16]}", True

    # Fall back to IP address
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"

    return f"ip:{client_ip}", False


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Redis-based rate limiting middleware.
    Uses sliding window algorithm.
    """

    def __init__(self, app, redis_url: Optional[str] = None):
        super().__init__(app)
        self.redis_url = redis_url or settings.REDIS_URL
        self._redis = None

    async def get_redis(self):
        """Lazy initialization of Redis connection."""
        if self._redis is None:
            try:
                import redis.asyncio as redis
                self._redis = redis.from_url(self.redis_url)
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}. Rate limiting disabled.")
                return None
        return self._redis

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/health/ready"]:
            return await call_next(request)

        # Skip rate limiting in debug mode (optional)
        # if settings.DEBUG:
        #     return await call_next(request)

        redis_client = await self.get_redis()

        # If Redis is unavailable, allow request but log warning
        if redis_client is None:
            return await call_next(request)

        try:
            # Get client identifier
            client_id, is_authenticated = get_client_identifier(request)

            # Get rate limit category
            category = get_limit_category(request.url.path)

            # Get limit for this category
            user_type = "authenticated" if is_authenticated else "anonymous"
            limit = DEFAULT_LIMITS[user_type].get(category, DEFAULT_LIMITS[user_type]["default"])

            # Rate limit key
            window = 60  # 1 minute window
            current_time = int(time.time())
            window_start = current_time - (current_time % window)
            key = f"ratelimit:{client_id}:{category}:{window_start}"

            # Increment counter
            current = await redis_client.incr(key)

            # Set expiry on first request
            if current == 1:
                await redis_client.expire(key, window + 1)

            # Calculate remaining
            remaining = max(0, limit - current)

            # Add rate limit headers
            response = None

            if current > limit:
                # Rate limit exceeded
                logger.warning(
                    f"Rate limit exceeded: {client_id} - {category} "
                    f"({current}/{limit} in {window}s)"
                )
                response = JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "detail": "Zu viele Anfragen. Bitte warten Sie einen Moment.",
                        "retry_after": window - (current_time % window),
                    }
                )
            else:
                response = await call_next(request)

            # Add rate limit headers to all responses
            response.headers["X-RateLimit-Limit"] = str(limit)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            response.headers["X-RateLimit-Reset"] = str(window_start + window)

            return response

        except Exception as e:
            logger.error(f"Rate limiting error: {e}")
            # On error, allow the request
            return await call_next(request)


class InMemoryRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple in-memory rate limiting for development.
    Use RateLimitMiddleware with Redis in production.
    """

    def __init__(self, app):
        super().__init__(app)
        self._requests: dict[str, list[float]] = {}

    async def dispatch(self, request: Request, call_next):
        # Skip health checks
        if request.url.path in ["/health", "/health/ready"]:
            return await call_next(request)

        client_id, is_authenticated = get_client_identifier(request)
        category = get_limit_category(request.url.path)

        user_type = "authenticated" if is_authenticated else "anonymous"
        limit = DEFAULT_LIMITS[user_type].get(category, DEFAULT_LIMITS[user_type]["default"])

        current_time = time.time()
        window = 60  # 1 minute

        # Get request history
        key = f"{client_id}:{category}"
        if key not in self._requests:
            self._requests[key] = []

        # Filter old requests
        self._requests[key] = [
            ts for ts in self._requests[key]
            if ts > current_time - window
        ]

        current = len(self._requests[key])

        if current >= limit:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Zu viele Anfragen. Bitte warten Sie einen Moment.",
                    "retry_after": 60,
                }
            )

        # Record this request
        self._requests[key].append(current_time)

        response = await call_next(request)

        # Add headers
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(limit - current - 1)

        return response
