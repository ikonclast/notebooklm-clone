"""Chat-Endpoint — RAG mit SSE-Streaming, Grounding und Confidence-Threshold.

Ablauf:
  query → embed → ChromaDB (Top-K, gefiltert auf document_ids) → Grounding-Prompt
  → LLM-Stream. Erst ein `sources`-Event, dann `token`-Events, dann `done`.

Grounding (ARCHITECTURE.md, Entscheidung 3): die KI antwortet ausschließlich aus
den Quellen. Confidence-Threshold (Entscheidung 4): liegt der beste Score darunter,
wird gar kein LLM aufgerufen — direkt die ehrliche "nicht gefunden"-Antwort.

Datenschutz: im Audit landet kein Query-Text, nur Metadaten.
"""

import asyncio
import json
import logging
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from audit import write_audit_event
from config import get_settings
from models.schemas import ChatRequest, ChunkResult, Source
from services.embedder import get_embedder
from services.grounding import is_grounded, top_score
from services.llm import get_llm_provider
from services.vectorstore import get_vector_store

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])

SYSTEM_PROMPT = (
    "Du bist ein präziser Dokumenten-Assistent. Beantworte Fragen ausschließlich "
    "basierend auf den bereitgestellten Quellen. Wenn die Antwort nicht in den "
    "Quellen enthalten ist, antworte: \"Diese Information ist in deinen Dokumenten "
    "nicht vorhanden.\" Halluziniere niemals. Zitiere immer die Quelle."
)
NOT_FOUND_MESSAGE = "Diese Information ist in deinen Dokumenten nicht vorhanden."
_EXCERPT_CHARS = 240


def _sse(event: str, data: object) -> str:
    """Formatiert ein Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _excerpt(text: str, limit: int = _EXCERPT_CHARS) -> str:
    """Kürzt Chunk-Text auf einen lesbaren Ausschnitt für die UI."""
    collapsed = " ".join(text.split())
    if len(collapsed) <= limit:
        return collapsed
    return collapsed[:limit].rsplit(" ", 1)[0] + "…"


def _build_messages(query: str, results: list[ChunkResult]) -> list[dict[str, str]]:
    """Baut den Grounding-Prompt: System-Constraint + nummerierte Quellen + Frage."""
    context = "\n\n".join(
        f"[Quelle {i}] {r.filename}, Seite {r.page}:\n{r.text}"
        for i, r in enumerate(results, start=1)
    )
    user = f"Quellen:\n{context}\n\nFrage: {query}"
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user},
    ]


async def _event_stream(req: ChatRequest) -> AsyncIterator[str]:
    settings = get_settings()
    query_id = uuid.uuid4().hex

    # Embedding + Suche sind synchron/CPU-gebunden → in Threadpool, damit der
    # Event-Loop frei bleibt.
    query_vec = await asyncio.to_thread(get_embedder().embed_one, req.query)
    results = await asyncio.to_thread(
        get_vector_store().search, query_vec, settings.top_k, req.document_ids
    )

    best = top_score(results)
    grounded = is_grounded(results, settings.confidence_threshold)

    write_audit_event(
        "chat.queried",
        query_id=query_id,
        document_ids=req.document_ids,
        sources_found=len(results) if grounded else 0,
    )
    logger.info(
        "chat queried",
        extra={
            "query_id": query_id,
            "document_ids": req.document_ids,
            "results": len(results),
            "best_score": round(best, 4),
            "grounded": grounded,
        },
    )

    # Confidence-Threshold: kein LLM-Call, direkte ehrliche Antwort.
    if not grounded:
        yield _sse("sources", [])
        yield _sse("token", {"text": NOT_FOUND_MESSAGE})
        yield _sse("done", {})
        return

    sources = [
        Source(
            document_id=r.document_id,
            filename=r.filename,
            page=r.page,
            excerpt=_excerpt(r.text),
            score=round(r.score, 4),
        )
        for r in results
    ]
    yield _sse("sources", [s.model_dump() for s in sources])

    try:
        provider = get_llm_provider(settings, req.provider)
    except ValueError as exc:
        # z. B. gewählter Cloud-Provider ohne API-Key.
        yield _sse("error", {"message": str(exc)})
        yield _sse("done", {})
        return

    try:
        async for delta in provider.stream_chat(_build_messages(req.query, results)):
            yield _sse("token", {"text": delta})
    except Exception:
        logger.exception("llm streaming failed", extra={"query_id": query_id})
        yield _sse(
            "error", {"message": "Die Antwort konnte nicht generiert werden."}
        )
    yield _sse("done", {})


@router.post("/chat")
async def chat(req: ChatRequest) -> StreamingResponse:
    """RAG-Antwort als SSE-Stream."""
    return StreamingResponse(
        _event_stream(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # nginx: kein Buffering des Streams
        },
    )
