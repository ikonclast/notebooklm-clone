"""Embedding-Service auf Basis von sentence-transformers.

Modell: all-MiniLM-L6-v2 (384 Dimensionen) — lokal, kostenlos, kein API-Key.
Singleton: das Modell wird genau einmal geladen (Laden dauert mehrere Sekunden
und belegt RAM). Über get_embedder() kommt überall dieselbe Instanz.
"""

from functools import lru_cache

from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384


class Embedder:
    """Dünne Hülle um SentenceTransformer mit normalisierten Vektoren.

    Normalisierung passt zur Cosine-Distanz des Vektorstores: so ist der
    zurückgegebene Score direkt eine Cosine-Similarity in [-1, 1] (praktisch [0, 1]).
    """

    def __init__(self, model_name: str = MODEL_NAME) -> None:
        self._model = SentenceTransformer(model_name)

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Bettet eine Liste von Texten ein. Reihenfolge bleibt erhalten."""
        vectors = self._model.encode(
            texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )
        return vectors.tolist()

    def embed_one(self, text: str) -> list[float]:
        """Bequemlichkeit für eine einzelne Query."""
        return self.embed([text])[0]


@lru_cache
def get_embedder() -> Embedder:
    """Embedder-Singleton — das Modell wird nur beim ersten Aufruf geladen."""
    return Embedder()
