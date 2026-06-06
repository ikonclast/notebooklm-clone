"""LLM-Provider-Endpunkt — welche Modelle das Frontend live anbieten darf.

Ein Provider ist nur "available", wenn er auch wirklich nutzbar ist: Cloud-Provider
brauchen einen API-Key, Ollama muss erreichbar sein. So zeigt das Frontend keine
Option an, die beim Anklicken scheitern würde.
"""

import logging

import httpx
from fastapi import APIRouter

from config import get_settings
from models.schemas import ProviderInfo, ProvidersResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["providers"])


async def _ollama_reachable(base_url: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            resp = await client.get(f"{base_url.rstrip('/')}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False


@router.get("/providers")
async def list_providers() -> ProvidersResponse:
    """Verfügbare Provider + aktueller Server-Default."""
    settings = get_settings()

    providers = [
        ProviderInfo(
            id="ollama",
            label="Ollama (lokal)",
            model=settings.ollama_model,
            available=await _ollama_reachable(settings.ollama_base_url),
        ),
        ProviderInfo(
            id="groq",
            label="Groq",
            model=settings.groq_model,
            available=bool(settings.groq_api_key.get_secret_value()),
        ),
        ProviderInfo(
            id="openai",
            label="OpenAI",
            model=settings.openai_model,
            available=bool(settings.openai_api_key.get_secret_value()),
        ),
    ]
    return ProvidersResponse(default=settings.llm_provider, providers=providers)
