# Makefile for neo-dashboard
# Usage: make <target>

.PHONY: help install dev start prod env-example health

help:
	@echo "Available targets:"
	@echo "  install       Install dependencies (uses npm ci if package-lock.json exists)"
	@echo "  dev           Start development server (nodemon)"
	@echo "  start         Start the app (uses npm start)"
	@echo "  prod          Run in production mode (requires GATEWAY_PASSWORD env var)"
	@echo "  env-example   Copy .env.example to .env (safe no-overwrite)"
	@echo "  health        Run a healthcheck against http://localhost:3000/api/health"

install:
	@if [ -f package-lock.json ]; then \
		echo "Installing with npm ci (package-lock.json found)"; \
		npm ci; \
	else \
		echo "Installing with npm install"; \
		npm install; \
	fi

dev:
	npm run dev

start:
	npm run start

prod:
	@if [ -z "$(GATEWAY_PASSWORD)" ]; then \
		echo "ERROR: GATEWAY_PASSWORD must be set for production run. Example: make prod GATEWAY_PASSWORD=\"yourpass\""; exit 1; \
	fi
	NODE_ENV=production GATEWAY_PASSWORD="$(GATEWAY_PASSWORD)" npm run start

env-example:
	@if [ -f .env ]; then \
		echo ".env already exists — skipping"; \
	else \
		cp .env.example .env && echo "Created .env from .env.example"; \
	fi

health:
	@echo "Checking http://localhost:3000/api/health";
	@curl -fsS --max-time 5 http://localhost:3000/api/health || echo "Healthcheck failed or server not running"
