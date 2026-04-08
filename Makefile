# Ξ NΞØ PROTOCOL // Dashboard Makefile
# Control Center for Mission Control Deployment

.PHONY: help install dev start kill-port setup-ipfs doctor clean-env health clean build test sync-ecosystem-graph validate-ecosystem-graph tunnel-neo-agent tunnel-flowpay tunnel-nexus tunnel-neobot tunnel-neobot-orchestration tunnel-status

# Default Port
PORT ?= 3000
TUNNEL_SERVICE_NEOBOT ?= neobot-orchestration

help:
	@echo "Ξ  NΞØ DASHBOARD COMMANDS"
	@echo "-------------------------"
	@echo "  make install      - Install dependencies safely"
	@echo "  make build        - Refresh the ecosystem graph artifact"
	@echo "  make test         - Run the Node test suite"
	@echo "  make dev          - Start development mode (with auto-kill on port 3000)"
	@echo "  make start        - Start the production server"
	@echo "  make sync-ecosystem-graph     - Sync graph data into the dashboard artifact"
	@echo "  make validate-ecosystem-graph - Validate graph consistency before publish"
	@echo "  make kill-port    - Kill any process running on port $(PORT)"
	@echo "  make setup-ipfs   - Configure IPFS CORS and API Port (5001)"
	@echo "  make doctor       - Run system diagnostics"
	@echo "  make clean-env    - Re-create neo-config.env from .env"
	@echo "  make health       - Check if server is responding"
	@echo ""
	@echo "  Tunnel Operations (NΞØ Tunnel)"
	@echo "    tunnel-neo-agent   Start tunnel for WhatsApp/TG Agent (8042)"
	@echo "    tunnel-flowpay     Start tunnel for FlowPay Gateway (4321)"
	@echo "    tunnel-nexus       Start tunnel for Protocol Nexus (3000)"
	@echo "    tunnel-neobot      Start tunnel for neobot-orchestration (19000)"
	@echo "    tunnel-neobot-orchestration  Explicit target for neobot-orchestration"
	@echo "    tunnel-status      Check status of the tunnel server"
	@echo ""

install:
	@echo "⦿ Installing dependencies..."
	@pnpm install

build:
	@echo "🏗 Building project..."
	@pnpm run build
	@echo "✓ Build complete."

test:
	@echo "🧪 Running test suite..."
	@pnpm test

sync-ecosystem-graph:
	@echo "🕸 Syncing ecosystem graph..."
	@pnpm run sync:ecosystem-graph

validate-ecosystem-graph:
	@echo "🔎 Validating ecosystem graph..."
	@pnpm run validate:ecosystem-graph

clean:
	@echo "🧹 Cleaning project..."
	@rm -rf node_modules
	@echo "✓ Cleaned. Lockfile preserved. Run 'make install' to restore."

kill-port:
	@echo "🔫 Killing process on port $(PORT)..."
	@lsof -t -i :$(PORT) | xargs kill -9 || echo "No process found on port $(PORT)"

dev: kill-port
	@echo "⟠ Starting Dashboard in DEV mode..."
	pnpm run dev

start: kill-port
	@echo "⨂ Starting Dashboard in PROD mode..."
	pnpm start

setup-ipfs:
	@echo "🔗 Configuring IPFS for NΞØ Dashboard..."
	@ipfs config Addresses.API /ip4/127.0.0.1/tcp/5001
	@ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["webui://-", "http://localhost:$(PORT)", "http://127.0.0.1:5001", "https://webui.ipfs.io"]'
	@ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "POST"]'
	@echo "✓ IPFS Configured. Please restart IPFS Desktop."

doctor:
	@echo "🩺 Running NΞØ System Diagnostics..."
	@node -v | grep "v22" && echo "✓ Node.js v22 detected" || echo "⧖ Node.js version mismatch"
	@ls neo-config.env > /dev/null && echo "✓ neo-config.env found" || echo "✗ neo-config.env MISSING"
	@ipfs version && echo "✓ IPFS (Kubo) installed" || echo "✗ IPFS MISSING"
	@ipfs id > /dev/null && echo "✓ IPFS Daemon online" || echo "✗ IPFS Daemon OFFLINE"

clean-env:
	@echo "🧹 Cleaning and fixing Environment..."
	@cat .env > neo-config.env || echo "⧖ Could not read .env, using manual keys"
	@echo "✓ neo-config.env refreshed"

health:
	@echo "◬ Checking Mission Control Health..."
	@curl -fsS --max-time 5 http://localhost:$(PORT)/health || echo "✗ Server status: UNREACHABLE"

# --- TUNNEL OPERATIONS -------------------------------------------------------

tunnel-neo-agent:
	@cd ../neo-tunnel && set -a && [ -f .env ] && . ./.env || true && set +a && \
		[ -n "$$TUNNEL_SECRET" ] || (echo "❌ TUNNEL_SECRET não definido (../neo-tunnel/.env ou env atual)" && exit 1) && \
		$(MAKE) client-neo-agent TUNNEL_SECRET="$$TUNNEL_SECRET" NEO_TUNNEL_URL="$${NEO_TUNNEL_URL:-wss://tunnel.neoprotocol.space}"

tunnel-flowpay:
	@cd ../neo-tunnel && set -a && [ -f .env ] && . ./.env || true && set +a && \
		[ -n "$$TUNNEL_SECRET" ] || (echo "❌ TUNNEL_SECRET não definido (../neo-tunnel/.env ou env atual)" && exit 1) && \
		$(MAKE) client-flowpay TUNNEL_SECRET="$$TUNNEL_SECRET" NEO_TUNNEL_URL="$${NEO_TUNNEL_URL:-wss://tunnel.neoprotocol.space}"

tunnel-nexus:
	@cd ../neo-tunnel && set -a && [ -f .env ] && . ./.env || true && set +a && \
		[ -n "$$TUNNEL_SECRET" ] || (echo "❌ TUNNEL_SECRET não definido (../neo-tunnel/.env ou env atual)" && exit 1) && \
		$(MAKE) client-nexus TUNNEL_SECRET="$$TUNNEL_SECRET" NEO_TUNNEL_URL="$${NEO_TUNNEL_URL:-wss://tunnel.neoprotocol.space}"

tunnel-neobot:
	@$(MAKE) tunnel-neobot-orchestration

tunnel-neobot-orchestration:
	@echo "🚇 Tunnel → $(TUNNEL_SERVICE_NEOBOT) (localhost:19000)"
	@echo "  Webhook: https://tunnel.neoprotocol.space/hook/$(TUNNEL_SERVICE_NEOBOT)"
	@cd ../neo-tunnel && set -a && [ -f .env ] && . ./.env || true && set +a && \
		[ -n "$$TUNNEL_SECRET" ] || (echo "❌ TUNNEL_SECRET não definido (../neo-tunnel/.env ou env atual)" && exit 1) && \
		NEO_TUNNEL_URL=$${NEO_TUNNEL_URL:-wss://tunnel.neoprotocol.space} \
		TUNNEL_SECRET=$$TUNNEL_SECRET TUNNEL_SERVICE=$(TUNNEL_SERVICE_NEOBOT) LOCAL_PORT=19000 \
		npx tsx src/client.ts

tunnel-status:
	@cd ../neo-tunnel && $(MAKE) status
