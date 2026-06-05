"""ChromaDB-Wrapper für den Vektorstore.

Eine Collection pro Deployment (kein Multi-Tenant im MVP). Persistenz auf Platte,
Metadaten-Filterung nach document_id. Cosine-Distanz, damit der Score direkt als
Similarity interpretierbar ist (siehe confidence_threshold).

Concurrency: ChromaDB embedded ist nicht für parallele Schreiber aus mehreren
Prozessen ausgelegt — das System läuft daher als single-worker (ARCHITECTURE.md,
Entscheidung 7).
"""

from functools import lru_cache
from pathlib import Path

import chromadb
from chromadb.config import Settings as ChromaSettings

from config import get_settings
from models.schemas import Chunk, ChunkResult

COLLECTION_NAME = "documents"


class VectorStore:
    """Speichert und durchsucht Chunk-Embeddings."""

    def __init__(self, path: str | Path | None = None) -> None:
        path = str(path or get_settings().chroma_path)
        # Telemetrie aus: kein Byte an Dritte (DSGVO) und saubere Logs.
        self._client = chromadb.PersistentClient(
            path=path,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self._collection = self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    def add_chunks(self, chunks: list[Chunk], embeddings: list[list[float]]) -> None:
        """Fügt Chunks samt vorab berechneter Embeddings hinzu.

        embeddings muss in Reihenfolge und Länge zu chunks passen.
        """
        if not chunks:
            return
        if len(chunks) != len(embeddings):
            raise ValueError(
                f"chunks ({len(chunks)}) und embeddings ({len(embeddings)}) "
                "müssen gleich lang sein"
            )
        self._collection.add(
            ids=[c.id for c in chunks],
            embeddings=embeddings,
            documents=[c.text for c in chunks],
            metadatas=[c.metadata for c in chunks],
        )

    def search(
        self, query_vec: list[float], top_k: int, doc_ids: list[str] | None = None
    ) -> list[ChunkResult]:
        """Ähnlichste Chunks zur Query, optional auf doc_ids eingegrenzt.

        Der Score ist eine Cosine-Similarity (1 − Distanz), höher = besser.
        """
        where = {"document_id": {"$in": doc_ids}} if doc_ids else None
        res = self._collection.query(
            query_embeddings=[query_vec],
            n_results=top_k,
            where=where,
            include=["documents", "metadatas", "distances"],
        )

        # Chroma liefert pro Query eine innere Liste; wir haben genau eine Query.
        ids = res["ids"][0]
        documents = res["documents"][0]
        metadatas = res["metadatas"][0]
        distances = res["distances"][0]

        results: list[ChunkResult] = []
        for id_, text, meta, dist in zip(ids, documents, metadatas, distances):
            results.append(
                ChunkResult(
                    id=id_,
                    document_id=str(meta["document_id"]),
                    filename=str(meta["filename"]),
                    page=int(meta["page"]),
                    chunk_index=int(meta["chunk_index"]),
                    char_start=int(meta["char_start"]),
                    char_end=int(meta["char_end"]),
                    text=text,
                    score=1.0 - float(dist),
                )
            )
        return results

    def delete_document(self, doc_id: str) -> None:
        """Entfernt alle Chunks eines Dokuments (DSGVO Hard Delete, Teil davon)."""
        self._collection.delete(where={"document_id": doc_id})

    def count(self) -> int:
        return self._collection.count()


@lru_cache
def get_vector_store() -> VectorStore:
    """VectorStore-Singleton mit dem konfigurierten Persistenz-Pfad."""
    return VectorStore()
