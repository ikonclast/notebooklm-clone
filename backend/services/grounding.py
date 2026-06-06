"""Confidence-Threshold-Entscheidung — reine Funktionen, einzeln testbar.

Trennt die „Antworten wir überhaupt?"-Logik vom Streaming in chat.py: Liegt der
beste Retrieval-Score unter der Schwelle, wird kein LLM aufgerufen, sondern
ehrlich „nicht gefunden" geantwortet (ARCHITECTURE.md, Entscheidung 4).
"""

from collections.abc import Sequence

from models.schemas import ChunkResult


def top_score(results: Sequence[ChunkResult]) -> float:
    """Bester (höchster) Retrieval-Score; 0.0 bei keinen Treffern.

    Setzt voraus, dass results nach Score absteigend sortiert ist (so liefert es
    der VectorStore: kleinste Distanz zuerst)."""
    return results[0].score if results else 0.0


def is_grounded(results: Sequence[ChunkResult], threshold: float) -> bool:
    """Grounded = es gibt Treffer UND der beste Score erreicht die Schwelle."""
    return bool(results) and top_score(results) >= threshold
