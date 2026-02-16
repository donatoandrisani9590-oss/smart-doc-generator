"""
Agent Orchestrator endpoint — Claude-powered document creation with tool-use.

SSE streaming endpoint that:
1. Loads team context (instructions, clauses, templates)
2. Calls Claude API with tool definitions
3. Executes tools and loops until complete
4. Streams events (thinking, tool_start, tool_result, text_delta, done) to frontend
"""
import json
import logging
import time
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.services.ai_instructions import get_ai_instructions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/agent")


class AgentMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class AgentRequest(BaseModel):
    messages: list[AgentMessage]
    country_code: str = "DE"
    team_id: Optional[int] = None
    document_type_id: Optional[int] = None
    form_data: Optional[dict] = None


@router.post("/chat")
async def agent_chat_stream(
    request: AgentRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Streaming agent endpoint. Returns SSE events:
    - {"type": "text_delta", "content": "..."}
    - {"type": "tool_start", "tool": "...", "args": {...}}
    - {"type": "tool_result", "tool": "...", "result": {...}}
    - {"type": "done", "summary": "..."}
    """
    # Load 3-level AI instructions
    instructions = await get_ai_instructions(
        db,
        country_code=request.country_code,
        document_type_id=request.document_type_id,
        team_id=request.team_id,
    )

    # Build system prompt
    system_prompt = _build_system_prompt(instructions, request.form_data)

    async def _stream():
        try:
            # Phase 0: Simple streaming response (no tool-use yet)
            # Tool-use loop will be added in Phase 1
            from app.services.llm_service import LLMService, LLMConfig, LLMMessage, LLMProvider

            llm = LLMService(preferred_provider=LLMProvider.CLAUDE)

            messages = [LLMMessage(role="system", content=system_prompt)]
            for msg in request.messages:
                messages.append(LLMMessage(role=msg.role, content=msg.content))

            config = LLMConfig(temperature=0.4, max_tokens=2048)

            _start = time.time()
            full_text = ""

            async for token in llm.chat_stream(messages, config):
                full_text += token
                event = {"type": "text_delta", "content": token}
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

            latency_ms = int((time.time() - _start) * 1000)

            # Done event
            done_event = {
                "type": "done",
                "summary": full_text[:200],
                "latency_ms": latency_ms,
            }
            yield f"data: {json.dumps(done_event, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.error(f"Agent stream error: {e}")
            error_event = {"type": "error", "message": str(e)}
            yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _build_system_prompt(instructions: str, form_data: Optional[dict] = None) -> str:
    """Build the agent system prompt with instructions and context."""
    base = (
        "Du bist ein KI-Dokumentenassistent. Du hilfst Anwendern beim Erstellen "
        "von Geschäftsdokumenten. Du arbeitest präzise, freundlich und effizient.\n\n"
        "REGELN:\n"
        "1. Verwende NUR Textbausteine aus der Team-Bibliothek des Anwenders.\n"
        "2. Verwende NUR Briefvorlagen des Teams.\n"
        "3. Wenn du Text generierst, markiere ihn als 'KI-generiert'.\n"
        "4. Halte dich an die Unternehmens-, Team- und Dokumenttyp-Richtlinien.\n"
        "5. Bei Unsicherheit: Frage den Anwender.\n"
    )

    if instructions:
        base += f"\n{instructions}\n"

    if form_data:
        non_empty = {k: v for k, v in form_data.items() if v}
        if non_empty:
            base += f"\nAKTUELLE FORMULARDATEN:\n{json.dumps(non_empty, ensure_ascii=False, indent=2)}\n"

    return base
