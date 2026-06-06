"""Zentrale, typisierte Konfiguration.

Alle Konfigurationswerte werden über eine einzige Settings-Klasse verwaltet.
Kein os.getenv() verstreut im Code. Validierung beim Start, nicht zur Laufzeit —
fehlende oder ungültige Werte führen sofort beim Start zu einem Fehler.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

APP_VERSION = "0.1.0"

# Basisordner des Backends (backend/). Daran werden die lokalen Daten-Pfade
# verankert, damit sie unabhängig vom Arbeitsverzeichnis stimmen.
_BASE_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    """Anwendungs-Konfiguration, geladen aus Umgebungsvariablen / .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- LLM Provider ---
    llm_provider: Literal["groq", "openai", "ollama"] = "ollama"

    groq_api_key: SecretStr = SecretStr("")
    groq_model: str = "llama-3.3-70b-versatile"

    openai_api_key: SecretStr = SecretStr("")
    openai_model: str = "gpt-4o-mini"

    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "llama3.2:3b"
    # Optional — nur für Ollama Cloud/Turbo nötig. Lokales Ollama braucht keinen Key.
    ollama_api_key: SecretStr = SecretStr("")

    # --- Retrieval ---
    confidence_threshold: float = Field(0.3, ge=0.0, le=1.0)
    top_k: int = Field(5, ge=1, le=20)

    # --- Upload / Chunking ---
    max_file_size_mb: int = Field(20, ge=1, le=100)
    chunk_size_tokens: int = Field(500, ge=50, le=2000)
    chunk_overlap_percent: float = Field(0.15, ge=0.0, le=0.5)

    # --- Persistenz-Pfade ---
    # Defaults für den LOKALEN Betrieb (ohne Docker): persistent unter
    # backend/data/ — NICHT /tmp (das wäre flüchtig und würde beim Reboot
    # gelöscht). Im Docker-Betrieb überschreiben docker-compose.yml und das
    # Dockerfile diese Werte auf /data/* (gemountete named Volumes).
    # Alle drei sind per Env (UPLOAD_DIR / CHROMA_PATH / AUDIT_LOG_PATH)
    # bzw. .env überschreibbar.
    upload_dir: Path = _BASE_DIR / "data" / "uploads"
    chroma_path: Path = _BASE_DIR / "data" / "chroma"
    audit_log_path: Path = _BASE_DIR / "data" / "audit.jsonl"

    # --- CORS ---
    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    """Settings-Singleton. lru_cache stellt sicher, dass die .env nur einmal
    gelesen und validiert wird."""
    return Settings()
