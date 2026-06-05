"""Paragraph-basiertes Chunking mit satzgenauem Overlap.

Designziele (siehe ARCHITECTURE.md, Entscheidung 1):
- Absatzgrenzen respektieren — kein Satz wird willkürlich durchgetrennt.
- Ziel-Chunkgröße ~chunk_size_tokens (grob: Zeichen ≈ Tokens × 4).
- ~chunk_overlap_percent Overlap, realisiert als ganze Sätze vom Ende des
  vorherigen Chunks.

Chunking erfolgt pro Seite. So gehört jeder Chunk zu genau einer Seitennummer —
die Voraussetzung für präzise Quellenangaben. Overlap überschreitet daher
bewusst keine Seitengrenze.

Invariante: chunk.text == page_text[char_start:char_end] (zusammenhängende Spanne).
"""

import re

from config import Settings, get_settings
from models.schemas import Chunk
from services.parser import Page

# Absatz = zusammenhängender Block bis zur nächsten Leerzeile (oder Textende).
_PARAGRAPH = re.compile(r"\S.*?(?=\n\s*\n|\Z)", re.DOTALL)
# Satzende: . ! ? gefolgt von Whitespace.
_SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+")


def _paragraph_spans(text: str) -> list[tuple[int, int]]:
    """(start, end)-Offsets aller nicht-leeren Absätze im Text."""
    return [(m.start(), m.end()) for m in _PARAGRAPH.finditer(text)]


def _sentence_spans(text: str) -> list[tuple[int, int]]:
    """(start, end)-Offsets aller Sätze relativ zu `text`."""
    spans: list[tuple[int, int]] = []
    start = 0
    for m in _SENTENCE_BOUNDARY.finditer(text):
        spans.append((start, m.start()))
        start = m.end()
    spans.append((start, len(text)))
    return [(s, e) for s, e in spans if text[s:e].strip()]


def _segments(text: str, target_chars: int) -> list[tuple[int, int]]:
    """Zerlegt den Seitentext in Basis-Segmente (Absätze).

    Übergroße Absätze werden satzweise in Teilstücke ≤ target_chars gebrochen,
    damit ein einzelner Riesenabsatz nicht einen überdimensionierten Chunk erzeugt.
    """
    segments: list[tuple[int, int]] = []
    for p_start, p_end in _paragraph_spans(text):
        if p_end - p_start <= target_chars:
            segments.append((p_start, p_end))
            continue

        # Absatz zu groß → satzweise gruppieren.
        cur_start: int | None = None
        cur_end = p_start
        for s_local, e_local in _sentence_spans(text[p_start:p_end]):
            s, e = p_start + s_local, p_start + e_local
            if cur_start is None:
                cur_start, cur_end = s, e
            elif e - cur_start <= target_chars:
                cur_end = e
            else:
                segments.append((cur_start, cur_end))
                cur_start, cur_end = s, e
        if cur_start is not None:
            segments.append((cur_start, cur_end))
    return segments


def _group_segments(
    segments: list[tuple[int, int]], target_chars: int
) -> list[tuple[int, int]]:
    """Fasst Segmente gierig zu Chunk-Spannen ≤ target_chars zusammen."""
    chunks: list[tuple[int, int]] = []
    cur_start: int | None = None
    cur_end = 0
    for s, e in segments:
        if cur_start is None:
            cur_start, cur_end = s, e
        elif e - cur_start <= target_chars:
            cur_end = e
        else:
            chunks.append((cur_start, cur_end))
            cur_start, cur_end = s, e
    if cur_start is not None:
        chunks.append((cur_start, cur_end))
    return chunks


def _overlap_start(text: str, start: int, end: int, overlap_chars: int) -> int:
    """Absoluter Startoffset für den Overlap: ganze Sätze vom Ende des Chunks,
    bis ~overlap_chars erreicht sind (mindestens der letzte Satz)."""
    spans = _sentence_spans(text[start:end])
    overlap_local = spans[-1][0] if spans else 0
    for s_local, _ in reversed(spans):
        overlap_local = s_local
        if end - (start + s_local) >= overlap_chars:
            break
    return start + overlap_local


def _chunk_page(
    text: str,
    page: int,
    document_id: str,
    filename: str,
    next_index: int,
    target_chars: int,
    overlap_chars: int,
) -> list[Chunk]:
    base_spans = _group_segments(_segments(text, target_chars), target_chars)

    chunks: list[Chunk] = []
    prev_span: tuple[int, int] | None = None
    for start, end in base_spans:
        # Overlap: Start nach hinten in den vorigen Chunk ziehen.
        if prev_span is not None and overlap_chars > 0:
            start = _overlap_start(text, prev_span[0], prev_span[1], overlap_chars)
        chunk_text = text[start:end].strip()
        if not chunk_text:
            continue
        # char_start/char_end an den gestrippten Text angleichen (Invariante halten).
        lead = len(text[start:end]) - len(text[start:end].lstrip())
        char_start = start + lead
        char_end = char_start + len(chunk_text)
        chunks.append(
            Chunk(
                id=f"{document_id}:{next_index + len(chunks)}",
                document_id=document_id,
                filename=filename,
                page=page,
                chunk_index=next_index + len(chunks),
                char_start=char_start,
                char_end=char_end,
                text=chunk_text,
            )
        )
        prev_span = (start, end)
    return chunks


def chunk_document(
    pages: list[Page],
    document_id: str,
    filename: str,
    *,
    settings: Settings | None = None,
) -> list[Chunk]:
    """Zerlegt geparste Seiten in überlappende Chunks mit Herkunfts-Metadaten."""
    settings = settings or get_settings()
    target_chars = settings.chunk_size_tokens * 4
    overlap_chars = int(target_chars * settings.chunk_overlap_percent)

    chunks: list[Chunk] = []
    for page in pages:
        page_text = str(page["text"])
        page_no = int(page["page"])
        chunks.extend(
            _chunk_page(
                page_text,
                page_no,
                document_id,
                filename,
                next_index=len(chunks),
                target_chars=target_chars,
                overlap_chars=overlap_chars,
            )
        )
    return chunks
