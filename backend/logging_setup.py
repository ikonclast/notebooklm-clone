"""Strukturiertes JSON-Logging mit Request-ID-Kontext.

Grundsatz (DSGVO): In Logs landen ausschließlich Metadaten — niemals
Dokumenteninhalt, Query-Text oder LLM-Antworten. Diese Disziplin liegt beim
Aufrufer; dieses Modul stellt nur die Infrastruktur bereit.
"""

import json
import logging
import sys
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone

# Request-ID wird pro Request gesetzt und in jeden Log-Eintrag übernommen.
request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)

# Standard-Attribute eines LogRecord — alles andere gilt als strukturiertes "extra".
_RESERVED = set(
    logging.makeLogRecord({}).__dict__.keys()
) | {"message", "asctime", "taskName"}


def new_request_id() -> str:
    """Erzeugt eine neue Request-ID und legt sie im Kontext ab."""
    rid = uuid.uuid4().hex[:12]
    request_id_var.set(rid)
    return rid


def set_request_id(rid: str | None) -> None:
    request_id_var.set(rid)


class JsonFormatter(logging.Formatter):
    """Formatiert LogRecords als einzeilige JSON-Objekte."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        rid = request_id_var.get()
        if rid is not None:
            payload["request_id"] = rid

        # Über `extra={...}` mitgegebene strukturierte Felder übernehmen.
        for key, value in record.__dict__.items():
            if key not in _RESERVED:
                payload[key] = value

        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=False, default=str)


def setup_logging(level: int = logging.INFO) -> None:
    """Konfiguriert das Root-Logging einmalig auf JSON-Ausgabe nach stdout."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    # uvicorns Access-Log dämpfen — eigene strukturierte Logs sind aussagekräftiger.
    logging.getLogger("uvicorn.access").handlers.clear()
