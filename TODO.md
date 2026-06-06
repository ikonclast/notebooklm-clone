# TODO

## Vor Abgabe

- [x] **Export ohne Docker verifiziert** (2026-06-06).
  Backend im venv (`pip install torch --index-url …/cpu` + `requirements.txt`,
  `uvicorn`), Frontend `npm run dev`. Voller Flow grün: Upload → Vorschläge →
  Chat (groq) → Quellen-Link → Löschen. `pytest` 17/17 im venv (Python 3.13).
  Daten persistent in `backend/data/`, lokaler `/api`-Proxy greift
  (BACKEND_URL Default `http://localhost:8000`). README-Lokalsetup ergänzt
  (CPU-torch + Modell-Download zur Laufzeit).

## Daueranforderung (bei jeder Änderung beachten)

- Keine Docker-only-Annahmen einbauen. Jeder neue Pfad / jede neue Abhängigkeit
  muss auch im reinen `pip`/`npm`-Betrieb funktionieren und dokumentiert sein.

---

_Beobachtungen, die nur dokumentiert sind (kein geplantes To-do):_
_Confidence-Threshold-Verhalten bei sehr kleinen Dokumenten — siehe_
_`ARCHITECTURE.md` → „Bekannte Grenzen". Wird ggf. später mit echten Daten_
_betrachtet, aber aktuell nicht eingeplant._
