"""Unit-Tests für die Confidence-Threshold-Entscheidung."""

from models.schemas import ChunkResult
from services.grounding import is_grounded, top_score


def _cr(score: float) -> ChunkResult:
    return ChunkResult(
        id="c",
        document_id="d",
        filename="f.txt",
        page=1,
        chunk_index=0,
        char_start=0,
        char_end=1,
        text="x",
        score=score,
    )


def test_top_score_picks_first():
    assert top_score([_cr(0.8), _cr(0.4)]) == 0.8


def test_top_score_empty_is_zero():
    assert top_score([]) == 0.0


def test_grounded_above_threshold():
    assert is_grounded([_cr(0.5)], 0.3) is True


def test_grounded_exactly_at_threshold():
    # >= : der Grenzwert selbst zählt noch als grounded.
    assert is_grounded([_cr(0.3)], 0.3) is True


def test_not_grounded_below_threshold():
    assert is_grounded([_cr(0.2)], 0.3) is False


def test_not_grounded_when_no_results():
    assert is_grounded([], 0.3) is False
    # Auch bei Schwelle 0.0: ohne Treffer nie grounded.
    assert is_grounded([], 0.0) is False
