# Agentic Document Engine — Phase 0: Infrastruktur

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Alle Fundamente legen, damit Phase 1 (Agent Orchestrator) sofort mit der Kernlogik starten kann.

**Architecture:** Claude API-Client als neuer LLM-Provider, 3-Ebenen-Instruktionshierarchie (Company > Team > DocType), DB-Erweiterungen fuer KI-generierte Klauseln und Team-Patterns, und ein initialer Agent-Endpoint mit SSE-Streaming.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy (async), Anthropic Python SDK, Redis, React 19, TypeScript

**Design Doc:** `docs/plans/2026-02-16-agentic-document-engine-design.md`

---

## Task 1: DB-Migration — Team.ai_instructions + Clause KI-Felder + TeamPattern

**Files:**
- Create: `backend/migrations/versions/009_add_agent_infrastructure.py`
- Modify: `backend/app/models/enterprise.py:297-317` (Team model)
- Modify: `backend/app/models/documents.py:93-135` (Clause model)
- Create: (TeamPattern model — in enterprise.py)
- Modify: `backend/app/models/__init__.py` (export TeamPattern)

**Step 1: Write the migration file**

```python
# backend/migrations/versions/009_add_agent_infrastructure.py
"""Add agent infrastructure: Team.ai_instructions, Clause AI fields, TeamPattern table"""

from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"

def upgrade():
    # 1. Team: ai_instructions
    op.add_column("teams", sa.Column("ai_instructions", sa.Text(), nullable=True))

    # 2. Clause: KI-Generierungs-Metadaten
    op.add_column("clauses", sa.Column("is_ai_generated", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("clauses", sa.Column("ai_generation_context", sa.Text(), nullable=True))

    # 3. TeamPattern table
    op.create_table(
        "team_patterns",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("document_type_id", sa.Integer(), sa.ForeignKey("document_types.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field_defaults", sa.Text(), nullable=True),
        sa.Column("common_clause_ids", sa.Text(), nullable=True),
        sa.Column("sample_size", sa.Integer(), default=0),
        sa.Column("calculated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("team_id", "document_type_id", name="uq_team_pattern_team_doctype"),
    )

def downgrade():
    op.drop_table("team_patterns")
    op.drop_column("clauses", "ai_generation_context")
    op.drop_column("clauses", "is_ai_generated")
    op.drop_column("teams", "ai_instructions")
```

**Step 2: Add fields to Team model**

In `backend/app/models/enterprise.py`, add after line 313 (`allow_member_invites`):

```python
    # KI-Anweisungen (team-spezifisch, ergaenzt globale Unternehmensanweisungen)
    ai_instructions = Column(Text, nullable=True)
```

**Step 3: Add fields to Clause model**

In `backend/app/models/documents.py`, add after line 131 (`approval_comment`):

```python
    # KI-Generierungs-Metadaten (Agentic Engine)
    is_ai_generated = Column(Boolean, default=False)
    ai_generation_context = Column(Text, nullable=True)  # JSON: {prompt, applied_rules[], source_document_id}
```

**Step 4: Add TeamPattern model to enterprise.py**

Add at the end of `backend/app/models/enterprise.py`:

```python
class TeamPattern(Base):
    """Aggregierte Muster pro Team+Dokumenttyp, periodisch berechnet."""
    __tablename__ = "team_patterns"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    document_type_id = Column(Integer, ForeignKey("document_types.id", ondelete="CASCADE"), nullable=False)

    field_defaults = Column(Text, nullable=True)      # JSON: {"wochenstunden": "40", ...}
    common_clause_ids = Column(Text, nullable=True)    # JSON: [12, 15, 23, 42]
    sample_size = Column(Integer, default=0)
    calculated_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("team_id", "document_type_id", name="uq_team_pattern_team_doctype"),
    )
```

**Step 5: Export TeamPattern in __init__.py**

In `backend/app/models/__init__.py`, add `TeamPattern` to the imports from enterprise.

**Step 6: Add migration to startup**

In `backend/app/main.py`, find the startup migration section and ensure `009_add_agent_infrastructure` columns are handled (same pattern as existing startup migrations for missing columns).

**Step 7: Run migration and verify**

Run: `cd backend && python -c "from app.models.enterprise import Team, TeamPattern; from app.models.documents import Clause; print('Models OK')"`
Expected: `Models OK`

**Step 8: Commit**

```bash
git add backend/migrations/versions/009_add_agent_infrastructure.py backend/app/models/enterprise.py backend/app/models/documents.py backend/app/models/__init__.py backend/app/main.py
git commit -m "feat: add agent infrastructure DB models (Team.ai_instructions, Clause AI fields, TeamPattern)"
```

---

## Task 2: Claude API Client in llm_service.py

**Files:**
- Modify: `backend/app/services/llm_service.py:31-36` (LLMProvider enum)
- Modify: `backend/app/services/llm_service.py:73-99` (add ClaudeClient after BaseLLMClient)
- Modify: `backend/app/services/llm_service.py:516-585` (LLMService + auto-detect)
- Modify: `backend/requirements.txt` (add anthropic SDK)

**Step 1: Add anthropic to requirements**

Add `anthropic>=0.42.0` to `backend/requirements.txt`.

**Step 2: Add CLAUDE to LLMProvider enum**

In `llm_service.py` around line 31-36, add `CLAUDE = "claude"` to the enum:

```python
class LLMProvider(str, Enum):
    GROQ = "groq"
    MISTRAL = "mistral"
    OLLAMA = "ollama"
    CLAUDE = "claude"  # NEU
```

**Step 3: Write ClaudeClient class**

Add after OllamaClient (around line 514), before LLMService:

```python
class ClaudeClient(BaseLLMClient):
    """Anthropic Claude API client — used for agent orchestration and complex reasoning."""

    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        self.default_model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-5-20250929")

    async def is_available(self) -> bool:
        return bool(self.api_key)

    async def chat(self, messages: list[LLMMessage], config: LLMConfig) -> LLMResponse:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=self.api_key)

        # Convert messages: separate system from user/assistant
        system_content = ""
        api_messages = []
        for msg in messages:
            if msg.role == "system":
                system_content += msg.content + "\n"
            else:
                api_messages.append({"role": msg.role, "content": msg.content})

        response = await client.messages.create(
            model=config.model or self.default_model,
            max_tokens=config.max_tokens or 4096,
            temperature=config.temperature,
            system=system_content.strip() if system_content else None,
            messages=api_messages,
        )

        content = response.content[0].text if response.content else ""
        return LLMResponse(
            content=content,
            provider="claude",
            model=response.model,
            tokens_used=response.usage.input_tokens + response.usage.output_tokens,
        )

    async def chat_stream(self, messages: list[LLMMessage], config: LLMConfig) -> AsyncGenerator[str, None]:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=self.api_key)

        system_content = ""
        api_messages = []
        for msg in messages:
            if msg.role == "system":
                system_content += msg.content + "\n"
            else:
                api_messages.append({"role": msg.role, "content": msg.content})

        async with client.messages.stream(
            model=config.model or self.default_model,
            max_tokens=config.max_tokens or 4096,
            temperature=config.temperature,
            system=system_content.strip() if system_content else None,
            messages=api_messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text
```

**Step 4: Register ClaudeClient in LLMService**

In `LLMService.__init__` (around line 533), add:

```python
self.claude = ClaudeClient()
```

In `_get_client()` (around line 540), add Claude to auto-detect. Claude should NOT be auto-detected for simple tasks — it's only used when explicitly requested:

```python
if self.preferred_provider == LLMProvider.CLAUDE:
    if await self.claude.is_available():
        self._active_client = self.claude
        return self._active_client
```

**Step 5: Run existing tests to verify no regression**

Run: `cd backend && python -m pytest tests/ -x -q --timeout=30 2>&1 | head -30`
Expected: Same test results as before (20 pre-existing failures, no new ones).

**Step 6: Commit**

```bash
git add backend/app/services/llm_service.py backend/requirements.txt
git commit -m "feat: add ClaudeClient to LLM service (Anthropic API provider)"
```

---

## Task 3: Extend get_ai_instructions() with Team Layer

**Files:**
- Modify: `backend/app/services/ai_instructions.py` (add team_id parameter + query)
- Modify: `backend/app/services/cache.py` (add team-aware cache key)

**Step 1: Update cache key helper**

In `backend/app/services/cache.py`, add a new key helper:

```python
def ai_instructions_key_with_team(country_code: str, team_id: Optional[int] = None, document_type_id: Optional[int] = None) -> str:
    """Cache key for 3-level AI instructions (company + team + doctype)."""
    return f"ai_instructions:v2:{country_code}:{team_id or 'none'}:{document_type_id or 'none'}"
```

**Step 2: Extend get_ai_instructions()**

Rewrite `backend/app/services/ai_instructions.py`:

```python
async def get_ai_instructions(
    db: AsyncSession,
    country_code: str,
    document_type_id: Optional[int] = None,
    team_id: Optional[int] = None,
) -> str:
    """
    Load and combine AI instructions from 3 levels:
    1. Global (per country) — CompanySettings.ai_instructions
    2. Team — Team.ai_instructions (NEU)
    3. Per document type — DocumentType.ai_instructions

    Returns formatted string for system prompts, or empty string.
    Cached for 10 minutes.
    """
    from app.services.cache import ai_instructions_key_with_team

    cache_key = ai_instructions_key_with_team(country_code, team_id, document_type_id)
    cached = await cache.get(cache_key)
    if cached is not None and isinstance(cached, dict) and _CACHE_WRAPPER_KEY in cached:
        return cached[_CACHE_WRAPPER_KEY]

    parts: list[str] = []

    # 1. Global instructions from CompanySettings (per country)
    result = await db.execute(
        select(CompanySettings).where(CompanySettings.country_code == country_code)
    )
    company = result.scalar_one_or_none()
    if company and company.ai_instructions and company.ai_instructions.strip():
        parts.append(f"UNTERNEHMENS-RICHTLINIEN:\n{company.ai_instructions.strip()}")

    # 2. Team-specific instructions (NEU)
    if team_id:
        from app.models.enterprise import Team
        team = await db.get(Team, team_id)
        if team and team.ai_instructions and team.ai_instructions.strip():
            parts.append(f"TEAM-REGELN ({team.name}):\n{team.ai_instructions.strip()}")

    # 3. Document-type-specific instructions
    if document_type_id:
        doc_type = await db.get(DocumentType, document_type_id)
        if doc_type and doc_type.ai_instructions and doc_type.ai_instructions.strip():
            parts.append(f"DOKUMENTTYP-REGELN ({doc_type.name}):\n{doc_type.ai_instructions.strip()}")

    if not parts:
        instructions = ""
    else:
        instructions = "\n\nBENUTZERDEFINIERTE ANWEISUNGEN:\n" + "\n\n".join(parts)

    await cache.set(cache_key, {_CACHE_WRAPPER_KEY: instructions}, ttl=600)
    return instructions
```

**Step 3: Keep backward compatibility**

The function signature is backward-compatible — `team_id` defaults to `None`. All existing callers (refine, draft, compliance, chat, etc.) continue to work without changes. They can be updated later to pass `team_id` when available.

**Step 4: Add cache invalidation for team instructions**

In `backend/app/services/cache.py`, add:

```python
async def invalidate_team_ai_instructions(team_id: int) -> None:
    """Invalidate all cached instructions for a team (all countries, all doc types)."""
    # Pattern-based deletion
    pattern = f"ai_instructions:v2:*:{team_id}:*"
    await cache.delete_pattern(pattern)
```

**Step 5: Verify imports work**

Run: `cd backend && python -c "from app.services.ai_instructions import get_ai_instructions; print('OK')"`
Expected: `OK`

**Step 6: Commit**

```bash
git add backend/app/services/ai_instructions.py backend/app/services/cache.py
git commit -m "feat: extend AI instructions with 3-level hierarchy (Company > Team > DocType)"
```

---

## Task 4: Agent Endpoint Scaffold with SSE Streaming

**Files:**
- Create: `backend/app/api/v1/endpoints/smart/agent.py`
- Modify: `backend/app/main.py` (register router)

**Step 1: Create the agent endpoint file**

```python
# backend/app/api/v1/endpoints/smart/agent.py
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

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
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
    current_user: User = Depends(get_current_user),
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
            # Phase 1: Simple streaming response (no tool-use yet)
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
        "von Geschaeftsdokumenten. Du arbeitest praezise, freundlich und effizient.\n\n"
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
```

**Step 2: Register router in main.py**

In `backend/app/main.py`, add import and registration (around line 607, after smart_wizard):

```python
from app.api.v1.endpoints.smart import agent as smart_agent

# Around line 608:
app.include_router(smart_agent.router, tags=["agent"])
```

**Step 3: Verify endpoint loads**

Run: `cd backend && python -c "from app.api.v1.endpoints.smart.agent import router; print(f'Routes: {[r.path for r in router.routes]}')" `
Expected: `Routes: ['/chat']`

**Step 4: Commit**

```bash
git add backend/app/api/v1/endpoints/smart/agent.py backend/app/main.py
git commit -m "feat: add agent endpoint scaffold with SSE streaming (/api/v1/agent/chat)"
```

---

## Task 5: Frontend — Extended SSE Event Types

**Files:**
- Modify: `frontend/src/lib/api-stream.ts` (extend SSEEvent interface)

**Step 1: Extend SSEEvent type**

In `frontend/src/lib/api-stream.ts`, replace the existing `SSEEvent` interface:

```typescript
export interface SSEEvent {
  // Existing (text streaming)
  token?: string;
  done?: boolean;
  provider?: string;
  changes_summary?: string;
  error?: string;

  // Agent events (Phase 0 prep, used in Phase 1+2)
  type?: "text_delta" | "thinking" | "tool_start" | "tool_result"
       | "form_update" | "clause_update" | "clause_draft"
       | "preview_ready" | "done" | "error";
  content?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  fields?: Record<string, string>;
  enable?: number[];
  disable?: number[];
  title?: string;
  html?: string;
  summary?: string;
  latency_ms?: number;
  requires_confirmation?: boolean;
}
```

This is backward-compatible — existing consumers check `event.token` and `event.done`, which still work. New agent consumers will check `event.type`.

**Step 2: Commit**

```bash
git add frontend/src/lib/api-stream.ts
git commit -m "feat: extend SSE event types for agent protocol"
```

---

## Task 6: Frontend — Feature Flag for Agent

**Files:**
- Modify: `frontend/src/contexts/FeatureSettingsContext.tsx` (add enable_ai_agent)
- Modify: `backend/app/models/user_settings.py` (add enable_ai_agent flag)

**Step 1: Add feature flag to backend model**

In `backend/app/models/user_settings.py`, add to the feature definitions:

```python
enable_ai_agent = Column(Boolean, default=True)
```

And add to the `FEATURE_DEFINITIONS` dict:

```python
"enable_ai_agent": {
    "label": "KI-Assistent (Agent-Modus)",
    "description": "Aktiviert den KI-gestuetzten Dokumentenassistenten mit Chat-First-Workflow",
    "default": True,
    "group": "ki",
},
```

**Step 2: Add feature key to frontend**

In `frontend/src/contexts/FeatureSettingsContext.tsx`, add to the `FeatureKey` type:

```typescript
| "enable_ai_agent"
```

And add to `DEFAULT_SETTINGS`:

```typescript
enable_ai_agent: true,
```

**Step 3: Commit**

```bash
git add frontend/src/contexts/FeatureSettingsContext.tsx backend/app/models/user_settings.py
git commit -m "feat: add enable_ai_agent feature flag"
```

---

## Task 7: Team AI Instructions API Endpoint

**Files:**
- Modify: `backend/app/api/v1/endpoints/user/teams.py` (add PATCH for ai_instructions)

**Step 1: Add endpoint for updating team AI instructions**

Add to `backend/app/api/v1/endpoints/user/teams.py`:

```python
class TeamAIInstructionsUpdate(BaseModel):
    ai_instructions: Optional[str] = None


@router.patch("/{team_id}/ai-instructions")
async def update_team_ai_instructions(
    team_id: int,
    payload: TeamAIInstructionsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update AI instructions for a team. Requires admin or owner role."""
    # Verify team membership with admin/owner role
    member = await _get_team_member(db, team_id, str(current_user.id))
    if not member or member.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Nur Team-Admins koennen KI-Anweisungen aendern")

    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team nicht gefunden")

    team.ai_instructions = payload.ai_instructions
    await db.commit()

    # Invalidate cache
    from app.services.cache import invalidate_team_ai_instructions
    await invalidate_team_ai_instructions(team_id)

    return {"status": "ok", "team_id": team_id}


@router.get("/{team_id}/ai-instructions")
async def get_team_ai_instructions(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get AI instructions for a team. Requires team membership."""
    member = await _get_team_member(db, team_id, str(current_user.id))
    if not member:
        raise HTTPException(status_code=403, detail="Kein Zugriff auf dieses Team")

    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team nicht gefunden")

    return {
        "team_id": team_id,
        "team_name": team.name,
        "ai_instructions": team.ai_instructions or "",
    }
```

**Step 2: Commit**

```bash
git add backend/app/api/v1/endpoints/user/teams.py
git commit -m "feat: add team AI instructions API endpoints (GET/PATCH)"
```

---

## Task 8: Build + Smoke Test

**Step 1: Install new backend dependency**

Run: `cd backend && pip install anthropic>=0.42.0`

**Step 2: Run backend tests**

Run: `cd backend && python -m pytest tests/ -x -q --timeout=30 2>&1 | head -30`
Expected: Same pre-existing failures, no new ones.

**Step 3: Build frontend**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no new errors.

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore: Phase 0 infrastructure complete — build verified"
```

---

## Summary: Phase 0 Deliverables

After completing all 8 tasks:

| Deliverable | Status |
|-------------|--------|
| `Team.ai_instructions` DB field | Ready |
| `Clause.is_ai_generated` + `ai_generation_context` | Ready |
| `TeamPattern` table | Ready |
| Migration `009_add_agent_infrastructure.py` | Ready |
| `ClaudeClient` in llm_service.py | Ready |
| `get_ai_instructions()` with 3-level hierarchy | Ready |
| `POST /api/v1/agent/chat` SSE endpoint | Ready (text-only, no tools yet) |
| Extended SSE event types (frontend) | Ready |
| `enable_ai_agent` feature flag | Ready |
| `PATCH /teams/{id}/ai-instructions` API | Ready |

**Next:** Phase 1 — Agent Orchestrator (Tool-Use Loop, 8 Tool-Definitionen, Conversation Memory)
