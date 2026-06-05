"""Provider-agnostische LLM-Abstraktion.

Kerngedanke (ARCHITECTURE.md, Entscheidung 5): Groq, OpenAI und Ollama sind alle
OpenAI-API-kompatibel. Deshalb genügt EINE Implementierung auf Basis des
`openai`-Clients — es unterscheiden sich nur base_url, api_key und model.

Neuer Provider = ein Zweig in der Factory. Kein Vendor-Lock-in.
"""

from collections.abc import AsyncIterator
from typing import Protocol, runtime_checkable

from openai import AsyncOpenAI

from config import Settings


@runtime_checkable
class LLMProvider(Protocol):
    """Schnittstelle für alle LLM-Provider."""

    def stream_chat(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        """Streamt die Antwort des Modells Token für Token."""
        ...


class OpenAICompatibleProvider:
    """Gemeinsame Implementierung für jeden OpenAI-kompatiblen Endpoint."""

    def __init__(self, *, api_key: str, base_url: str | None, model: str) -> None:
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self._model = model

    async def stream_chat(
        self, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        stream = await self._client.chat.completions.create(
            model=self._model,
            messages=messages,  # type: ignore[arg-type]
            stream=True,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


def get_llm_provider(settings: Settings) -> LLMProvider:
    """Wählt und konfiguriert den Provider anhand der Settings."""
    if settings.llm_provider == "groq":
        return OpenAICompatibleProvider(
            api_key=settings.groq_api_key.get_secret_value(),
            base_url="https://api.groq.com/openai/v1",
            model=settings.groq_model,
        )
    if settings.llm_provider == "openai":
        return OpenAICompatibleProvider(
            api_key=settings.openai_api_key.get_secret_value(),
            base_url=None,  # OpenAI-Default-Endpoint
            model=settings.openai_model,
        )
    # ollama (Default) — lokal; Dummy-Key reicht, Cloud-Key optional.
    return OpenAICompatibleProvider(
        api_key=settings.ollama_api_key.get_secret_value() or "ollama",
        base_url=f"{settings.ollama_base_url.rstrip('/')}/v1",
        model=settings.ollama_model,
    )
