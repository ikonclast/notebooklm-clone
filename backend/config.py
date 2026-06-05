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
    upload_dir: Path = Path("/tmp/uploads")
    chroma_path: Path = Path("/tmp/chroma")
    audit_log_path: Path = Path("/tmp/audit.jsonl")

    # --- CORS ---
    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    """Settings-Singleton. lru_cache stellt sicher, dass die .env nur einmal
    gelesen und validiert wird."""
    return Settings()
