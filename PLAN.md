# Implementierungsleitfaden — NotebookLM Clone

> Jeder Block endet mit: Test → Commit. Nicht weitergehen bevor der Block grün ist.
> Commit-Messages sind Vorschläge — anpassen wenn nötig.

---

## Tech Stack

| Komponente | Technologie | Warum |
|---|---|---|
| Frontend | Next.js 14 + Tailwind + TS strict | Typsicher, kein any |
| Backend | Python + FastAPI (async, single-worker) | Native async, beste KI-Libs |
| Config | Pydantic Settings | Typisiert, validiert, selbstdokumentierend |
| PDF-Parser | PyMuPDF (fitz) | Schnell, Seitennummern |
| Chunking | Eigenimplementierung | Keine LangChain-Blackbox |
| Embeddings | sentence-transformers all-MiniLM-L6-v2 | Lokal, kostenlos, kein API-Key |
| Vektorstore | ChromaDB (embedded, single-worker) | Lokal, persistent, Metadaten-Filterung |
| LLM | Groq / OpenAI / Ollama (abstrakt) | Provider-agnostisch |
| LLM Default | Ollama + llama3.2:3b (in Docker) | Lokal, DSGVO-konform, kein API-Key nötig |
| Streaming | Server-Sent Events (SSE) | Standard, kein WebSocket-Overhead |
| Audit-Log | JSON Lines (append-only) | Nachvollziehbar, backupbar, kein Content |
| Deployment | Docker Compose + named Volumes | Ein Command, vollständig self-contained |
| Developer UX | Makefile | dev / test / lint / backup / restore |

---

## Verzeichnisstruktur (Ziel)

```
notebooklm-clone/
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   ├── config.py
│   ├── logging_setup.py
│   ├── audit.py
│   ├── main.py
│   ├── models/
│   │   └── schemas.py
│   ├── services/
│   │   ├── parser.py
│   │   ├── chunker.py
│   │   ├── embedder.py
│   │   ├── vectorstore.py
│   │   └── llm.py
│   └── routers/
│       ├── health.py
│       ├── documents.py
│       └── chat.py
├── frontend/
│   └── (Next.js App)
├── docker-compose.yml
├── Makefile
├── ARCHITECTURE.md
└── PLAN.md
```

---

## Block 1 — Project Scaffold

**Was:** FastAPI-Grundgerüst, Pydantic Settings, Health-Endpoint, Projektstruktur.

```
backend/requirements.txt       — alle Abhängigkeiten mit gepinnten Versionen
backend/.env.example           — alle Umgebungsvariablen dokumentiert
backend/config.py              — Pydantic BaseSettings (LLM_PROVIDER, API_KEY, thresholds, limits)
backend/main.py                — FastAPI App, CORS, Lifespan, Router einbinden
backend/routers/health.py      — GET /health → { status: "ok", version: "..." }
```

**Pydantic Settings Kern:**
```python
class Settings(BaseSettings):
    llm_provider: Literal["groq", "openai", "ollama"] = "ollama"
    groq_api_key: SecretStr = ""
    openai_api_key: SecretStr = ""
    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "llama3.2:3b"
    confidence_threshold: float = Field(0.3, ge=0.0, le=1.0)
    max_file_size_mb: int = Field(20, ge=1, le=100)
    chunk_size_tokens: int = 500
    chunk_overlap_percent: float = Field(0.15, ge=0.0, le=0.5)
    upload_dir: Path = Path("/tmp/uploads")
    chroma_path: Path = Path("/tmp/chroma")
    audit_log_path: Path = Path("/tmp/audit.jsonl")
```

**Test:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
curl http://localhost:8000/health   # → { "status": "ok" }
```

**Commit:** `feat: project scaffold — FastAPI, Pydantic Settings, health endpoint`

---

## Block 2 — Logging + Audit + Schemas

**Was:** Strukturiertes JSON-Logging, Audit-Log als append-only JSON Lines, alle Pydantic-Schemas.

```
backend/logging_setup.py       — JSON-Logging mit request_id Kontext, niemals Content loggen
backend/audit.py               — write_audit_event(event, **kwargs) → append-only .jsonl
backend/models/schemas.py      — Document, Chunk, JobStatus, ChatMessage, ChatResponse, Source
```

**Wichtig für Logging:** Kein Query-Text, kein Dokumenteninhalt. Nur Metadaten:
`document_id`, `filename`, `size_bytes`, `duration_ms`, `chunks_count`, `top_score`.

**Wichtig für Audit:** Separate Datei (nicht Application-Log). Events:
`document.uploaded`, `document.ready`, `document.failed`, `document.deleted`, `chat.queried`.

**Test:**
```python
# in Python REPL oder kleinem test_schemas.py
from models.schemas import Document, JobStatus, ChatResponse
from audit import write_audit_event
from pathlib import Path
import tempfile

# Schemas validieren
doc = Document(id="abc", filename="test.pdf", status="ready", pages=3, chunks=12)
assert doc.id == "abc"

# Audit schreiben
with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as f:
    write_audit_event("document.uploaded", document_id="abc", filename="test.pdf", size_bytes=1024, log_path=Path(f.name))
    # Datei öffnen und prüfen: valides JSON, kein Content
```

**Commit:** `feat: structured JSON logging, audit log, Pydantic schemas`

---

## Block 3 — Parser + Chunker

**Was:** PDF- und TXT-Parser mit Seitennummern, Paragraph-Chunker mit Overlap und Metadaten.

```
backend/services/parser.py     — parse_pdf(path) → List[{text, page}], parse_txt(path) → List[{text, page: 1}]
backend/services/chunker.py    — chunk_document(pages, doc_id, filename) → List[Chunk]
```

**Chunker-Logik:**
- Absatzgrenzen respektieren (split auf `\n\n`)
- Ziel-Chunk: ~500 Tokens (grob: Zeichen / 4)
- 15% Overlap: letzter Satz des vorherigen Chunks wird als erster Satz des nächsten übernommen
- Metadaten pro Chunk: `document_id`, `filename`, `page`, `chunk_index`, `char_start`, `char_end`

**Test:**
```bash
# Eine echte PDF-Datei parsen (jede beliebige PDF nehmen)
python -c "
from services.parser import parse_pdf
from services.chunker import chunk_document
pages = parse_pdf('test.pdf')
print(f'Pages: {len(pages)}, first page chars: {len(pages[0][\"text\"])}')
chunks = chunk_document(pages, 'doc-123', 'test.pdf')
print(f'Chunks: {len(chunks)}')
print('First chunk metadata:', chunks[0].metadata)
print('Overlap check — last chars of chunk 0:', chunks[0].text[-100:])
print('First chars of chunk 1:', chunks[1].text[:100])
# Sichtbar prüfen: gibt es Überlapp?
"
```

**Commit:** `feat: PDF/TXT parser and paragraph chunker with overlap`

---

## Block 4 — Embedder + VectorStore

**Was:** sentence-transformers Embedder (Singleton), ChromaDB Wrapper.

```
backend/services/embedder.py    — embed(texts: List[str]) → List[List[float]], Singleton-Pattern
backend/services/vectorstore.py — add_chunks(chunks), search(query_vec, top_k, doc_ids) → List[ChunkResult], delete_document(doc_id)
```

**Embedder:** `all-MiniLM-L6-v2`, Singleton damit das Modell nur einmal geladen wird.
**VectorStore:** ChromaDB mit einer Collection pro Deployment (kein Multi-Tenant im MVP).
Metadaten-Filterung bei `search`: nur Chunks der übergebenen `doc_ids` zurückgeben.

**Test:**
```python
from services.embedder import get_embedder
from services.vectorstore import VectorStore
from models.schemas import Chunk

embedder = get_embedder()
vecs = embedder.embed(["Dieser Vertrag gilt ab dem 1. Januar.", "Die Kündigung muss schriftlich erfolgen."])
print(f"Vector shape: {len(vecs[0])} dims")  # sollte 384 sein

vs = VectorStore(path="/tmp/test_chroma")
test_chunk = Chunk(id="c1", document_id="d1", filename="test.pdf", page=1,
                   chunk_index=0, char_start=0, char_end=40,
                   text="Dieser Vertrag gilt ab dem 1. Januar.")
vs.add_chunks([test_chunk], vecs[:1])
results = vs.search(vecs[1], top_k=1, doc_ids=["d1"])
print(f"Top result: {results[0].text[:50]}, score: {results[0].score:.3f}")
vs.delete_document("d1")
results_after = vs.search(vecs[1], top_k=1, doc_ids=["d1"])
print(f"After delete: {len(results_after)} results")  # muss 0 sein
```

**Commit:** `feat: sentence-transformers embedder and ChromaDB vector store`

---

## Block 5 — Document Upload API + Background Processing

**Was:** POST /documents gibt 202 zurück, Background Task verarbeitet async, Status-Polling.

```
backend/routers/documents.py   — POST /documents → 202 + job_id
                                  GET /documents/{id}/status → JobStatus
                                  Background Task: parse → chunk → embed → store → status update
```

**Status-Flow:** `pending` → `processing` → `ready` | `failed` + error_message

**Wichtig:** Job-Status im Memory (dict) ist für MVP ok. Bei Neustart gehen offene Jobs verloren —
das ist dokumentiert und akzeptiert.

**Test:**
```bash
# Server laufen lassen, dann:
curl -X POST http://localhost:8000/documents \
     -F "file=@test.pdf"
# → { "job_id": "abc123", "status": "pending" }

# Pollen bis ready:
curl http://localhost:8000/documents/abc123/status
# → { "status": "processing", "stage": "embedding" }
# → { "status": "ready", "chunks": 23 }

# In ChromaDB prüfen: Chunks vorhanden
python -c "
import chromadb
client = chromadb.PersistentClient(path='/tmp/chroma')
col = client.get_collection('documents')
print('Total chunks:', col.count())
"
```

**Commit:** `feat: async document upload with background processing and status polling`

---

## Block 6 — Input Validation + Hard Delete

**Was:** Validierung als eigene Schicht, DELETE als echtes Hard Delete (DSGVO Art. 17).

```
backend/routers/documents.py   — Validierung: Dateigröße, Content-Type, korrupte PDFs
                                  DELETE /documents/{id} → Datei + ChromaDB-Chunks + Metadaten + Audit
```

**Validierung:**
- Dateigröße > `max_file_size_mb` → 413
- Content-Type nicht `application/pdf` oder `text/plain` → 415
- Korrupte PDF (PyMuPDF wirft Exception) → Job-Status `failed` + Fehlermeldung

**Hard Delete Checkliste:**
1. Originaldatei vom Dateisystem
2. Alle Chunks aus ChromaDB (`delete_document(doc_id)`)
3. Job-Status aus Memory
4. Audit-Event `document.deleted`

**Test:**
```bash
# Zu große Datei:
python -c "open('big.txt','w').write('x'*21*1024*1024)"  # 21 MB
curl -X POST http://localhost:8000/documents -F "file=@big.txt"
# → 413

# Falscher Content-Type:
curl -X POST http://localhost:8000/documents -F "file=@image.jpg"
# → 415

# Korrupte PDF:
echo "not a pdf" > fake.pdf
curl -X POST http://localhost:8000/documents -F "file=@fake.pdf"
# → 202, dann status: "failed"

# Hard Delete:
JOB_ID=$(curl -s -X POST http://localhost:8000/documents -F "file=@test.pdf" | jq -r .job_id)
# warten bis ready, dann:
curl -X DELETE http://localhost:8000/documents/$JOB_ID
# Audit-Log prüfen: document.deleted Eintrag vorhanden
# ChromaDB prüfen: count() kleiner geworden
```

**Commit:** `feat: input validation and DSGVO hard delete (Art. 17)`

---

## Block 7 — LLM Provider Abstraction

**Was:** Protocol-Interface für LLM, drei Implementierungen: Groq, OpenAI, Ollama.

```
backend/services/llm.py        — LLMProvider Protocol, get_llm_provider() Factory
                                  GroqProvider, OpenAIProvider, OllamaProvider
                                  Alle implementieren: stream_chat(messages) → AsyncIterator[str]
```

**Alle drei Provider sind OpenAI-API-kompatibel** — Groq und Ollama implementieren die OpenAI-API.
Das bedeutet: eine Implementierung mit dem `openai`-Python-Client, nur `base_url` und `api_key` ändern sich.

```python
class LLMProvider(Protocol):
    async def stream_chat(self, messages: list[dict]) -> AsyncIterator[str]: ...

def get_llm_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider == "groq":
        return GroqProvider(api_key=settings.groq_api_key)
    elif settings.llm_provider == "openai":
        return OpenAIProvider(api_key=settings.openai_api_key)
    else:
        return OllamaProvider(base_url=settings.ollama_base_url, model=settings.ollama_model)
```

**Test:**
```bash
# .env setzen: LLM_PROVIDER=groq, GROQ_API_KEY=...
python -c "
import asyncio
from config import get_settings
from services.llm import get_llm_provider

async def test():
    provider = get_llm_provider(get_settings())
    async for token in provider.stream_chat([{'role':'user','content':'Sage nur: Hallo'}]):
        print(token, end='', flush=True)
    print()

asyncio.run(test())
"
# Sichtbar: Tokens kommen einzeln rein
```

**Commit:** `feat: provider-agnostic LLM abstraction (Groq, OpenAI, Ollama)`

---

## Block 8 — Chat Endpoint + SSE + Grounding

**Was:** POST /chat als SSE-Stream, Grounding-Constraint, Confidence Threshold, Audit.

```
backend/routers/chat.py        — POST /chat → StreamingResponse (SSE)
```

**Stream-Protokoll:**
```
event: sources
data: [{"filename":"doc.pdf","page":3,"excerpt":"...","score":0.82}]

event: token
data: {"text": "Laut"}

event: done
data: {}
```

**Confidence Threshold:** Bester Retrieval-Score < `confidence_threshold` → kein LLM-Call.
Direkt: `event: sources` mit leerem Array, dann ein einzelner `event: token` mit der "nicht gefunden"-Meldung.

**Grounding System Prompt:**
```
Du bist ein präziser Dokumenten-Assistent. Beantworte Fragen ausschließlich
basierend auf den bereitgestellten Quellen. Wenn die Antwort nicht in den
Quellen enthalten ist, antworte: "Diese Information ist in deinen Dokumenten
nicht vorhanden." Halluziniere niemals. Zitiere immer die Quelle.
```

**Audit:** `chat.queried` mit `query_id`, `document_ids`, `sources_found` — kein Query-Text.

**Test:**
```bash
# Server laufen, Dokument hochgeladen und ready
curl -N -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "Was steht im Vertrag?", "document_ids": ["<id>"]}'
# Sichtbar: erst sources-Event, dann Token-Stream

# Threshold-Test: sinnlose Frage stellen
curl -N -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "Was kostet ein Flug nach Tokio?", "document_ids": ["<id>"]}'
# → sources: [], dann: "Diese Information ist in deinen Dokumenten nicht vorhanden."
```

**Commit:** `feat: chat endpoint — SSE streaming, RAG grounding, confidence threshold`

---

## Block 9 — Next.js Scaffold + Layout

**Was:** Next.js 14 App Router, TypeScript strict, Tailwind, Zwei-Spalten-Layout-Shell.

```
frontend/                      — npx create-next-app@latest mit TS strict + Tailwind
frontend/app/layout.tsx        — Root Layout
frontend/app/page.tsx          — Zwei-Spalten-Layout: Sidebar links, ChatPanel rechts
frontend/lib/api.ts            — Typisierter API-Client (kein fetch direkt in Components)
frontend/types/index.ts        — Document, JobStatus, ChatResponse, Source (sync mit Backend-Schemas)
```

**TypeScript strict:** `"strict": true` in tsconfig.json. Kein `any`. CI würde hier fehlschlagen.

**Test:**
```bash
cd frontend
npm run dev
# Browser: http://localhost:3000
# Sichtbar: Zwei-Spalten-Layout, TypeScript-Fehler: keine
npm run build   # muss durchlaufen ohne Fehler
```

**Commit:** `feat: Next.js frontend scaffold — TypeScript strict, two-column layout`

---

## Block 10 — Upload UI + Status Polling

**Was:** UploadZone mit Drag & Drop, Job-Status-Polling, SourcesList mit Status-Indikatoren.

```
frontend/components/UploadZone.tsx    — Drag & Drop, startet Polling nach Upload
frontend/components/SourcesList.tsx   — Dokumente mit Status: processing/ready/failed, Lösch-Button
frontend/hooks/useDocumentPolling.ts  — Polling-Hook: pollt GET /documents/{id}/status bis ready|failed
```

**UX-Details:**
- Während `processing`: Spinner + aktueller Stage-Text
- `ready`: grüner Indicator, Dokument wählbar für Chat
- `failed`: roter Indicator + Fehlermeldung sichtbar
- Löschen: sofort aus Liste entfernen, DELETE im Hintergrund

**Test:**
```bash
# Backend läuft auf :8000, Frontend auf :3000
# Manuell testen:
# 1. PDF per Drag & Drop hochladen
# 2. Spinner erscheint, Stage-Text ändert sich
# 3. Nach fertig: grüner Indicator
# 4. Korrupte Datei hochladen → roter Indicator mit Fehlermeldung
# 5. Dokument löschen → verschwindet aus Liste
```

**Commit:** `feat: upload zone with drag & drop and async status polling`

---

## Block 11 — Chat UI + Streaming

**Was:** ChatPanel mit SSE-Consumer, Token-Stream live rendern, SourceBadges.

```
frontend/components/ChatPanel.tsx      — Eingabefeld, Nachrichtenverlauf, Streaming-Antwort
frontend/components/SourceBadge.tsx    — "📄 doc.pdf, S.3" — klickbar, zeigt Excerpt
frontend/hooks/useSSEChat.ts           — SSE-Hook: sources-Event → SourceBadges, token-Events → Text aufbauen
```

**Wichtig:** `EventSource` API funktioniert nicht für POST-Requests.
Stattdessen: `fetch` + `response.body.getReader()` + `eventsource-parser` (npm package).

**Test:**
```bash
# Vollständiger Flow:
# 1. PDF hochladen → warten bis ready
# 2. Frage stellen
# 3. Sichtbar: SourceBadges erscheinen sofort (sources-Event)
# 4. Sichtbar: Antworttext baut sich Wort für Wort auf
# 5. "Nicht gefunden"-Case: sinnlose Frage → leere Sources + Hinweistext
```

**Commit:** `feat: chat panel with SSE streaming and source badges`

---

## Block 12 — Error States + Polish

**Was:** Alle Fehlerzustände im UI, kein `any` im TypeScript, letzter Frontend-Schliff.

```
Fehlerzustände die behandelt werden müssen:
- Upload fehlgeschlagen (Netzwerk, 413, 415)
- Dokument im Status "failed" (korrupte PDF)
- Backend nicht erreichbar beim Chat
- Kein Dokument ausgewählt beim Chat-Versuch
- Streaming-Verbindung unterbrochen
```

**Test:**
```bash
npm run build                  # muss fehlerfrei durchlaufen
npx tsc --noEmit               # kein einziges TypeScript-Fehler

# Backend stoppen, dann Chat-Versuch:
# Sichtbar: Fehlermeldung statt Absturz

# 21MB-Datei hochladen:
# Sichtbar: "Datei zu groß" Meldung
```

**Commit:** `feat: error states, typed API client, TypeScript strict clean`

---

## Block 13 — Dockerfiles

**Was:** Produktionsreife Dockerfiles. Backend bäckt sentence-transformers Model ein.

```
backend/Dockerfile
frontend/Dockerfile
```

**Backend Dockerfile — kritischer Schritt:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Modell zur Build-Zeit laden — nicht zur Laufzeit
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

**`--workers 1` ist bewusst** (ChromaDB Concurrency — siehe ARCHITECTURE.md Entscheidung 7).

**Test:**
```bash
docker build -t notebooklm-backend ./backend
docker build -t notebooklm-frontend ./frontend
# Beide müssen fehlerfrei bauen
# Backend-Image: kein Internet-Zugriff beim Start (Modell schon drin)
docker run --rm notebooklm-backend python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2'); print('Model OK')"
```

**Commit:** `feat: production Dockerfiles with pre-baked embedding model`

---

## Block 14 — Docker Compose + Ollama + Makefile

**Was:** Vollständiger Stack, Ollama via Init-Container, named Volumes, Makefile.

```
docker-compose.yml
Makefile
```

**docker-compose.yml Struktur:**
```yaml
services:
  ollama:
    image: ollama/ollama
    volumes: [ollama_data:/root/.ollama]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 10s
      retries: 10

  ollama-pull:
    image: ollama/ollama
    depends_on:
      ollama:
        condition: service_healthy
    environment: [OLLAMA_HOST=http://ollama:11434]
    entrypoint: ["ollama", "pull", "llama3.2:3b"]
    restart: "no"

  backend:
    build: ./backend
    depends_on:
      ollama-pull:
        condition: service_completed_successfully
    volumes:
      - chroma_data:/data/chroma
      - uploads_data:/data/uploads
      - audit_data:/data/audit
    environment: [LLM_PROVIDER=ollama, OLLAMA_BASE_URL=http://ollama:11434]

  frontend:
    build: ./frontend
    depends_on: [backend]
    ports: ["3000:3000"]

volumes:
  ollama_data:
  chroma_data:
  uploads_data:
  audit_data:
```

**Makefile Targets:**
```makefile
dev:      # lokale Entwicklung ohne Docker
test:     # Backend-Tests + TypeScript-Check
lint:     # ruff (Python) + eslint (TS)
backup:   # Volumes → backup/YYYY-MM-DD_HH-MM-SS/*.tar.gz
restore:  # make restore BACKUP=2025-01-15_10-30-00
```

**Test:**
```bash
docker compose up
# Warten — beim ersten Start lädt Ollama llama3.2:3b (~2GB)
# Browser: http://localhost:3000
# Vollständiger Flow testen: Upload → Frage → Streaming-Antwort

make backup
# Prüfen: backup/YYYY-MM-DD_HH-MM-SS/ mit drei .tar.gz Dateien

docker compose down
docker compose up      # zweiter Start: kein Model-Download, sofort ready
```

**Commit:** `feat: full Docker Compose stack with Ollama init container and Makefile`

---

## Block 15 — README + .env.example + Abgabe

**Was:** Alles was für Abgabe und GitHub gebraucht wird.

```
README.md              — Quickstart, Features, Screenshot, Systemanforderungen
.env.example           — vollständig dokumentiert, DSGVO-Hinweis für Cloud-Provider
ARCHITECTURE.md        — finaler Review, nichts fehlt
```

**README muss enthalten:**
- Systemanforderungen: Docker, 4GB RAM für Ollama
- `docker compose up` — ein Command, fertig
- Screenshot oder GIF des laufenden Systems
- Link zu ARCHITECTURE.md als "Design Decisions"

**.env.example DSGVO-Hinweis:**
```bash
# WICHTIG — DSGVO:
# LLM_PROVIDER=ollama  → vollständig lokal, kein Byte verlässt die Infrastruktur (Default)
# LLM_PROVIDER=groq    → Dokumenteninhalt wird auf US-Servern verarbeitet (AVV erforderlich)
# LLM_PROVIDER=openai  → Dokumenteninhalt wird auf US-Servern verarbeitet (AVV erforderlich)
```

**Loom-Video (5-8 Min):**
- `docker compose up` zeigen, warten bis healthy
- PDF hochladen → Status-Polling live sehen
- 2-3 Fragen stellen → Streaming + Quellenangaben
- "Nicht gefunden"-Case demonstrieren
- Dokument löschen → Hard Delete erklären (DSGVO)
- 2 Min Architektur: async, streaming, provider abstraction, warum kein LangChain

**Test:**
```bash
# Repo frisch klonen, KEIN .env setzen:
git clone <repo> test-clone
cd test-clone
docker compose up
# Muss funktionieren — mit Ollama als Default, kein API-Key nötig
```

**Commit:** `docs: README, .env.example with DSGVO guidance, finalize ARCHITECTURE.md`

---

## Abgabe-Checkliste

- [ ] GitHub Repo public — saubere History mit 15 Commits
- [ ] Loom-Video aufgenommen und verlinkt
- [ ] README: `docker compose up` → es funktioniert
- [ ] ARCHITECTURE.md vollständig
- [ ] E-Mail schreiben
