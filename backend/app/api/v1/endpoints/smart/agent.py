"""
Agent Orchestrator endpoint — LLM-powered document creation with tool-use.

Uses Groq/Mistral/Ollama (OpenAI-compatible API) for tool-calling.
Falls back through available providers automatically via LLMService.

SSE streaming endpoint that:
1. Loads team context (instructions, clauses, templates)
2. Calls LLM API with OpenAI-compatible tool definitions
3. Executes tools and loops until complete
4. Streams events (tool_start, tool_result, text_delta, done) to frontend

Conversation memory is stored in Redis (1h TTL) keyed by user_id + session_id.
"""
import asyncio
import json
import logging
import os
import time
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.deps import get_current_user
from app.services.ai_instructions import get_ai_instructions
from app.services.agent_tools import AGENT_TOOLS, execute_tool, MAX_TOOL_ITERATIONS
from app.services.cache import cache
from app.services.pii_sanitizer import sanitize_form_data, sanitize_error_message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/agent")

# ── Conversation memory constants ──────────────────────────────────────
CONV_TTL = 3600  # 1h (DSGVO: minimale Speicherdauer für PII-haltige Konversationen)
MAX_CONV_MESSAGES = 50

# ── LLM Provider config for agent ─────────────────────────────────────
# Use a larger model for tool-calling quality (70B preferred, 8B fallback)
AGENT_MODEL = os.getenv("AGENT_MODEL", "llama-3.3-70b-versatile")


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
        # DSGVO Art. 5(1c): Datenminimierung — sensitive Felder werden redacted
        sanitized = sanitize_form_data(form_data)
        if sanitized:
            base += f"\nAKTUELLE FORMULARDATEN (sensitive Felder geschützt):\n{json.dumps(sanitized, ensure_ascii=False, indent=2)}\n"

    return base


# ── LLM API caller (OpenAI-compatible: Groq, Mistral, Ollama) ────────

async def _get_llm_config() -> tuple[str, str, dict]:
    """
    Detect available LLM provider and return (base_url, model, headers).

    Priority: Groq → Mistral → Ollama (matching LLMService but for tool-calling).
    """
    # Groq (fast, supports tool-calling with Llama 3.x models)
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        return (
            "https://api.groq.com/openai/v1",
            AGENT_MODEL,
            {"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
        )

    # Mistral (EU-hosted, DSGVO-konform)
    mistral_key = os.getenv("MISTRAL_API_KEY")
    if mistral_key:
        return (
            "https://api.mistral.ai/v1",
            os.getenv("MISTRAL_MODEL", "mistral-small-latest"),
            {"Authorization": f"Bearer {mistral_key}", "Content-Type": "application/json"},
        )

    # Ollama (local)
    ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{ollama_host}/api/tags", timeout=2.0)
            if resp.status_code == 200:
                return (
                    f"{ollama_host}/v1",  # Ollama's OpenAI-compat endpoint
                    os.getenv("OLLAMA_MODEL", "mistral:7b-instruct"),
                    {"Content-Type": "application/json"},
                )
    except Exception:
        pass

    raise RuntimeError(
        "Kein LLM-Provider für den KI-Assistenten verfügbar. "
        "Bitte GROQ_API_KEY, MISTRAL_API_KEY setzen oder Ollama starten."
    )


async def _call_llm_with_tools(
    base_url: str,
    model: str,
    headers: dict,
    messages: list[dict],
    tools: list[dict],
    temperature: float = 0.4,
    max_tokens: int = 4096,
) -> dict:
    """
    Call LLM with OpenAI-compatible chat completions + tools.

    Returns the raw JSON response dict.
    Includes retry logic for Groq rate limits (429).
    On tool validation errors (400), retries without tools as fallback.
    """
    payload = {
        "model": model,
        "messages": messages,
        "tools": tools,
        "tool_choice": "auto",
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    max_retries = 3
    for attempt in range(max_retries):
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=60.0,
            )

            if response.status_code == 429:
                if attempt < max_retries - 1:
                    wait_time = 2 ** (attempt + 1)
                    retry_after = response.headers.get("retry-after")
                    if retry_after:
                        try:
                            wait_time = min(float(retry_after), 10.0)
                        except ValueError:
                            pass
                    logger.warning(
                        f"LLM rate limit (Versuch {attempt + 1}/{max_retries}), "
                        f"Retry in {wait_time}s..."
                    )
                    await asyncio.sleep(wait_time)
                    continue
                raise Exception("LLM Rate-Limit nach Retries erreicht. Bitte kurz warten.")

            if response.status_code == 400:
                error_text = response.text[:500]
                # Groq sometimes returns 400 when the model generates invalid
                # tool arguments (e.g. string instead of int). Retry without
                # tools so the model can still produce a text response.
                if "tool" in error_text.lower() and attempt < max_retries - 1:
                    logger.warning(
                        f"Tool validation error (Versuch {attempt + 1}), "
                        f"retrying without tools: {error_text[:200]}"
                    )
                    payload.pop("tools", None)
                    payload.pop("tool_choice", None)
                    continue
                raise Exception(f"LLM API Fehler (400): {error_text}")

            if response.status_code != 200:
                error_text = response.text[:500]
                raise Exception(f"LLM API Fehler ({response.status_code}): {error_text}")

            return response.json()

    raise Exception("LLM API: Max Retries erreicht")


# ── Tool argument coercion ────────────────────────────────────────────

# Maps tool_name → {param_name: expected_type} for integer fields
# that Groq/Llama sometimes sends as strings
_INT_PARAMS = {
    "get_form_field_definitions": {"document_type_id"},
    "search_clauses": {"document_type_id"},
    "select_clauses": {"enable", "disable"},  # arrays of int
    "generate_text": {"max_sentences"},
    "update_package_draft": {"draft_id"},
    "apply_to_all_drafts": {"job_id"},
}


def _coerce_tool_args(tool_name: str, args: dict) -> dict:
    """
    Fix type mismatches from Groq/Llama tool calls.

    Llama models sometimes generate string values where integers
    are expected (e.g. "1" instead of 1). This coerces them.
    """
    int_params = _INT_PARAMS.get(tool_name, set())
    if not int_params:
        return args

    fixed = dict(args)
    for param in int_params:
        if param not in fixed:
            continue
        val = fixed[param]
        if isinstance(val, str):
            try:
                fixed[param] = int(val)
            except (ValueError, TypeError):
                pass
        elif isinstance(val, list):
            # Coerce list items (e.g. enable: ["1", "2"] → [1, 2])
            fixed[param] = [
                int(item) if isinstance(item, str) else item
                for item in val
            ]
    return fixed


# ── Conversation deletion (DSGVO Art. 17 — Recht auf Löschung) ────────

@router.delete("/conversation/{session_id}")
async def delete_conversation(
    session_id: str,
    current_user=Depends(get_current_user),
):
    """Lösche eine Konversation aus dem Cache (Recht auf Löschung, Art. 17 DSGVO)."""
    key = _conversation_key(current_user.id, session_id)
    await cache.delete(key)
    return {"status": "ok", "message": "Konversation gelöscht"}


# ── Main endpoint ─────────────────────────────────────────────────────

@router.post("/chat")
async def agent_chat_stream(
    request: AgentRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Streaming agent endpoint with OpenAI-compatible tool-use loop.

    Uses Groq/Mistral/Ollama (auto-detected) instead of Claude.

    Returns SSE events:
    - {"type": "text_delta", "content": "..."}
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
        provider_name = "unknown"
        model_name = "unknown"

        try:
            # Auto-detect LLM provider
            base_url, model_name, headers = await _get_llm_config()

            # Detect provider from URL for logging
            if "groq.com" in base_url:
                provider_name = "groq"
            elif "mistral.ai" in base_url:
                provider_name = "mistral"
            else:
                provider_name = "ollama"

            logger.info(f"Agent using {provider_name} ({model_name})")

            # Build API messages: system + conversation history
            api_messages = [
                {"role": "system", "content": system_prompt},
            ]
            for m in conversation:
                if m["role"] in ("user", "assistant"):
                    api_messages.append({"role": m["role"], "content": m["content"]})

            iteration = 0

            while iteration < MAX_TOOL_ITERATIONS:
                iteration += 1

                # Call LLM with tools (OpenAI-compatible format)
                data = await _call_llm_with_tools(
                    base_url=base_url,
                    model=model_name,
                    headers=headers,
                    messages=api_messages,
                    tools=AGENT_TOOLS,
                    temperature=0.4,
                    max_tokens=4096,
                )

                # Track usage
                usage = data.get("usage", {})
                total_input_tokens += usage.get("prompt_tokens", 0)
                total_output_tokens += usage.get("completion_tokens", 0)

                # Extract the assistant message
                choice = data.get("choices", [{}])[0]
                message = choice.get("message", {})
                finish_reason = choice.get("finish_reason", "stop")

                # Process text content
                text_content = message.get("content") or ""
                if text_content:
                    full_text += text_content

                    # Stream text in chunks for smoother display
                    chunk_size = 20
                    for i in range(0, len(text_content), chunk_size):
                        chunk = text_content[i:i + chunk_size]
                        yield _sse({"type": "text_delta", "content": chunk})

                # Process tool calls
                tool_calls = message.get("tool_calls") or []
                tool_result_messages = []

                for tc in tool_calls:
                    func = tc.get("function", {})
                    tool_name = func.get("name", "")
                    tool_call_id = tc.get("id", "")

                    # Parse arguments (Groq returns JSON string)
                    try:
                        tool_input = json.loads(func.get("arguments", "{}"))
                    except json.JSONDecodeError:
                        tool_input = {}

                    # Coerce types (Llama sometimes sends "1" instead of 1)
                    tool_input = _coerce_tool_args(tool_name, tool_input)

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

                    # Collect tool result for next API call (OpenAI format)
                    tool_result_messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "content": json.dumps(result, ensure_ascii=False),
                    })

                # If LLM is done (no tool calls or finish_reason != tool_calls), exit loop
                if not tool_calls or finish_reason != "tool_calls":
                    break

                # Otherwise, append assistant message + tool results and continue
                # Build assistant message for next turn
                assistant_msg = {"role": "assistant", "content": text_content or None}
                if tool_calls:
                    assistant_msg["tool_calls"] = tool_calls
                api_messages.append(assistant_msg)

                # Append all tool results
                for tr_msg in tool_result_messages:
                    api_messages.append(tr_msg)

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
            if hasattr(e, "message"):
                error_msg = e.message
            # DSGVO: Error-Messages können Prompt-Teile mit PII enthalten
            error_msg = sanitize_error_message(error_msg)
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
