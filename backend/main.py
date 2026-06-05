"""FastAPI-Einstiegspunkt.

Bindet Router ein, konfiguriert CORS und verwaltet den Anwendungs-Lebenszyklus
über einen Lifespan-Kontext (statt der veralteten on_event-Hooks).
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import APP_VERSION, get_settings
from routers import health


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup/Shutdown. Erstellt die benötigten Datenverzeichnisse, damit
    spätere Schreibzugriffe (Uploads, ChromaDB, Audit-Log) nicht fehlschlagen."""
    settings = get_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.chroma_path.mkdir(parents=True, exist_ok=True)
    settings.audit_log_path.parent.mkdir(parents=True, exist_ok=True)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="NotebookLM Clone",
        version=APP_VERSION,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    return app


app = create_app()
