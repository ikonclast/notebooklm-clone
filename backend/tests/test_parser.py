"""Unit-Tests für den Parser — TXT voll, PDF minimal + Fehlerfälle."""

import fitz  # PyMuPDF
import pytest

from services.parser import ParseError, parse_pdf, parse_txt


def test_parse_txt_basic(tmp_path):
    p = tmp_path / "a.txt"
    p.write_text("Hallo Welt\n\nZweiter Absatz", encoding="utf-8")
    pages = parse_txt(p)
    assert len(pages) == 1
    assert pages[0]["page"] == 1
    assert "Hallo Welt" in str(pages[0]["text"])


def test_parse_txt_empty(tmp_path):
    p = tmp_path / "empty.txt"
    p.write_text("", encoding="utf-8")
    pages = parse_txt(p)
    assert len(pages) == 1
    assert pages[0]["text"] == ""


def test_parse_pdf_two_pages(tmp_path):
    p = tmp_path / "doc.pdf"
    doc = fitz.open()
    doc.new_page().insert_text((72, 72), "Seite eins Inhalt")
    doc.new_page().insert_text((72, 72), "Seite zwei Inhalt")
    doc.save(p)
    doc.close()

    pages = parse_pdf(p)
    assert [pg["page"] for pg in pages] == [1, 2]
    assert "eins" in str(pages[0]["text"])
    assert "zwei" in str(pages[1]["text"])


def test_parse_pdf_corrupt_raises(tmp_path):
    p = tmp_path / "broken.pdf"
    p.write_text("das ist gar keine PDF", encoding="utf-8")
    with pytest.raises(ParseError):
        parse_pdf(p)


def test_parse_pdf_without_text_raises(tmp_path):
    p = tmp_path / "blank.pdf"
    doc = fitz.open()
    doc.new_page()  # leere Seite ohne Text → kein extrahierbarer Inhalt
    doc.save(p)
    doc.close()
    with pytest.raises(ParseError):
        parse_pdf(p)
