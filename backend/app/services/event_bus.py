"""
Event Bus - Redis Pub/Sub für Server-Sent Events

Stellt publish_event() und subscribe_user_events() bereit.
Graceful Degradation: Bei Redis-Ausfall wird geloggt und zurückgekehrt.
"""

import json
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

# Lazy-initialized Redis connection for pub/sub
_pubsub_redis: Optional[aioredis.Redis] = None


async def _get_redis() -> Optional[aioredis.Redis]:
    """Lazy-init Redis client for pub/sub (separate from cache client)."""
    global _pubsub_redis
    if _pubsub_redis is not None:
        return _pubsub_redis
    try:
        _pubsub_redis = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=3,
        )
        # Test connection
        await _pubsub_redis.ping()
        logger.info("Event Bus: Redis Pub/Sub verbunden")
        return _pubsub_redis
    except Exception as e:
        logger.warning("Event Bus: Redis nicht verfügbar (%s) — Events deaktiviert", e)
        _pubsub_redis = None
        return None


def _channel_name(user_id: str) -> str:
    """Redis channel name for a user."""
    return f"events:user:{user_id}"


async def publish_event(
    user_id: str,
    event_type: str,
    data: dict,
) -> bool:
    """
    Publiziert ein Event an den Redis-Kanal eines Users.

    Returns True bei Erfolg, False bei Fehler (silent).
    """
    redis_client = await _get_redis()
    if not redis_client:
        return False

    message = json.dumps({
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data,
    })

    try:
        await redis_client.publish(_channel_name(user_id), message)
        return True
    except Exception as e:
        logger.warning("Event Bus: Publish fehlgeschlagen für User %s: %s", user_id, e)
        return False


async def subscribe_user_events(user_id: str) -> AsyncGenerator[dict, None]:
    """
    Async Generator der Events aus dem Redis Pub/Sub Kanal eines Users yielded.

    Yields dict mit keys: event_type, timestamp, data
    """
    redis_client = await _get_redis()
    if not redis_client:
        return

    pubsub = redis_client.pubsub()
    channel = _channel_name(user_id)

    try:
        await pubsub.subscribe(channel)
        logger.debug("Event Bus: Subscribed to %s", channel)

        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                event = json.loads(message["data"])
                yield event
            except (json.JSONDecodeError, TypeError):
                logger.warning("Event Bus: Ungültige Nachricht auf %s", channel)
                continue
    except Exception as e:
        logger.warning("Event Bus: Subscription-Fehler für %s: %s", channel, e)
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
        except Exception:
            pass
