# NotebookLM Clone — Architecture & Decision Log

> Dokumentiert bewusste Entscheidungen, Alternativen und Tradeoffs.
> Dies ist kein Tutorial — es ist ein Designdokument.

---

## Was gebaut wird

Ein RAG-basiertes Dokumenten-Q&A-System. Nutzer laden Dokumente hoch,
stellen Fragen und bekommen Antworten mit präzisen Quellenangaben —
ausschließlich basierend auf den hochgeladenen Quellen.

## Systemqualitäten (Non-Functional Requirements)

Diese Eigenschaften sind keine Features — sie sind Grundanforderungen.

| Qualität | Umsetzung im System |
|---|---|
| **Backupbar** | Named Docker Volumes, `make backup` exportiert Snapshot |
| **Auditierbar** | Audit-Log für alle kritischen Aktionen (append-only JSON Lines) |
| **Logbar** | Strukturiertes JSON-Logging, Request-IDs, kein sensitiver Content in Logs |
| **Wartbar** | Clean Architecture, Dependency Injection, Custom Exceptions, Type Safety |
| **Erweiterbar** | Protocol-Interfaces für VectorStore und LLM — neue Provider = eine Datei |
| **DSGVO-konform** | Hard Delete, kein Content in Logs, LLM-Provider als Datenschutzentscheidung |

---

## Was bewusst NICHT gebaut wird (und warum)

| Feature | Warum nicht |
|---|---|
| Audio Overview | Aufwendige TTS + Dialoggenerierung — kein Kernwert für diesen Prototyp |
| YouTube / Web-Import | Scope Creep — PDF + TXT deckt 80% realer Use Cases ab |
| Google Docs Integration | OAuth-Komplexität rechtfertigt den Aufwand hier nicht |
| Sharing / Collaboration | Infrastruktur-Feature, kein Produkt-Feature |
| Mehrere Notebooks | Kommt nach dem MVP — Datenmodell ist bereits darauf vorbereitet |

---

## System-Architektur

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Next.js)               │
│  ┌─────────────┐  ┌──────────────────────────────┐  │
│  │  Sidebar    │  │        Chat Panel            │  │
│  │  (Sources)  │  │  [Frage eingeben]            │  │
│  │             │  │  ─────────────────────────── │  │
│  │ 📄 doc1.pdf │  │  Antwort...                  │  │
│  │ 📄 doc2.pdf │  │  ┌──────────────────────┐    │  │
│  │             │  │  │ Quelle: doc1.pdf, S.3│    │  │
│  └─────────────┘  │  └──────────────────────┘    │  │
│                   └──────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         │ HTTP
┌─────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                │
│                                                     │
│   Upload-Flow:                                      │
│   PDF/TXT → Parser → Chunker → Embedder → ChromaDB  │
│                                                     │
│   Query-Flow:                                       │
│   Frage → Embedder → ChromaDB (Top-K) → LLM → Antwort + Quellen │
└─────────────────────────────────────────────────────┘
```

---

## Entscheidung 1: Chunking-Strategie

**Problem:** Naives Chunking (alle N Zeichen) zerschneidet Sätze und verliert Kontext.

**Entschieden:** Paragraph-basiertes Chunking mit Overlap
- Absatzgrenzen respektieren (kein Satz wird durchgetrennt)
- 10-15% Overlap zwischen aufeinanderfolgenden Chunks
- Ziel-Chunk-Größe: ~400-600 Tokens

**Alternative verworfen:** RecursiveCharacterTextSplitter von LangChain
— funktioniert, aber versteckt die Entscheidung. Eigene Implementierung
macht das Verhalten explizit und kontrollierbar.

**Konsequenz:** Etwas mehr Code, aber vollständige Kontrolle über
Chunk-Grenzen und Metadaten.

---

## Entscheidung 2: Metadaten-Modell

Jeder Chunk speichert:
```python
{
    "document_id": str,      # UUID des Dokuments
    "filename": str,         # Originalname
    "page": int,             # Seitennummer (bei PDF)
    "chunk_index": int,      # Position im Dokument
    "char_start": int,       # Zeichenposition Start
    "char_end": int,         # Zeichenposition Ende
}
```

**Warum:** Ermöglicht exakte Quellenangaben ("doc.pdf, Seite 3").
Ohne diese Metadaten ist "Quelle: Dokument 1" die einzige Möglichkeit —
das ist nicht besser als kein RAG.

---

## Entscheidung 3: Grounding-Constraint

**Das Kernversprechen von NotebookLM:** Die KI antwortet NUR aus den Quellen.
Kein Allgemeinwissen, keine Spekulationen.

**Umsetzung via System Prompt:**
> "Du bist ein präziser Dokumenten-Assistent. Beantworte Fragen
> ausschließlich basierend auf den bereitgestellten Quellen.
> Wenn die Antwort nicht in den Quellen enthalten ist, sage klar:
> 'Diese Information ist in deinen Dokumenten nicht vorhanden.'
> Halluziniere niemals. Zitiere immer die Quelle."

**Warum wichtig:** Ohne diesen Constraint ist es ein normaler Chatbot
mit Kontext-Padding. Mit diesem Constraint wird es ein verlässliches Tool.

---

## Entscheidung 4: Confidence Threshold

Wenn die Ähnlichkeit der besten Treffer unter einem Threshold liegt
(z.B. cosine similarity < 0.3), wird KEINE LLM-Anfrage gemacht.
Stattdessen: direkte Antwort "Nicht in deinen Quellen gefunden."

**Warum:** Verhindert, dass das LLM bei irrelevanten Retrieval-Ergebnissen
trotzdem halluziniert. Spart API-Kosten. Macht das System ehrlicher.

**Zur Kalibrierung:** Der Wert 0.3 ist ein sinnvoller Startwert für `all-MiniLM-L6-v2`,
aber nicht universell gültig. Cosine-Similarity-Verteilungen hängen vom Embedding-Modell
und Dokumenttyp ab. Der richtige Ansatz für ein Produktivsystem: Testset mit bekannten
Fragen aufbauen und den Threshold per F1-Score (Precision/Recall) empirisch optimieren.
Der Wert ist daher als `confidence_threshold` in Pydantic Settings konfigurierbar —
nicht hart kodiert.

---

## Entscheidung 5: LLM Provider Abstraction

```
LLM_PROVIDER=groq     → Groq API (Llama 3.3 70B) — Standard, schnell
LLM_PROVIDER=openai   → OpenAI GPT-4o-mini
LLM_PROVIDER=ollama   → lokales Modell via Ollama
```

**Warum:** Keine Vendor-Lock-in. Demo läuft mit Groq (kostenlos, schnell),
aber das System ist designed um mit jedem OpenAI-kompatiblen Endpoint zu laufen.
Ollama-Support zeigt, dass lokale/private Deployments möglich sind.

---

## Entscheidung 6: Kein LangChain

LangChain wäre 10x schneller zu schreiben. Bewusst nicht verwendet, weil:
1. Die RAG-Pipeline ist das Herzstück — sie sollte lesbar und explizit sein
2. LangChain abstrahiert genau die Entscheidungen weg, die hier dokumentiert sind
3. Eigene Implementierung zeigt Verständnis des Systems, nicht nur Kenntnis einer Library

---

## Entscheidung 6b: Kein Claude API native Document Support

**Verworfene Alternative:** Claude's File API ermöglicht es, PDFs direkt hochzuladen und ohne
eigene Embedding-Pipeline zu befragen — einfacher zu implementieren, weniger Infrastruktur.

**Warum verworfen:**
1. **Vendor-Lock-in:** Das System läuft nur mit Anthropic-Zugang. Keine lokale Alternative möglich.
2. **DSGVO:** Dokumenteninhalt verlässt bei Cloud-Providern immer die eigene Infrastruktur.
   Mit der eigenen RAG-Pipeline + Ollama ist ein vollständig lokales Deployment möglich.
3. **Quellenangaben:** Claude's File API gibt keine Chunk-Level-Quellenangaben zurück —
   das zentrale Feature ("doc.pdf, Seite 3") wäre nicht ohne eigene Implementierung realisierbar.
4. **Demonstrierbarkeit:** Die eigene RAG-Pipeline ist das Herzstück das erklärt und bewertet werden kann.
   Eine Black-Box-API zeigt kein Systemverständnis.

**Was stattdessen:** Provider-Abstraktion mit Ollama-Support als default in Docker Compose —
vollständig lokal, kein Byte verlässt die Infrastruktur.

---

## Entscheidung 7: ChromaDB als Vektorstore

**Warum ChromaDB:**
- Lokal, keine externe Infrastruktur
- Persistenz on disk (kein Neu-Embedden bei Neustart)
- Einfache Metadaten-Filterung

**Alternative:** FAISS — schneller, aber kein Persistence, kein Metadaten-Support out-of-the-box.
**Alternative:** Pinecone/Weaviate — cloud-managed, aber externe Abhängigkeit für einen Prototyp unnötig.
**Alternative:** pgvector (PostgreSQL Extension) — die richtige Wahl wenn bereits PostgreSQL
im Stack ist: ein Service statt zwei, SQL-Joins zwischen Vektoren und relationalen Daten möglich,
production-grade. Für diesen Prototyp ohne relationale Daten (kein User-Management, keine
Notebook-Tabellen) ist ChromaDB schlanker. Bei einem echten Multi-User-System: pgvector + Postgres.

**Concurrency-Hinweis:** ChromaDB embedded (in-process) ist nicht thread-safe bei parallelen
Schreibzugriffen aus mehreren Prozessen. Dieses System läuft bewusst als single-worker
FastAPI-Instanz (`--workers 1`). Das ist für einen Prototyp korrekt. Bei einem Multi-User-System
wäre entweder ChromaDB als separater HTTP-Service oder der Wechsel zu pgvector die richtige Lösung.

---

## Entscheidung 8: Async Document Processing

**Problem:** PDF-Verarbeitung (Parse → Chunk → Embed) dauert je nach Dokumentgröße 5-30 Sekunden.
Ein synchroner Upload-Endpoint würde den HTTP-Request blockieren — schlechte UX, Timeout-Risiko.

**Entschieden:** Upload gibt sofort `202 Accepted` + `job_id` zurück.
Verarbeitung läuft als FastAPI Background Task.
Client pollt `GET /documents/{id}/status` bis `"ready"` oder `"failed"`.

```
POST /documents  →  202 { job_id: "abc123" }
GET  /documents/abc123/status  →  { status: "processing", progress: "embedding" }
GET  /documents/abc123/status  →  { status: "ready" }
```

**Warum wichtig:** So werden echte Systeme gebaut. Blocking HTTP auf CPU-intensive
Arbeit ist ein Anti-Pattern. FastAPI Background Tasks sind dafür genau das richtige Mittel.

---

## Entscheidung 9: Streaming via Server-Sent Events

**Problem:** LLM-Antworten kommen nicht instantan — ohne Streaming wartet der Nutzer
in Stille bis die komplette Antwort fertig ist.

**Entschieden:** SSE (Server-Sent Events) statt vollständige HTTP Response.
Stream-Protokoll: erst ein `sources`-Event mit den Quellenangaben, dann `token`-Events live.

```
event: sources
data: [{"filename": "doc.pdf", "page": 3, "excerpt": "..."}]

event: token
data: {"text": "Laut"}

event: token
data: {"text": " Vertrag..."}

event: done
data: {}
```

**Warum SSE statt WebSocket:** SSE ist unidirektional (Server → Client), einfacher,
kein Handshake-Overhead. Für diesen Use Case ausreichend und die richtige Wahl.

---

## Entscheidung 10: Pydantic Settings für Konfiguration

Alle Konfigurationswerte werden über eine typisierte `Settings`-Klasse verwaltet:

```python
class Settings(BaseSettings):
    llm_provider: Literal["groq", "openai", "ollama"] = "groq"
    groq_api_key: SecretStr
    confidence_threshold: float = Field(0.3, ge=0.0, le=1.0)
    max_file_size_mb: int = Field(20, ge=1, le=100)
    chunk_size_tokens: int = 500
    chunk_overlap_percent: float = 0.15
```

Kein `os.getenv()` verstreut im Code. Validierung beim Start, nicht zur Laufzeit.
Fehlende Pflicht-Werte → Fehler sofort beim Starten, nicht beim ersten Request.

---

## Entscheidung 11: Input Validation als eigene Schicht

Upload-Validierung findet im Backend statt — nicht nur im Frontend:
- Dateigröße-Limit (max_file_size_mb aus Settings)
- Content-Type muss `application/pdf` oder `text/plain` sein
- Korrupte PDFs werden in der Parser-Phase abgefangen → Job-Status "failed" + Fehlermeldung
- Kein blindes Vertrauen auf Dateiendung

**Warum:** Frontend-Validierung ist UX, Backend-Validierung ist Sicherheit.
Beides ist nötig, keines ersetzt das andere.

---

## Entscheidung 12: DSGVO-Konformität

### LLM-Provider-Wahl ist eine Datenschutzentscheidung

Wird Groq oder OpenAI als LLM-Provider genutzt, verlässt der Dokumenteninhalt
die eigene Infrastruktur und wird auf US-amerikanischen Servern verarbeitet.
Für Unternehmen mit sensiblen Dokumenten bedeutet das:
- Auftragsverarbeitungsvertrag (AVV) mit dem Provider erforderlich
- Datentransfer in Drittland (Art. 46 DSGVO) muss abgesichert sein

**Lösung:** Ollama-Support als vollständig lokale Alternative.
Kein Byte verlässt die eigene Infrastruktur. Für DSGVO-kritische Deployments
ist Ollama die richtige Wahl — deshalb ist es Teil der Provider-Abstraktion.

Diese Entscheidung ist in `.env.example` und README dokumentiert.

### Hard Delete — Recht auf Löschung (Art. 17 DSGVO)

`DELETE /documents/{id}` ist ein echtes Hard Delete:
1. Originaldatei vom Dateisystem entfernt
2. Alle Chunks aus ChromaDB gelöscht
3. Job-Status-Eintrag entfernt
4. Audit-Event geschrieben

Es gibt kein Soft-Delete, kein "markiert als gelöscht". Gelöscht bedeutet gelöscht.

### Was niemals geloggt wird

- Dokumenteninhalt (weder in Application- noch Audit-Log)
- Query-Text des Nutzers (potenziell personenbezogene Daten)
- Dateiinhalte in Fehlermeldungen

Was geloggt wird: Metadaten (document_id, filename, size, Anzahl Chunks, Scores, Durations).

---

## Entscheidung 13: Audit-Log

Neben dem Application-Log gibt es einen separaten Audit-Log als append-only JSON Lines Datei.

**Zweck:** Nachvollziehbarkeit aller kritischen Aktionen — wann wurde was hochgeladen,
verarbeitet, abgefragt, gelöscht.

**Audit-Events:**
```json
{"ts": "2025-01-15T10:23:41Z", "event": "document.uploaded",   "document_id": "abc", "filename": "vertrag.pdf", "size_bytes": 204800, "pages": 12}
{"ts": "2025-01-15T10:23:45Z", "event": "document.ready",      "document_id": "abc", "chunks": 47, "duration_ms": 3821}
{"ts": "2025-01-15T10:24:12Z", "event": "chat.queried",        "query_id": "xyz",   "document_ids": ["abc"], "sources_found": 3}
{"ts": "2025-01-15T10:31:05Z", "event": "document.deleted",    "document_id": "abc", "filename": "vertrag.pdf"}
{"ts": "2025-01-15T10:45:22Z", "event": "document.failed",     "document_id": "def", "error_type": "ParseError"}
```

**Bewusst nicht im Audit-Log:**
- Query-Text (Datenschutz)
- Dokumenteninhalt (Datenschutz)
- LLM-Antworten (Datenschutz)

---

## Entscheidung 14: Backup-Strategie

Alle persistenten Daten liegen in named Docker Volumes:
- `chroma_data` — Vektordatenbank + Embeddings
- `uploads_data` — Originaldateien
- `audit_data` — Audit-Log

`make backup` erstellt einen timestamped Snapshot beider Volumes:
```bash
backup/
└── 2025-01-15_10-30-00/
    ├── chroma_data.tar.gz
    ├── uploads_data.tar.gz
    └── audit_data.tar.gz
```

Restore: `make restore BACKUP=2025-01-15_10-30-00`

**Warum wichtig:** Ein System ohne Backup-Strategie ist kein Production-System.
Die Strategie muss dokumentiert und testbar sein — nicht nur "wir könnten es machen".

---

## Entscheidung 15: Ollama in Docker Compose — vollständig selbst-contained

**Ziel:** `docker compose up` startet das gesamte System inklusive lokalem LLM.
Kein externer API-Key erforderlich für den Default-Betrieb.

**Umsetzung via Init-Container-Muster:**

```yaml
ollama:
  image: ollama/ollama
  volumes:
    - ollama_data:/root/.ollama
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
    interval: 10s
    retries: 10

ollama-pull:                          # läuft einmal, dann fertig
  image: ollama/ollama
  depends_on:
    ollama:
      condition: service_healthy
  environment:
    - OLLAMA_HOST=http://ollama:11434
  entrypoint: ["ollama", "pull", "llama3.2:3b"]
  restart: "no"

backend:
  depends_on:
    ollama-pull:
      condition: service_completed_successfully
```

Das `ollama_data`-Volume speichert das Modell persistent: beim zweiten `docker compose up`
ist kein erneuter Download nötig.

**Modellwahl:** `llama3.2:3b` (~2GB) — läuft auf CPU, benötigt ~4GB RAM, ausreichend für
RAG-Anwendungen (das Modell fasst nur retrieved Context zusammen, kein Weltwissen nötig).

**Warum das wichtig ist:** Default `LLM_PROVIDER=ollama` in docker-compose.yml bedeutet:
das System ist out-of-the-box DSGVO-konform. Kein Byte verlässt die Infrastruktur.
Cloud-Provider (Groq, OpenAI) sind opt-in via `.env` — mit explizitem DSGVO-Hinweis.

**Für das Embedding-Modell (sentence-transformers):**
Das Modell wird zur Docker-Build-Zeit heruntergeladen, nicht zur Laufzeit:
```dockerfile
RUN python -c "from sentence_transformers import SentenceTransformer; \
               SentenceTransformer('all-MiniLM-L6-v2')"
```
`docker compose up` startet sofort. Kein Warten auf Downloads nach dem Build.

---

## Entscheidung 16: /api-Proxy als Runtime-Route-Handler statt next.config-Rewrite

Das Frontend spricht das Backend über einen Same-Origin-Proxy `/api/*` an. Naheliegend
wäre ein `rewrites()` in `next.config.mjs` — **funktioniert mit `output: standalone`
aber nicht:** das Rewrite-Ziel wird zur **Build-Zeit** ins Routes-Manifest eingebacken.
Beim `docker build` ist `BACKEND_URL` noch nicht gesetzt, also fror `localhost:8000`
ein und der Container proxyte ins Leere (`ECONNREFUSED`).

Lösung: ein Catch-all Route Handler (`app/api/[...path]/route.ts`), der `BACKEND_URL`
bei **jedem Request** liest und den Response-Body streamt (für das SSE-Chat-Streaming).
So ist die Backend-Adresse eine echte Laufzeit-Konfiguration — lokal `localhost:8000`,
in Compose `http://backend:8000`.

---

## Entscheidung 17: Live-Provider-Wahl & inhaltsbasierte Fragen-Vorschläge

- **Provider-Umschaltung zur Laufzeit:** `ChatRequest.provider` überschreibt pro
  Anfrage den Server-Default; `GET /providers` meldet, welche Provider nutzbar sind
  (Cloud-Key gesetzt bzw. Ollama erreichbar). Das Frontend zeigt nur verfügbare
  Optionen aktiv an — kein Neustart nötig, um das Modell zu wechseln.
- **Vorschläge aus dem Inhalt:** `POST /suggestions` lässt das gewählte LLM aus einem
  Ausschnitt der gewählten Dokumente konkrete Einstiegsfragen generieren — statt
  generischer Platzhalter. Schlägt die Generierung fehl, bleibt die Liste leer (die
  UI degradiert sauber, statt zu brechen). Ohne gewählte Quellen: keine Vorschläge.

---

## Bekannte Grenzen (offen, bewusst dokumentiert)

**Confidence-Threshold vs. Paraphrasen bei kleinen Dokumenten.**
Der Threshold (`CONFIDENCE_THRESHOLD=0.3`) verhindert Halluzinationen: liegt der
beste Retrieval-Score darunter, antwortet das System ehrlich „nicht vorhanden",
statt zu raten. Beobachtung beim Test mit einem *sehr kleinen* Dokument (ein
einziger Chunk mit mehreren Themen): Eine paraphrasierte Frage („Wie lange ist die
Garantie?" gegen den Satz „Die Garantie … beträgt 24 Monate …") kann knapp unter
0.3 fallen und fälschlich als „nicht gefunden" gelten. Grund: Ein Chunk, der mehrere
Themen mischt, ergibt einen gemittelten Embedding-Vektor, der zu einer spezifischen
Frage schwächer passt. Bei realistischen Dokumenten (viele, thematisch engere Chunks)
tritt das deutlich seltener auf.

Status: **Verhalten ist korrekt (lieber ehrlich „nicht gefunden" als halluzinieren).**
Bewusst nicht angepasst — bei realistischen Datenmengen ist das kaum relevant. Falls
es sich später mit echten Daten zeigt, wäre ein leicht niedrigerer Threshold (~0.25)
oder feineres Chunking denkbar; aktuell **nicht eingeplant**, nur hier festgehalten.

**Datenablage ohne Docker.**
Lokal (ohne Docker) liegen Uploads, ChromaDB und Audit-Log persistent unter
`backend/data/` (nicht `/tmp` — das wäre flüchtig). Im Docker-Betrieb überschreiben
Compose/Dockerfile die Pfade auf `/data/*` (gemountete named Volumes). Beide Wege
sind in `backend/.env.example` und `README.md` dokumentiert; das System ist damit
**auch ohne Docker exportierbar und lauffähig**.

---

## Was als nächstes käme (v2)

1. **Hybrid Search** — BM25 (Keyword) + Vektorsuche kombinieren → bessere Treffer
2. **Mehrere Notebooks** — Datenmodell bereits vorbereitet (document_id mit notebook_id verknüpfen)
3. **Reranking** — Cross-Encoder nach initialem Retrieval für höhere Präzision
4. **Streaming** — LLM-Antworten token-by-token streamen (UX)
5. **OCR** — Gescannte PDFs via Tesseract/pymupdf unterstützen
