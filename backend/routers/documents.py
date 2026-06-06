"""Dokument-Endpunkte: Upload (async) und Status-Polling.

Upload gibt sofort 202 + job_id zurück; die teure Pipeline (parse → chunk →
embed → store) läuft als Background Task. Der Client pollt den Status, bis
"ready" oder "failed" (siehe ARCHITECTURE.md, Entscheidung 8).

Job-State liegt im Speicher (dict). Bei Neustart gehen offene Jobs verloren —
für einen Prototyp bewusst akzeptiert und dokumentiert.
"""

import logging
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse

from audit import write_audit_event
from config import get_settings
from models.schemas import JobStatus
from services.chunker import chunk_document
from services.embedder import get_embedder
from services.parser import ParseError, parse_pdf, parse_txt
from services.vectorstore import get_vector_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["documents"])

# Erlaubte Content-Types. Validiert wird der Content-Type, nicht die Endung.
CONTENT_TYPE_PDF = "application/pdf"
CONTENT_TYPE_TXT = "text/plain"
ALLOWED_CONTENT_TYPES = {CONTENT_TYPE_PDF, CONTENT_TYPE_TXT}

_READ_CHUNK = 1024 * 1024  # 1 MiB


@dataclass
class _Job:
    """Interner Job-Eintrag: öffentlicher Status + Pfad + Content-Type."""

    status: JobStatus
    path: Path
    content_type: str


# In-Memory Job-Store (MVP). Zugriff nur aus dem single-worker-Prozess.
_jobs: dict[str, _Job] = {}


def _update(doc_id: str, **fields: object) -> None:
    """Aktualisiert den Status eines Jobs immutable (pydantic model_copy).

    Tolerant gegenüber zwischenzeitlich gelöschten Jobs (DSGVO Hard Delete):
    ein gelöschter Job wird nicht wiederbelebt.
    """
    job = _jobs.get(doc_id)
    if job is None:
        return
    job.status = job.status.model_copy(update=fields)


def _process_document(doc_id: str) -> None:
    """Background Task: vollständige Verarbeitungspipeline für ein Dokument."""
    job = _jobs.get(doc_id)
    if job is None:  # zwischenzeitlich gelöscht
        return

    filename = job.status.filename
    started = time.monotonic()
    try:
        _update(doc_id, status="processing", stage="parsing")
        # Dispatch nach validiertem Content-Type, nicht nach Dateiendung.
        if job.content_type == CONTENT_TYPE_PDF:
            pages = parse_pdf(job.path, display_name=filename)
        else:
            pages = parse_txt(job.path)

        _update(doc_id, stage="chunking")
        chunks = chunk_document(pages, doc_id, filename)

        _update(doc_id, stage="embedding")
        embeddings = get_embedder().embed([c.text for c in chunks])

        _update(doc_id, stage="storing")
        get_vector_store().add_chunks(chunks, embeddings)

        duration_ms = int((time.monotonic() - started) * 1000)
        _update(
            doc_id,
            status="ready",
            stage="done",
            pages=len(pages),
            chunks=len(chunks),
        )
        write_audit_event(
            "document.ready",
            document_id=doc_id,
            chunks=len(chunks),
            duration_ms=duration_ms,
        )
        logger.info(
            "document processed",
            extra={
                "document_id": doc_id,
                "pages": len(pages),
                "chunks_count": len(chunks),
                "duration_ms": duration_ms,
            },
        )
    except ParseError as exc:
        _update(doc_id, status="failed", stage=None, error_message=str(exc))
        write_audit_event(
            "document.failed", document_id=doc_id, error_type="ParseError"
        )
        logger.warning(
            "document parse failed",
            extra={"document_id": doc_id, "error_type": "ParseError"},
        )
    except Exception as exc:  # defensiv: jeder andere Fehler → failed, kein Crash
        _update(
            doc_id,
            status="failed",
            stage=None,
            error_message="Interner Fehler bei der Verarbeitung.",
        )
        write_audit_event(
            "document.failed", document_id=doc_id, error_type=type(exc).__name__
        )
        logger.exception(
            "document processing failed",
            extra={"document_id": doc_id, "error_type": type(exc).__name__},
        )


async def _read_within_limit(file: UploadFile, max_bytes: int) -> bytes:
    """Liest die Datei in Blöcken und bricht bei Überschreitung des Limits ab —
    so wird eine übergroße Datei nie vollständig in den Speicher geladen."""
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(_READ_CHUNK):
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Datei zu groß (max. {max_bytes // (1024 * 1024)} MB).",
            )
        chunks.append(chunk)
    return b"".join(chunks)


def _validate_content_type(file: UploadFile) -> None:
    """Validierung als eigene Schicht (ARCHITECTURE.md, Entscheidung 11)."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Nicht unterstützter Dateityp: {file.content_type}. "
                "Erlaubt: PDF, TXT."
            ),
        )


@router.post("", status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
) -> dict[str, str]:
    """Nimmt eine Datei an, validiert sie, speichert sie und stößt die
    Verarbeitung an. Antwortet sofort mit 202 + job_id."""
    settings = get_settings()

    # Validierung VOR dem Schreiben — ungültige Uploads hinterlassen nichts.
    _validate_content_type(file)
    content = await _read_within_limit(file, settings.max_file_size_mb * 1024 * 1024)

    doc_id = uuid.uuid4().hex
    filename = file.filename or "unbenannt"

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    dest = settings.upload_dir / f"{doc_id}{Path(filename).suffix}"
    dest.write_bytes(content)

    _jobs[doc_id] = _Job(
        status=JobStatus(
            document_id=doc_id,
            filename=filename,
            status="pending",
            stage="queued",
        ),
        path=dest,
        content_type=file.content_type or CONTENT_TYPE_TXT,
    )
    write_audit_event(
        "document.uploaded",
        document_id=doc_id,
        filename=filename,
        size_bytes=len(content),
    )

    background_tasks.add_task(_process_document, doc_id)
    return {"job_id": doc_id, "status": "pending"}


@router.get("")
async def list_documents() -> list[JobStatus]:
    """Alle bekannten Dokumente mit ihrem aktuellen Status (für die Sidebar)."""
    return [job.status for job in _jobs.values()]


@router.get("/{doc_id}/status")
async def get_status(doc_id: str) -> JobStatus:
    job = _jobs.get(doc_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden.")
    return job.status


@router.get("/{doc_id}/file")
async def get_file(doc_id: str) -> FileResponse:
    """Liefert die Originaldatei aus — inline, damit der Browser sie direkt anzeigt
    (PDF-Viewer springt per #page=N auf die zitierte Seite).

    Kein Path-Traversal: doc_id ist nur ein Lookup-Schlüssel, der ausgelieferte
    Pfad stammt aus dem intern verwalteten Job."""
    job = _jobs.get(doc_id)
    if job is None or not job.path.exists():
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden.")
    return FileResponse(
        path=job.path,
        media_type=job.content_type,
        filename=job.status.filename,
        content_disposition_type="inline",
    )


@router.delete("/{doc_id}", status_code=204)
async def delete_document(doc_id: str) -> Response:
    """Echtes Hard Delete (DSGVO Art. 17) — gelöscht heißt gelöscht.

    Reihenfolge: Originaldatei → ChromaDB-Chunks → Job-Status → Audit-Event.
    """
    job = _jobs.get(doc_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden.")

    filename = job.status.filename
    job.path.unlink(missing_ok=True)          # 1. Originaldatei vom Dateisystem
    get_vector_store().delete_document(doc_id)  # 2. alle Chunks aus ChromaDB
    del _jobs[doc_id]                          # 3. Job-Status aus dem Speicher

    write_audit_event(                          # 4. Audit-Event
        "document.deleted", document_id=doc_id, filename=filename
    )
    logger.info("document deleted", extra={"document_id": doc_id})
    return Response(status_code=204)
