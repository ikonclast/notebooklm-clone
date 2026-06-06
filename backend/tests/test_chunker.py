"""Unit-Tests für den Chunker — reine Funktion, kein Setup, echte Asserts."""

from config import Settings
from services.chunker import chunk_document

# chunk_size_tokens hat im Settings-Modell die Untergrenze ge=50.
# target_chars = chunk_size_tokens * 4 → bei 50 sind das 200 Zeichen.
# Dieser Text (~300 Zeichen, ein Absatz) splittet damit zuverlässig in ≥2 Chunks.
_LONG = (
    "Der erste Satz beschreibt die Garantie sehr genau. "
    "Der zweite Satz handelt von der Kuendigung im Detail. "
    "Der dritte Satz nennt die monatliche Gebuehr ganz klar. "
    "Der vierte Satz erklaert die Faelligkeit der Zahlung. "
    "Der fuenfte Satz fasst alle Bedingungen noch zusammen. "
    "Der sechste Satz schliesst das Dokument inhaltlich ab."
)


def _settings(size: int = 50, overlap: float = 0.25) -> Settings:
    return Settings(chunk_size_tokens=size, chunk_overlap_percent=overlap)


def _page(text: str, page: int = 1) -> dict[str, object]:
    return {"text": text, "page": page}


def test_empty_text_yields_no_chunks():
    assert chunk_document([_page("")], "d", "f.txt", settings=_settings()) == []
    assert chunk_document([_page("   \n\n  ")], "d", "f.txt", settings=_settings()) == []


def test_short_text_single_chunk():
    text = "Ein kurzer Absatz."
    chunks = chunk_document([_page(text)], "d", "f.txt", settings=_settings(size=200))
    assert len(chunks) == 1
    c = chunks[0]
    assert c.text == text
    assert c.page == 1
    assert c.chunk_index == 0
    assert c.document_id == "d"
    assert c.char_start < c.char_end


def test_span_invariant_and_sequential_indices():
    chunks = chunk_document([_page(_LONG)], "d", "f.txt", settings=_settings(overlap=0.0))
    assert len(chunks) >= 2
    for i, c in enumerate(chunks):
        assert c.chunk_index == i
        assert c.page == 1
        assert c.char_start < c.char_end
        # Invariante: chunk.text ist genau die Spanne im Seitentext.
        assert c.text == _LONG[c.char_start:c.char_end]


def test_overlap_present_when_enabled():
    chunks = chunk_document([_page(_LONG)], "d", "f.txt", settings=_settings(overlap=0.3))
    assert len(chunks) >= 2
    # Overlap: der nächste Chunk beginnt vor dem Ende des vorherigen.
    assert chunks[1].char_start < chunks[0].char_end


def test_no_overlap_is_disjoint():
    chunks = chunk_document([_page(_LONG)], "d", "f.txt", settings=_settings(overlap=0.0))
    assert len(chunks) >= 2
    # Ohne Overlap überlappen die Chunks nicht.
    assert chunks[1].char_start >= chunks[0].char_end


def test_each_page_keeps_its_number():
    chunks = chunk_document(
        [_page("Inhalt von Seite eins.", 1), _page("Inhalt von Seite zwei.", 2)],
        "d",
        "f.pdf",
        settings=_settings(size=200),
    )
    assert {c.page for c in chunks} == {1, 2}
