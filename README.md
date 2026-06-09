# NotebookLM Clone

Ein dokumentengestützter KI-Assistent: PDFs/TXT hochladen, Fragen stellen,
**belegte** Antworten erhalten. Die KI antwortet ausschließlich aus den
hochgeladenen Quellen und zeigt zu jeder Aussage die Fundstelle. Findet sie
nichts, sagt sie es ehrlich — statt zu halluzinieren.

Default-Betrieb ist **vollständig lokal** (Ollama als LLM): kein API-Key, kein
Cloud-Dienst, kein Byte verlässt die Infrastruktur — DSGVO-konform out of the box.

---

## Schnellstart

Einzige Voraussetzung: **Docker** mit Compose-Plugin.

```bash
git clone https://github.com/ikonclast/notebooklm-clone
cd notebooklm-clone
docker compose up
```
Jeder weitere Start ist sofort bereit (kein erneuter Download).
Danach auch im Hintergrund startbar: `docker compose up -d`

Beim **ersten** Start lädt der Stack das lokale Sprachmodell `llama3.2:3b`
(~2 GB) in ein persistentes Volume. Danach:

- Frontend: **http://localhost:3000**
- Backend-API: http://localhost:8000 (Health: `/health`)

Jeder weitere Start ist sofort bereit (kein erneuter Download).

> Kein `.env` nötig. Für Cloud-Provider oder zum Anpassen von Limits:
> `cp .env.example .env` und Werte setzen.

### Systemanforderungen

| Ressource | Empfehlung |
|---|---|
| Docker | aktuelle Version mit `docker compose` |
| RAM | ~4 GB frei (für `llama3.2:3b` auf CPU) |
| Speicher | ~3 GB (Modell + Images) |

---

## Bedienung

1. **Quelle hochladen** — PDF oder TXT per Drag & Drop in die Seitenleiste
   (max. 20 MB). Der Verarbeitungsfortschritt (parsen → chunking → embedding →
   speichern) wird live angezeigt.
2. **Quellen auswählen** — fertige Dokumente ankreuzen. Sind welche gewählt,
   schlägt die App **aus dem Inhalt generierte** Einstiegsfragen vor (keine
   generischen Platzhalter — ohne Quellen gibt es keine Vorschläge).
3. **Modell wählen** — oben rechts live zwischen **Ollama (lokal)**, **Groq** und
   **OpenAI** umschalten. Nicht konfigurierte Provider sind ausgegraut.
4. **Fragen stellen** — die Antwort streamt Wort für Wort, Belege erscheinen als
   anklickbare Quellen-Chips mit Originaltextstelle, Seitenzahl und Score. Über
   den aufgeklappten Beleg öffnet ein Klick das **Originaldokument im neuen Tab,
   direkt auf der zitierten Seite**.
5. **Löschen** — entfernt das Dokument hart (Datei + Embeddings + Audit-Eintrag),
   Recht auf Löschung nach Art. 17 DSGVO.

---

## Architektur (Kurzfassung)

```
Browser ──/api──▶ Next.js (Proxy) ──▶ FastAPI ──▶ ChromaDB (Vektorstore)
                                          │
                                          ├─▶ sentence-transformers (Embeddings, lokal)
                                          └─▶ LLM: Ollama (lokal) | Groq | OpenAI
```

- **RAG-Pipeline:** Upload → PDF/TXT-Parser → Paragraph-Chunking mit Overlap →
  Embeddings (`all-MiniLM-L6-v2`, lokal) → ChromaDB. Bei einer Frage:
  Top-K-Retrieval, Confidence-Schwelle, gegroundeter Prompt, SSE-Streaming.
- **Grounding & Ehrlichkeit:** Liegt der beste Retrieval-Score unter der
  Schwelle, gibt es **keinen** LLM-Call — die App antwortet direkt „nicht
  vorhanden". Das System-Prompt verbietet Antworten außerhalb der Quellen.
- **Async Verarbeitung:** Upload antwortet sofort mit `202` + `job_id`; die
  teure Pipeline läuft als Background-Task, das Frontend pollt den Status.
- **Provider-agnostisch:** Groq, OpenAI und Ollama sind alle OpenAI-API-kompatibel
  — eine Implementierung, nur `base_url`/Key wechseln.
- **Kein LangChain:** Chunking, Retrieval und Prompting sind bewusst eigene,
  nachvollziehbare ~50-Zeilen-Bausteine statt einer Blackbox.

Vollständige Begründungen aller Entscheidungen: **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## LLM-Provider wechseln

Zwei Ebenen:

- **Live im UI** — der Umschalter oben rechts wählt pro Anfrage zwischen Ollama,
  Groq und OpenAI. `GET /providers` meldet, welche Provider nutzbar sind (Key
  gesetzt bzw. Ollama erreichbar); nur die werden anklickbar.
- **Default & Keys** — der Server-Default und die API-Keys kommen aus `.env`:

```bash
# .env
LLM_PROVIDER=ollama      # Vorauswahl im UI
GROQ_API_KEY=gsk_...     # macht Groq im Umschalter verfügbar
OPENAI_API_KEY=sk-...    # macht OpenAI verfügbar
```

> **DSGVO-Hinweis:** Bei `groq` oder `openai` wird der Dokumenteninhalt auf
> US-Servern verarbeitet — ein Auftragsverarbeitungsvertrag (AVV) ist
> erforderlich. `ollama` verarbeitet alles lokal. Der Umschalter weist im Menü
> darauf hin.

---

## Daten & Backup

Alle persistenten Daten liegen in named Docker Volumes (`chroma_data`,
`uploads_data`, `audit_data`, `ollama_data`).

```bash
make backup                              # → backup/<timestamp>/*.tar.gz
make restore BACKUP=2026-06-06_10-30-00  # zurückspielen
make clean                               # Stack + ALLE Daten löschen
```

---

## Lokale Entwicklung (ohne Docker)

```bash
# Backend (venv empfohlen)
cd backend
python3 -m venv .venv && source .venv/bin/activate
# CPU-only torch zuerst — sonst zieht pip auf CPU-Maschinen ~4 GB CUDA-Pakete:
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
uvicorn main:app --reload            # → http://localhost:8000

# Frontend (zweites Terminal)
cd frontend && npm install && npm run dev    # → http://localhost:3000
```

Oder beides parallel: `make dev`. Tests/Qualität: `make test`
(TypeScript-Check + `pytest`), `make lint` (ruff + eslint). Für die Tests vorab
`pip install -r backend/requirements-dev.txt`.

> **Erststart:** Ohne Docker lädt das Embedding-Modell `all-MiniLM-L6-v2`
> (~90 MB) beim ersten Upload einmalig von Hugging Face nach `~/.cache`
> (im Docker-Image ist es vorgebacken). Danach läuft alles offline.

**Datenablage ohne Docker:** Uploads, Vektor-DB und Audit-Log liegen persistent
unter `backend/data/` (gitignored) — bewusst **nicht** `/tmp`, das beim Reboot
verloren ginge. Andere Pfade per `backend/.env` setzen (`UPLOAD_DIR`,
`CHROMA_PATH`, `AUDIT_LOG_PATH`). Im Docker-Betrieb liegen dieselben Daten in den
named Volumes unter `/data/*`. Das System ist damit auch ohne Docker exportierbar
und lauffähig.

---

## Projektstruktur

```
backend/    FastAPI: Upload/Chat-Router, RAG-Services, Config, Audit
frontend/   Next.js 14 (App Router, TS strict): Sidebar, Chat, SSE-Streaming
docker-compose.yml   Ollama (+ Modell-Pull), Backend, Frontend, Volumes
Makefile             up / down / dev / test / lint / backup / restore
ARCHITECTURE.md      Entscheidungs-Log
PLAN.md              Implementierungsleitfaden (15 Blöcke)
```

---

## Makefile-Befehle

| Befehl | Wirkung |
|---|---|
| `make up` | Gesamten Stack starten |
| `make down` | Stoppen (Daten bleiben) |
| `make dev` | Backend + Frontend lokal parallel |
| `make test` | TypeScript-Check + Backend-Import |
| `make lint` | ruff + eslint |
| `make backup` / `make restore` | Volume-Snapshots |
| `make clean` | Stack + alle Volumes löschen |
