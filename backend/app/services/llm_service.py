"""
LLM Service: Provider-agnostic interface for language models.

Supports:
- Groq (free tier, very fast, Llama/Gemma/Mistral models)
- Mistral AI API (EU-hosted, GDPR-compliant)
- Ollama (local development, offline)

Priority order (auto-detect):
1. Ollama (if running locally - best for dev)
2. Groq (if API key set - free, fast, great for production)
3. Mistral AI (if API key set - EU-hosted)

Privacy-First Design:
- Local Dev: Ollama (no data leaves machine)
- Production: Groq free tier or Mistral AI
"""
import os
import json
import asyncio
import httpx
from abc import ABC, abstractmethod
from enum import Enum
from typing import Optional, List, Dict, Any, AsyncGenerator
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)


class LLMProvider(str, Enum):
    """Supported LLM providers."""
    GROQ = "groq"
    MISTRAL = "mistral"
    OLLAMA = "ollama"
    OPENAI = "openai"  # Fallback only


class LLMMessage(BaseModel):
    """Chat message format compatible with all providers."""
    role: str  # "system", "user", "assistant"
    content: str


class LLMResponse(BaseModel):
    """Standardized response from LLM."""
    content: str
    provider: str
    model: str
    usage: Optional[Dict[str, Any]] = None  # tokens used (int or float depending on provider)
    raw_response: Optional[Dict[str, Any]] = None


class LLMConfig(BaseModel):
    """Configuration for LLM requests."""
    temperature: float = 0.3  # Lower for more deterministic compliance checks
    max_tokens: int = 2000
    top_p: float = 0.9
    json_mode: bool = False  # Request JSON output

    def get_max_tokens(self, model: str = "") -> int:
        """Return max_tokens capped to the model's context limit."""
        # Models with smaller output limits
        small_output_models = {
            "llama-3.1-8b-instant": 8192,
            "gemma2-9b-it": 8192,
            "mistral-small-latest": 8192,
        }
        model_limit = small_output_models.get(model, 32768)
        return min(self.max_tokens, model_limit)


class BaseLLMClient(ABC):
    """Abstract base class for LLM clients."""

    @abstractmethod
    async def chat(
        self,
        messages: List[LLMMessage],
        config: Optional[LLMConfig] = None
    ) -> LLMResponse:
        """Send chat completion request."""
        pass

    @abstractmethod
    async def chat_stream(
        self,
        messages: List[LLMMessage],
        config: Optional[LLMConfig] = None
    ) -> AsyncGenerator[str, None]:
        """Send streaming chat completion request, yielding tokens."""
        pass  # pragma: no cover
        yield  # Make it a generator  # noqa: E501

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if the provider is available."""
        pass


class MistralClient(BaseLLMClient):
    """
    Mistral AI client - EU-hosted, GDPR-compliant.

    Models:
    - mistral-small-latest: Fast, efficient (recommended for compliance)
    - mistral-medium-latest: Balanced
    - mistral-large-latest: Most capable

    API Docs: https://docs.mistral.ai/api/
    """

    def __init__(self):
        self.api_key = os.getenv("MISTRAL_API_KEY")
        self.base_url = "https://api.mistral.ai/v1"
        self.default_model = os.getenv("MISTRAL_MODEL", "mistral-small-latest")

    async def is_available(self) -> bool:
        """Check if Mistral API is configured and reachable."""
        if not self.api_key:
            return False
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=5.0
                )
                return response.status_code == 200
        except Exception:
            return False

    async def chat(
        self,
        messages: List[LLMMessage],
        config: Optional[LLMConfig] = None
    ) -> LLMResponse:
        """Send chat request to Mistral API."""
        if not self.api_key:
            raise ValueError("MISTRAL_API_KEY not configured")

        config = config or LLMConfig()

        payload = {
            "model": self.default_model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": config.temperature,
            "max_tokens": config.get_max_tokens(self.default_model),
            "top_p": config.top_p,
        }

        # Mistral supports JSON mode
        if config.json_mode:
            payload["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=60.0
            )

            if response.status_code != 200:
                raise Exception(f"Mistral API error: {response.status_code} - {response.text}")

            data = response.json()

            return LLMResponse(
                content=data["choices"][0]["message"]["content"],
                provider="mistral",
                model=data["model"],
                usage=data.get("usage"),
                raw_response=data
            )

    async def chat_stream(
        self,
        messages: List[LLMMessage],
        config: Optional[LLMConfig] = None
    ) -> AsyncGenerator[str, None]:
        """Stream chat response from Mistral API (OpenAI-compatible SSE)."""
        if not self.api_key:
            raise ValueError("MISTRAL_API_KEY not configured")

        config = config or LLMConfig()

        payload = {
            "model": self.default_model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": config.temperature,
            "max_tokens": config.get_max_tokens(self.default_model),
            "top_p": config.top_p,
            "stream": True,
        }

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=60.0,
            ) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    raise Exception(f"Mistral API error: {response.status_code} - {error_body.decode()}")

                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]  # Strip "data: " prefix
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue


class GroqClient(BaseLLMClient):
    """
    Groq client - Free, ultra-fast inference.

    Free tier: 30 requests/min, 14.400 requests/day
    Models:
    - llama-3.1-8b-instant: Fast, good quality (recommended)
    - gemma2-9b-it: Google's model, good for German
    - mixtral-8x7b-32768: Mistral's MoE, large context

    API is OpenAI-compatible.
    Get API key: https://console.groq.com/keys
    """

    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        self.base_url = "https://api.groq.com/openai/v1"
        self.default_model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

    async def is_available(self) -> bool:
        """Check if Groq API key is configured."""
        if not self.api_key:
            return False
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=5.0
                )
                return response.status_code == 200
        except Exception:
            return False

    async def chat(
        self,
        messages: List[LLMMessage],
        config: Optional[LLMConfig] = None
    ) -> LLMResponse:
        """Send chat request to Groq API (OpenAI-compatible)."""
        if not self.api_key:
            raise ValueError("GROQ_API_KEY not configured")

        config = config or LLMConfig()

        payload = {
            "model": self.default_model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": config.temperature,
            "max_tokens": config.get_max_tokens(self.default_model),
            "top_p": config.top_p,
        }

        if config.json_mode:
            payload["response_format"] = {"type": "json_object"}

        max_retries = 3
        for attempt in range(max_retries):
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json=payload,
                    timeout=30.0
                )

                if response.status_code == 429:
                    if attempt < max_retries - 1:
                        wait_time = 2 ** (attempt + 1)  # 2s, 4s
                        retry_after = response.headers.get("retry-after")
                        if retry_after:
                            try:
                                wait_time = min(float(retry_after), 10.0)
                            except ValueError:
                                pass
                        logger.warning(
                            f"Groq rate limit (Versuch {attempt + 1}/{max_retries}), "
                            f"Retry in {wait_time}s..."
                        )
                        await asyncio.sleep(wait_time)
                        continue
                    raise Exception(
                        "Groq Rate-Limit nach Retries erreicht. Bitte kurz warten."
                    )

                if response.status_code != 200:
                    raise Exception(f"Groq API error: {response.status_code} - {response.text}")

                data = response.json()

                return LLMResponse(
                    content=data["choices"][0]["message"]["content"],
                    provider="groq",
                    model=data["model"],
                    usage=data.get("usage"),
                    raw_response=data
                )

        raise Exception("Groq API: Max Retries erreicht")

    async def chat_stream(
        self,
        messages: List[LLMMessage],
        config: Optional[LLMConfig] = None
    ) -> AsyncGenerator[str, None]:
        """Stream chat response from Groq API (OpenAI-compatible SSE)."""
        if not self.api_key:
            raise ValueError("GROQ_API_KEY not configured")

        config = config or LLMConfig()

        payload = {
            "model": self.default_model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": config.temperature,
            "max_tokens": config.get_max_tokens(self.default_model),
            "top_p": config.top_p,
            "stream": True,
        }

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=60.0,
            ) as response:
                if response.status_code == 429:
                    error_body = await response.aread()
                    raise Exception(f"Groq Rate-Limit erreicht: {error_body.decode()}")
                if response.status_code != 200:
                    error_body = await response.aread()
                    raise Exception(f"Groq API error: {response.status_code} - {error_body.decode()}")

                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue


class OllamaClient(BaseLLMClient):
    """
    Ollama client - Local LLM inference.

    Perfect for:
    - Local development (no API costs)
    - Offline testing
    - Maximum privacy (no data leaves machine)

    Recommended models:
    - mistral:7b-instruct-v0.3-q4_K_M (fast, good quality)
    - mixtral:8x7b-instruct-v0.1-q4_K_M (best quality, needs 32GB+ RAM)

    Setup: brew install ollama && ollama pull mistral:7b-instruct
    """

    def __init__(self):
        self.base_url = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        self.default_model = os.getenv("OLLAMA_MODEL", "mistral:7b-instruct")

    async def is_available(self) -> bool:
        """Check if Ollama is running locally."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/api/tags",
                    timeout=2.0
                )
                return response.status_code == 200
        except Exception:
            return False

    async def chat(
        self,
        messages: List[LLMMessage],
        config: Optional[LLMConfig] = None
    ) -> LLMResponse:
        """Send chat request to local Ollama instance."""
        config = config or LLMConfig()

        # Ollama uses a different format
        payload = {
            "model": self.default_model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": False,
            "options": {
                "temperature": config.temperature,
                "num_predict": config.get_max_tokens(self.default_model),
                "top_p": config.top_p,
            }
        }

        # Ollama JSON mode
        if config.json_mode:
            payload["format"] = "json"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=120.0  # Local inference can be slow
            )

            if response.status_code != 200:
                raise Exception(f"Ollama error: {response.status_code} - {response.text}")

            data = response.json()

            return LLMResponse(
                content=data["message"]["content"],
                provider="ollama",
                model=data["model"],
                usage={
                    "prompt_tokens": data.get("prompt_eval_count", 0),
                    "completion_tokens": data.get("eval_count", 0)
                },
                raw_response=data
            )

    async def chat_stream(
        self,
        messages: List[LLMMessage],
        config: Optional[LLMConfig] = None
    ) -> AsyncGenerator[str, None]:
        """Stream chat response from local Ollama instance (NDJSON)."""
        config = config or LLMConfig()

        payload = {
            "model": self.default_model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": True,
            "options": {
                "temperature": config.temperature,
                "num_predict": config.get_max_tokens(self.default_model),
                "top_p": config.top_p,
            }
        }

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=120.0,
            ) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    raise Exception(f"Ollama error: {response.status_code} - {error_body.decode()}")

                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                        content = chunk.get("message", {}).get("content", "")
                        if content:
                            yield content
                        # Ollama signals done with "done": true
                        if chunk.get("done", False):
                            break
                    except json.JSONDecodeError:
                        continue


class LLMService:
    """
    Main LLM service with automatic provider selection.

    Priority order:
    1. Ollama (if running locally - best for dev)
    2. Groq (if API key set - free, ultra-fast)
    3. Mistral AI (if API key set - EU-hosted)

    Usage:
        llm = LLMService()
        response = await llm.chat([
            LLMMessage(role="system", content="Du bist ein Rechtsexperte."),
            LLMMessage(role="user", content="Prüfe diesen Textbaustein...")
        ])
    """

    def __init__(self, preferred_provider: Optional[LLMProvider] = None):
        self.groq = GroqClient()
        self.mistral = MistralClient()
        self.ollama = OllamaClient()
        self.preferred_provider = preferred_provider
        self._active_client: Optional[BaseLLMClient] = None

    async def _get_client(self) -> BaseLLMClient:
        """Get the best available LLM client."""
        if self._active_client:
            return self._active_client

        # If preferred provider specified, try it first
        if self.preferred_provider == LLMProvider.GROQ:
            if await self.groq.is_available():
                self._active_client = self.groq
                logger.info("Using Groq (free, fast)")
                return self._active_client

        if self.preferred_provider == LLMProvider.MISTRAL:
            if await self.mistral.is_available():
                self._active_client = self.mistral
                logger.info("Using Mistral AI (EU-hosted)")
                return self._active_client

        if self.preferred_provider == LLMProvider.OLLAMA:
            if await self.ollama.is_available():
                self._active_client = self.ollama
                logger.info("Using Ollama (local)")
                return self._active_client

        # Auto-detect: Ollama first (local dev), then Groq, then Mistral
        if await self.ollama.is_available():
            self._active_client = self.ollama
            logger.info("Using Ollama (local) - auto-detected")
            return self._active_client

        if await self.groq.is_available():
            self._active_client = self.groq
            logger.info("Using Groq (free, fast) - auto-detected")
            return self._active_client

        if await self.mistral.is_available():
            self._active_client = self.mistral
            logger.info("Using Mistral AI (EU-hosted) - auto-detected")
            return self._active_client

        raise RuntimeError(
            "No LLM provider available. Please either:\n"
            "1. Start Ollama locally: ollama serve\n"
            "2. Set GROQ_API_KEY environment variable (free: https://console.groq.com)\n"
            "3. Set MISTRAL_API_KEY environment variable"
        )

    async def chat(
        self,
        messages: List[LLMMessage],
        config: Optional[LLMConfig] = None
    ) -> LLMResponse:
        """
        Send chat completion request to best available provider.

        Args:
            messages: List of chat messages
            config: Optional configuration (temperature, max_tokens, etc.)

        Returns:
            LLMResponse with content and metadata
        """
        client = await self._get_client()
        return await client.chat(messages, config)

    async def chat_stream(
        self,
        messages: List[LLMMessage],
        config: Optional[LLMConfig] = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat completion tokens from best available provider.

        Args:
            messages: List of chat messages
            config: Optional configuration (temperature, max_tokens, etc.)

        Yields:
            String tokens as they are generated
        """
        client = await self._get_client()
        async for token in client.chat_stream(messages, config):
            yield token

    async def chat_json(
        self,
        messages: List[LLMMessage],
        config: Optional[LLMConfig] = None
    ) -> Dict[str, Any]:
        """
        Send chat request expecting JSON response.

        Automatically enables JSON mode and parses response.
        """
        config = config or LLMConfig()
        config.json_mode = True

        response = await self.chat(messages, config)

        try:
            return json.loads(response.content)
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON response: {e}")
            # Try to extract JSON from response
            content = response.content
            if "{" in content and "}" in content:
                start = content.index("{")
                end = content.rindex("}") + 1
                return json.loads(content[start:end])
            raise ValueError(f"Could not parse JSON from response: {content[:200]}")

    async def get_provider_info(self) -> Dict[str, Any]:
        """Get information about the active LLM provider."""
        client = await self._get_client()
        return {
            "provider": client.__class__.__name__.replace("Client", "").lower(),
            "model": getattr(client, "default_model", "unknown"),
            "is_local": isinstance(client, OllamaClient),
            "is_eu_hosted": isinstance(client, MistralClient),
            "is_free": isinstance(client, (OllamaClient, GroqClient))
        }


# Singleton instance
llm_service = LLMService()


# Convenience function
async def get_llm_service() -> LLMService:
    """Get the LLM service instance (for dependency injection)."""
    return llm_service


# ═══════════════════════════════════════════════════════════════════════════
# LLM CALL LOGGING (Observability)
# ═══════════════════════════════════════════════════════════════════════════

async def log_llm_call(
    feature: str,
    response: Optional[LLMResponse] = None,
    latency_ms: int = 0,
    user_id: Optional[str] = None,
    country_code: Optional[str] = None,
    error_message: Optional[str] = None,
) -> None:
    """
    Log an LLM call to the database (fire-and-forget).

    Call this after each llm.chat() or llm.chat_json() invocation.
    Failures are silently logged — never blocks the main response.
    """
    try:
        from app.db import async_session_factory
        from app.models.enterprise import LLMCallLog

        provider = response.provider if response else "unknown"
        model = response.model if response else None
        usage = response.usage or {} if response else {}
        status = "error" if error_message else "success"

        log_entry = LLMCallLog(
            user_id=user_id,
            feature=feature,
            provider=provider,
            model=model,
            prompt_tokens=usage.get("prompt_tokens", 0) or 0,
            completion_tokens=usage.get("completion_tokens", 0) or 0,
            total_tokens=usage.get("total_tokens", 0) or 0,
            latency_ms=latency_ms,
            status=status,
            error_message=error_message,
            country_code=country_code,
        )

        async with async_session_factory() as session:
            session.add(log_entry)
            await session.commit()

    except Exception as e:
        logger.debug(f"LLM call logging failed (non-critical): {e}")
