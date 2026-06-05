"""Dokument-Parser für PDF und TXT.

Liefert pro Seite ein Dict {"text", "page"}. Die Seitennummer ist die Grundlage
für exakte Quellenangaben weiter unten in der Pipeline.
"""

from pathlib import Path

import fitz  # PyMuPDF

# Pro-Seite-Repräsentation: 1-basierte Seitennummer + extrahierter Text.
Page = dict[str, object]


class ParseError(Exception):
    """Ein Dokument konnte nicht gelesen werden (z. B. korrupte/gescannte PDF).

    Wird vom Upload-Flow abgefangen → Job-Status "failed" + error_type "ParseError".
    """


def parse_pdf(path: str | Path) -> list[Page]:
    """Extrahiert Text seitenweise aus einer PDF.

    Raises:
        ParseError: PDF nicht öffenbar oder ohne extrahierbaren Text.
    """
    path = Path(path)
    try:
        doc = fitz.open(path)
    except Exception as exc:  # PyMuPDF wirft diverse Typen bei kaputten Dateien
        raise ParseError(f"PDF konnte nicht geöffnet werden: {path.name}") from exc

    try:
        pages: list[Page] = [
            {"text": page.get_text("text"), "page": i}
            for i, page in enumerate(doc, start=1)
        ]
    finally:
        doc.close()

    if not any(str(p["text"]).strip() for p in pages):
        # Reiner Bild-/Scan-PDF ohne Textlayer — ohne OCR nichts zu holen.
        raise ParseError(
            f"PDF enthält keinen extrahierbaren Text (evtl. gescannt): {path.name}"
        )

    return pages


def parse_txt(path: str | Path) -> list[Page]:
    """Liest eine Textdatei als eine einzelne 'Seite'."""
    path = Path(path)
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        # Fallback für nicht-UTF-8-Dateien, damit Uploads nicht hart scheitern.
        text = path.read_text(encoding="latin-1")
    return [{"text": text, "page": 1}]


def parse_document(path: str | Path, filename: str) -> list[Page]:
    """Wählt den Parser anhand der Dateiendung."""
    if filename.lower().endswith(".pdf"):
        return parse_pdf(path)
    return parse_txt(path)
