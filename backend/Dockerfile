# syntax=docker/dockerfile:1
FROM python:3.11-slim

# Schlankes, reproduzierbares Image — kein pip-Cache, keine .pyc-Dateien.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HUB_DISABLE_TELEMETRY=1

WORKDIR /app

COPY requirements.txt .
# CPU-only torch ZUERST — sonst zieht sentence-transformers den vollen CUDA/NVIDIA-
# Stack (~5 GB ungenutzt, wir rechnen auf CPU). Spart ~7 GB Image und macht den
# finalen Layer-Export von Minuten auf Sekunden.
RUN pip install --no-cache-dir torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Embedding-Modell zur BUILD-Zeit laden, nicht zur Laufzeit.
# Folge: `docker compose up` ist sofort einsatzbereit — kein Download, kein
# Internet-Zugriff beim Start (ARCHITECTURE.md, Entscheidung 15).
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY . .

# Persistente Daten liegen unter /data (named Volumes, siehe docker-compose.yml).
ENV UPLOAD_DIR=/data/uploads \
    CHROMA_PATH=/data/chroma \
    AUDIT_LOG_PATH=/data/audit/audit.jsonl

EXPOSE 8000

# --workers 1 ist bewusst: ChromaDB (embedded) ist single-writer und der
# In-Memory Job-Store lebt im Prozess (ARCHITECTURE.md, Entscheidung 7 & 12).
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
