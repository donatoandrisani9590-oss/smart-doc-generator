"""
SSE (Server-Sent Events) Endpoint für Real-time Updates.

Jeder authentifizierte User hält eine SSE-Verbindung offen.
Events werden via Redis Pub/Sub empfangen und sofort gepusht.
Keepalive-Pings alle 25 Sekunden verhindern Proxy-Timeouts.
"""

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, Request, Query, HTTPException, status, Depends
from fastapi.responses import StreamingResponse
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db import get_db
from app.models.core import User
from app.services.event_bus import subscribe_user_events

logger = logging.getLogger(__name__)

router = APIRouter()

KEEPALIVE_INTERVAL = 25  # Sekunden (Railway Proxy-Timeout = 30s)


async def _validate_token(token: str, db: AsyncSession) -> Optional[User]:
    """Validiert JWT-Token und gibt User zurück (wie get_current_user, aber ohne OAuth2-Dependency)."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        return None

    return user


async def _event_generator(request: Request, user_id: str):
    """
    Async Generator für SSE-Events.

    1. Sendet retry-Direktive
    2. Subscribed auf Redis Pub/Sub Kanal des Users
    3. Wartet auf Events oder sendet Keepalive-Pings
    """
    # SSE retry directive (ms)
    yield "retry: 3000\n\n"

    # Event-Queue für non-blocking Ping/Event multiplexing
    queue: asyncio.Queue = asyncio.Queue()

    async def _redis_listener():
        """Leitet Redis-Events in die Queue."""
        try:
            async for event in subscribe_user_events(user_id):
                await queue.put(event)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning("SSE Redis Listener Fehler für User %s: %s", user_id, e)

    listener_task = asyncio.create_task(_redis_listener())

    try:
        while True:
            # Prüfe ob Client noch verbunden
            if await request.is_disconnected():
                break

            try:
                # Warte auf Event oder Timeout für Ping
                event = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_INTERVAL)
                event_type = event.get("event_type", "message")
                data = event.get("data", {})
                yield f"event: {event_type}\ndata: {_json_dumps(data)}\n\n"
            except asyncio.TimeoutError:
                # Keepalive Ping
                yield "event: ping\ndata: {}\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        listener_task.cancel()
        try:
            await listener_task
        except asyncio.CancelledError:
            pass


def _json_dumps(data: dict) -> str:
    """Kompaktes JSON ohne Whitespace."""
    return json.dumps(data, separators=(",", ":"), ensure_ascii=False)


@router.get("/stream")
async def event_stream(
    request: Request,
    token: str = Query(..., description="JWT Bearer Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    SSE-Endpoint für Real-time Events.

    EventSource unterstützt keine Custom Headers, daher wird der
    JWT-Token als Query-Parameter übergeben.
    """
    user = await _validate_token(token, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiger oder abgelaufener Token",
        )

    user_id = str(user.id)
    logger.info("SSE: Verbindung geöffnet für User %s", user_id)

    return StreamingResponse(
        _event_generator(request, user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Nginx/Railway proxy buffering deaktivieren
        },
    )
