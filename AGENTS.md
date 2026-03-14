# AGENTS.md — neo-dashboard

## Project Overview
Premium dashboard for NEO BOT with Express API, 3D ecosystem visualization, monitoring, and IPFS integration.

## Tech Stack
- **Backend**: Node.js + Express (ESM)
- **Frontend**: Multi-page HTML/CSS/JS
- **IPFS**: kubo-rpc-client
- **Deploy**: Railway

## Repository Structure
```
server.js         # Main Express server
routes/
  ai-routes.js
  automation-routes.js
  neo-routes.js
  report-routes.js
  nexus-routes-v2.js
public/           # HTML frontend pages
scripts/          # Ecosystem graph sync
lib/              # Connection manager, monitoring
```

## How to Build & Test
```bash
npm install
npm start         # Express server
npm run dev       # Dev with watch
```

## Key Patterns

### Adding a New Route
1. Create `routes/<domain>-routes.js`
2. Use Express Router with ESM exports
3. Use the connection manager for external services
4. Register in main `server.js`

### Connection Manager
- All external connections go through `lib/connection-manager.js`
- Never create ad-hoc connections to services
- Handles reconnection and pooling

## Rules
- ESM modules only (import/export, not require)
- Use connection manager for all external services
- Never modify ecosystem graph data manually
- Authenticate all API endpoints
- Rate limit public endpoints
