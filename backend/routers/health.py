"""Health-Endpoint — Liveness-Check für Orchestrierung und Monitoring."""

from fastapi import APIRouter

from config import APP_VERSION

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Gibt den Anwendungsstatus zurück. Kein DB- oder Modell-Zugriff —
    bewusst leichtgewichtig, damit der Check schnell und seiteneffektfrei ist."""
    return {"status": "ok", "version": APP_VERSION}
