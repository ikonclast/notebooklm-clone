"""FastAPI-Einstiegspunkt.

Bindet Router ein, konfiguriert CORS und verwaltet den Anwendungs-Lebenszyklus
über einen Lifespan-Kontext (statt der veralteten on_event-Hooks).
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator, Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from config import APP_VERSION, get_settings
from logging_setup import new_request_id, setup_logging
from routers import chat, documents, health


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
    setup_logging()
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

    @app.middleware("http")
    async def request_id_middleware(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        """Vergibt pro Request eine ID für korrelierbare Logs und gibt sie
        im Response-Header zurück."""
        rid = new_request_id()
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response

    app.include_router(health.router)
    app.include_router(documents.router)
    app.include_router(chat.router)
    return app


app = create_app()
