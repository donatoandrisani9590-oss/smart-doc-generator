"""
Agent Orchestrator endpoint — Claude-powered document creation with tool-use.

SSE streaming endpoint that:
1. Loads team context (instructions, clauses, templates)
2. Calls Claude API with tool definitions
3. Executes tools and loops until complete
4. Streams events (thinking, tool_start, tool_result, text_delta, done) to frontend

Conversation memory is stored in Redis (24h TTL) keyed by user_id + session_id.
"""
import asyncio
import json
import logging
import os
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.services.ai_instructions import get_ai_instructions
from app.services.agent_tools import AGENT_TOOLS, execute_tool, MAX_TOOL_ITERATIONS
from app.services.cache import cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/agent")

# ── Conversation memory constants ──────────────────────────────────────
CONV_TTL = 86400  # 24h
MAX_CONV_MESSAGES = 50


# ── Request / Response models ─────────────────────────────────────────

class AgentMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class AgentRequest(BaseModel):
    messages: list[AgentMessage]
    country_code: str = "DE"
    team_id: Optional[int] = None
    document_type_id: Optional[int] = None
    form_data: Optional[dict] = None
    session_id: Optional[str] = None  # For conversation memory


# ── Conversation memory helpers ───────────────────────────────────────

def _conversation_key(user_id: int, session_id: str) -> str:
    return f"agent:conversation:{user_id}:{session_id}"


async def _load_conversation(user_id: int, session_id: str) -> list[dict]:
    """Load previous conversation messages from Redis."""
    key = _conversation_key(user_id, session_id)
    data = await cache.get(key)
    if data and isinstance(data, list):
        return data[-MAX_CONV_MESSAGES:]
    return []


async def _save_conversation(user_id: int, session_id: str, messages: list[dict]) -> None:
    """Save conversation messages to Redis with TTL."""
    key = _conversation_key(user_id, session_id)
    trimmed = messages[-MAX_CONV_MESSAGES:]
    await cache.set(key, trimmed, ttl=CONV_TTL)


# ── SSE helper ────────────────────────────────────────────────────────

def _sse(event: dict) -> str:
    """Format a dict as an SSE data frame."""
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


# ── System prompt builder ─────────────────────────────────────────────

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
        "6. Verwende die verfügbaren Tools, um Formulardaten zu setzen, "
        "Klauseln auszuwählen und Dokumente zu erstellen.\n"
        "7. Erkläre dem Anwender kurz, was du tust, bevor du ein Tool aufrufst.\n"
        "8. Wenn du eine Klausel brauchst, die nicht existiert, erstelle einen "
        "Entwurf mit create_clause_draft — der Anwender muss bestätigen.\n"
        "9. Rufe get_form_field_definitions auf, wenn du nicht weißt, welche "
        "Felder ein Dokumenttyp hat.\n"
    )

    if instructions:
        base += f"\n{instructions}\n"

    if form_data:
        non_empty = {k: v for k, v in form_data.items() if v}
        if non_empty:
            base += f"\nAKTUELLE FORMULARDATEN:\n{json.dumps(non_empty, ensure_ascii=False, indent=2)}\n"

    return base


# ── Main endpoint ─────────────────────────────────────────────────────

@router.post("/chat")
async def agent_chat_stream(
    request: AgentRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Streaming agent endpoint with Claude tool-use loop.

    Returns SSE events:
    - {"type": "text_delta", "content": "..."}
    - {"type": "thinking", "content": "..."}
    - {"type": "tool_start", "tool": "...", "args": {...}}
    - {"type": "tool_result", "tool": "...", "result": {...}}
    - {"type": "form_update", "fields": {...}}
    - {"type": "clause_update", "enable": [...], "disable": [...]}
    - {"type": "clause_draft", "title": "...", "html": "...", "requires_confirmation": true}
    - {"type": "done", "summary": "...", "latency_ms": int}
    - {"type": "error", "message": "..."}
    """
    # Load 3-level AI instructions
    instructions = await get_ai_instructions(
        db,
        country_code=request.country_code,
        document_type_id=request.document_type_id,
        team_id=request.team_id,
    )

    system_prompt = _build_system_prompt(instructions, request.form_data)

    # Session management
    session_id = request.session_id or str(uuid.uuid4())
    user_id = current_user.id

    # Load conversation history
    conversation = await _load_conversation(user_id, session_id)

    # Append new user messages
    for msg in request.messages:
        conversation.append({"role": msg.role, "content": msg.content})

    async def _stream():
        nonlocal conversation
        _start = time.time()
        full_text = ""
        total_input_tokens = 0
        total_output_tokens = 0
        provider_name = "claude"
        model_name = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-5-20250929")

        try:
            import anthropic

            api_key = os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                yield _sse({"type": "error", "message": "ANTHROPIC_API_KEY nicht konfiguriert"})
                return

            client = anthropic.AsyncAnthropic(api_key=api_key)

            # Build API messages (conversation history, no system messages)
            api_messages = [
                {"role": m["role"], "content": m["content"]}
                for m in conversation
                if m["role"] in ("user", "assistant")
            ]

            iteration = 0

            while iteration < MAX_TOOL_ITERATIONS:
                iteration += 1

                # Call Claude with tools
                response = await client.messages.create(
                    model=model_name,
                    max_tokens=4096,
                    temperature=0.4,
                    system=system_prompt,
                    tools=AGENT_TOOLS,
                    messages=api_messages,
                )

                # Track usage
                total_input_tokens += response.usage.input_tokens
                total_output_tokens += response.usage.output_tokens

                # Process content blocks
                tool_results = []

                for block in response.content:
                    if block.type == "text":
                        text = block.text
                        full_text += text

                        # Stream text in chunks for smoother display
                        chunk_size = 20
                        for i in range(0, len(text), chunk_size):
                            chunk = text[i:i + chunk_size]
                            yield _sse({"type": "text_delta", "content": chunk})

                    elif block.type == "tool_use":
                        tool_name = block.name
                        tool_input = block.input
                        tool_id = block.id

                        # Emit tool_start event
                        yield _sse({
                            "type": "tool_start",
                            "tool": tool_name,
                            "args": tool_input,
                        })

                        # Execute tool
                        result = await execute_tool(
                            tool_name=tool_name,
                            tool_input=tool_input,
                            db=db,
                            user_id=user_id,
                            country_code=request.country_code,
                        )

                        # Emit tool_result event
                        yield _sse({
                            "type": "tool_result",
                            "tool": tool_name,
                            "result": result,
                        })

                        # Emit semantic events based on tool type
                        if tool_name == "fill_form_fields" and result.get("status") == "ok":
                            yield _sse({
                                "type": "form_update",
                                "fields": result.get("fields", {}),
                            })

                        elif tool_name == "select_clauses" and result.get("status") == "ok":
                            yield _sse({
                                "type": "clause_update",
                                "enable": result.get("enable", []),
                                "disable": result.get("disable", []),
                            })

                        elif tool_name == "create_clause_draft" and result.get("status") == "requires_confirmation":
                            draft = result.get("draft", {})
                            yield _sse({
                                "type": "clause_draft",
                                "title": draft.get("title", ""),
                                "html": draft.get("content", ""),
                                "requires_confirmation": True,
                            })

                        # Collect tool result for next API call
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tool_id,
                            "content": json.dumps(result, ensure_ascii=False),
                        })

                # If Claude is done (no more tool calls), exit loop
                if response.stop_reason != "tool_use":
                    break

                # Otherwise, append assistant response + tool results and continue
                # Build assistant content for the conversation
                assistant_content = []
                for block in response.content:
                    if block.type == "text":
                        assistant_content.append({
                            "type": "text",
                            "text": block.text,
                        })
                    elif block.type == "tool_use":
                        assistant_content.append({
                            "type": "tool_use",
                            "id": block.id,
                            "name": block.name,
                            "input": block.input,
                        })

                api_messages.append({"role": "assistant", "content": assistant_content})
                api_messages.append({"role": "user", "content": tool_results})

            # Save conversation (only text messages, not tool-use details)
            conversation.append({"role": "assistant", "content": full_text})
            await _save_conversation(user_id, session_id, conversation)

            latency_ms = int((time.time() - _start) * 1000)

            # Done event
            yield _sse({
                "type": "done",
                "summary": full_text[:200],
                "latency_ms": latency_ms,
                "session_id": session_id,
            })

            # Fire-and-forget LLM logging
            try:
                from app.services.llm_service import LLMResponse, log_llm_call
                llm_response = LLMResponse(
                    content=full_text,
                    provider=provider_name,
                    model=model_name,
                    usage={
                        "prompt_tokens": total_input_tokens,
                        "completion_tokens": total_output_tokens,
                        "total_tokens": total_input_tokens + total_output_tokens,
                    },
                )
                asyncio.create_task(log_llm_call(
                    feature="agent",
                    response=llm_response,
                    latency_ms=latency_ms,
                    user_id=str(user_id),
                    country_code=request.country_code,
                ))
            except Exception as log_err:
                logger.warning(f"LLM log failed: {log_err}")

        except Exception as e:
            logger.error(f"Agent stream error: {e}")
            error_msg = str(e)
            # Sanitize Anthropic API errors
            if hasattr(e, "message"):
                error_msg = e.message
            yield _sse({"type": "error", "message": error_msg})

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
