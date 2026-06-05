"""Audit-Log — append-only JSON Lines für alle kritischen Aktionen.

Getrennt vom Application-Log: nachvollziehbar, backupbar, leicht maschinell
auswertbar. Es wird NIE Inhalt geloggt — kein Dokumenttext, kein Query-Text,
keine LLM-Antwort. Nur Metadaten (IDs, Dateinamen, Größen, Zähler, Dauern).

Bekannte Events:
    document.uploaded, document.ready, document.failed,
    document.deleted, chat.queried
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from config import get_settings


def write_audit_event(
    event: str,
    *,
    log_path: Path | None = None,
    **fields: object,
) -> dict[str, object]:
    """Hängt ein Audit-Event als eine JSON-Zeile an die Audit-Datei an.

    Args:
        event: Event-Name, z. B. "document.uploaded".
        log_path: Zieldatei. Default: settings.audit_log_path.
        **fields: Metadaten-Felder. KEIN Content (siehe Modul-Docstring).

    Returns:
        Den geschriebenen Record (nützlich für Tests / Weiterverarbeitung).
    """
    if log_path is None:
        log_path = get_settings().audit_log_path

    record: dict[str, object] = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "event": event,
        **fields,
    }

    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")

    return record
