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
server.js              # Main Express server entrypoint
src/
  routes/              # API route modules
  lib/                 # Shared runtime integrations/utilities
public/                # HTML/CSS/static frontend surface
scripts/               # Ecosystem graph sync and local utilities
docs/                  # Active documentation
archive/               # Legacy UI/code kept out of runtime paths
```

## How to Build & Test

```bash
pnpm install
pnpm start         # Express server
pnpm run dev       # Dev with watch
```

## Key Patterns

### Adding a New Route

1. Create `src/routes/<domain>-routes.js`
2. Use Express Router with ESM exports
3. Use the connection manager for external services
4. Register in main `server.js`

### Connection Manager

- All external connections go through `src/lib/connection-manager.js`
- Never create ad-hoc connections to services
- Handles reconnection and pooling

## Rules

- ESM modules only (import/export, not require)
- Use connection manager for all external services
- Never modify ecosystem graph data manually
- Authenticate all API endpoints
- Rate limit public endpoints

## PNPM Boundary and Canonical Inputs

- PNPM runtime/store may be shared by the parent workspace, but this dashboard owns its `package.json`, lockfile and
  `node_modules`. Run `pnpm install --frozen-lockfile` only in this repository; never repair a sibling project while
  validating the dashboard.
- Execute release checks with the Node version managed by mise that satisfies the repository engine contract.
- `pnpm build` regenerates the ignored visual graph from the canonical orchestrator endpoint. Do not commit a generated
  graph snapshot.
- Readiness data comes from the canonical orchestrator report. Keep `stack-report.json` only as a deploy fallback and
  regenerate it from the orchestrator before release.
