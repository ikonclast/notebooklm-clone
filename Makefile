# NotebookLM Clone — Developer UX
# Volumes tragen feste Namen (siehe docker-compose.yml), daher sind backup/
# restore unabhängig vom Projektverzeichnis-Namen.

DATA_VOLUMES := chroma uploads audit
BACKUP_ROOT  := backup

.DEFAULT_GOAL := help

.PHONY: help up down logs build rebuild ps clean \
        dev dev-backend dev-frontend test lint backup restore

help: ## Diese Übersicht
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# ── Docker-Stack ────────────────────────────────────────────────────────────
up: ## Gesamten Stack starten (baut bei Bedarf)
	docker compose up --build

down: ## Stack stoppen (Daten bleiben in den Volumes)
	docker compose down

logs: ## Logs aller Services folgen
	docker compose logs -f

build: ## Images bauen ohne zu starten
	docker compose build

rebuild: ## Images ohne Cache neu bauen
	docker compose build --no-cache

ps: ## Status der Services
	docker compose ps

clean: ## Stack + Volumes löschen (ALLE Daten weg — DSGVO-Klarheit)
	docker compose down -v

# ── Lokale Entwicklung (ohne Docker) ────────────────────────────────────────
dev-backend: ## Backend lokal (uvicorn --reload)
	cd backend && uvicorn main:app --reload --port 8000

dev-frontend: ## Frontend lokal (next dev)
	cd frontend && npm run dev

dev: ## Backend + Frontend lokal parallel
	@echo "Backend → :8000 · Frontend → :3000  (Strg-C beendet beide)"
	@trap 'kill 0' INT TERM; \
	 ( cd backend && uvicorn main:app --reload --port 8000 ) & \
	 ( cd frontend && npm run dev ) & \
	 wait

# ── Qualität ────────────────────────────────────────────────────────────────
test: ## TypeScript-Check + Backend-Import-Smoke-Test
	cd frontend && npm run typecheck
	cd backend && python -c "import main; print('backend import OK')"

lint: ## ruff (Python) + eslint (TS) — überspringt fehlende Tools
	@command -v ruff >/dev/null 2>&1 && ruff check backend || echo "ruff nicht installiert — übersprungen"
	cd frontend && npm run lint

# ── Backup / Restore (named Volumes → tar.gz) ───────────────────────────────
backup: ## Snapshot aller Daten-Volumes nach backup/<timestamp>/
	@ts=$$(date +%Y-%m-%d_%H-%M-%S); dir=$(BACKUP_ROOT)/$$ts; mkdir -p $$dir; \
	for v in $(DATA_VOLUMES); do \
	  docker run --rm \
	    -v notebooklm_$${v}_data:/data:ro \
	    -v "$(CURDIR)/$$dir":/backup \
	    alpine tar czf /backup/$${v}_data.tar.gz -C /data . ; \
	done; \
	echo "Backup → $$dir"

restore: ## Aus Snapshot zurückspielen: make restore BACKUP=YYYY-MM-DD_HH-MM-SS
	@test -n "$(BACKUP)" || { echo "Aufruf: make restore BACKUP=<verzeichnis>"; exit 1; }
	@test -d "$(BACKUP_ROOT)/$(BACKUP)" || { echo "Nicht gefunden: $(BACKUP_ROOT)/$(BACKUP)"; exit 1; }
	@for v in $(DATA_VOLUMES); do \
	  docker run --rm \
	    -v notebooklm_$${v}_data:/data \
	    -v "$(CURDIR)/$(BACKUP_ROOT)/$(BACKUP)":/backup:ro \
	    alpine sh -c "rm -rf /data/* && tar xzf /backup/$${v}_data.tar.gz -C /data" ; \
	done; \
	echo "Wiederhergestellt aus $(BACKUP_ROOT)/$(BACKUP)"
