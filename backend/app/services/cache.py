"""
Redis caching service for performance optimization.
Caches design settings, clauses, and document type data for fast preview.
"""
import json
import logging
from typing import Optional, Any
import os

logger = logging.getLogger(__name__)

# Try to import redis, fall back to in-memory cache if not available
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None


class CacheService:
    """
    Caching service with Redis backend (production) or in-memory fallback (dev).
    """
    
    def __init__(self):
        self._redis_client: Optional[Any] = None
        self._memory_cache: dict = {}
        self._initialized = False
    
    async def init(self):
        """Initialize Redis connection."""
        if self._initialized:
            return
        
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        
        if REDIS_AVAILABLE:
            try:
                self._redis_client = redis.from_url(
                    redis_url,
                    encoding="utf-8",
                    decode_responses=True
                )
                # Test connection
                await self._redis_client.ping()
                logger.info(f"Redis connected: {redis_url}")
            except Exception as e:
                logger.warning(f"Redis unavailable ({e}), using memory cache")
                self._redis_client = None
        else:
            logger.warning("Redis library not installed, using memory cache")
        
        self._initialized = True
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self._initialized:
            await self.init()
        
        if self._redis_client:
            try:
                value = await self._redis_client.get(key)
                if value:
                    return json.loads(value)
            except Exception as e:
                logger.warning("Redis GET failed for key=%s: %s", key, e)

        return self._memory_cache.get(key)
    
    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """
        Set value in cache with TTL (seconds).
        Default TTL: 5 minutes.
        """
        if not self._initialized:
            await self.init()
        
        serialized = json.dumps(value, default=str)
        
        if self._redis_client:
            try:
                await self._redis_client.setex(key, ttl, serialized)
                return True
            except Exception as e:
                logger.warning("Redis SET failed for key=%s: %s", key, e)

        # Memory cache fallback (no TTL enforcement)
        self._memory_cache[key] = value
        return True
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache."""
        if not self._initialized:
            await self.init()
        
        if self._redis_client:
            try:
                await self._redis_client.delete(key)
            except Exception as e:
                logger.warning("Redis DELETE failed for key=%s: %s", key, e)

        self._memory_cache.pop(key, None)
        return True
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern."""
        if not self._initialized:
            await self.init()
        
        count = 0
        
        if self._redis_client:
            try:
                async for key in self._redis_client.scan_iter(match=pattern):
                    await self._redis_client.delete(key)
                    count += 1
            except Exception as e:
                logger.warning("Redis SCAN/DELETE failed for pattern=%s: %s", pattern, e)

        # Memory cache pattern matching (fnmatch for proper glob support)
        import fnmatch
        keys_to_delete = [k for k in self._memory_cache if fnmatch.fnmatch(k, pattern)]
        for k in keys_to_delete:
            del self._memory_cache[k]
            count += 1
        
        return count
    
    async def clear(self) -> bool:
        """Clear entire cache."""
        if not self._initialized:
            await self.init()
        
        if self._redis_client:
            try:
                await self._redis_client.flushdb()
            except Exception as e:
                logger.warning("Redis FLUSHDB failed: %s", e)

        self._memory_cache.clear()
        return True


# Global cache instance
cache = CacheService()


# ═══════════════════════════════════════════════════════════════════════════
# CACHE KEY HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def design_settings_key(country_code: str) -> str:
    return f"design_settings:{country_code}"


def clauses_key(document_type_id: int) -> str:
    return f"clauses:type:{document_type_id}"


def document_type_key(document_type_id: int) -> str:
    return f"document_type:{document_type_id}"


def form_fields_key(document_type_id: int) -> str:
    return f"form_fields:type:{document_type_id}"


# ═══════════════════════════════════════════════════════════════════════════
# CACHE INVALIDATION HELPERS
# ═══════════════════════════════════════════════════════════════════════════

async def invalidate_design_settings(country_code: str):
    """Invalidate design settings cache for a country."""
    await cache.delete(design_settings_key(country_code))


async def invalidate_clauses(document_type_id: int = None):
    """Invalidate clauses cache."""
    if document_type_id:
        await cache.delete(clauses_key(document_type_id))
    else:
        await cache.delete_pattern("clauses:*")


def variant_groups_key(document_type_id: int) -> str:
    """Cache key for variant groups by document type."""
    return f"preview:variant_groups:{document_type_id}"


async def invalidate_variant_groups(document_type_id: int) -> None:
    """Invalidate variant groups cache for a document type."""
    await cache.delete(variant_groups_key(document_type_id))


async def invalidate_document_type(document_type_id: int):
    """Invalidate document type cache."""
    await cache.delete(document_type_key(document_type_id))
    await cache.delete(clauses_key(document_type_id))
    await cache.delete(form_fields_key(document_type_id))
    await cache.delete(variant_groups_key(document_type_id))


async def invalidate_all():
    """Clear all caches."""
    await cache.clear()


# ═══════════════════════════════════════════════════════════════════════════
# AI CACHE KEYS (Compliance, Consistency, AI Instructions)
# ═══════════════════════════════════════════════════════════════════════════

def compliance_scan_key(content_hash: str, country_code: str, use_llm: bool = False) -> str:
    """Cache key for compliance scan results."""
    mode = "llm" if use_llm else "pattern"
    return f"compliance:v1:{mode}:{country_code}:{content_hash}"


def consistency_check_key(check_hash: str) -> str:
    """Cache key for consistency check results."""
    return f"consistency:v1:{check_hash}"


def ai_instructions_key(country_code: str, document_type_id: Optional[int] = None) -> str:
    """Cache key for AI instructions (global + per document type) — legacy 2-level."""
    return f"ai_instructions:{country_code}:{document_type_id or 'global'}"


def ai_instructions_key_with_team(country_code: str, team_id: Optional[int] = None, document_type_id: Optional[int] = None) -> str:
    """Cache key for 3-level AI instructions (company + team + doctype)."""
    return f"ai_instructions:v2:{country_code}:{team_id or 'none'}:{document_type_id or 'none'}"


# ═══════════════════════════════════════════════════════════════════════════
# AI CACHE INVALIDATION
# ═══════════════════════════════════════════════════════════════════════════

async def invalidate_compliance_cache():
    """Invalidate all compliance scan cache entries."""
    await cache.delete_pattern("compliance:*")


async def invalidate_consistency_cache():
    """Invalidate all consistency check cache entries."""
    await cache.delete_pattern("consistency:*")


async def invalidate_ai_instructions(country_code: str = None):
    """Invalidate AI instructions cache."""
    if country_code:
        await cache.delete_pattern(f"ai_instructions:{country_code}:*")
        await cache.delete_pattern(f"ai_instructions:v2:{country_code}:*")
    else:
        await cache.delete_pattern("ai_instructions:*")


async def invalidate_team_ai_instructions(team_id: int) -> None:
    """Invalidate all cached instructions for a team (all countries, all doc types)."""
    await cache.delete_pattern(f"ai_instructions:v2:*:{team_id}:*")
