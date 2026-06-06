# TODO

## Vor Abgabe

- [ ] **Export ohne Docker verifizieren.**
  Das System **muss exportierbar und ohne Docker lauffähig** sein. In der
  Abgabe-Vorbereitung einmal sauber durchspielen:
  - Backend: `cd backend && pip install -r requirements.txt && uvicorn main:app`
    (Daten landen persistent in `backend/data/`, nicht `/tmp`).
  - Frontend: `cd frontend && npm install && npm run dev`.
  - Voller Flow ohne Container: Upload → Vorschläge → Chat → Quellen → Löschen.
  - Prüfen, dass `make dev` beides startet und der `/api`-Proxy lokal greift
    (BACKEND_URL Default `http://localhost:8000`).

## Daueranforderung (bei jeder Änderung beachten)

- Keine Docker-only-Annahmen einbauen. Jeder neue Pfad / jede neue Abhängigkeit
  muss auch im reinen `pip`/`npm`-Betrieb funktionieren und dokumentiert sein.

---

_Beobachtungen, die nur dokumentiert sind (kein geplantes To-do):_
_Confidence-Threshold-Verhalten bei sehr kleinen Dokumenten — siehe_
_`ARCHITECTURE.md` → „Bekannte Grenzen". Wird ggf. später mit echten Daten_
_betrachtet, aber aktuell nicht eingeplant._
