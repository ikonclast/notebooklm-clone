# Design Brief — NotebookLM Clone

> Handoff für die UI-Gestaltung (z. B. via Claude Design). Beschreibt jede
> Komponente, jeden Zustand und die **echten** Datenfelder aus dem Backend,
> damit das Design 1:1 zur API passt. Markenneutral, kein Firmen-Branding.

**Ziel:** UI für einen NotebookLM-Klon (Dokumenten-Q&A mit Quellenangaben).
**Erkennbar NotebookLM in Struktur & UX, aber eine saubere, eigene visuelle
Umsetzung — kein Pixel-Copy.** Neutral, modern, ruhig. Stack-Ziel: React +
Tailwind, später in Next.js 14 (App Router, TypeScript strict) integriert.

---

## Produktkern (muss visuell im Zentrum stehen)

Das Alleinstellungsmerkmal ist **vertrauenswürdige, geerdete Antworten**: Die KI
antwortet *nur* aus den hochgeladenen Dokumenten und zeigt zu jeder Antwort
**klickbare Quellenangaben** (Datei + Seite + Textausschnitt). Findet sie nichts,
sagt sie das ehrlich. Diese Ehrlichkeit + die Zitate sind der „Wow"-Moment — gib
ihnen visuelles Gewicht.

---

## Layout (Zwei-Spalten + Header)

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: Name "NotebookLM Clone" (dezent)                │
├──────────────────┬──────────────────────────────────────┤
│  SIDEBAR (links) │  CHAT-PANEL (rechts)                  │
│  "Quellen"       │                                       │
│  [+ Hochladen]   │  Nachrichtenverlauf (scrollt)         │
│                  │   - User-Bubble                       │
│  📄 vertrag.pdf  │   - Antwort + Quellen-Chips darunter  │
│     ● ready      │                                       │
│  📄 bericht.pdf  │  ─────────────────────────────────    │
│     ◐ processing │  [ Frage eingeben…        ] [Senden]  │
│  📄 scan.pdf     │                                       │
│     ✕ failed     │                                       │
└──────────────────┴──────────────────────────────────────┘
```

Breakpoints: Desktop zweispaltig; Mobile → Sidebar als ein-/ausklappbares Panel.

---

## Komponenten & alle Zustände

### 1. UploadZone (in der Sidebar)
- Drag & Drop + Klick-zum-Auswählen
- Akzeptiert **nur PDF & TXT**, max **20 MB**
- Fehler-Toasts: „Datei zu groß (max. 20 MB)" (413), „Nicht unterstützter
  Dateityp" (415)

### 2. SourcesList (Dokumentliste, jede Zeile)
- Icon + Dateiname + Status-Indikator. Vier Status:
  - `processing` → Spinner + Stage-Text (z. B. „Embedding…")
  - `ready` → grüner Punkt, **auswählbar** (Checkbox/Toggle) für den Chat
  - `failed` → roter Indikator + Fehlermeldung sichtbar
  - `pending` → neutraler „in Warteschlange"-Zustand
- Pro Dokument ein **Löschen**-Button (Mülleimer)
- **Leerzustand**: „Noch keine Quellen — lade ein PDF oder TXT hoch, um zu starten."

### 3. ChatPanel (rechts)
- Nachrichtenverlauf: User-Frage + KI-Antwort
- **Antwort baut sich live Token-für-Token auf** (Streaming) — „tippt"-Cursor
  während des Streamens
- Unter jeder Antwort: **Quellen-Chips** (s. u.)
- **Leerzustand**: einladender Start-Screen, ggf. Beispiel-Fragen
- **Eingabe**: Textfeld + Senden-Button; deaktiviert/Hinweis, wenn **kein
  Dokument ausgewählt** ist
- Spezialfall „nicht gefunden": Antwort *„Diese Information ist in deinen
  Dokumenten nicht vorhanden."* — sichtbar anders als eine normale Antwort
  (dezenter „kein Treffer"-Stil), **ohne** Quellen-Chips

### 4. SourceBadge / Quellen-Chip ⭐ (Schlüsselkomponente)
- Kompakt: `📄 vertrag.pdf · S. 3` (+ optional kleiner Score)
- **Klickbar** → klappt den **Textausschnitt** (Excerpt) auf, der die Antwort
  belegt
- Mehrere Chips pro Antwort möglich

### 5. Fehler-/Randzustände
- Backend nicht erreichbar beim Chat → freundliche Fehlermeldung statt Absturz
- Streaming unterbrochen → Hinweis
- Upload fehlgeschlagen (Netz / 413 / 415)

---

## Echte Datenformen (so liefert das Backend — bitte exakt verwenden)

```ts
// Dokument-Status (GET /documents, GET /documents/{id}/status)
type JobStatus = {
  document_id: string;
  filename: string;
  status: "pending" | "processing" | "ready" | "failed";
  stage: "queued" | "parsing" | "chunking" | "embedding" | "storing" | "done" | null;
  pages: number;
  chunks: number;
  error_message: string | null;
};

// Quelle (kommt im SSE "sources"-Event als Array)
type Source = { filename: string; page: number; excerpt: string; score: number };
```

### API-Vertrag (Referenz)
- `POST /documents` (multipart `file`) → `202 { job_id, status }`
- `GET /documents` → `JobStatus[]`
- `GET /documents/{id}/status` → `JobStatus`
- `DELETE /documents/{id}` → `204`
- `POST /chat` mit `{ query: string, document_ids: string[] }` → **SSE-Stream**

### Chat-Stream-Protokoll (SSE)
Nacheinander:
```
event: sources   data: Source[]
event: token     data: { "text": "…" }     (viele)
event: done      data: {}
event: error     data: { "message": "…" }  (nur im Fehlerfall, statt/vor done)
```

---

## Gestalterische Leitplanken
- Ruhig, fokussiert, viel Weißraum, klare Typo-Hierarchie. **Ein** durchgezogenes
  Theme (Light empfohlen; optional Dark).
- Status-Farben sparsam & eindeutig (ready / processing / failed).
- Lesbarkeit von Antwort + Quellen hat Priorität über Deko.
- Outline-Icons, keine verspielten KI-Klischees.

---

## Erwartetes Ergebnis
- Hauptansicht (Sidebar + Chat) **mit befüllten Beispieldaten** und **allen
  Zuständen**: processing / ready / failed, Streaming-Antwort mit aufgeklappten
  Quellen-Chips, Leerzustände, „nicht gefunden", Upload-Fehler.
- Sauberes React + Tailwind (Komponenten getrennt), damit es direkt in Next.js
  übernommen werden kann.
