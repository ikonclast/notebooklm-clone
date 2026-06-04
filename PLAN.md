# Implementierungsplan — NotebookLM Clone

Zeitrahmen: ~1 Woche, keine vollen Tage

---

## Phase 1 — Backend Foundation (Session 1, ~2-3h)

**Ziel:** FastAPI läuft, Konfiguration sauber, Dokumente können hochgeladen und geparst werden.

- [ ] `backend/requirements.txt` erstellen
- [ ] `backend/config.py` — Pydantic Settings (LLM_PROVIDER, API_KEY, thresholds, limits)
- [ ] `backend/logging.py` — strukturiertes JSON-Logging mit Kontext (document_id, duration_ms) — niemals Content
- [ ] `backend/audit.py` — Audit-Log als append-only JSON Lines (separate Datei, separate Concerns)
- [ ] `backend/main.py` — FastAPI App, CORS, Lifespan-Events
- [ ] `backend/models/schemas.py` — Pydantic Models (Document, Chunk, JobStatus, ChatMessage, ChatResponse, Source)
- [ ] `backend/services/parser.py` — PDF (PyMuPDF) + TXT Parser, gibt Text + Seitennummern zurück
- [ ] `backend/services/chunker.py` — Paragraph-Chunking mit Overlap + Metadaten
- [ ] `backend/routers/health.py` — GET /health → Status aller Abhängigkeiten
- [ ] `backend/routers/documents.py` — POST /documents → 202 + job_id (async!), GET /documents/{id}/status

**Erfolgskriterium:** Upload gibt sofort 202 zurück, `/health` zeigt alle Services grün

---

## Phase 2 — RAG Core (Session 2, ~2-3h)

**Ziel:** Background-Processing funktioniert, Embeddings + Retrieval stehen.

- [ ] `backend/services/embedder.py` — sentence-transformers (all-MiniLM-L6-v2), lokal
- [ ] `backend/services/vectorstore.py` — ChromaDB Wrapper (add_chunks, search, delete)
- [ ] Background Task: PDF → Parse → Chunk → Embed → ChromaDB → Status "ready"
- [ ] Status-Polling sauber: "pending" → "processing" → "ready" | "failed" + error message
- [ ] Input Validation als echte Schicht: Dateigröße, Content-Type, korrupte PDFs abfangen
- [ ] Hard Delete: Datei + ChromaDB-Chunks + Metadaten vollständig entfernen + Audit-Event
- [ ] Retrieval testen: Frage → Top-K Chunks mit Scores + Metadaten

**Erfolgskriterium:** Upload non-blocking, Status polling funktioniert, Hard Delete hinterlässt keine Datenreste

---

## Phase 3 — LLM + Streaming (Session 3, ~2-3h)

**Ziel:** Q&A mit Grounding + Streaming-Antworten via SSE.

- [ ] `backend/services/llm.py` — Provider Abstraction (Groq / OpenAI / Ollama), alle OpenAI-kompatibel
- [ ] `.env.example` vollständig dokumentiert
- [ ] Grounding System Prompt — nur aus Quellen antworten, explizit "nicht gefunden" melden
- [ ] Confidence Threshold: unter 0.3 → kein LLM-Call, direkte Antwort
- [ ] `backend/routers/chat.py` — POST /chat als SSE Stream
- [ ] Stream-Format: erst Sources-Chunk, dann Answer-Tokens live
- [ ] Application-Log: query_id, chunks_retrieved, top_score, llm_provider, duration_ms — kein Query-Text
- [ ] Audit-Event: chat.queried mit document_ids + sources_found (kein Query-Text — DSGVO)

**Erfolgskriterium:** Antwort-Tokens kommen live rein, Quellenangaben erscheinen sofort

---

## Phase 4 — Frontend (Session 4-5, ~3-4h)

**Ziel:** Funktionierendes UI das die System-Qualität zeigt — TypeScript strict.

- [ ] Next.js 14 App Router Setup + Tailwind, TypeScript strict mode
- [ ] Layout: Sidebar links (Quellen) + Chat rechts
- [ ] `UploadZone` — Drag & Drop, startet Polling auf Job-Status
- [ ] `SourcesList` — Dokumente mit Status-Indicator (processing/ready/failed), löschbar
- [ ] `ChatPanel` — Streaming-Antwort live rendern (SSE consumer)
- [ ] `SourceBadge` — Klickbare Quellenangabe ("📄 doc.pdf, S.3")
- [ ] Typed API-Client (keine any's)
- [ ] Error States: Upload fehlgeschlagen, LLM nicht erreichbar, Dokument noch nicht ready

**Erfolgskriterium:** Vollständiger Flow, Streaming sichtbar, alle Error States behandelt

---

## Phase 5 — Docker + Polish + Abgabe (Session 6, ~2h)

**Ziel:** Ein Command, alles läuft. Abgabe-ready.

- [ ] `docker-compose.yml` — named Volumes (chroma_data, uploads_data, audit_data), health checks
- [ ] `Dockerfile` backend + frontend
- [ ] `Makefile` — `make dev`, `make test`, `make lint`, `make backup`, `make restore`
- [ ] `README.md` — `docker compose up`, fertig. Features, Screenshot, Architektur-Übersicht
- [ ] `.env.example` — DSGVO-Hinweis bei Cloud-LLM-Providern dokumentiert
- [ ] ARCHITECTURE.md finalisieren
- [ ] Loom-Video aufnehmen (5-8 Min):
  - `docker compose up` zeigen — ein Command
  - PDF hochladen → Status-Polling live sehen
  - 2-3 Fragen stellen → Streaming + Quellenangaben
  - "Nicht gefunden"-Case demonstrieren
  - Dokument löschen → Hard Delete erklären (DSGVO)
  - 2 Min: Architektur erklären — async, streaming, provider abstraction, audit log
- [ ] GitHub Repo public schalten
- [ ] E-Mail schreiben

---

## Tech Stack

| Komponente | Technologie | Warum |
|---|---|---|
| Frontend | Next.js 14 + Tailwind + TS strict | Typsicher, kein any |
| Backend | Python + FastAPI (async) | Native async, beste KI-Libs |
| Config | Pydantic Settings | Typisiert, validiert, selbstdokumentierend |
| PDF-Parser | PyMuPDF (fitz) | Schnell, Seitennummern |
| Chunking | Eigenimplementierung | Keine LangChain-Blackbox |
| Embeddings | sentence-transformers | Lokal, kostenlos, kein API-Key |
| Vektorstore | ChromaDB | Lokal, persistent, Metadaten-Filterung |
| LLM | Groq / OpenAI / Ollama (abstrakt) | Provider-agnostisch |
| Streaming | Server-Sent Events (SSE) | Standard, kein WebSocket-Overhead |
| Audit-Log | JSON Lines (append-only) | Nachvollziehbar, backupbar, kein Content |
| Deployment | Docker Compose + named Volumes | Ein Command, backupbar |
| Developer UX | Makefile | dev / test / lint / backup / restore |
