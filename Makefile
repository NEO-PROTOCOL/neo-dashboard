# 🛰️ NΞØ PROTOCOL // Dashboard Makefile
# Control Center for Mission Control Deployment

.PHONY: help install dev start prod kill-port setup-ipfs doctor clean-env health clean

clean:
	@echo "🧹 Cleaning project..."
	@rm -rf node_modules package-lock.json
	@echo "✅ Cleaned. Run 'make install' to restore."

# Default Port
PORT ?= 3000

help:
	@echo "🛰️  NΞØ DASHBOARD COMMANDS"
	@echo "-------------------------"
	@echo "  make install      - Install dependencies safely"
	@echo "  make dev          - Start development mode (with auto-kill on port 3000)"
	@echo "  make start        - Start the production server"
	@echo "  make kill-port    - Kill any process running on port $(PORT)"
	@echo "  make setup-ipfs   - Configure IPFS CORS and API Port (5001)"
	@echo "  make doctor       - Run system diagnostics"
	@echo "  make clean-env    - Re-create neo-config.env from .env"
	@echo "  make health       - Check if server is responding"

install:
	@echo "📦 Installing dependencies..."
	@npm install

kill-port:
	@echo "🔫 Killing process on port $(PORT)..."
	@lsof -t -i :$(PORT) | xargs kill -9 || echo "No process found on port $(PORT)"

dev: kill-port
	@echo "🚀 Starting Dashboard in DEV mode..."
	npm run dev

start: kill-port
	@echo "🌐 Starting Dashboard in PROD mode..."
	npm start

setup-ipfs:
	@echo "🔗 Configuring IPFS for NΞØ Dashboard..."
	@ipfs config Addresses.API /ip4/127.0.0.1/tcp/5001
	@ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["webui://-", "http://localhost:$(PORT)", "http://127.0.0.1:5001", "https://webui.ipfs.io"]'
	@ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "POST"]'
	@echo "✅ IPFS Configured. Please restart IPFS Desktop."

doctor:
	@echo "🩺 Running NΞØ System Diagnostics..."
	@node -v | grep "v22" && echo "✅ Node.js v22 detected" || echo "⚠️ Node.js version mismatch"
	@ls neo-config.env > /dev/null && echo "✅ neo-config.env found" || echo "❌ neo-config.env MISSING"
	@ipfs version && echo "✅ IPFS (Kubo) installed" || echo "❌ IPFS MISSING"
	@ipfs id > /dev/null && echo "✅ IPFS Daemon online" || echo "❌ IPFS Daemon OFFLINE"

clean-env:
	@echo "🧹 Cleaning and fixing Environment..."
	@cat .env > neo-config.env || echo "⚠️ Could not read .env, using manual keys"
	@echo "✅ neo-config.env refreshed"

health:
	@echo "🚑 Checking Mission Control Health..."
	@curl -fsS --max-time 5 http://localhost:$(PORT)/api/health || echo "❌ Server status: UNREACHABLE"
