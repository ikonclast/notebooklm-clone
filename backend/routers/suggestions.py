"""Fragen-Vorschläge aus dem Dokumentinhalt generieren.

Ersetzt generische Mockup-Fragen: das LLM liest einen Ausschnitt der gewählten
Dokumente und schlägt konkrete, beantwortbare Fragen vor. Schlägt die Generierung
fehl, gibt es eine leere Liste zurück — die UI zeigt dann einfach keine Vorschläge,
statt zu brechen.
"""

import asyncio
import json
import logging
import re

from fastapi import APIRouter

from config import get_settings
from models.schemas import SuggestionsRequest, SuggestionsResponse
from services.llm import get_llm_provider
from services.vectorstore import get_vector_store

logger = logging.getLogger(__name__)
router = APIRouter(tags=["suggestions"])

_MAX_DOCS = 3
_MAX_SAMPLE_CHARS = 4000
_MAX_QUESTIONS = 4

_PROMPT = (
    "Du bekommst Auszüge aus Dokumenten. Formuliere genau {n} kurze, konkrete "
    "Fragen auf Deutsch, die sich allein aus diesem Inhalt beantworten lassen. "
    "Keine Einleitung, keine Nummerierung. Antworte ausschließlich als JSON-Array "
    "von Strings, z. B. [\"Frage 1?\", \"Frage 2?\"]."
)


def _parse_questions(raw: str) -> list[str]:
    """Robustes Parsen: erst JSON-Array, sonst zeilenweise."""
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(0))
            if isinstance(data, list):
                return [str(q).strip() for q in data if str(q).strip()]
        except json.JSONDecodeError:
            pass
    # Fallback: Zeilen, die wie Fragen aussehen.
    lines = [re.sub(r"^[\s\-\d.)\"]+", "", ln).strip(' "') for ln in raw.splitlines()]
    return [ln for ln in lines if ln.endswith("?")]


@router.post("/suggestions")
async def suggestions(req: SuggestionsRequest) -> SuggestionsResponse:
    """Generiert Fragen-Vorschläge für die gewählten Dokumente."""
    settings = get_settings()
    store = get_vector_store()

    samples: list[str] = []
    for doc_id in req.document_ids[:_MAX_DOCS]:
        text = await asyncio.to_thread(store.get_document_text, doc_id, 4)
        if text:
            samples.append(text)

    sample = "\n\n".join(samples)[:_MAX_SAMPLE_CHARS]
    if not sample.strip():
        return SuggestionsResponse(questions=[])

    try:
        provider = get_llm_provider(settings, override=req.provider)
        raw = await provider.complete(
            [
                {"role": "system", "content": _PROMPT.format(n=_MAX_QUESTIONS)},
                {"role": "user", "content": sample},
            ]
        )
        questions = _parse_questions(raw)[:_MAX_QUESTIONS]
    except Exception:
        logger.warning("suggestion generation failed", exc_info=True)
        return SuggestionsResponse(questions=[])

    return SuggestionsResponse(questions=questions)
