"""Pydantic-Schemas — das gemeinsame Datenmodell von Backend und API.

Diese Typen sind die Quelle der Wahrheit. Die TypeScript-Typen im Frontend
(types/index.ts) werden hiergegen synchron gehalten.
"""

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

# --- Wertebereiche als Literale (statt magischer Strings) ---
DocumentStatus = Literal["pending", "processing", "ready", "failed"]
ProcessingStage = Literal["queued", "parsing", "chunking", "embedding", "storing", "done"]
Role = Literal["system", "user", "assistant"]
ProviderId = Literal["ollama", "groq", "openai"]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Chunk(BaseModel):
    """Ein Textabschnitt eines Dokuments inklusive Herkunfts-Metadaten.

    Die Metadaten ermöglichen exakte Quellenangaben ("doc.pdf, Seite 3").
    """

    id: str
    document_id: str
    filename: str
    page: int
    chunk_index: int
    char_start: int
    char_end: int
    text: str

    @property
    def metadata(self) -> dict[str, str | int]:
        """ChromaDB-kompatible Metadaten (nur str/int) — ohne den Text selbst."""
        return {
            "document_id": self.document_id,
            "filename": self.filename,
            "page": self.page,
            "chunk_index": self.chunk_index,
            "char_start": self.char_start,
            "char_end": self.char_end,
        }


class ChunkResult(Chunk):
    """Ein Chunk mit Retrieval-Score, wie ihn die Vektorsuche zurückgibt."""

    score: float


class Document(BaseModel):
    """Logischer Zustand eines hochgeladenen Dokuments."""

    id: str
    filename: str
    status: DocumentStatus = "pending"
    pages: int = 0
    chunks: int = 0
    error_message: str | None = None
    uploaded_at: datetime = Field(default_factory=_utcnow)


class JobStatus(BaseModel):
    """Antwort von GET /documents/{id}/status — der Verarbeitungsfortschritt."""

    document_id: str
    filename: str
    status: DocumentStatus
    stage: ProcessingStage | None = None
    pages: int = 0
    chunks: int = 0
    error_message: str | None = None


class Source(BaseModel):
    """Eine Quellenangabe in einer Chat-Antwort.

    document_id erlaubt dem Frontend, das Original zu verlinken
    (GET /documents/{id}/file#page=…)."""

    document_id: str
    filename: str
    page: int
    excerpt: str
    score: float


class ChatMessage(BaseModel):
    """Eine einzelne Nachricht im Chat-Verlauf."""

    role: Role
    content: str


class ChatRequest(BaseModel):
    """Eingehende Chat-Anfrage. document_ids grenzt die Suche auf gewählte Quellen ein.

    provider erlaubt das Umschalten des LLM zur Laufzeit (None → Server-Default).
    """

    query: str = Field(min_length=1)
    document_ids: list[str] = Field(min_length=1)
    provider: ProviderId | None = None


class ChatResponse(BaseModel):
    """Vollständige (nicht-gestreamte) Repräsentation einer Chat-Antwort."""

    answer: str
    sources: list[Source]


class ProviderInfo(BaseModel):
    """Ein LLM-Provider und ob er gerade nutzbar ist (Key gesetzt / erreichbar)."""

    id: ProviderId
    label: str
    model: str
    available: bool


class ProvidersResponse(BaseModel):
    """Antwort von GET /providers — Auswahl fürs Frontend plus aktueller Default."""

    default: ProviderId
    providers: list[ProviderInfo]


class SuggestionsRequest(BaseModel):
    """Fragen-Vorschläge aus dem Inhalt der gewählten Dokumente generieren."""

    document_ids: list[str] = Field(min_length=1)
    provider: ProviderId | None = None


class SuggestionsResponse(BaseModel):
    questions: list[str]
